// Builds the HTML for displaying projects (map popups, update cards, recent list).
// Uses textContent instead of innerHTML so sheet data can't inject HTML/scripts.

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

// content of the popup shown when a map marker is clicked
function buildProjectPopup(project) {
  const box = document.createElement("div");
  box.style.color = "black";
  box.append(
    labeledLine("div", "Name", project.name),
    labeledLine("div", "Range", formatDateRange(project)),
    labeledLine("div", "Description", project.description),
    labeledLine("div", "Address", project.address)
  );
  return box;
}

// card on the Updates page
function renderProjectCard(project) {
  const card = document.createElement("div");
  card.className = "project-card";

  const title = document.createElement("h2");
  title.textContent = project.name;

  card.append(
    title,
    labeledLine("p", "Location", project.address),
    labeledLine("p", "Date Range", formatDateRange(project)),
    labeledLine("p", "Date Submitted", formatDate(project.submittedAt)),
    labeledLine("p", "Description", project.description)
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
