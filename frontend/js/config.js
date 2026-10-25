// Settings shared by every page. Change values here instead of in individual files.

const MAPBOX_TOKEN = "pk.eyJ1IjoiY2l2aWMtbGluayIsImEiOiJjbWdwbzd6c2kyY3dyMmpuMnpxMTBrMm13In0.KY2MzBxSk5XV2TcEWe3MQA";

// Supabase database that stores projects (supabase/schema.sql).
// The website only reads with this key; adding/editing goes through the server's /api/projects,
// which checks the login and writes with the secret key (see backendLogin/server.js).
// Find both values in the Supabase dashboard > Project Settings > API Keys / Data API.
// ===== PASTE YOUR SUPABASE VALUES HERE =====
const SUPABASE_URL = "https://sompmpnkupnitlchtghh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KPinMWLjcDMoqblMMxxoNA_-Xu1wWMv"; // safe to share: it can only read
// ===========================================

// Login/submit API (backendLogin/server.js), served from the same address as the site
const API_URL = "/api";

// Map defaults [lng, lat]
const MAP_CENTER = [-87.5, 37.9];
const MAP_ZOOM = 3;
