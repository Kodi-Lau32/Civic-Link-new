// Mapbox setup. Pages need a <div id="map"></div> plus the mapbox-gl and search-js scripts.
//
// Projects are drawn two ways: small colored dots when zoomed out, full pins when zoomed in.
// Between DETAIL_ZOOM_START and DETAIL_ZOOM_END the dots fade out as the pins fade in.
// The legend doubles as a filter (by type and by status), and clicking a project opens a sidebar.

const DETAIL_ZOOM_START = 9;  // below this: dots only
const DETAIL_ZOOM_END = 11;   // above this: pins only

// checkbox groups in the legend; key is the project field each group filters on (a value or a list)
const FILTER_GROUPS = [
  { key: "types", title: "Type", options: PROJECT_TYPES, colors: TYPE_COLORS },
  { key: "status", title: "Status", options: PROJECT_STATUSES },
];

const DOTS_SOURCE = "project-dots";
// map -> { entries: [{ project, marker }], features, hidden: { types: Set, status: Set }, selected, sidebar }
const mapState = new WeakMap();

function createMap() {
  mapboxgl.accessToken = MAPBOX_TOKEN;
  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v12",
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
  });
  const hidden = {};
  FILTER_GROUPS.forEach((group) => { hidden[group.key] = new Set(); });
  mapState.set(map, { entries: [], features: [], hidden, selected: null, sidebar: null });

  addSearchBox(map);
  addFilterLegend(map);
  addSidebar(map);
  map.on("load", () => addDotLayer(map));
  map.on("zoom", () => updateMarkerDetail(map));
  return map;
}

// address search box that flies the map to the result
function addSearchBox(map) {
  const geocoder = new mapboxsearch.MapboxGeocoder();
  geocoder.accessToken = MAPBOX_TOKEN;
  geocoder.options = {
    language: "en",
    country: ["US"],
    proximity: MAP_CENTER,
    worldview: ["us"],
  };
  geocoder.mapboxgl = mapboxgl;
  geocoder.marker = false;
  geocoder.bindMap(map);
  map.getContainer().appendChild(geocoder);
}

function addProjectMarker(map, project) {
  const state = mapState.get(map);
  const index = state.entries.length;
  const color = typeColor(project);
  const hidden = isFilteredOut(state, project);

  const marker = new mapboxgl.Marker({ color })
    .setLngLat([project.lng, project.lat])
    .addTo(map);
  marker.getElement().style.cursor = "pointer";
  marker.getElement().addEventListener("click", () => showProject(map, index));
  marker.getElement().classList.toggle("marker-filtered-out", hidden);

  state.entries.push({ project, marker });
  state.features.push({
    type: "Feature",
    geometry: { type: "Point", coordinates: [project.lng, project.lat] },
    properties: { index, color, hidden },
  });
  refreshDots(map);
  updateMarkerDetail(map);
  return marker;
}

// adds a marker for every project that has valid coordinates, returns the markers
function addProjectMarkers(map, projects) {
  return projects.filter(hasLocation).map((project) => addProjectMarker(map, project));
}

// false if the marker's type or status is currently filtered out
function isMarkerShown(marker) {
  return !marker.getElement().classList.contains("marker-filtered-out");
}

// #region filter legend
function addFilterLegend(map) {
  const legend = document.createElement("div");
  legend.className = "map-legend";

  // header that collapses the legend so it doesn't cover the map
  const toggle = document.createElement("button");
  toggle.type = "button"; // don't submit the form on the submit page
  toggle.className = "map-legend-toggle";
  toggle.textContent = "Filters";
  toggle.addEventListener("click", () => legend.classList.toggle("collapsed"));

  const groups = document.createElement("div");
  groups.className = "map-legend-groups";
  legend.append(toggle, groups);

  FILTER_GROUPS.forEach((group) => {
    const title = document.createElement("div");
    title.className = "map-legend-title";
    title.textContent = group.title;
    groups.appendChild(title);

    Object.entries(group.options).forEach(([value, label]) => {
      const row = document.createElement("label");
      row.className = "map-legend-row";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.addEventListener("change", () => setFilterValueShown(map, group.key, value, checkbox.checked));
      row.appendChild(checkbox);

      if (group.colors) {
        const swatch = document.createElement("span");
        swatch.className = "map-legend-dot";
        swatch.style.background = group.colors[value];
        row.appendChild(swatch);
      }

      row.append(label);
      groups.appendChild(row);
    });
  });

  map.getContainer().appendChild(legend);
}

