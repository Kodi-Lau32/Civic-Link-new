// Settings shared by every page. Change values here instead of in individual files.

const MAPBOX_TOKEN = "pk.eyJ1IjoiY2l2aWMtbGluayIsImEiOiJjbWdwbzd6c2kyY3dyMmpuMnpxMTBrMm13In0.KY2MzBxSk5XV2TcEWe3MQA";

// Google Sheet that stores projects (read here with the Sheets API; writes go through
// the server's /api/projects, which checks the login and forwards to Apps Script)
const SHEETS_API_KEY = "AIzaSyAoYSJ-B-i4r-jgl0n3is3VJMgBhVhwy44";
const SHEET_ID = "1UK356MwkhS73fkZHGkeQwS_UBx9YpTf9dIunNaGbXLw";
const SHEET_NAME = "Sheet1";


// Login/submit API (backendLogin/server.js), served from the same address as the site
const API_URL = "/api";

// Map defaults [lng, lat]
const MAP_CENTER = [-87.5, 37.9];
const MAP_ZOOM = 3;
