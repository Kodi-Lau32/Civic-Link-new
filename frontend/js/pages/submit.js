// Submit page: click the map (or type an address) to place a project, then send it to the sheet.

const MARKER_CLICK_TOLERANCE = 25; // pixels; clicks this close to an existing marker don't move the pin

let pickedLngLat = null; // location chosen by clicking the map
let pickerMarker = null;
const projectMarkers = [];

function initSubmitPage() {
  mapboxsearch.autofill({ accessToken: MAPBOX_TOKEN });

  const map = createMap();
  loadProjects()
    .then((projects) => projectMarkers.push(...addProjectMarkers(map, projects)))
    .catch(console.error);

  map.on("click", (e) => pickLocation(map, e.lngLat));

  const form = document.getElementById("projectForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSubmit(map, form);
  });
}

function pickLocation(map, lngLat) {
  // ignore clicks on existing markers (those open their popup instead)
  const clickPoint = map.project(lngLat);
  const onMarker = projectMarkers.some((marker) => {
    const markerPoint = map.project(marker.getLngLat());
    return Math.hypot(markerPoint.x - clickPoint.x, markerPoint.y - clickPoint.y) < MARKER_CLICK_TOLERANCE;
  });
  if (onMarker) return;

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
}

async function handleSubmit(map, form) {
  const submitButton = document.getElementById("submitid");
  const typedAddress = document.getElementById("addressid").value.trim();

  // clicked location wins; otherwise look up the typed address
  let lngLat = pickedLngLat;
  let address = typedAddress;
  if (lngLat) {
    address = await reverseGeocode(lngLat.lng, lngLat.lat);
  } else if (typedAddress) {
    lngLat = await forwardGeocode(typedAddress);
  }

  if (!lngLat) {
    alert("Please click the map to choose the project's location.");
    return;
  }

  const project = {
    id: Math.random() * 10000000000000000,
    name: document.getElementById("nameid").value,
    description: document.getElementById("descriptionid").value,
    address,
    lng: lngLat.lng,
    lat: lngLat.lat,
    startDate: parseDay(document.getElementById("range1id").value),
    endDate: parseDay(document.getElementById("range2id").value),
    submittedAt: new Date(),
  };

  submitButton.disabled = true;
  try {
    await submitProject(project);
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      alert("Your login expired. Please log in again.");
      window.location.href = "login.html";
      return;
    }
    console.error(error);
    alert("Submission failed. Please try again.");
    return;
  } finally {
    submitButton.disabled = false;
  }

  projectMarkers.push(addProjectMarker(map, project));
  clearPickedLocation();
  form.reset();
  alert("Project submitted!");
}

initSubmitPage();
