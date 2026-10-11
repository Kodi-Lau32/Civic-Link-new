// Updates page: a card for every submitted project, newest first, with a search bar to filter them.
// The search is kept in the URL (updates.html?q=bridge) so results can be linked to.

let allProjects = [];

async function initUpdatesPage() {
  const container = document.getElementById("projects");
  const searchInput = document.getElementById("projectSearch");

  try {
    allProjects = (await loadProjects())
      .filter((p) => p.name)
      .sort(newestFirst);
  } catch (error) {
    console.error(error);
    container.append("Couldn't load projects.");
    return;
  }

  searchInput.value = new URLSearchParams(window.location.search).get("q") || "";
  searchInput.addEventListener("input", () => {
    updateSearchUrl(searchInput.value);
    showProjects(searchInput.value);
  });
  showProjects(searchInput.value);
}

function showProjects(query) {
  const container = document.getElementById("projects");
  const status = document.getElementById("searchStatus");
  const results = searchProjects(allProjects, query);

  container.replaceChildren(...results.map(renderProjectCard));

  if (allProjects.length === 0) {
    status.textContent = "No projects yet.";
  } else if (!query.trim()) {
    status.textContent = `${allProjects.length} projects`;
  } else if (results.length === 0) {
    status.textContent = `No projects match "${query.trim()}"`;
  } else {
    status.textContent = `${results.length} of ${allProjects.length} projects match "${query.trim()}"`;
  }
}

function updateSearchUrl(query) {
  const url = new URL(window.location);
  if (query.trim()) url.searchParams.set("q", query.trim());
  else url.searchParams.delete("q");
  history.replaceState(null, "", url);
}

initUpdatesPage();
