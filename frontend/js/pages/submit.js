// Submit page: click the map (or type an address) to place a project, then save it to the database.
// Edit mode (submit.html?edit=<id>): loads one of your own projects into the form and saves changes.

const MARKER_CLICK_TOLERANCE = 25; // pixels; clicks this close to an existing marker don't move the pin
const EDIT_ID = new URLSearchParams(window.location.search).get("edit");

let pickedLngLat = null;     // location of the pin (clicked, or the edited project's location)
let pickerMarker = null;
let locationChanged = false; // true once the user moves the pin themselves
let editingProject = null;   // the project being edited, in edit mode
let currentUser = null;      // logged-in engineer's username
const projectMarkers = [];

async function initSubmitPage() {
  mapboxsearch.autofill({ accessToken: MAPBOX_TOKEN });
  addTypeCheckboxes(document.getElementById("typeids"));
  addOptions(document.getElementById("statusid"), PROJECT_STATUSES);

  const form = document.getElementById("projectForm");
  const submitButton = document.getElementById("submitid");
  if (EDIT_ID) submitButton.disabled = true; // until the project has loaded

  const map = createMap();
  map.on("click", (e) => pickLocation(map, e.lngLat));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSubmit(map, form);
  });

  try {
    const [session, projects] = await Promise.all([getSession(), loadProjects()]);
    currentUser = session.username;

    if (EDIT_ID) {
      editingProject = findOwnProject(projects, EDIT_ID);
      if (!editingProject) return;
      startEditing(map, editingProject);
    }
    // the edited project is shown by the movable pin instead of a normal marker
    projectMarkers.push(...addProjectMarkers(map, projects.filter((p) => p !== editingProject)));
  } catch (error) {
    console.error(error);
    if (EDIT_ID) alert("Couldn't load the project. Please try again.");
  }
}

// adds an <option> for each key -> label
function addOptions(select, options) {
  Object.entries(options).forEach(([value, label]) => select.add(new Option(label, value)));
}

// a labeled checkbox for each project type, colored like its map pin
function addTypeCheckboxes(container) {
  Object.entries(PROJECT_TYPES).forEach(([value, label]) => {
    const row = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "type";
    checkbox.value = value;
    checkbox.style.accentColor = TYPE_COLORS[value];
    row.append(checkbox, label);
    container.appendChild(row);
  });
}

function typeCheckboxes() {
  return [...document.querySelectorAll("#typeids input[name=type]")];
}

// #region edit mode
// the project with this id if the logged-in engineer wrote it; otherwise explains and goes back
function findOwnProject(projects, id) {
  const project = projects.find((p) => String(p.id) === id);
  if (!project || project.author !== currentUser) {
    alert(project ? "You can only edit your own projects." : "That project couldn't be found.");
    window.location.href = "dashboard.html";
    return null;
  }
  return project;
}

function startEditing(map, project) {
  document.title = "Edit Project";
  document.getElementById("formTitle").textContent = "Edit Project";
  document.getElementById("formSubtitle").textContent = "Change any fields, then save.";

  document.getElementById("nameid").value = project.name;
  document.getElementById("range1id").value = formatDay(project.startDate);
  document.getElementById("range2id").value = formatDay(project.endDate);
  document.getElementById("statusid").value = project.statusSetting;
  typeCheckboxes().forEach((checkbox) => { checkbox.checked = project.types.includes(checkbox.value); });
  document.getElementById("descriptionshortid").value = project.descriptionShort;
  document.getElementById("descriptionlongid").value = project.descriptionLong;
  document.getElementById("resourcesid").value = project.resources.join("\n");
  document.getElementById("addressid").value = project.address;

  setPin(map, { lng: project.lng, lat: project.lat });
  map.jumpTo({ center: [project.lng, project.lat], zoom: 14 });

  const submitButton = document.getElementById("submitid");
  submitButton.textContent = "Save changes";
  submitButton.disabled = false;
}
// #endregion

