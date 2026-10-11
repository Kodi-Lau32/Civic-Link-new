// Civic Link server: hosts the website and handles login + project submissions.
// Run with: npm start (from backendLogin/), then open http://localhost:3000

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const { loadUsers, verifyPassword } = require("./users");

const app = express();
const PORT = process.env.PORT || 3000; // 5000 (macOS AirPlay) and 5500 (Live Server) are usually taken
const ROOT = path.join(__dirname, "..");

// Apps Script that writes to the Google Sheet. Only the server sends to it, after checking the login.
const SUBMIT_URL = process.env.SUBMIT_URL ||
  "https://script.google.com/macros/s/AKfycbx6nM4ig2c6E6yFyk8bKNRXhStCPj7wIPoamrtNYJ57pxi_xC0Ni0qdy0tCBmUs10090A/exec";
// optional: must match the Apps Script's SUBMIT_SECRET script property, if that's set
const SUBMIT_SECRET = process.env.SUBMIT_SECRET || "";

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

// fields the browser may set; author, id, and date are decided by the server/Apps Script
const PROJECT_FIELDS = ["name", "range", "date", "location", "description", "address", "type", "status"];
const EDITABLE_FIELDS = ["name", "range", "location", "description", "address", "type", "status"];

// Apps Script error codes -> HTTP status for the browser
const APPS_SCRIPT_ERRORS = { not_found: 404, forbidden: 403, bad_request: 400 };

function pick(object, fields) {
  const picked = {};
  fields.forEach((field) => {
    if (object && object[field] !== undefined) picked[field] = object[field];
  });
  return picked;
}

// sends a packet to the Apps Script and replies to the browser with the outcome
async function forwardToAppsScript(packet, res, successBody) {
  if (SUBMIT_SECRET) packet.secret = SUBMIT_SECRET;

  try {
    const response = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packet),
    });
    // Apps Script always answers 200, so check the status it reports
    const result = await response.json().catch(() => null);
    if (result && result.status === "success") return res.json({ success: true, ...successBody });

    const message = result ? result.message : `HTTP ${response.status}`;
    console.error("Apps Script error:", message);
    const status = (result && APPS_SCRIPT_ERRORS[result.code]) || 502;
    res.status(status).json({ success: false, message: status === 502 ? "Couldn't save the project." : message });
  } catch (error) {
    console.error("Apps Script request failed:", error);
    res.status(502).json({ success: false, message: "Couldn't save the project." });
  }
}

// new project: the logged-in engineer is recorded as the author
app.post("/api/projects", requireLogin, (req, res) => {
  const packet = pick(req.body, PROJECT_FIELDS);
  packet.id = crypto.randomUUID(); // text id, so the sheet doesn't round it like a big number
  packet.author = getSession(req).username;
  forwardToAppsScript(packet, res, { id: packet.id });
});

// edit a project; the Apps Script only allows it if the project's author is the logged-in engineer
app.put("/api/projects/:id", requireLogin, (req, res) => {
  const packet = pick(req.body, EDITABLE_FIELDS);
  packet.action = "update";
  packet.id = req.params.id;
  packet.author = getSession(req).username;
  forwardToAppsScript(packet, res, { id: packet.id });
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
