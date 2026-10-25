// One-time copy of the old Google Sheet into the Supabase projects table.
// Run with: npm run import-sheet (from backendLogin/, after filling in .env and running supabase/schema.sql)
// Safe to run more than once: rows are matched by id, so running again updates them instead of adding copies.

const SHEETS_API_KEY = "AIzaSyAoYSJ-B-i4r-jgl0n3is3VJMgBhVhwy44";
const SHEET_ID = "1UK356MwkhS73fkZHGkeQwS_UBx9YpTf9dIunNaGbXLw";
const SHEET_NAME = "Sheet1";

const TYPES = ["construction", "flock_camera", "data_center", "unwanted_repair"];
const TYPE_LABELS = { construction: "Construction", flock_camera: "Flock camera", data_center: "Data center", unwanted_repair: "Unwanted repair" };
const STATUSES = ["proposed", "ongoing", "finished", "rejected"];
const STATUS_LABELS = { proposed: "Proposed construction", ongoing: "Ongoing construction", finished: "Finished construction", rejected: "Rejected project" };

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in backendLogin/.env first (see .env.example).");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${SHEETS_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(`Couldn't read the sheet: ${data.error ? data.error.message : response.status}`);

  const [headers = [], ...rows] = data.values || [];
  const sheetRows = rows.map((row, i) => {
    const obj = { _row: i + 2 }; // sheet row number (row 1 is the header)
    headers.forEach((header, column) => { obj[String(header).trim()] = row[column] ?? ""; });
    return obj;
  });

  // old rows have ids the sheet rounded off (like 8.27513E+15) that can repeat; those get "sheet-row-N" instead
  const idCounts = {};
  sheetRows.forEach((r) => { idCounts[r.id] = (idCounts[r.id] || 0) + 1; });
  const projects = sheetRows
    .filter((r) => r.name || r.location)
    .map((r) => toProjectRow(r, r.id && idCounts[r.id] === 1 ? String(r.id) : `sheet-row-${r._row}`));

  if (projects.length === 0) return console.log("The sheet has no projects to copy.");

  const headersOut = { apikey: SUPABASE_SECRET_KEY, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" };
  if (SUPABASE_SECRET_KEY.startsWith("eyJ")) headersOut.Authorization = `Bearer ${SUPABASE_SECRET_KEY}`;
  const save = await fetch(`${SUPABASE_URL}/rest/v1/projects?on_conflict=id`, {
    method: "POST",
    headers: headersOut,
    body: JSON.stringify(projects),
  });
  if (!save.ok) throw new Error(`Supabase rejected the import: ${await save.text()}`);
  console.log(`✅ Copied ${projects.length} projects from the sheet to Supabase.`);
}

// sheet row (name | range | date | location | description | id | address | type | status | author) -> database row
function toProjectRow(r, id) {
  const [lng, lat] = splitPair(r.location).map((text) => (text && text.trim() ? Number(text) : NaN));
  const [start, end] = splitPair(r.range);
  const submittedAt = r.date ? new Date(r.date) : null;

  return {
    id,
    name: r.name || "",
    description_short: r.description || "",
    address: r.address || "",
    type: [parseKey(r.type, TYPES, TYPE_LABELS) || "construction"],
    status: parseKey(r.status, STATUSES, STATUS_LABELS),
    author: r.author || null,
    lng: Number.isFinite(lng) ? lng : null,
    lat: Number.isFinite(lat) ? lat : null,
    start_date: parseDay(start),
    end_date: parseDay(end),
    submitted_at: submittedAt && !isNaN(submittedAt) ? submittedAt.toISOString() : null,
  };
}

function splitPair(text) {
  const parts = String(text || "").split(",");
  return [parts[0], parts[1]];
}

// the key matching text, which can be the key ("flock_camera") or the label ("Flock camera"). null if none.
function parseKey(text, keys, labels) {
  const normalize = (s) => String(s || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const wanted = normalize(text);
  if (!wanted) return null;
  return keys.find((key) => key === wanted || normalize(labels[key]) === wanted) || null;
}

// "YYYY-MM-DD" (or anything Date can read) -> "YYYY-MM-DD", or null
function parseDay(text) {
  if (!text || !text.trim()) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) return text.trim();
  const date = new Date(text);
  if (isNaN(date)) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

main().catch((error) => {
  console.error("❌", error.message);
  process.exit(1);
});
