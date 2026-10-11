// All network requests: Google Sheet, our server (login + submit), Mapbox geocoding.

async function loadProjects() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${SHEETS_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  return rowsToObjects(data.values).map(parseProject);
}

// thrown when the server says the session is missing/expired
class NotLoggedInError extends Error {}

async function submitProject(project) {
  const response = await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toSheetPacket(project)),
  });
  if (response.status === 401) throw new NotLoggedInError();
  if (!response.ok) throw new Error(`Submit failed (${response.status})`);
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
