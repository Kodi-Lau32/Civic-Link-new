// Everything that knows how a project is stored in the Google Sheet lives here.
// The rest of the app only uses the Project objects made by parseProject():
//   { id, name, description, address, lng, lat, startDate, endDate, submittedAt }
//
// Sheet columns: name | range | date | location | description | id | address
//   range    "YYYY-MM-DD,YYYY-MM-DD" (start, end)
//   date     submission time as a Date() string
//   location "lng,lat"

// turns the Sheets API's array of rows into objects keyed by the header row
function rowsToObjects(values) {
  if (!values || values.length === 0) return [];
  const headers = values[0];

  return values.slice(1).map((row) => {
    const obj = {};
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

  return {
    id: row.id,
    name: row.name || "",
    description: row.description || "",
    address: row.address || "",
    lng,
    lat,
    startDate: parseDay(start),
    endDate: parseDay(end),
    submittedAt: submittedAt && !isNaN(submittedAt) ? submittedAt : null,
  };
}

// the packet the Apps Script expects (keep key order and formats the same)
function toSheetPacket(project) {
  return {
    name: project.name,
    range: [formatDay(project.startDate), formatDay(project.endDate)],
    date: project.submittedAt.toString(),
    location: [project.lng, project.lat],
    description: project.description,
    id: project.id,
    address: project.address,
  };
}

function hasLocation(project) {
  return Number.isFinite(project.lng) && Number.isFinite(project.lat);
}

// "upcoming" | "ongoing" | "completed" | "unknown", based on today's date
function projectStatus(project, today = new Date()) {
  const { startDate, endDate } = project;
  if (!startDate && !endDate) return "unknown";
  if (startDate && today < startDate) return "upcoming";
  if (endDate && today.getTime() >= endDate.getTime() + 24 * 3600 * 1000) return "completed"; // after the end day
  return "ongoing";
}

// sort comparator: most recently submitted first
function newestFirst(a, b) {
  return (b.submittedAt || 0) - (a.submittedAt || 0);
}

function splitPair(text) {
  const parts = (text || "").split(",");
  return [parts[0], parts[1]];
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
