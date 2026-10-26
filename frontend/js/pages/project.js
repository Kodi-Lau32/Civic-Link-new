// Project page (project.html?p=<key>): one project in full, with a live map, a timeline,
// and links to nearby projects. Opened from the stories at the top of the Updates page.

const PROJECT_KEY = new URLSearchParams(window.location.search).get("p");
const MORE_COUNT = 3; // nearby projects shown at the bottom
const DAY_MS = 24 * 3600 * 1000;

async function initProjectPage() {
  const article = document.getElementById("project");

  let projects, session;
  try {
    [projects, session] = await Promise.all([loadProjects(), getSession().catch(() => ({ loggedIn: false }))]);
  } catch (error) {
    console.error(error);
    article.replaceChildren(message("Couldn't load this project. Please try again."));
    return;
  }

  const project = projects.find((p) => p.key === PROJECT_KEY);
  if (!project) {
    article.replaceChildren(message("This project couldn't be found. It may have been removed."));
    return;
  }

  document.title = `${project.name} | Civic Link`;
  article.replaceChildren(...renderArticle(project, session));
  if (hasLocation(project)) showProjectMap(project);
  showMoreProjects(project, projects);
}

function message(text) {
  const p = document.createElement("p");
  p.className = "project-loading";
  p.textContent = text;
  return p;
}

// #region article
function renderArticle(project, session) {
  const meta = document.createElement("div");
  meta.className = "featured-meta";
  meta.append(...renderTypeBadges(project), PROJECT_STATUSES[project.status]);

  const title = document.createElement("h1");
  title.className = "project-title";
  title.textContent = project.name;

  const byline = document.createElement("p");
  byline.className = "project-byline";
  byline.textContent = [
    project.author && `Submitted by ${project.author}`,
    project.submittedAt && `on ${formatDate(project.submittedAt)}`,
  ].filter(Boolean).join(" ");

  const parts = [meta, title, byline];

  // only the author sees an Edit button (the database checks this again when saving)
  if (session.loggedIn && project.author && project.author === session.username) {
    const edit = document.createElement("a");
    edit.className = "project-edit-button";
    edit.href = `submit.html?edit=${encodeURIComponent(project.id)}`;
    edit.textContent = "Edit this project";
    parts.push(edit);
  }

  if (hasLocation(project)) {
    const map = document.createElement("div");
    map.id = "map";
    map.className = "project-map";
    parts.push(map);
  }

  parts.push(renderTimeline(project), renderFacts(project));

  // the full write-up; projects without one show their short description instead
  const about = project.descriptionLong || project.descriptionShort;
  if (about) {
    const description = document.createElement("p");
    description.className = "project-description";
    description.textContent = about;
    parts.push(subheading("About this project"), description);
  }

  if (project.resources.length > 0) {
    const list = document.createElement("ul");
    list.className = "project-resources";
    list.append(...project.resources.map(renderResource));
    parts.push(subheading("Sources"), list);
  }
  return parts;
}

function subheading(text) {
  const heading = document.createElement("h2");
  heading.className = "project-subheading";
  heading.textContent = text;
  return heading;
}

// a source: web addresses become links (only http/https, so a stored "javascript:" can't run), anything else is text
function renderResource(resource) {
  const item = document.createElement("li");
  if (/^https?:\/\//i.test(resource)) {
    const link = document.createElement("a");
    link.href = resource;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = resource;
    item.appendChild(link);
  } else {
    item.textContent = resource;
  }
  return item;
}

// grid of key facts
function renderFacts(project) {
  const facts = document.createElement("dl");
  facts.className = "project-facts";

  const add = (label, value) => {
    if (!value) return;
    const item = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    item.append(dt, dd);
    facts.appendChild(item);
  };

  add("Location", project.address);
  add("Starts", formatDate(project.startDate));
  add("Ends", formatDate(project.endDate));
  add("Duration", durationText(project));
  add(project.types.length > 1 ? "Types" : "Type", typeLabels(project));
  add("Status", PROJECT_STATUSES[project.status]);
  return facts;
}

function durationText(project) {
  if (!project.startDate || !project.endDate) return "";
  const days = Math.round((project.endDate - project.startDate) / DAY_MS) + 1;
  if (days < 1) return "";
  if (days < 60) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30.4);
  return months < 24 ? `About ${months} months` : `About ${Math.round(months / 12)} years`;
}

// progress bar from start to end date, with a sentence like "12 days left"
function renderTimeline(project) {
  const timeline = document.createElement("div");
  timeline.className = "project-timeline";

  const { percent, text } = timelineProgress(project);
  const label = document.createElement("p");
  label.className = "project-timeline-label";
  label.textContent = text;
  timeline.appendChild(label);

  if (percent !== null) {
    const bar = document.createElement("div");
    bar.className = "project-timeline-bar";
    const fill = document.createElement("div");
    fill.className = "project-timeline-fill";
    fill.style.width = `${percent}%`;
    fill.style.background = typeColor(project);
    bar.appendChild(fill);

    const ends = document.createElement("div");
    ends.className = "project-timeline-ends";
    const start = document.createElement("span");
    start.textContent = formatDate(project.startDate);
    const end = document.createElement("span");
    end.textContent = formatDate(project.endDate);
    ends.append(start, end);

    timeline.append(bar, ends);
  }
  return timeline;
}

function timelineProgress(project, today = new Date()) {
  const { startDate, endDate, status } = project;
  if (status === "rejected") return { percent: null, text: "This project was rejected." };
  if (!startDate || !endDate) return { percent: null, text: "No schedule has been posted." };

  const end = endDate.getTime() + DAY_MS; // through the end of the last day
  const daysUntil = (date) => Math.ceil((date - today) / DAY_MS);

  if (today < startDate) {
    const days = daysUntil(startDate);
    return { percent: 0, text: `Starts in ${days} day${days === 1 ? "" : "s"}` };
  }
  if (today.getTime() >= end) return { percent: 100, text: `Finished ${formatDate(endDate)}` };

  const percent = Math.round(((today - startDate) / (end - startDate)) * 100);
  const days = daysUntil(end);
  return { percent, text: `${percent}% of the way through · ${days} day${days === 1 ? "" : "s"} left` };
}
// #endregion

// #region map and nearby projects
function showProjectMap(project) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v12",
    center: [project.lng, project.lat],
    zoom: 15,
    cooperativeGestures: true, // scrolling the page doesn't zoom the map
  });
  map.addControl(new mapboxgl.NavigationControl(), "top-right");
  new mapboxgl.Marker({ color: typeColor(project) }).setLngLat([project.lng, project.lat]).addTo(map);
}

// closest other projects (or the newest ones, if this project has no location)
function showMoreProjects(project, projects) {
  const others = projects.filter((p) => p !== project && p.name);
  const nearby = hasLocation(project)
    ? others.filter(hasLocation).sort((a, b) => distanceKm(project, a) - distanceKm(project, b))
    : others.sort(newestFirst);
  const picks = nearby.slice(0, MORE_COUNT);
  if (picks.length === 0) return;

  if (!hasLocation(project)) document.getElementById("moreTitle").textContent = "More updates";
  document.getElementById("more").replaceChildren(...picks.map((p) => renderFeaturedStory(p, false)));
  document.getElementById("moreSection").hidden = false;
}

// straight-line distance between two projects
function distanceKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
// #endregion

initProjectPage();
