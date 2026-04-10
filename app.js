const STORAGE_KEY = "sitcheck-demo-listings";
const DEFAULT_CENTER = [14.5547, 121.0244];
const DEFAULT_ZOOM = 12;

const defaultListings = [
  {
    name: "Central Mall 2F Restroom",
    location: "Makati, near the food court",
    latitude: 14.5528,
    longitude: 121.0246,
    hasBidet: true,
    cleanliness: 4,
    pressureLevel: 4,
    paymentRequired: true,
    fee: 10,
    notes: "Well-maintained and usually stocked, but the queue gets longer after lunch."
  },
  {
    name: "Ayala Triangle Park Comfort Room",
    location: "Legazpi Village park entrance",
    latitude: 14.5563,
    longitude: 121.0234,
    hasBidet: false,
    cleanliness: 3,
    pressureLevel: 2,
    paymentRequired: false,
    fee: 0,
    notes: "Free access and easy to find, though supplies can run low during busy hours."
  },
  {
    name: "North Station Concourse Restroom",
    location: "Transit level beside ticketing",
    latitude: 14.6549,
    longitude: 121.0311,
    hasBidet: true,
    cleanliness: 5,
    pressureLevel: 5,
    paymentRequired: false,
    fee: 0,
    notes: "Clean, accessible, and reliable for commuters needing a quick stop."
  },
  {
    name: "Weekend Market Washroom",
    location: "Open-air market rear side",
    latitude: 14.676,
    longitude: 121.0437,
    hasBidet: false,
    cleanliness: 2,
    pressureLevel: 1,
    paymentRequired: true,
    fee: 5,
    notes: "Basic setup, small maintenance fee, and best used before midday rush."
  }
];

const state = {
  listings: loadListings(),
  filters: {
    search: "",
    bidet: "any",
    payment: "any",
    cleanliness: 0
  },
  ui: {
    mobileTab: null,
    desktopPanel: "listings"
  },
  draft: {
    nameTouched: false,
    locationTouched: false,
    geocodeRequestId: 0
  }
};

const elements = {
  searchInput: document.querySelector("#search-input"),
  bidetFilter: document.querySelector("#bidet-filter"),
  paymentFilter: document.querySelector("#payment-filter"),
  cleanlinessFilter: document.querySelector("#cleanliness-filter"),
  totalCount: document.querySelector("#total-count"),
  bidetCount: document.querySelector("#bidet-count"),
  freeCount: document.querySelector("#free-count"),
  resultsSummary: document.querySelector("#results-summary"),
  mapSummary: document.querySelector("#map-summary"),
  cardGrid: document.querySelector("#card-grid"),
  form: document.querySelector("#listing-form"),
  nameInput: document.querySelector('input[name="name"]'),
  locationInput: document.querySelector('input[name="location"]'),
  latitudeInput: document.querySelector('input[name="latitude"]'),
  longitudeInput: document.querySelector('input[name="longitude"]'),
  resetButton: document.querySelector("#reset-demo"),
  pinStatus: document.querySelector("#pin-status"),
  focusPinButton: document.querySelector("#focus-pin"),
  cardTemplate: document.querySelector("#toilet-card-template"),
  mobileTabButtons: document.querySelectorAll("[data-mobile-tab-button]"),
  mobilePanels: document.querySelectorAll("[data-mobile-panel]"),
  mobileTargetLinks: document.querySelectorAll("[data-mobile-target]"),
  desktopPanels: {
    listings: document.querySelector("#toilet-list"),
    add: document.querySelector("#add-form")
  }
};

let map;
let markerLayer;
let zoomControl;
let zoomControlPosition;
let contributionMarker;
let contributionMarkerVisible = false;

bindEvents();
initMap();
render();

