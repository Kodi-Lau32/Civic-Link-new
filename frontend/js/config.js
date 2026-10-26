// Settings shared by every page. Change values here instead of in individual files.

const MAPBOX_TOKEN = "pk.eyJ1IjoiY2l2aWMtbGluayIsImEiOiJjbWdwbzd6c2kyY3dyMmpuMnpxMTBrMm13In0.KY2MzBxSk5XV2TcEWe3MQA";

// Supabase project that stores projects and engineer logins (supabase/schema.sql).
// This key is public on purpose: on its own it can only read. Logged-in engineers can also add and
// edit their own projects; the database's rules (Row Level Security) enforce that, not this code.
// Find both values in the Supabase dashboard > Project Settings > API Keys / Data API.
// ===== PASTE YOUR SUPABASE VALUES HERE =====
const SUPABASE_URL = "https://sompmpnkupnitlchtghh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KPinMWLjcDMoqblMMxxoNA_-Xu1wWMv"; // safe to share: it can only read
// ===========================================

// Map defaults [lng, lat]
const MAP_CENTER = [-87.5, 37.9];
const MAP_ZOOM = 3;