// #region location
function pickLocation(map, lngLat) {
  // ignore clicks on existing markers (those open their details instead); hidden types don't count
  const clickPoint = map.project(lngLat);
  const onMarker = projectMarkers.filter(isMarkerShown).some((marker) => {
    const markerPoint = map.project(marker.getLngLat());
    return Math.hypot(markerPoint.x - clickPoint.x, markerPoint.y - clickPoint.y) < MARKER_CLICK_TOLERANCE;
  });
  if (onMarker) return;

  setPin(map, lngLat);
  locationChanged = true;
}

function setPin(map, lngLat) {
  if (!pickerMarker) {
    pickerMarker = new mapboxgl.Marker().setLngLat(lngLat).addTo(map);
  } else {
    pickerMarker.setLngLat(lngLat);
  }
  pickedLngLat = lngLat;
}

function clearPickedLocation() {
  if (pickerMarker) pickerMarker.remove();
  pickerMarker = null;
  pickedLngLat = null;
  locationChanged = false;
}

// decides the project's location and address:
//  - pin moved on the map -> use the pin and look up its address
//  - address typed (or changed, when editing) -> look up that address's location
//  - otherwise keep the pin and the address as they are
async function resolveLocation(typedAddress) {
  if (pickedLngLat && locationChanged) {
    return { lngLat: pickedLngLat, address: await reverseGeocode(pickedLngLat.lng, pickedLngLat.lat) };
  }

  const addressEdited = typedAddress && (!editingProject || typedAddress !== editingProject.address);
  if (addressEdited) {
    const found = await forwardGeocode(typedAddress);
    if (found) return { lngLat: found, address: typedAddress };
  }

  if (pickedLngLat) {
    return { lngLat: pickedLngLat, address: typedAddress || await reverseGeocode(pickedLngLat.lng, pickedLngLat.lat) };
  }
  return { lngLat: null, address: typedAddress };
}
// #endregion

async function handleSubmit(map, form) {
  const submitButton = document.getElementById("submitid");
  const types = typeCheckboxes().filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
  if (types.length === 0) {
    alert("Please choose at least one project type.");
    return;
  }

  const { lngLat, address } = await resolveLocation(document.getElementById("addressid").value.trim());

  if (!lngLat) {
    alert("Please click the map to choose the project's location.");
    return;
  }

  const startDate = parseDay(document.getElementById("range1id").value);
  const endDate = parseDay(document.getElementById("range2id").value);
  const statusSetting = document.getElementById("statusid").value;

  const project = {
    id: editingProject ? editingProject.id : null, // new ids come from the server
    name: document.getElementById("nameid").value,
    descriptionShort: document.getElementById("descriptionshortid").value,
    descriptionLong: document.getElementById("descriptionlongid").value,
    resources: document.getElementById("resourcesid").value.split("\n").map((line) => line.trim()).filter(Boolean),
    address,
    types,
    status: projectStatus(statusSetting, startDate, endDate),
    statusSetting,
    author: currentUser,
    lng: lngLat.lng,
    lat: lngLat.lat,
    startDate,
    endDate,
    submittedAt: editingProject ? editingProject.submittedAt : new Date(),
  };

  submitButton.disabled = true;
  try {
    if (editingProject) {
      await updateProject(editingProject.id, project);
    } else {
      project.id = await submitProject(project);
    }
  } catch (error) {
    submitButton.disabled = false;
    if (error instanceof NotLoggedInError) {
      alert("Your login expired. Please log in again.");
      window.location.href = "login.html";
      return;
    }
    console.error(error);
    alert(`${editingProject ? "Saving" : "Submission"} failed: ${error.message}`);
    return;
  }

  if (editingProject) {
    alert("Changes saved!");
    window.location.href = "dashboard.html";
    return;
  }

  submitButton.disabled = false;
  projectMarkers.push(addProjectMarker(map, project));
  clearPickedLocation();
  form.reset();
  alert("Project submitted!");
}

initSubmitPage();