function bindEvents() {
  elements.nameInput.addEventListener("input", () => {
    state.draft.nameTouched = true;
  });

  elements.locationInput.addEventListener("input", () => {
    state.draft.locationTouched = true;
  });

  elements.mobileTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setMobileTab(button.dataset.mobileTabButton);
    });
  });

  elements.mobileTargetLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetTab = link.dataset.mobileTarget;

      if (!targetTab) {
        return;
      }

      if (isMobileViewport()) {
        event.preventDefault();
        setMobileTab(targetTab);
        return;
      }

      if (targetTab === "listings" || targetTab === "add") {
        event.preventDefault();
        setDesktopPanel(targetTab);
      }
    });
  });

  elements.focusPinButton.addEventListener("click", () => {
    if (!map || !contributionMarker) {
      return;
    }

    if (isMobileViewport() && state.ui.mobileTab !== "add") {
      state.ui.mobileTab = "add";
      updateMobileUI();
    }

    focusContributionPin();
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    render();
  });

  elements.bidetFilter.addEventListener("change", (event) => {
    state.filters.bidet = event.target.value;
    render();
  });

  elements.paymentFilter.addEventListener("change", (event) => {
    state.filters.payment = event.target.value;
    render();
  });

  elements.cleanlinessFilter.addEventListener("change", (event) => {
    state.filters.cleanliness = Number(event.target.value);
    render();
  });

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(elements.form);

    const newListing = normalizeListing({
      name: formData.get("name"),
      location: formData.get("location"),
      latitude: formData.get("latitude"),
      longitude: formData.get("longitude"),
      hasBidet: formData.get("hasBidet") === "true",
      cleanliness: formData.get("cleanliness"),
      pressureLevel: formData.get("pressureLevel"),
      paymentRequired: formData.get("paymentRequired") === "true",
      fee: formData.get("fee"),
      notes: formData.get("notes")
    }, state.listings.length);

    state.listings = [newListing, ...state.listings];
    persistListings();
    elements.form.reset();
    resetContributionDraft();
    render();
  });

  elements.resetButton.addEventListener("click", () => {
    state.listings = defaultListings.map((listing, index) => normalizeListing(listing, index));
    persistListings();
    resetContributionDraft();
    render();
  });
}

