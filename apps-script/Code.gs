// Google Apps Script for the Civic Link sheet (open the sheet > Extensions > Apps Script).
// This file is a copy for version control; the live version is the one in the Apps Script editor.
//
// After pasting changes: Deploy > Manage deployments > pencil (Edit) > Version: New version > Deploy.
// That keeps the same /exec URL, so the server's SUBMIT_URL doesn't need to change.

// Columns written for each submission, matched by the header names in row 1 (any order).
// Missing headers are added to the end of row 1 automatically.
const FIELDS = ["name", "range", "date", "location", "description", "id", "address", "type", "status", "author"];

// Fields an author can change when editing (not id, date, or author)
const EDITABLE_FIELDS = ["name", "range", "location", "description", "address", "type", "status"];

// Allowed project types (must match PROJECT_TYPES in frontend/js/projects.js)
const TYPES = ["construction", "flock_camera", "data_center", "unwanted_repair"];
const DEFAULT_TYPE = "construction";

// Allowed statuses (must match PROJECT_STATUSES in frontend/js/projects.js).
// Blank means "automatic": the website works it out from the project's dates.
const STATUSES = ["proposed", "ongoing", "finished", "rejected"];

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows = sheet.getDataRange().getValues();
  return ContentService.createTextOutput(
    JSON.stringify(rows)
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);

  // Recommended (the server decides who the author is, so only it should be able to post here):
  // add a script property SUBMIT_SECRET (Project Settings > Script properties) and start the
  // server with the same value.
  const secret = PropertiesService.getScriptProperties().getProperty("SUBMIT_SECRET");
  if (secret && data.secret !== secret) {
    return errorResponse("forbidden", "Unauthorized");
  }

  const isUpdate = data.action === "update";

  // new projects get defaults; edits only change the fields that were sent
  if (!isUpdate) data.type = data.type || DEFAULT_TYPE;
  if (data.type !== undefined && TYPES.indexOf(data.type) === -1) {
    return errorResponse("bad_request", "Unknown type: " + data.type);
  }

  if (!isUpdate) data.status = data.status || "";
  if (data.status && STATUSES.indexOf(data.status) === -1) {
    return errorResponse("bad_request", "Unknown status: " + data.status);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lock = LockService.getScriptLock(); // one write at a time, so rows don't shift mid-edit
  lock.waitLock(10000);
  try {
    const headers = ensureHeaders(sheet);
    if (isUpdate) return updateProject(sheet, headers, data);

    sheet.appendRow(headers.map((header) => (FIELDS.indexOf(header) === -1 ? "" : toCell(data[header]))));
    return jsonResponse({ status: "success" });
  } finally {
    lock.releaseLock();
  }
}

// edits the row whose id matches, only if data.author is that row's author
function updateProject(sheet, headers, data) {
  if (!data.id || !data.author) return errorResponse("bad_request", "Missing id or author");

  const idColumn = headers.indexOf("id");
  const authorColumn = headers.indexOf("author");
  const lastRow = sheet.getLastRow();
  const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, headers.length).getValues() : [];

  const index = rows.findIndex((row) => String(row[idColumn]) === String(data.id));
  if (index === -1) return errorResponse("not_found", "Project not found");
  if (String(rows[index][authorColumn]) !== data.author) {
    return errorResponse("forbidden", "You can only edit your own projects");
  }

  // replace only editable fields that were sent; keep everything else as it was
  const updated = rows[index].map((cell, column) => {
    const header = headers[column];
    return EDITABLE_FIELDS.indexOf(header) !== -1 && data[header] !== undefined ? toCell(data[header]) : cell;
  });
  sheet.getRange(index + 2, 1, 1, headers.length).setValues([updated]);
  return jsonResponse({ status: "success" });
}

// returns the header row, adding any FIELDS that are missing
function ensureHeaders(sheet) {
  const lastColumn = sheet.getLastColumn();
  const headers = lastColumn
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((h) => String(h).trim())
    : [];

  const missing = FIELDS.filter((field) => headers.indexOf(field) === -1);
  if (missing.length > 0) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
  }
  return headers.concat(missing);
}

// arrays (range, location) are stored as "a,b", the format the website reads.
// Text starting with = or + gets a leading ' so the sheet doesn't run it as a formula.
function toCell(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(",");
  if (typeof value === "string" && /^[=+]/.test(value)) return "'" + value;
  return value;
}

// code is read by the server: not_found, forbidden, or bad_request
function errorResponse(code, message) {
  return jsonResponse({ status: "error", code: code, message: message });
}

function jsonResponse(object) {
  return ContentService.createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}
