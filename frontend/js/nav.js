// Builds the navbar on every page from NAV_LINKS, so adding a page only means editing this list.
// Usage: put <div class="navbar" id="navbar"></div> at the top of <body>.
//        Add data-search to that div to show the Search button.

// folder containing the frontend pages, worked out from this script's location
// so links work from both index.html (root) and frontend/*.html
const FRONTEND_DIR = new URL("..", document.currentScript.src);

const NAV_LINKS = [
  { label: "Home", path: "../index.html" },
  { label: "Login", path: "login.html" },
  { label: "Updates", path: "updates.html" },
  { label: "Submit", path: "submit.html" },
];

function renderNavbar() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;

  const logo = document.createElement("a");
  logo.className = "home-logo";
  logo.href = new URL("../index.html", FRONTEND_DIR).href;
  logo.textContent = "CIVIC LINK";

  const links = document.createElement("div");
  links.className = "navbar-icons-flex";

  NAV_LINKS.forEach(({ label, path }) => {
    const link = document.createElement("a");
    link.className = "navbar-icons";
    link.href = new URL(path, FRONTEND_DIR).href;
    link.textContent = label;
    if (label === "Login") link.id = "navLogin";
    links.appendChild(link);
  });

  if (navbar.hasAttribute("data-search")) {
    const searchButton = document.createElement("button");
    searchButton.className = "search-button";
    searchButton.id = "openSearch";
    searchButton.textContent = "Search";
    links.appendChild(searchButton);
  }

  navbar.append(logo, links);
}

// turns "Login" into "Logout" while logged in
async function showLoginState() {
  const loginLink = document.getElementById("navLogin");
  if (!loginLink) return;

  try {
    const session = await (await fetch(`${API_URL}/session`)).json();
    if (!session.loggedIn) return;
  } catch {
    return; // server not reachable; leave the Login link
  }

  loginLink.textContent = "Logout";
  loginLink.addEventListener("click", async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/logout`, { method: "POST" });
    window.location.href = new URL("../index.html", FRONTEND_DIR).href;
  });
}

renderNavbar();
showLoginState();
