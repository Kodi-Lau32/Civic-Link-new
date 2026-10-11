// Updates page: the newest projects as newsletter-style stories at the top, then the full
// gallery of every project (newest first) with a search bar.
// The search is kept in the URL (updates.html?q=bridge) so results can be linked to.

const FEATURED_COUNT = 3; // 1 lead story + 2 smaller ones

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

  showFeatured();

  searchInput.value = new URLSearchParams(window.location.search).get("q") || "";
  searchInput.addEventListener("input", () => {
    updateSearchUrl(searchInput.value);
    showProjects(searchInput.value);
  });
  showProjects(searchInput.value);
  if (searchInput.value) document.getElementById("allProjects").scrollIntoView(); // linked search: jump to results
}

function showFeatured() {
  const featured = document.getElementById("featured");
  const newest = allProjects.slice(0, FEATURED_COUNT);
  featured.replaceChildren(...newest.map((project, i) => renderFeaturedStory(project, i === 0)));
  if (newest.length === 0) featured.append("No projects yet.");
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
