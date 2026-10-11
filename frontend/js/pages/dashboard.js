// Engineer dashboard: the logged-in engineer's own projects, with a summary, search, and edit links.

let myProjects = [];

async function initDashboard() {
  const container = document.getElementById("projects");

  try {
    const [session, projects] = await Promise.all([getSession(), loadProjects()]);
    if (!session.loggedIn) {
      window.location.href = "login.html";
      return;
    }

    document.getElementById("welcome").textContent = `Welcome, ${session.username}`;
    myProjects = projects.filter((p) => p.author === session.username).sort(newestFirst);
  } catch (error) {
    console.error(error);
    container.append("Couldn't load your projects.");
    return;
  }

  renderStats();
  const searchInput = document.getElementById("projectSearch");
  searchInput.addEventListener("input", () => showMyProjects(searchInput.value));
  showMyProjects("");
}

// "5 projects · 2 Ongoing construction · ..." (only statuses you have)
function renderStats() {
  const stats = document.getElementById("stats");
  const counts = {};
  myProjects.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });

  stats.appendChild(statChip(myProjects.length, myProjects.length === 1 ? "project" : "projects"));
  Object.keys(PROJECT_STATUSES)
    .filter((status) => counts[status])
    .forEach((status) => stats.appendChild(statChip(counts[status], PROJECT_STATUSES[status].toLowerCase())));
}

function statChip(count, label) {
  const chip = document.createElement("span");
  chip.className = "dashboard-stat";
  const number = document.createElement("strong");
  number.textContent = count;
  chip.append(number, " " + label);
  return chip;
}

function showMyProjects(query) {
  const container = document.getElementById("projects");
  const status = document.getElementById("searchStatus");
  const results = searchProjects(myProjects, query);

  container.replaceChildren(...results.map(renderMyProjectCard));

  if (myProjects.length === 0) {
    status.textContent = "You haven't submitted any projects yet.";
  } else if (query.trim() && results.length === 0) {
    status.textContent = `None of your projects match "${query.trim()}"`;
  } else {
    status.textContent = query.trim() ? `${results.length} of ${myProjects.length} projects` : "";
  }
}

// the normal project card plus an Edit button
function renderMyProjectCard(project) {
  const card = renderProjectCard(project);
  const edit = document.createElement("a");
  edit.className = "project-edit-button";
  edit.href = `submit.html?edit=${encodeURIComponent(project.id)}`;
  edit.textContent = "Edit";
  card.appendChild(edit);
  return card;
}

initDashboard();
