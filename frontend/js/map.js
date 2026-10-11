// Mapbox setup. Pages need a <div id="map"></div> plus the mapbox-gl and search-js scripts.
//
// Projects are drawn two ways: small colored dots when zoomed out, full pins when zoomed in.
// Between DETAIL_ZOOM_START and DETAIL_ZOOM_END the dots fade out as the pins fade in.

const DETAIL_ZOOM_START = 9;  // below this: dots only
const DETAIL_ZOOM_END = 11;   // above this: pins only

// colors for dots, pins, and the legend
const STATUS_STYLES = {
  ongoing: { color: "#2e9e5b", label: "Ongoing" },
  upcoming: { color: "#2f7fd8", label: "Upcoming" },
  completed: { color: "#8a8a8a", label: "Completed" },
  unknown: { color: "#e08a1e", label: "Dates unknown" },
};

const DOTS_SOURCE = "project-dots";
const mapDots = new WeakMap(); // map -> { features, markers } for the dot layer

function createMap() {
  mapboxgl.accessToken = MAPBOX_TOKEN;
  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v12",
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
  });
  mapDots.set(map, { features: [], markers: [] });

  addSearchBox(map);
  addLegend(map);
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

function addLegend(map) {
  const legend = document.createElement("div");
  legend.className = "map-legend";

  Object.values(STATUS_STYLES).forEach(({ color, label }) => {
    const row = document.createElement("div");
    const swatch = document.createElement("span");
    swatch.className = "map-legend-dot";
    swatch.style.background = color;
    row.append(swatch, label);
    legend.appendChild(row);
  });

  map.getContainer().appendChild(legend);
}

function addProjectMarker(map, project) {
  const popup = new mapboxgl.Popup({ offset: 25 }).setDOMContent(buildProjectPopup(project));
  const marker = new mapboxgl.Marker({ color: STATUS_STYLES[projectStatus(project)].color })
    .setLngLat([project.lng, project.lat])
    .setPopup(popup)
    .addTo(map);

  // the dot for this project points back to its marker so clicking it can open the same popup
  const dots = mapDots.get(map);
  dots.markers.push(marker);
  dots.features.push({
    type: "Feature",
    geometry: { type: "Point", coordinates: [project.lng, project.lat] },
    properties: { marker: dots.markers.length - 1, color: STATUS_STYLES[projectStatus(project)].color },
  });
  refreshDots(map);
  updateMarkerDetail(map);
  return marker;
}

// adds a marker for every project that has valid coordinates, returns the markers
function addProjectMarkers(map, projects) {
  return projects.filter(hasLocation).map((project) => addProjectMarker(map, project));
}

// #region zoom-dependent detail
function addDotLayer(map) {
  map.addSource(DOTS_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: DOTS_SOURCE,
    type: "circle",
    source: DOTS_SOURCE,
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
    if (map.getZoom() >= DETAIL_ZOOM_END) return; // pins are showing; they handle their own clicks
    const marker = mapDots.get(map).markers[e.features[0].properties.marker];
    if (!marker.getPopup().isOpen()) marker.togglePopup();
  });
  map.on("mouseenter", DOTS_SOURCE, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", DOTS_SOURCE, () => { map.getCanvas().style.cursor = ""; });

  refreshDots(map);
}

function refreshDots(map) {
  const source = map.getSource(DOTS_SOURCE);
  if (source) source.setData({ type: "FeatureCollection", features: mapDots.get(map).features });
}

// fades pins in as you zoom past DETAIL_ZOOM_START (dots fade out through their layer paint)
function updateMarkerDetail(map) {
  const zoom = map.getZoom();
  const opacity = Math.min(1, Math.max(0, (zoom - DETAIL_ZOOM_START) / (DETAIL_ZOOM_END - DETAIL_ZOOM_START)));

  mapDots.get(map).markers.forEach((marker) => {
    const element = marker.getElement();
    // fade the pin graphic, not the wrapper (Mapbox controls the wrapper's own opacity)
    const pin = element.firstElementChild;
    if (pin) pin.style.opacity = opacity;
    element.classList.toggle("marker-faded", opacity < 0.5);
  });
}
// #endregion
