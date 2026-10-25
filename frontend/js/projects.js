// Everything that knows how a project is stored in the database lives here.
// The rest of the app only uses the Project objects made by parseProject():
//   { id, key, name, descriptionShort, descriptionLong, resources, address, types, status, statusSetting,
//     author, lng, lat, startDate, endDate, submittedAt }
//   key: used in page links (same as the id)
//   types: list of PROJECT_TYPES keys, at least one; the first one sets the project's color
//
// Database columns (table "projects", see supabase/schema.sql):
//   id | name | description_short | address | type | status | author | lng | lat | start_date | end_date
//   | submitted_at | description_long | resources
//   type         list of keys from PROJECT_TYPES (tags), e.g. ["construction", "data_center"]
//   description_short / description_long   summary for cards / full write-up for the project page
//   resources    list of sources (links or citations)
//   status       a key from PROJECT_STATUSES, or null = work it out from the dates
//   author       username of the engineer who submitted it (set by the server; null on old sheet rows)
//   start_date / end_date  "YYYY-MM-DD"
//   submitted_at timestamp, set by the database

// project types: key stored in the database -> label shown on the site.
// To add a type, add it here and in TYPE_COLORS, and to projects_type_check in supabase/schema.sql.
const PROJECT_TYPES = {
  construction: "Construction",
  flock_camera: "Flock camera",
  data_center: "Data center",
  unwanted_repair: "Unwanted repair",
};

// color for each type (map pins/dots, labels on the Updates page)
const TYPE_COLORS = {
  construction: "#e08a1e",
  flock_camera: "#d64545",
  data_center: "#7b4fd6",
  unwanted_repair: "#2f7fd8",
};
const DEFAULT_PROJECT_TYPE = "construction";

// project statuses: key stored in the database -> label shown on the site.
// To add one, add it here and to the status check in supabase/schema.sql.
const PROJECT_STATUSES = {
  proposed: "Proposed construction",
  ongoing: "Ongoing construction",
  finished: "Finished construction",
  rejected: "Rejected project",
};

// database row -> Project
function parseProject(row) {
  const startDate = parseDay(row.start_date);
  const endDate = parseDay(row.end_date);
  const submittedAt = row.submitted_at ? new Date(row.submitted_at) : null;
  const statusSetting = PROJECT_STATUSES[row.status] ? row.status : "";

  return {
    id: row.id,
    key: String(row.id),
    name: row.name || "",
    descriptionShort: row.description_short || "",
    descriptionLong: row.description_long || "",
    resources: Array.isArray(row.resources) ? row.resources.filter(Boolean) : [],
    address: row.address || "",
    types: parseTypes(row.type),
    status: projectStatus(statusSetting, startDate, endDate),
    statusSetting, // what's stored: a status key, or "" for automatic
    author: row.author || "",
    lng: row.lng ?? NaN,
    lat: row.lat ?? NaN,
    startDate,
    endDate,
    submittedAt: submittedAt && !isNaN(submittedAt) ? submittedAt : null,
  };
}

// known tags from the database's type list; [DEFAULT_PROJECT_TYPE] if there are none
function parseTypes(value) {
  const types = (Array.isArray(value) ? value : [value]).filter((type) => PROJECT_TYPES[type]);
  return types.length > 0 ? types : [DEFAULT_PROJECT_TYPE];
}

// the project's color (from its first tag)
function typeColor(project) {
  return TYPE_COLORS[project.types[0]];
}

// "Construction, Data center"
function typeLabels(project) {
  return project.types.map((type) => PROJECT_TYPES[type]).join(", ");
}

// the chosen status, or (if automatic) proposed before the start date, finished after the end date, else ongoing
function projectStatus(statusSetting, startDate, endDate, today = new Date()) {
  if (statusSetting) return statusSetting;
  if (startDate && today < startDate) return "proposed";
  if (endDate && today.getTime() >= endDate.getTime() + 24 * 3600 * 1000) return "finished"; // day after the end date
  return "ongoing";
}

// Project -> the columns the browser may send (the server sets id, author, and submitted_at)
function toDatabaseRow(project) {
  return {
    name: project.name,
    description_short: project.descriptionShort,
    description_long: project.descriptionLong,
    resources: project.resources,
    address: project.address,
    type: project.types,
    status: project.statusSetting || null,
    lng: project.lng,
    lat: project.lat,
    start_date: formatDay(project.startDate) || null,
    end_date: formatDay(project.endDate) || null,
  };
}

function hasLocation(project) {
  return Number.isFinite(project.lng) && Number.isFinite(project.lat);
}

// sort comparator: most recently submitted first
function newestFirst(a, b) {
  return (b.submittedAt || 0) - (a.submittedAt || 0);
}

// "YYYY-MM-DD" -> local Date (new Date("YYYY-MM-DD") would be UTC and can show the previous day)
function parseDay(text) {
  if (!text) return null;
  const match = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match ? new Date(match[1], match[2] - 1, match[3]) : new Date(text);
  return isNaN(date) ? null : date;
}

// local Date -> "YYYY-MM-DD"
function formatDay(date) {
  if (!date) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
