// Everything that knows how a project is stored in the Google Sheet lives here.
// The rest of the app only uses the Project objects made by parseProject():
//   { id, key, row, name, description, address, type, status, statusSetting, author, lng, lat, startDate, endDate, submittedAt }
//   key: unique per project, used in page links (the id, or "row-N" for older rows whose ids aren't unique)
//
// Sheet columns: name | range | date | location | description | id | address | type | status | author
//   range    "YYYY-MM-DD,YYYY-MM-DD" (start, end)
//   date     submission time as a Date() string
//   location "lng,lat"
//   type     a key from PROJECT_TYPES (blank on older rows)
//   status   a key from PROJECT_STATUSES, or blank = work it out from the dates
//   author   username of the engineer who submitted it (set by the server; blank on older rows)

// project types: key stored in the sheet -> label shown on the site.
// To add a type, add it here and in TYPE_COLORS, and add the key to TYPES in the Apps Script.
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
const DEFAULT_PROJECT_TYPE = "construction"; // used for rows from before types existed

// project statuses: key stored in the sheet -> label shown on the site.
// To add one, add it here and to STATUSES in the Apps Script.
const PROJECT_STATUSES = {
  proposed: "Proposed construction",
  ongoing: "Ongoing construction",
  finished: "Finished construction",
  rejected: "Rejected project",
};

// turns the Sheets API's array of rows into objects keyed by the header row
function rowsToObjects(values) {
  if (!values || values.length === 0) return [];
  const headers = values[0];

  return values.slice(1).map((row, index) => {
    const obj = { _row: index + 2 }; // sheet row number (row 1 is the header)
    headers.forEach((header, i) => {
      obj[header] = row[i] ?? "";
    });
    return obj;
  });
}

function parseProject(row) {
  const [lng, lat] = splitPair(row.location).map(parseCoord);
  const [start, end] = splitPair(row.range);
  const submittedAt = row.date ? new Date(row.date) : null;
  const startDate = parseDay(start);
  const endDate = parseDay(end);
  const statusSetting = parseKey(row.status, PROJECT_STATUSES) || "";

  return {
    id: row.id,
    row: row._row,
    name: row.name || "",
    description: row.description || "",
    address: row.address || "",
    type: parseKey(row.type, PROJECT_TYPES) || DEFAULT_PROJECT_TYPE,
    status: projectStatus(statusSetting, startDate, endDate),
    statusSetting, // what's stored: a status key, or "" for automatic
    author: row.author || "",
    lng,
    lat,
    startDate,
    endDate,
    submittedAt: submittedAt && !isNaN(submittedAt) ? submittedAt : null,
  };
}

// the chosen status, or (if automatic) proposed before the start date, finished after the end date, else ongoing
function projectStatus(statusSetting, startDate, endDate, today = new Date()) {
  if (statusSetting) return statusSetting;
  if (startDate && today < startDate) return "proposed";
  if (endDate && today.getTime() >= endDate.getTime() + 24 * 3600 * 1000) return "finished"; // day after the end date
  return "ongoing";
}

// the packet the Apps Script expects (keep key order and formats the same)
function toSheetPacket(project) {
  return {
    name: project.name,
    range: [formatDay(project.startDate), formatDay(project.endDate)],
    date: project.submittedAt ? project.submittedAt.toString() : "",
    location: [project.lng, project.lat],
    description: project.description,
    id: project.id,
    address: project.address,
    type: project.type,
    status: project.statusSetting,
  };
}

// gives each project a key for links: its id if no other project shares it, otherwise "row-N".
// (older rows have ids the sheet rounded off, like 8.27513E+15, which can repeat)
function assignKeys(projects) {
  const idCounts = {};
  projects.forEach((p) => { idCounts[p.id] = (idCounts[p.id] || 0) + 1; });
  projects.forEach((p) => { p.key = p.id && idCounts[p.id] === 1 ? String(p.id) : `row-${p.row}`; });
  return projects;
}

function hasLocation(project) {
  return Number.isFinite(project.lng) && Number.isFinite(project.lat);
}

// sort comparator: most recently submitted first
function newestFirst(a, b) {
  return (b.submittedAt || 0) - (a.submittedAt || 0);
}

function splitPair(text) {
  const parts = (text || "").split(",");
  return [parts[0], parts[1]];
}

// finds the key in options matching text, which can be the key ("flock_camera") or the label
// ("Flock camera") in any capitalization, so rows typed into the sheet by hand still work. null if none.
function parseKey(text, options) {
  const normalize = (s) => String(s || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const wanted = normalize(text);
  if (!wanted) return null;
  return Object.keys(options).find((key) => key === wanted || normalize(options[key]) === wanted) || null;
}

function parseCoord(text) {
  return text && text.trim() !== "" ? Number(text) : NaN;
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