// hidden if, in some group, all of the project's values are unchecked
// (so a project tagged construction + data center shows while either one is checked)
function isFilteredOut(state, project) {
  return FILTER_GROUPS.some((group) => [].concat(project[group.key]).every((value) => state.hidden[group.key].has(value)));
}

function setFilterValueShown(map, key, value, shown) {
  const state = mapState.get(map);
  if (shown) state.hidden[key].delete(value);
  else state.hidden[key].add(value);
  applyFilters(map);
}

function applyFilters(map) {
  const state = mapState.get(map);

  state.entries.forEach(({ project, marker }, index) => {
    const hidden = isFilteredOut(state, project);
    marker.getElement().classList.toggle("marker-filtered-out", hidden);
    state.features[index].properties.hidden = hidden;
    if (hidden && state.selected === index) closeSidebar(map);
  });
  refreshDots(map);
}
// #endregion

// #region project sidebar
function addSidebar(map) {
  const sidebar = document.createElement("div");
  sidebar.className = "map-sidebar";

  const close = document.createElement("button");
  close.type = "button"; // don't submit the form on the submit page
  close.className = "map-sidebar-close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";
  close.addEventListener("click", () => closeSidebar(map));

  const content = document.createElement("div");
  sidebar.append(close, content);
  map.getContainer().appendChild(sidebar);
  mapState.get(map).sidebar = { element: sidebar, content };

  // clicking empty map closes it (clicks on pins and dots open a project instead)
  map.on("click", (e) => {
    if (e.originalEvent.target.closest(".mapboxgl-marker")) return;
    if (dotClickable(map) && map.queryRenderedFeatures(e.point, { layers: [DOTS_SOURCE] }).length) return;
    closeSidebar(map);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar(map);
  });
}

function showProject(map, index) {
  const state = mapState.get(map);
  const { project } = state.entries[index];

  state.sidebar.content.replaceChildren(buildProjectDetails(project));
  state.sidebar.element.classList.add("open");
  state.sidebar.element.scrollTop = 0;
  setSelected(state, index);
}

function closeSidebar(map) {
  const state = mapState.get(map);
  state.sidebar.element.classList.remove("open");
  setSelected(state, null);
}

function setSelected(state, index) {
  if (state.selected !== null) state.entries[state.selected].marker.getElement().classList.remove("marker-selected");
  state.selected = index;
  if (index !== null) state.entries[index].marker.getElement().classList.add("marker-selected");
}
// #endregion

// #region zoom-dependent detail
function addDotLayer(map) {
  map.addSource(DOTS_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: DOTS_SOURCE,
    type: "circle",
    source: DOTS_SOURCE,
    filter: ["!", ["get", "hidden"]], // filtered-out projects (see applyFilters)
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3, DETAIL_ZOOM_END, 7],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1,
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], DETAIL_ZOOM_START, 1, DETAIL_ZOOM_END, 0],
      "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], DETAIL_ZOOM_START, 1, DETAIL_ZOOM_END, 0],
    },
  });

  map.on("click", DOTS_SOURCE, (e) => {
    if (dotClickable(map)) showProject(map, e.features[0].properties.index);
  });
  map.on("mouseenter", DOTS_SOURCE, () => { if (dotClickable(map)) map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", DOTS_SOURCE, () => { map.getCanvas().style.cursor = ""; });

  refreshDots(map);
  applyFilters(map);
}

// dots are invisible (but still on the map) once pins are fully shown
function dotClickable(map) {
  return map.getLayer(DOTS_SOURCE) && map.getZoom() < DETAIL_ZOOM_END;
}

function refreshDots(map) {
  const source = map.getSource(DOTS_SOURCE);
  if (source) source.setData({ type: "FeatureCollection", features: mapState.get(map).features });
}

// fades pins in as you zoom past DETAIL_ZOOM_START (dots fade out through their layer paint)
function updateMarkerDetail(map) {
  const zoom = map.getZoom();
  const opacity = Math.min(1, Math.max(0, (zoom - DETAIL_ZOOM_START) / (DETAIL_ZOOM_END - DETAIL_ZOOM_START)));

  mapState.get(map).entries.forEach(({ marker }) => {
    const element = marker.getElement();
    // fade the pin graphic, not the wrapper (Mapbox controls the wrapper's own opacity)
    const pin = element.firstElementChild;
    if (pin) pin.style.opacity = opacity;
    element.classList.toggle("marker-faded", opacity < 0.5);
  });
}
// #endregion
