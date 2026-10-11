// Home page (index.html): read-only map of all projects + today's submissions.

async function initHomePage() {
  const map = createMap();
  const updatesBox = document.getElementById("updates");

  try {
    const projects = await loadProjects();
    addProjectMarkers(map, projects);
    updatesBox.appendChild(renderRecentList(projects));
  } catch (error) {
    console.error(error);
    updatesBox.append("Couldn't load projects.");
  }
}

initHomePage();
