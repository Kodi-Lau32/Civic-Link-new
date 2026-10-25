// Builds the HTML for displaying projects (map sidebar, update cards, recent list).
// Uses textContent instead of innerHTML so project data can't inject HTML/scripts.

function formatDate(date) {
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
}

function formatDateRange(project) {
  if (!project.startDate && !project.endDate) return "";
  return `${formatDate(project.startDate)} – ${formatDate(project.endDate)}`;
}

function timeAgo(date) {
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (seconds < 60) return Math.round(seconds) + " sec ago";
  if (seconds < 1800) return Math.round(seconds / 60) + " min ago";
  if (seconds < 3600) return "less than an hr ago";
  return Math.round(seconds / 3600) + " hrs ago";
}

function isToday(date) {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

// <tag><strong>Label:</strong> value</tag>
function labeledLine(tag, label, value) {
  const line = document.createElement(tag);
  const strong = document.createElement("strong");
  strong.textContent = label + ": ";
  line.append(strong, value);
  return line;
}

// "Submitted by" line, or nothing for older projects without an author (spread into append())
function authorLine(project) {
  return project.author ? [labeledLine("p", "Submitted by", project.author)] : [];
}

// a colored label for each of the project's tags (Updates page stories and the project page)
function renderTypeBadges(project) {
  return project.types.map((type) => {
    const badge = document.createElement("span");
    badge.className = "type-badge";
    badge.style.background = TYPE_COLORS[type];
    badge.textContent = PROJECT_TYPES[type];
    return badge;
  });
}

// content of the map sidebar shown when a project is clicked
function buildProjectDetails(project) {
  const box = document.createElement("div");

  const title = document.createElement("h3");
  title.textContent = project.name;

  const type = document.createElement("div");
  type.className = "map-sidebar-type";
  project.types.forEach((tag) => {
    const swatch = document.createElement("span");
    swatch.className = "map-legend-dot";
    swatch.style.background = TYPE_COLORS[tag];
    type.append(swatch, PROJECT_TYPES[tag]);
  });

  box.append(
    title,
    type,
    labeledLine("p", "Status", PROJECT_STATUSES[project.status]),
    labeledLine("p", "Dates", formatDateRange(project)),
    labeledLine("p", "Address", project.address),
    labeledLine("p", "Description", project.descriptionShort),
    labeledLine("p", "Submitted", formatDate(project.submittedAt)),
    ...authorLine(project)
  );
  return box;
}

// map picture for a project, from Mapbox's static image API (width/height in CSS pixels)
function staticMapUrl(project, width, height) {
  const color = typeColor(project).replace("#", "");
  const point = `${project.lng},${project.lat}`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+${color}(${point})/${point},14,0/` +
    `${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
}

// link to a project's own page (frontend/project.html)
function projectPageUrl(project) {
  return `project.html?p=${encodeURIComponent(project.key)}`;
}

// newsletter-style story that links to the project's page; lead = the big one
function renderFeaturedStory(project, lead) {
  const story = document.createElement("a");
  story.className = lead ? "featured-story featured-story-lead" : "featured-story";
  story.href = projectPageUrl(project);

  if (hasLocation(project)) {
    const image = document.createElement("img");
    image.className = "featured-map";
    image.src = lead ? staticMapUrl(project, 800, 520) : staticMapUrl(project, 500, 200);
    image.alt = `Map of ${project.address || project.name}`;
    image.loading = "lazy";
    story.appendChild(image);
  }

  const body = document.createElement("div");
  body.className = "featured-body";

  const meta = document.createElement("div");
  meta.className = "featured-meta";
  meta.append(...renderTypeBadges(project), [PROJECT_STATUSES[project.status], formatDate(project.submittedAt)].filter(Boolean).join(" · "));

  const title = document.createElement("h3");
  title.textContent = project.name;

  const description = document.createElement("p");
  description.className = "featured-description";
  description.textContent = project.descriptionShort;

  const details = document.createElement("p");
  details.className = "featured-details";
  details.textContent = [project.address, formatDateRange(project)].filter(Boolean).join(" · ");

  body.append(meta, title, description, details);
  if (project.author) {
    const author = document.createElement("p");
    author.className = "featured-author";
    author.textContent = `Submitted by ${project.author}`;
    body.appendChild(author);
  }

  story.appendChild(body);
  return story;
}

// card on the Updates page
function renderProjectCard(project) {
  const card = document.createElement("div");
  card.className = "project-card";

  const title = document.createElement("h2");
  title.textContent = project.name;

  card.append(
    title,
    labeledLine("p", project.types.length > 1 ? "Types" : "Type", typeLabels(project)),
    labeledLine("p", "Status", PROJECT_STATUSES[project.status]),
    labeledLine("p", "Location", project.address),
    labeledLine("p", "Date Range", formatDateRange(project)),
    labeledLine("p", "Date Submitted", formatDate(project.submittedAt)),
    labeledLine("p", "Description", project.descriptionShort),
    ...authorLine(project)
  );
  return card;
}

// list of today's submissions for the home page's updates box
function renderRecentList(projects) {
  const list = document.createElement("ul");
  list.id = "updateslist";

  const recent = projects
    .filter((p) => p.name && p.submittedAt && isToday(p.submittedAt))
    .sort(newestFirst);

  recent.forEach((project) => {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = project.name;
    const address = document.createElement("span");
    address.textContent = project.address;

    item.append(name, document.createElement("br"), address, ", " + timeAgo(project.submittedAt));
    list.append(item, document.createElement("br"));
  });

  if (recent.length === 0) {
    list.textContent = "No recent submissions yet!";
  }
  return list;
}
