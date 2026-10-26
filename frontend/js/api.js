// All network requests: Supabase (database + logins) and Mapbox geocoding.
// The Supabase client comes from the supabase-js <script> tag on each page.

// keeps the logged-in engineer's session in this browser (localStorage) and refreshes it automatically
const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// every project in the database (anyone can read)
async function loadProjects() {
  const { data, error } = await db.from("projects").select("*");
  if (error) throw new Error(`Couldn't load projects: ${error.message}`);
  return data.map(parseProject);
}

// thrown when nobody is logged in, or the session has expired
class NotLoggedInError extends Error {}

// new project; the database records the logged-in engineer as its author. Resolves to the new id.
async function submitProject(project) {
  await requireLogin();
  const { data, error } = await db.from("projects").insert(toDatabaseRow(project)).select("id").single();
  if (error) throw saveError(error);
  return data.id;
}

// saves changes to one of the logged-in engineer's own projects
async function updateProject(id, project) {
  await requireLogin();
  const { data, error } = await db.from("projects").update(toDatabaseRow(project)).eq("id", id).select("id");
  if (error) throw saveError(error);
  // the database skips projects you don't own instead of raising an error
  if (data.length === 0) throw new Error("You can only edit your own projects.");
  return id;
}

async function requireLogin() {
  const session = await getSession();
  if (!session.loggedIn) throw new NotLoggedInError();
}

// database error -> an Error with a message people can act on
function saveError(error) {
  if (error.code === "PGRST301" || /jwt/i.test(error.message)) return new NotLoggedInError();
  if (error.code === "42501") {
    return new Error("Your account isn't allowed to save projects. Ask an admin to give it a username.");
  }
  return new Error(error.message);
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

// resolves to { success, message }
async function login(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) return { success: false, message: error.message === "Invalid login credentials" ? "Invalid email or password" : error.message };
  if (!data.user.app_metadata.username) {
    await db.auth.signOut();
    return { success: false, message: "This account doesn't have a username yet. Ask an admin to set one up." };
  }
  return { success: true };
}

async function logout() {
  await db.auth.signOut();
}

// resolves to { loggedIn, username }; username is set by an admin in the account's app_metadata
async function getSession() {
  const { data } = await db.auth.getSession();
  const username = data.session?.user.app_metadata.username;
  return { loggedIn: !!username, username: username || null };
}
