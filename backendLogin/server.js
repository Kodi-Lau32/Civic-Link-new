// Civic Link server: hosts the website and handles login + project submissions.
// Run with: npm start (from backendLogin/), then open http://localhost:3000

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { loadUsers, verifyPassword } = require("./users");

const app = express();
const PORT = process.env.PORT || 3000; // 5000 (macOS AirPlay) and 5500 (Live Server) are usually taken
const ROOT = path.join(__dirname, "..");

// Supabase database that stores projects. Only the server writes to it, after checking the login.
// The secret key can do anything to the database, so it lives in backendLogin/.env (not committed to git)
// instead of here. Copy .env.example to .env and paste your values in.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.warn("⚠️  SUPABASE_URL / SUPABASE_SECRET_KEY aren't set, so saving projects won't work. See backendLogin/.env.example");
}

const SESSION_COOKIE = "civiclink_session";
const SESSION_HOURS = 8;
const sessions = new Map(); // token -> { username, expires } (cleared when the server restarts)

const MAX_FAILED_LOGINS = 10; // per IP, per window
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const failedLogins = new Map(); // ip -> { count, resetAt }

app.use(express.json());

// #region sessions
function getCookie(req, name) {
  const cookies = req.headers.cookie ? req.headers.cookie.split(";") : [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function getSession(req) {
  const token = getCookie(req, SESSION_COOKIE);
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function startSession(req, res, username) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { username, expires: Date.now() + SESSION_HOURS * 3600 * 1000 });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,     // page scripts can't read it
    sameSite: "lax",    // not sent on cross-site POSTs
    secure: req.secure, // https only when hosted with https
    maxAge: SESSION_HOURS * 3600 * 1000,
  });
}

function endSession(req, res) {
  const token = getCookie(req, SESSION_COOKIE);
  if (token) sessions.delete(token);
  res.clearCookie(SESSION_COOKIE);
}

// for API routes: reject with 401
function requireLogin(req, res, next) {
  if (!getSession(req)) return res.status(401).json({ success: false, message: "Please log in." });
  next();
}

// for pages: send to the login page instead
function requireLoginPage(req, res, next) {
  if (!getSession(req)) return res.redirect("/frontend/login.html");
  next();
}
// #endregion

// #region login rate limiting
function tooManyFailedLogins(ip) {
  const entry = failedLogins.get(ip);
  if (!entry || entry.resetAt < Date.now()) return false;
  return entry.count >= MAX_FAILED_LOGINS;
}

function recordFailedLogin(ip) {
  const entry = failedLogins.get(ip);
  if (!entry || entry.resetAt < Date.now()) {
    failedLogins.set(ip, { count: 1, resetAt: Date.now() + FAILED_LOGIN_WINDOW_MS });
  } else {
    entry.count++;
  }
}
// #endregion

// #region API
app.post("/api/login", async (req, res) => {
  if (tooManyFailedLogins(req.ip)) {
    return res.status(429).json({ success: false, message: "Too many attempts. Try again later." });
  }

  const { username, password } = req.body || {};
  const user = loadUsers().find((u) => u.username === username);

  if (user && typeof password === "string" && await verifyPassword(password, user)) {
    failedLogins.delete(req.ip);
    startSession(req, res, user.username);
    res.json({ success: true, message: "Login successful" });
  } else {
    recordFailedLogin(req.ip);
    res.status(401).json({ success: false, message: "Invalid username or password" });
  }
});

app.post("/api/logout", (req, res) => {
  endSession(req, res);
  res.json({ success: true });
});

app.get("/api/session", (req, res) => {
  const session = getSession(req);
  res.json({ loggedIn: !!session, username: session ? session.username : null });
});

// columns the browser may set; id, author, and submitted_at are decided by the server/database
const PROJECT_FIELDS = [
  "name", "description_short", "description_long", "resources", "address", "type", "status", "lng", "lat", "start_date", "end_date",
];

function pick(object, fields) {
  const picked = {};
  fields.forEach((field) => {
    if (object && object[field] !== undefined) picked[field] = object[field];
  });
  return picked;
}

class SupabaseError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// sends a request to the projects table (Supabase's REST API); resolves to the rows it returned/changed
async function projectsRequest(method, query, body) {
  const key = SUPABASE_SECRET_KEY || "";
  const headers = { apikey: key, "Content-Type": "application/json", Prefer: "return=representation" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`; // older service_role keys are JWTs

  const response = await fetch(`${SUPABASE_URL}/rest/v1/projects${query}`, {
    method,
    headers,
    body: body && JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new SupabaseError(response.status, (result && result.message) || `HTTP ${response.status}`);
  return result;
}

// replies to the browser when a database request fails
function sendSaveError(res, error) {
  console.error("Supabase error:", error.message);
  // 400 = the database rejected the data (e.g. an unknown type or status); anything else is our problem
  if (error.status === 400) return res.status(400).json({ success: false, message: error.message });
  res.status(502).json({ success: false, message: "Couldn't save the project." });
}

// new project: the logged-in engineer is recorded as the author
app.post("/api/projects", requireLogin, async (req, res) => {
  const row = pick(req.body, PROJECT_FIELDS);
  row.author = getSession(req).username;
  try {
    const [saved] = await projectsRequest("POST", "", row);
    res.json({ success: true, id: saved.id });
  } catch (error) {
    sendSaveError(res, error);
  }
});

// edit a project; only changes it if its author is the logged-in engineer
app.put("/api/projects/:id", requireLogin, async (req, res) => {
  const id = encodeURIComponent(req.params.id);
  const author = encodeURIComponent(getSession(req).username);
  try {
    const updated = await projectsRequest("PATCH", `?id=eq.${id}&author=eq.${author}`, pick(req.body, PROJECT_FIELDS));
    if (updated.length > 0) return res.json({ success: true, id: req.params.id });

    // nothing changed: either there's no such project, or someone else wrote it
    const existing = await projectsRequest("GET", `?id=eq.${id}&select=id`);
    if (existing.length === 0) return res.status(404).json({ success: false, message: "Project not found" });
    res.status(403).json({ success: false, message: "You can only edit your own projects" });
  } catch (error) {
    sendSaveError(res, error);
  }
});
// #endregion

// #region pages
// only index.html and frontend/ are public (not this folder, .git, etc.)
app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(ROOT, "index.html")));
app.get(["/frontend/submit.html", "/frontend/dashboard.html"], requireLoginPage);
app.use("/frontend", express.static(path.join(ROOT, "frontend")));
// #endregion

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
