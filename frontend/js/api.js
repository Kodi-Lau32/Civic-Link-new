// All network requests: Supabase database, our server (login + submit), Mapbox geocoding.

// every project in the database (Supabase's REST API; the publishable key can only read)
async function loadProjects() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/projects?select=*`, {
    headers: supabaseHeaders(SUPABASE_PUBLISHABLE_KEY),
  });
  const rows = await response.json();
  if (!response.ok) throw new Error(`Couldn't load projects: ${rows.message || response.status}`);
  return rows.map(parseProject);
}

// older Supabase keys are JWTs ("eyJ...") and also go in Authorization; newer sb_ keys only go in apikey
function supabaseHeaders(key) {
  return key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

// thrown when the server says the session is missing/expired
class NotLoggedInError extends Error {}

// new project; the server records the logged-in engineer as its author. Resolves to the new id.
async function submitProject(project) {
  return sendProject("POST", `${API_URL}/projects`, project);
}

// saves changes to one of the logged-in engineer's own projects
async function updateProject(id, project) {
  return sendProject("PUT", `${API_URL}/projects/${encodeURIComponent(id)}`, project);
}

async function sendProject(method, url, project) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toDatabaseRow(project)),
  });
  if (response.status === 401) throw new NotLoggedInError();

  const result = await response.json().catch(() => null);
  if (!result) {
    // not our server (e.g. opened with Live Server, which answers 405/404 to API calls)
    throw new Error(`The Civic Link server didn't answer (${response.status}). Start it with "npm start" ` +
      `in backendLogin and open the site at http://localhost:3000.`);
  }
  if (!response.ok) throw new Error(result.message || `Save failed (${response.status})`);
  return result.id;
}

// coordinates -> address text
async function reverseGeocode(lng, lat) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      return data.features[0].place_name;
    }
    return "Address not found";
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return "Error fetching address";
  }
}

// address text -> { lng, lat }, or null if nothing matched
async function forwardGeocode(address) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json` +
    `?limit=1&country=us&proximity=${MAP_CENTER.join(",")}&access_token=${MAPBOX_TOKEN}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lng, lat };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

// resolves to { success, message }; on success the server sets a session cookie
async function login(username, password) {
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return response.json();
}

// resolves to { loggedIn, username }
async function getSession() {
  const response = await fetch(`${API_URL}/session`);
  return response.json();
}
