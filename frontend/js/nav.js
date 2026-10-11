// Builds the navbar on every page from NAV_LINKS, so adding a page only means editing this list.
// Usage: put <div class="navbar" id="navbar"></div> at the top of <body>.
//        Add data-search to that div to show the Search button.
// The account button on the right shows whether you're logged in (and holds Log in / Log out).

// folder containing the frontend pages, worked out from this script's location
// so links work from both index.html (root) and frontend/*.html
const FRONTEND_DIR = new URL("..", document.currentScript.src);

// loggedIn: true = only shown to logged-in engineers
const NAV_LINKS = [
  { label: "Home", path: "../index.html" },
  { label: "Dashboard", path: "dashboard.html", loggedIn: true },
  { label: "Updates", path: "updates.html" },
  { label: "Submit", path: "submit.html" },
];

// links in the account dropdown when logged in
const ACCOUNT_MENU_LINKS = [
  { label: "Dashboard", path: "dashboard.html" },
  { label: "Submit a project", path: "submit.html" },
];

const PERSON_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6z"/></svg>`;

function pageUrl(path) {
  return new URL(path, FRONTEND_DIR).href;
}

function renderNavbar() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;

  const logo = document.createElement("a");
  logo.className = "home-logo";
  logo.href = pageUrl("../index.html");
  logo.textContent = "CIVIC LINK";

  const links = document.createElement("div");
  links.className = "navbar-icons-flex";

  NAV_LINKS.forEach(({ label, path, loggedIn }) => {
    const link = document.createElement("a");
    link.className = "navbar-icons";
    link.href = pageUrl(path);
    link.textContent = label;
    if (loggedIn) {
      link.classList.add("nav-logged-in");
      link.hidden = true;
    }
    links.appendChild(link);
  });

  if (navbar.hasAttribute("data-search")) {
    const searchButton = document.createElement("button");
    searchButton.className = "search-button";
    searchButton.id = "openSearch";
    searchButton.textContent = "Search";
    links.appendChild(searchButton);
  }

  // filled in by showLoginState() once we know who's logged in
  const account = document.createElement("div");
  account.className = "nav-account";
  account.id = "navAccount";

  navbar.append(logo, links, account);
}

async function showLoginState() {
  const account = document.getElementById("navAccount");
  if (!account) return;

  let session = { loggedIn: false };
  try {
    session = await (await fetch(`${API_URL}/session`)).json();
  } catch {
    // server not reachable; show as logged out
  }

  if (session.loggedIn) {
    document.querySelectorAll(".nav-logged-in").forEach((link) => { link.hidden = false; });
    renderAccountMenu(account, session.username);
  } else {
    renderLoginButton(account);
  }
}

// logged out: person icon + "Log in"
function renderLoginButton(account) {
  const link = document.createElement("a");
  link.className = "nav-account-button";
  link.href = pageUrl("login.html");
  link.title = "Not logged in";

  const icon = document.createElement("span");
  icon.className = "nav-avatar nav-avatar-empty";
  icon.innerHTML = PERSON_ICON;

  link.append(icon, "Log in");
  account.replaceChildren(link);
}

// logged in: avatar with your initial + username, opens a dropdown
function renderAccountMenu(account, username) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nav-account-button";
  button.title = `Logged in as ${username}`;
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");

  const avatar = document.createElement("span");
  avatar.className = "nav-avatar";
  avatar.textContent = username.charAt(0).toUpperCase();
  avatar.style.background = avatarColor(username);

  const name = document.createElement("span");
  name.className = "nav-account-name";
  name.textContent = username;

  button.append(avatar, name);

  const menu = document.createElement("div");
  menu.className = "nav-account-menu";
  menu.hidden = true;

  const header = document.createElement("div");
  header.className = "nav-account-menu-header";
  const strong = document.createElement("strong");
  strong.textContent = username;
  header.append("Logged in as", document.createElement("br"), strong);
  menu.appendChild(header);

  ACCOUNT_MENU_LINKS.forEach(({ label, path }) => {
    const link = document.createElement("a");
    link.href = pageUrl(path);
    link.textContent = label;
    menu.appendChild(link);
  });

  const logout = document.createElement("button");
  logout.type = "button";
  logout.textContent = "Log out";
  logout.addEventListener("click", async () => {
    await fetch(`${API_URL}/logout`, { method: "POST" });
    window.location.href = pageUrl("../index.html");
  });
  menu.appendChild(logout);

  const setOpen = (open) => {
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  };
  button.addEventListener("click", () => setOpen(menu.hidden));
  document.addEventListener("click", (e) => { if (!account.contains(e.target)) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  account.replaceChildren(button, menu);
}

// same color for the same username every time
function avatarColor(username) {
  let hash = 0;
  for (const char of username) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return `hsl(${hash}, 55%, 45%)`;
}

renderNavbar();
showLoginState();
