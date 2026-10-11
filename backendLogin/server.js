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

// forwards a project to the Apps Script (same packet the browser used to send directly)
app.post("/api/projects", requireLogin, async (req, res) => {
  try {
    const response = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    if (!response.ok) throw new Error(`Apps Script responded ${response.status}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Submit failed:", error);
    res.status(502).json({ success: false, message: "Couldn't save the project." });
  }
});
// #endregion

// #region pages
// only index.html and frontend/ are public (not this folder, .git, etc.)
app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(ROOT, "index.html")));
app.get("/frontend/submit.html", requireLoginPage);
app.use("/frontend", express.static(path.join(ROOT, "frontend")));
// #endregion

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