function initMap() {
  if (typeof window.L === "undefined") {
    elements.mapSummary.textContent = "Map library could not be loaded.";
    return;
  }

  map = L.map("map", {
    scrollWheelZoom: !isMobileViewport(),
    zoomControl: false
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  zoomControlPosition = getZoomControlPosition();
  zoomControl = L.control.zoom({
    position: zoomControlPosition
  }).addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
  initContributionMarker();
  window.setTimeout(() => map.invalidateSize(), 0);
  window.addEventListener("resize", () => {
    map.invalidateSize();
    syncZoomControlPosition();
    syncScrollWheelZoom();
    updateMobileUI();
    updateDesktopUI();
  });
}

function render() {
  const visibleListings = getFilteredListings();
  updateMobileUI();
  updateDesktopUI();
  renderStats();
  renderMap(visibleListings);
  renderCards(visibleListings);
  renderSummary(visibleListings);
}

function renderStats() {
  elements.totalCount.textContent = state.listings.length;
  elements.bidetCount.textContent = state.listings.filter((listing) => listing.hasBidet).length;
  elements.freeCount.textContent = state.listings.filter((listing) => !listing.paymentRequired).length;
}

function renderMap(listings) {
  if (!map || !markerLayer) {
    return;
  }

  markerLayer.clearLayers();

  if (!listings.length) {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    elements.mapSummary.textContent = "No map pins match the current filters.";
    return;
  }

  const bounds = [];

  listings.forEach((listing) => {
    if (!Number.isFinite(listing.latitude) || !Number.isFinite(listing.longitude)) {
      return;
    }

    const marker = L.marker([listing.latitude, listing.longitude]);
    marker.bindPopup(buildPopupMarkup(listing));
    marker.addTo(markerLayer);
    bounds.push([listing.latitude, listing.longitude]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, {
      paddingTopLeft: getMapFitPadding().topLeft,
      paddingBottomRight: getMapFitPadding().bottomRight,
      maxZoom: 16
    });
  } else {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }

  const suffix = listings.length === 1 ? "pin" : "pins";
  elements.mapSummary.textContent = `Showing ${listings.length} ${suffix} on the map.`;
}

function renderCards(listings) {
  elements.cardGrid.innerHTML = "";

  if (!listings.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No toilets match the current filters. Try broadening the search.";
    elements.cardGrid.appendChild(emptyState);
    return;
  }

  listings.forEach((listing) => {
    const fragment = elements.cardTemplate.content.cloneNode(true);
    fragment.querySelector(".card-title").textContent = listing.name;
    fragment.querySelector(".card-location").textContent = listing.location;
    fragment.querySelector(".cleanliness-badge").textContent = `Cleanliness ${listing.cleanliness}/5`;
    fragment.querySelector(".card-notes").textContent = listing.notes;
    fragment.querySelector(".card-fee").textContent = listing.paymentRequired
      ? `Fee required: PHP ${listing.fee || 0}`
      : "Free access";

    const tagRow = fragment.querySelector(".tag-row");
    tagRow.appendChild(buildTag(listing.hasBidet ? "Bidet available" : "No bidet"));
    tagRow.appendChild(buildTag(listing.paymentRequired ? "Paid entry" : "Free entry", listing.paymentRequired));
    fragment.querySelector(".pressure-row").appendChild(buildPressureBadge(listing.pressureLevel));

    elements.cardGrid.appendChild(fragment);
  });
}

function renderSummary(listings) {
  const suffix = listings.length === 1 ? "listing" : "listings";
  elements.resultsSummary.textContent = `Showing ${listings.length} ${suffix} from ${state.listings.length} total.`;
}

function getFilteredListings() {
  return state.listings.filter((listing) => {
    const matchesSearch =
      !state.filters.search ||
      [listing.name, listing.location, listing.notes]
        .join(" ")
        .toLowerCase()
        .includes(state.filters.search);

    const matchesBidet =
      state.filters.bidet === "any" ||
      (state.filters.bidet === "yes" && listing.hasBidet) ||
      (state.filters.bidet === "no" && !listing.hasBidet);

    const matchesPayment =
      state.filters.payment === "any" ||
      (state.filters.payment === "free" && !listing.paymentRequired) ||
      (state.filters.payment === "paid" && listing.paymentRequired);

    const matchesCleanliness = listing.cleanliness >= state.filters.cleanliness;

    return matchesSearch && matchesBidet && matchesPayment && matchesCleanliness;
  });
}

function buildTag(text, warning = false) {
  const tag = document.createElement("span");
  tag.className = warning ? "tag warning" : "tag";
  tag.textContent = text;
  return tag;
}

function buildPopupMarkup(listing) {
  const feeText = listing.paymentRequired ? `Fee: PHP ${listing.fee || 0}` : "Free access";

  return `
    <div class="map-popup">
      <h3>${escapeHtml(listing.name)}</h3>
      <p>${escapeHtml(listing.location)}</p>
      <div class="popup-meta">
        <span class="tag">${listing.hasBidet ? "Bidet available" : "No bidet"}</span>
        <span class="tag">${feeText}</span>
        <span class="tag">Cleanliness ${listing.cleanliness}/5</span>
        <span class="tag pressure-inline">${escapeHtml(getPressureSummary(listing.pressureLevel))}</span>
      </div>
    </div>
  `;
}

function normalizeListing(listing, index) {
  const fallback = getFallbackCoordinates(index);
  const latitude = Number(listing.latitude);
  const longitude = Number(listing.longitude);

  return {
    name: String(listing.name || "Unnamed restroom").trim(),
    location: String(listing.location || "Location not provided").trim(),
    latitude: Number.isFinite(latitude) ? latitude : fallback.latitude,
    longitude: Number.isFinite(longitude) ? longitude : fallback.longitude,
    hasBidet: Boolean(listing.hasBidet),
    cleanliness: clampCleanliness(Number(listing.cleanliness)),
    pressureLevel: clampPressure(Number(listing.pressureLevel)),
    paymentRequired: Boolean(listing.paymentRequired),
    fee: Math.max(0, Number(listing.fee) || 0),
    notes: String(listing.notes || "No additional notes yet.").trim()
  };
}

function getFallbackCoordinates(index) {
  const offset = index * 0.008;

  return {
    latitude: DEFAULT_CENTER[0] + offset,
    longitude: DEFAULT_CENTER[1] + offset
  };
}

function getMapFitPadding() {
  if (window.innerWidth <= 860) {
    if (!state.ui.mobileTab) {
      return {
        topLeft: [24, 120],
        bottomRight: [24, 92]
      };
    }

    return {
      topLeft: [24, 132],
      bottomRight: [24, 250]
    };
  }

  if (window.innerWidth <= 1100) {
    return {
      topLeft: [32, 140],
      bottomRight: [32, 32]
    };
  }

  return {
    topLeft: [396, 220],
    bottomRight: [476, 40]
  };
}

function setMobileTab(tab) {
  if (isMobileViewport() && state.ui.mobileTab === tab) {
    state.ui.mobileTab = null;
  } else {
    state.ui.mobileTab = tab;
  }

  render();

  if (state.ui.mobileTab === "add") {
    focusContributionPin();
  }
}

function setDesktopPanel(panel) {
  if (panel !== "listings" && panel !== "add") {
    return;
  }

  state.ui.desktopPanel = panel;
  updateDesktopUI();

  if (panel === "add") {
    focusContributionPin();
  }
}

function updateMobileUI() {
  elements.mobileTabButtons.forEach((button) => {
    const isActive = button.dataset.mobileTabButton === state.ui.mobileTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  elements.mobilePanels.forEach((panel) => {
    const isActive = isMobileViewport() && panel.dataset.mobilePanel === state.ui.mobileTab;
    panel.classList.toggle("is-active", isActive);
  });

  updateContributionMarkerVisibility();
}

function updateDesktopUI() {
  const isDesktop = !isMobileViewport();

  elements.mobileTargetLinks.forEach((link) => {
    const targetPanel = link.dataset.mobileTarget;
    const isActive = isDesktop && targetPanel === state.ui.desktopPanel;

    link.classList.toggle("primary", isActive);
    link.classList.toggle("secondary", !isActive);
  });

  Object.entries(elements.desktopPanels).forEach(([panelName, panelElement]) => {
    if (!panelElement) {
      return;
    }

    const shouldHide = isDesktop && panelName !== state.ui.desktopPanel;
    panelElement.classList.toggle("desktop-hidden", shouldHide);
    panelElement.hidden = shouldHide;
  });

  updateContributionMarkerVisibility();
}

function isMobileViewport() {
  return window.innerWidth <= 860;
}

function getZoomControlPosition() {
  return isMobileViewport() ? "topright" : "bottomleft";
}

function syncZoomControlPosition() {
  const nextPosition = getZoomControlPosition();

  if (!map || !zoomControl || nextPosition === zoomControlPosition) {
    return;
  }

  map.removeControl(zoomControl);
  zoomControl = L.control.zoom({
    position: nextPosition
  }).addTo(map);
  zoomControlPosition = nextPosition;
}

function syncScrollWheelZoom() {
  if (!map) {
    return;
  }

  if (isMobileViewport()) {
    map.scrollWheelZoom.disable();
    return;
  }

  map.scrollWheelZoom.enable();
}

function initContributionMarker() {
  if (!map || contributionMarker) {
    return;
  }

  contributionMarker = L.marker(DEFAULT_CENTER, {
    draggable: true,
    keyboard: true,
    title: "Contribution pin",
    icon: L.divIcon({
      className: "contribution-pin-wrapper",
      html: '<div class="contribution-pin"></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    })
  });

  contributionMarker.on("dragstart", () => {
    elements.pinStatus.textContent = "Pin moved. Looking up the nearest location details...";
  });

  contributionMarker.on("dragend", () => {
    const position = contributionMarker.getLatLng();
    applyContributionPosition(position.lat, position.lng);
  });

  resetContributionDraft();
  updateContributionMarkerVisibility();
}

function updateContributionMarkerVisibility() {
  if (!map || !contributionMarker) {
    return;
  }

  const shouldShow = isMobileViewport()
    ? state.ui.mobileTab === "add"
    : state.ui.desktopPanel === "add";

  if (shouldShow && !contributionMarkerVisible) {
    contributionMarker.addTo(map);
    contributionMarkerVisible = true;
  }

  if (!shouldShow && contributionMarkerVisible) {
    contributionMarker.remove();
    contributionMarkerVisible = false;
  }
}

function focusContributionPin() {
  if (!map || !contributionMarker) {
    return;
  }

  const markerPoint = map.latLngToContainerPoint(contributionMarker.getLatLng());
  const targetPoint = getContributionPinTargetPoint();
  const offset = [
    markerPoint.x - targetPoint.x,
    markerPoint.y - targetPoint.y
  ];

  map.panBy(offset, {
    animate: true,
    duration: 0.4
  });
}

function resetContributionDraft() {
  state.draft.nameTouched = false;
  state.draft.locationTouched = false;

  elements.nameInput.value = "";
  elements.locationInput.value = "";
  elements.pinStatus.textContent = "Drag the orange pin on the map to the right spot. We will suggest the location details automatically.";

  if (!contributionMarker) {
    return;
  }

  const position = map ? map.getCenter() : { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
  contributionMarker.setLatLng(position);
  applyContributionPosition(position.lat, position.lng);
}

function applyContributionPosition(latitude, longitude) {
  elements.latitudeInput.value = String(latitude);
  elements.longitudeInput.value = String(longitude);
  reverseGeocode(latitude, longitude);
}

async function reverseGeocode(latitude, longitude) {
  const requestId = state.draft.geocodeRequestId + 1;
  state.draft.geocodeRequestId = requestId;
  elements.pinStatus.textContent = "Pin placed. Looking up nearby location details...";

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error("Reverse geocoding failed");
    }

    const result = await response.json();

    if (requestId !== state.draft.geocodeRequestId) {
      return;
    }

    const suggestedName = buildSuggestedName(result);
    const suggestedLocation = result.display_name || `Pinned location at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

    if (!state.draft.nameTouched) {
      elements.nameInput.value = suggestedName;
    }

    if (!state.draft.locationTouched) {
      elements.locationInput.value = suggestedLocation;
    }

    elements.pinStatus.textContent = "Pin placed. Suggested name and location are ready to review.";
  } catch {
    if (requestId !== state.draft.geocodeRequestId) {
      return;
    }

    if (!state.draft.locationTouched) {
      elements.locationInput.value = `Pinned location at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    }

    if (!state.draft.nameTouched && !elements.nameInput.value.trim()) {
      elements.nameInput.value = "Pinned restroom";
    }

    elements.pinStatus.textContent = "Pin placed. We could not fetch the address, so you can fill in the details manually.";
  }
}

function buildSuggestedName(result) {
  const address = result.address || {};

  return (
    result.name ||
    address.amenity ||
    address.building ||
    address.shop ||
    address.tourism ||
    address.road ||
    "Pinned restroom"
  );
}

function getContributionPinTargetPoint() {
  if (!map) {
    return { x: 0, y: 0 };
  }

  const size = map.getSize();

  if (isMobileViewport()) {
    return {
      x: size.x / 2,
      y: size.y * 0.42
    };
  }

  return {
    x: size.x * 0.58,
    y: size.y * 0.48
  };
}

function clampPressure(value) {
  if (!Number.isFinite(value)) {
    return 3;
  }

  return Math.min(5, Math.max(1, Math.round(value)));
}

function getPressureLabel(level) {
  const labels = {
    1: "Polite drizzle",
    2: "Gentle splash",
    3: "Steady spray",
    4: "Power rinse",
    5: "Firehose energy"
  };

  return labels[level] || "Steady spray";
}

function getPressureSummary(level) {
  return `${renderPressureText(level)} ${getPressureLabel(level)}`;
}

function renderPressureText(level) {
  return `${level} ${level === 1 ? "drop" : "drops"} -`;
}

function buildPressureBadge(level) {
  const badge = document.createElement("div");
  badge.className = "pressure-badge";

  const title = document.createElement("span");
  title.className = "pressure-badge-title";
  title.textContent = "Pressure";

  const icons = document.createElement("span");
  icons.className = "pressure-icons";
  icons.setAttribute("aria-hidden", "true");

  for (let i = 0; i < level; i += 1) {
    const drop = document.createElement("span");
    drop.className = "pressure-drop";
    icons.appendChild(drop);
  }

  const label = document.createElement("span");
  label.className = "pressure-badge-label";
  label.textContent = `${level}/5 - ${getPressureLabel(level)}`;

  badge.append(title, icons, label);
  return badge;
}

function clampCleanliness(value) {
  if (!Number.isFinite(value)) {
    return 3;
  }

  return Math.min(5, Math.max(1, Math.round(value)));
}

function loadListings() {
  const storedValue = window.localStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return defaultListings.map((listing, index) => normalizeListing(listing, index));
  }

  try {
    const parsed = JSON.parse(storedValue);

    if (!Array.isArray(parsed) || !parsed.length) {
      return defaultListings.map((listing, index) => normalizeListing(listing, index));
    }

    return parsed.map((listing, index) => normalizeListing(listing, index));
  } catch {
    return defaultListings.map((listing, index) => normalizeListing(listing, index));
  }
}

function persistListings() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.listings));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
