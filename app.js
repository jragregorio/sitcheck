const STORAGE_KEY = "sitcheck-demo-listings";
const DEFAULT_CENTER = [14.5547, 121.0244];
const DEFAULT_ZOOM = 12;
const SUPABASE_TABLES = {
  toilets: "toilets",
  submissions: "toilet_submissions"
};
const AUTO_LOCATE_DELAY_MS = 450;
const NEAREST_SORT_LOCATION_DEBOUNCE_MS = 2000;
const RETURN_MAP_VIEW_SESSION_KEY = "sitcheck-return-map-view";
const SPLASH_SEEN_SESSION_KEY = "sitcheck-splash-seen";
const TOUR_COMPLETE_STORAGE_KEY = "sitcheck-onboarding-complete";
const TOUR_STEPS = [
  {
    targetSelector: "#map",
    title: "Explore the map",
    body: "Blue pins are restrooms nearby. Tap a pin to see bidet, tissue, fees, and cleanliness details."
  },
  {
    targetSelector: '[data-tour-target="listings-tab"]',
    title: "Browse and filter",
    body: "Open Listings to scroll nearby restrooms, or Filters to narrow by bidet, payment, and cleanliness."
  },
  {
    targetSelector: '[data-tour-target="add-tab"]',
    title: "Add a restroom",
    body: "Know a spot that is missing? Tap Add toilet to place a pin or drag the Orange Pin to the right spot. We will suggest the location details automatically. Then submit it for review."
  },
  {
    targetSelector: '[data-tour-target="menu-button"]',
    title: "Open the menu",
    body: "Tap the menu button whenever you want to adjust SitCheck or learn more about the app.",
    menuStep: true
  },
  {
    targetSelector: '[data-tour-target="options-menu"]',
    title: "Choose your options",
    body: "Options lets you control nearby suggestions and contribution reminders.",
    menuStep: true,
    openMenu: true
  },
  {
    targetSelector: '[data-tour-target="about-menu"]',
    title: "About SitCheck",
    body: "About SitCheck has app details, support links, reviews, and a button to replay this tour.",
    menuStep: true,
    openMenu: true
  }
];
const SPLASH_MIN_DURATION_MS = 5000;
const SPLASH_FADE_DURATION_MS = 1400;
const SPLASH_LINE_CYCLE_MS = 2000;
const HERO_COMPACT_DELAY_MS = 3000;
const NEARBY_LISTING_RADIUS_KM_DEFAULT = 0.2;
const AREA_NUDGE_RADIUS_MIN_KM = 0.2;
const AREA_NUDGE_RADIUS_MAX_KM = 0.5;
const AREA_NUDGE_SETTINGS_STORAGE_KEY = "sitcheck-area-nudge-settings";
const AREA_NUDGE_CHECK_INTERVAL_MS = 30000;
const AREA_NUDGE_MIN_MOVE_KM = 0.05;
const AREA_NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const AREA_NUDGE_COOLDOWN_STORAGE_KEY = "sitcheck-area-nudge-cooldown";
const AREA_NUDGE_STATIONARY_MS = 30000;
const AREA_NUDGE_STATIONARY_MAX_MOVE_KM = 0.03;
const AREA_NUDGE_MAP_ACTIVE_MS = 12000;
const ACCURACY_VOTES_STORAGE_KEY = "sitcheck-accuracy-votes";
const ACCURACY_VOTE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_AREA_NUDGE_SETTINGS = {
  enabled: true,
  radiusKm: NEARBY_LISTING_RADIUS_KM_DEFAULT
};
const SPLASH_LOADING_LINES = [
  "Calibrating bidet radar...",
  "Scanning for hero restrooms...",
  "Checking splash pressure...",
  "Estimating tissue refill rates...",
  "Counting clean seats...",
  "Routing your relief run..."
];
const splashStartedAtMs = Date.now();

const defaultListings = [
  {
    name: "Central Mall 2F Restroom",
    location: "Makati, near the food court",
    latitude: 14.5528,
    longitude: 121.0246,
    hasBidet: true,
    hasTissue: true,
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
    hasTissue: true,
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
    hasTissue: true,
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
    hasTissue: false,
    cleanliness: 2,
    pressureLevel: 1,
    paymentRequired: true,
    fee: 5,
    notes: "Basic setup, small maintenance fee, and best used before midday rush."
  }
];

const supabaseConfig = window.SITCHECK_CONFIG || {};
const supabaseUrl = typeof supabaseConfig.supabaseUrl === "string" ? supabaseConfig.supabaseUrl.trim() : "";
const supabaseAnonKey = typeof supabaseConfig.supabaseAnonKey === "string" ? supabaseConfig.supabaseAnonKey.trim() : "";
const supabaseClient = supabaseUrl && supabaseAnonKey && window.supabase?.createClient
  ? window.supabase.createClient(supabaseUrl, supabaseAnonKey)
  : null;

const state = {
  listings: supabaseClient ? [] : loadListings(),
  filters: {
    search: "",
    bidet: "any",
    payment: "any",
    cleanliness: 0
  },
  sort: "default",
  ui: {
    mobileTab: null,
    desktopPanel: "listings",
    dataMode: supabaseClient ? "supabase" : "local",
    isLoadingListings: Boolean(supabaseClient),
    remoteError: ""
  },
  draft: {
    nameTouched: false,
    locationTouched: false,
    geocodeRequestId: 0,
    latitude: null,
    longitude: null
  }
};

const elements = {
  searchInput: document.querySelector("#search-input"),
  bidetFilter: document.querySelector("#bidet-filter"),
  paymentFilter: document.querySelector("#payment-filter"),
  cleanlinessFilter: document.querySelector("#cleanliness-filter"),
  clearFiltersButton: document.querySelector("#clear-filters"),
  filterResultsCount: document.querySelector("#filter-results-count"),
  viewFilterResultsButton: document.querySelector("#view-filter-results"),
  sortButtons: document.querySelectorAll("[data-sort-option]"),
  totalCount: document.querySelector("#total-count"),
  bidetCount: document.querySelector("#bidet-count"),
  freeCount: document.querySelector("#free-count"),
  resultsSummary: document.querySelector("#results-summary"),
  heroPanel: document.querySelector("#hero-panel"),
  mapSummary: document.querySelector("#map-summary"),
  areaNudgeChip: document.querySelector("#area-nudge-chip"),
  areaNudgeChipText: document.querySelector(".area-nudge-chip-text"),
  areaNudgeChipDismiss: document.querySelector(".area-nudge-chip-dismiss"),
  areaNudgeChipAdd: document.querySelector(".area-nudge-chip-add"),
  addFormNote: document.querySelector("#add-form-note"),
  cardGrid: document.querySelector("#card-grid"),
  splashOverlay: document.querySelector("#app-splash"),
  toast: document.querySelector("#toast"),
  aboutButton: document.querySelector(".mobile-about-button"),
  appMenu: document.querySelector("#app-menu"),
  appMenuCloseButtons: document.querySelectorAll("[data-app-menu-close]"),
  locateButton: null,
  form: document.querySelector("#listing-form"),
  nameInput: document.querySelector('input[name="name"]'),
  locationInput: document.querySelector('input[name="location"]'),
  latitudeInput: document.querySelector('input[name="latitude"]'),
  longitudeInput: document.querySelector('input[name="longitude"]'),
  hasBidetInput: document.querySelector("#has-bidet-input"),
  pressureFieldset: document.querySelector("#pressure-fieldset"),
  paymentRequiredInput: document.querySelector('input[name="paymentRequired"]'),
  feeField: document.querySelector("#fee-field"),
  feeInput: document.querySelector('input[name="fee"]'),
  resetButton: document.querySelector("#reset-demo"),
  submitButton: document.querySelector("#submit-listing"),
  pinStatus: document.querySelector("#pin-status"),
  focusPinButton: document.querySelector("#focus-pin"),
  resetPinButton: document.querySelector("#reset-pin"),
  cardTemplate: document.querySelector("#toilet-card-template"),
  mobileTabButtons: document.querySelectorAll("[data-mobile-tab-button]"),
  mobilePanels: document.querySelectorAll("[data-mobile-panel]"),
  mobileTargetLinks: document.querySelectorAll("[data-mobile-target]"),
  tourOverlay: document.querySelector("#app-tour"),
  tourSpotlight: document.querySelector("#app-tour-spotlight"),
  tourStepLabel: document.querySelector("#app-tour-step"),
  tourTitle: document.querySelector("#app-tour-title"),
  tourBody: document.querySelector("#app-tour-body"),
  tourSkipButton: document.querySelector("#app-tour-skip"),
  tourNextButton: document.querySelector("#app-tour-next"),
  overlayLeft: document.querySelector(".overlay-left"),
  overlayRight: document.querySelector(".overlay-right"),
  splashLine: document.querySelector("#app-splash-line"),
  desktopPanels: {
    listings: document.querySelector("#toilet-list"),
    add: document.querySelector("#add-form")
  }
};

let map;
let markerLayer;
let userLocationLayer;
let mapControls;
let mapControlsPosition;
let listingMarkerMap = new Map();
let contributionMarker;
let contributionMarkerVisible = false;
let isLocatingUser = false;
let toastTimeoutId = 0;
let userLocation = null;
let userLocationWatchId = null;
let nearestSortRenderTimeoutId = 0;
let hasHiddenSplash = false;
let hasAttemptedAutoLocate = false;
let hasShownLocationEnabledToast = false;
let splashLineIntervalId = 0;
let lastSplashLineIndex = -1;
let pendingReturnMapView = loadReturnMapView();
let heroCompactTimeoutId = 0;
let areaNudgeCheckTimeoutId = 0;
let areaNudgeVisible = false;
let userLocationFixCount = 0;
let lastAreaNudgeCheckAtMs = 0;
let lastAreaNudgeCheckLatitude = null;
let lastAreaNudgeCheckLongitude = null;
let mapViewActiveSinceMs = 0;
let stationarySinceMs = 0;
let stationaryAnchorLatitude = null;
let stationaryAnchorLongitude = null;
const tourState = {
  active: false,
  stepIndex: 0,
  force: false
};

initializeSplashVisibility();
initializeSplashLineRotation();

try {
  bindEvents();
  initMap();
  syncDataModeUI();
  render();
  void initContributionReminderRuntime();

  if (supabaseClient) {
    void initializeRemoteListings();
  } else {
    scheduleSplashHide();
    scheduleAutoLocateUser();
  }

  if (hasHiddenSplash) {
    maybeScheduleAppTour();
    maybeShowContributionReminderNotice();
    maybeOpenAddFromQuery();
    scheduleHeroCompactMode();
    syncAreaNudgeMapViewState();
    updateMapControlLayout();
  }
} catch (error) {
  console.error("SitCheck startup failed:", error);
  scheduleSplashHide();
}

function bindEvents() {
  window.addEventListener("pagehide", stopUserLocationWatch);
  window.addEventListener("pageshow", () => {
    syncAreaNudgeChipMessage();
    syncAreaNudgeMapViewState();

    if (!isAreaNudgeEnabled()) {
      dismissAreaNudgeIfVisible();
    }

    queueAreaNudgeEvaluation();
  });

  elements.nameInput.addEventListener("input", () => {
    state.draft.nameTouched = true;
  });

  elements.locationInput.addEventListener("input", () => {
    state.draft.locationTouched = true;
  });

  if (elements.hasBidetInput) {
    elements.hasBidetInput.addEventListener("change", syncPressureFieldVisibility);
    syncPressureFieldVisibility();
  }

  if (elements.paymentRequiredInput) {
    elements.paymentRequiredInput.addEventListener("change", syncFeeFieldState);
    syncFeeFieldState();
  }

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

  document.querySelectorAll('a[href="about.html"], a[href="options.html"], a[href="admin.html"]').forEach((link) => {
    link.addEventListener("click", () => {
      saveReturnMapView();
    });
  });

  if (elements.aboutButton) {
    elements.aboutButton.addEventListener("click", openAppMenu);
  }

  elements.appMenuCloseButtons.forEach((button) => {
    button.addEventListener("click", closeAppMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.appMenu?.hidden === false) {
      closeAppMenu();
    }
  });

  bindAccuracyInteractions();

  if (elements.tourSkipButton) {
    elements.tourSkipButton.addEventListener("click", () => {
      completeAppTour();
    });
  }

  if (elements.tourNextButton) {
    elements.tourNextButton.addEventListener("click", () => {
      advanceAppTour();
    });
  }

  window.addEventListener("resize", handleTourResize);
  window.addEventListener("resize", handleHeroCompactResize);
  window.addEventListener("resize", updateMapControlLayout);

  if (elements.heroPanel) {
    elements.heroPanel.addEventListener("click", handleHeroPanelClick);
  }

  if (elements.areaNudgeChipDismiss) {
    elements.areaNudgeChipDismiss.addEventListener("click", () => {
      hideAreaNudge();
    });
  }

  if (elements.areaNudgeChipAdd) {
    elements.areaNudgeChipAdd.addEventListener("click", () => {
      openContributeFromAreaNudge();
    });
  }

  if (elements.focusPinButton) {
    elements.focusPinButton.addEventListener("click", () => {
      if (!map || !contributionMarker) {
        return;
      }

      if (isMobileViewport() && state.ui.mobileTab !== "add") {
        setMobileTab("add");
      }

      focusContributionPin();
    });
  }

  if (elements.resetPinButton) {
    elements.resetPinButton.addEventListener("click", () => {
      if (!contributionMarker) {
        return;
      }

      elements.pinStatus.textContent = "Pin reset near the center of the current map view.";
      placeContributionPinFromCurrentView({
        focusAfterPlacement: true
      });
    });
  }

  if (elements.searchInput) {
    elements.searchInput.addEventListener("input", (event) => {
      state.filters.search = event.target.value.trim().toLowerCase();
      render();
    });
  }

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

  elements.clearFiltersButton.addEventListener("click", () => {
    resetFilters();
    render();
  });

  if (elements.viewFilterResultsButton) {
    elements.viewFilterResultsButton.addEventListener("click", () => {
      showFilteredResultsOnMap();
    });
  }

  elements.sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextSort = button.dataset.sortOption;

      if (nextSort === "nearest" && !userLocation) {
        showToast("Use your location first to sort by nearest.", "error");
        return;
      }

      state.sort = nextSort;
      render();
    });
  });

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(elements.form);

    const newListing = normalizeListing({
      name: formData.get("name"),
      location: formData.get("location"),
      latitude: formData.get("latitude"),
      longitude: formData.get("longitude"),
      hasBidet: formData.get("hasBidet") === "true",
      hasTissue: formData.get("hasTissue") === "true",
      cleanliness: formData.get("cleanliness"),
      pressureLevel: formData.get("hasBidet") === "true" ? formData.get("pressureLevel") : null,
      paymentRequired: formData.get("paymentRequired") === "true",
      fee: formData.get("fee"),
      notes: formData.get("notes")
    }, state.listings.length);

    if (isUsingSupabase()) {
      setSubmitButtonState(true);

      try {
        await submitSupabaseListing(newListing);
        elements.form.reset();
        resetContributionDraft();
        syncFeeFieldState();
        syncPressureFieldVisibility();
        elements.pinStatus.textContent = "Submission sent for review. Thanks for contributing.";
        setHeroSummary("Contribution submitted for review.");
        showToast("Submitted for review. Thanks!", "success");
        closeContributePanel();
      } catch (error) {
        elements.pinStatus.textContent = error.message || "Could not submit contribution right now.";
        showToast(error.message || "Could not submit contribution right now.", "error");
      } finally {
        setSubmitButtonState(false);
      }

      return;
    }

    state.listings = [newListing, ...state.listings];
    persistListings();
    elements.form.reset();
    resetContributionDraft();
    syncFeeFieldState();
    syncPressureFieldVisibility();
    render();
    showToast("Listing saved to your local demo data.", "success");
  });

  elements.resetButton.addEventListener("click", () => {
    if (isUsingSupabase()) {
      return;
    }

    state.listings = defaultListings.map((listing, index) => normalizeListing(listing, index));
    persistListings();
    resetContributionDraft();
    render();
  });
}

function initMap() {
  if (typeof window.L === "undefined") {
    setHeroSummary("Map library could not be loaded.");
    return;
  }

  map = L.map("map", {
    scrollWheelZoom: !isMobileViewport(),
    zoomControl: false
  }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  syncMapControls(true);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
  userLocationLayer = L.layerGroup().addTo(map);
  initContributionMarker();
  window.setTimeout(() => map.invalidateSize(), 0);
  window.addEventListener("resize", () => {
    map.invalidateSize();
    syncMapControls();
    syncScrollWheelZoom();
    updateMobileUI();
    updateDesktopUI();
  });
}

function render() {
  const visibleListings = getVisibleListings();
  syncFilterUI();
  syncSortUI();
  updateMobileUI();
  updateDesktopUI();
  renderStats();
  renderMap(visibleListings);
  renderCards(visibleListings);
  renderSummary(visibleListings);
  refreshHeroSummary(visibleListings);
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
  listingMarkerMap = new Map();

  if (state.ui.isLoadingListings) {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    return;
  }

  if (state.ui.remoteError) {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    return;
  }

  if (!listings.length) {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    return;
  }

  const bounds = [];

  listings.forEach((listing) => {
    if (!Number.isFinite(listing.latitude) || !Number.isFinite(listing.longitude)) {
      return;
    }

    const marker = L.marker([listing.latitude, listing.longitude]);
    marker.bindPopup(buildPopupMarkup(listing), {
      autoPan: false
    });
    marker.addTo(markerLayer);
    listingMarkerMap.set(listing, marker);
    bounds.push([listing.latitude, listing.longitude]);
  });

  if (bounds.length) {
    if (restoreReturnMapView()) {
      return;
    }

    map.fitBounds(bounds, {
      paddingTopLeft: getMapFitPadding().topLeft,
      paddingBottomRight: getMapFitPadding().bottomRight,
      maxZoom: 16
    });
  } else {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }
}

function saveReturnMapView() {
  if (!map) {
    return;
  }

  const center = map.getCenter();
  const view = {
    latitude: center.lat,
    longitude: center.lng,
    zoom: map.getZoom()
  };

  try {
    window.sessionStorage.setItem(RETURN_MAP_VIEW_SESSION_KEY, JSON.stringify(view));
  } catch {
    // Ignore storage failures; map can still fall back to normal fit behavior.
  }
}

function loadReturnMapView() {
  try {
    const storedValue = window.sessionStorage.getItem(RETURN_MAP_VIEW_SESSION_KEY);

    if (!storedValue) {
      return null;
    }

    const parsed = JSON.parse(storedValue);
    const latitude = Number(parsed.latitude);
    const longitude = Number(parsed.longitude);
    const zoom = Number(parsed.zoom);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(zoom)) {
      return null;
    }

    return {
      latitude,
      longitude,
      zoom
    };
  } catch {
    return null;
  }
}

function restoreReturnMapView() {
  if (!map || !pendingReturnMapView) {
    return false;
  }

  map.setView([pendingReturnMapView.latitude, pendingReturnMapView.longitude], pendingReturnMapView.zoom, {
    animate: false
  });
  pendingReturnMapView = null;

  try {
    window.sessionStorage.removeItem(RETURN_MAP_VIEW_SESSION_KEY);
  } catch {
    // Ignore storage failures after successful restore.
  }

  return true;
}

function locateUser(options = {}) {
  const { silentOnError = false } = options;

  if (!map) {
    if (!silentOnError) {
      setHeroSummary("Map is still loading.");
    }
    return;
  }

  if (!navigator.geolocation) {
    if (!silentOnError) {
      setHeroSummary("Current location is not supported by this browser.");
    }
    return;
  }

  if (userLocationWatchId !== null && hasValidUserLocation()) {
    map.flyTo([userLocation.latitude, userLocation.longitude], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 1
    });
    if (!silentOnError) {
      setHeroSummary("Centered on your current location.");
    }
    return;
  }

  setLocateButtonState(true);
  if (!silentOnError) {
    showToast("Fetching your location...", "success");
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      applyUserLocationFix(position, { silentOnError, recenter: true });
      startUserLocationWatch({ silentOnError });
      setLocateButtonState(false);
    },
    (error) => {
      if (!silentOnError) {
        setHeroSummary(getLocationErrorMessage(error));
      }
      setLocateButtonState(false);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

function startUserLocationWatch(options = {}) {
  const { silentOnError = false } = options;

  if (!navigator.geolocation || userLocationWatchId !== null) {
    return;
  }

  userLocationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      applyUserLocationFix(position, { silentOnError });
      setLocateButtonState(false);
    },
    () => {
      setLocateButtonState(false);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    }
  );
}

function stopUserLocationWatch() {
  if (userLocationWatchId === null) {
    return;
  }

  navigator.geolocation.clearWatch(userLocationWatchId);
  userLocationWatchId = null;
  window.clearTimeout(nearestSortRenderTimeoutId);
  nearestSortRenderTimeoutId = 0;
}

function applyUserLocationFix(position, options = {}) {
  const { silentOnError = false, recenter = false } = options;
  const { latitude, longitude, accuracy } = position.coords;

  renderUserLocation(latitude, longitude, accuracy);
  userLocation = {
    latitude,
    longitude
  };
  updateLocateButtonActiveState();

  if (recenter && map) {
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), {
      animate: true,
      duration: 1
    });
    if (!(isMobileViewport() && state.ui.mobileTab)) {
      setHeroSummary("Centered on your current location.");
    } else {
      refreshHeroSummary();
    }
    if (!silentOnError) {
      showLocationEnabledToast();
    }
  }

  scheduleNearestSortRender();
  onUserLocationUpdated();
}

function scheduleNearestSortRender() {
  if (state.sort !== "nearest") {
    return;
  }

  window.clearTimeout(nearestSortRenderTimeoutId);
  nearestSortRenderTimeoutId = window.setTimeout(() => {
    nearestSortRenderTimeoutId = 0;
    render();
  }, NEAREST_SORT_LOCATION_DEBOUNCE_MS);
}

function onUserLocationUpdated() {
  if (!hasValidUserLocation()) {
    return;
  }

  updateStationaryAnchor(userLocation.latitude, userLocation.longitude);
  userLocationFixCount += 1;
  queueAreaNudgeEvaluation();
}

function normalizeAreaNudgeRadiusKm(radiusKm) {
  const meters = Math.round(Number(radiusKm) * 1000);

  if (!Number.isFinite(meters)) {
    return NEARBY_LISTING_RADIUS_KM_DEFAULT;
  }

  const clampedMeters = Math.min(
    Math.round(AREA_NUDGE_RADIUS_MAX_KM * 1000),
    Math.max(Math.round(AREA_NUDGE_RADIUS_MIN_KM * 1000), meters)
  );

  return clampedMeters / 1000;
}

function loadAreaNudgeSettings() {
  try {
    const raw = window.localStorage.getItem(AREA_NUDGE_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_AREA_NUDGE_SETTINGS };
    }

    const parsed = JSON.parse(raw);

    return {
      enabled: parsed.enabled !== false,
      radiusKm: normalizeAreaNudgeRadiusKm(parsed.radiusKm)
    };
  } catch {
    return { ...DEFAULT_AREA_NUDGE_SETTINGS };
  }
}

function isAreaNudgeEnabled() {
  return loadAreaNudgeSettings().enabled;
}

function getAreaNudgeRadiusKm() {
  return loadAreaNudgeSettings().radiusKm;
}

function getAreaNudgeRadiusMeters() {
  return Math.round(getAreaNudgeRadiusKm() * 1000);
}

function refreshMapViewActiveTimer() {
  if (!isMapViewActiveForAreaNudge()) {
    return;
  }

  if (!mapViewActiveSinceMs) {
    mapViewActiveSinceMs = Date.now();
  }
}

function resetMapViewActiveTimer() {
  mapViewActiveSinceMs = 0;
}

function isMapViewActiveForAreaNudge() {
  if (isMobileViewport()) {
    return !state.ui.mobileTab;
  }

  return state.ui.desktopPanel !== "add";
}

function updateStationaryAnchor(latitude, longitude) {
  const now = Date.now();
  const movedKm = stationaryAnchorLatitude === null
    ? Number.POSITIVE_INFINITY
    : getDistanceBetweenCoordinates(
      stationaryAnchorLatitude,
      stationaryAnchorLongitude,
      latitude,
      longitude
    );

  if (movedKm > AREA_NUDGE_STATIONARY_MAX_MOVE_KM) {
    stationaryAnchorLatitude = latitude;
    stationaryAnchorLongitude = longitude;
    stationarySinceMs = now;
  }
}

function meetsAreaNudgeTimingRules() {
  if (!mapViewActiveSinceMs || !stationarySinceMs) {
    return false;
  }

  const now = Date.now();
  return now - mapViewActiveSinceMs >= AREA_NUDGE_MAP_ACTIVE_MS &&
    now - stationarySinceMs >= AREA_NUDGE_STATIONARY_MS;
}

function queueAreaNudgeEvaluation() {
  if (!hasValidUserLocation() || userLocationFixCount < 2) {
    return;
  }

  window.clearTimeout(areaNudgeCheckTimeoutId);
  areaNudgeCheckTimeoutId = window.setTimeout(() => {
    areaNudgeCheckTimeoutId = 0;
    maybeShowAreaNudge();
  }, 400);
}

function maybeShowAreaNudge() {
  if (!isAreaNudgeEnabled() || !canEvaluateAreaNudge() || areaNudgeVisible) {
    return;
  }

  if (!meetsAreaNudgeTimingRules()) {
    return;
  }

  const { latitude, longitude } = userLocation;
  const now = Date.now();
  const movedKm = lastAreaNudgeCheckLatitude === null
    ? Number.POSITIVE_INFINITY
    : getDistanceBetweenCoordinates(
      lastAreaNudgeCheckLatitude,
      lastAreaNudgeCheckLongitude,
      latitude,
      longitude
    );
  const elapsedMs = now - lastAreaNudgeCheckAtMs;

  if (
    lastAreaNudgeCheckAtMs > 0 &&
    movedKm < AREA_NUDGE_MIN_MOVE_KM &&
    elapsedMs < AREA_NUDGE_CHECK_INTERVAL_MS
  ) {
    return;
  }

  lastAreaNudgeCheckAtMs = now;
  lastAreaNudgeCheckLatitude = latitude;
  lastAreaNudgeCheckLongitude = longitude;

  if (isAreaNudgeCooldownActive(latitude, longitude)) {
    return;
  }

  const radiusKm = getAreaNudgeRadiusKm();
  const nearestDistanceKm = getNearestListingDistanceKm();
  if (nearestDistanceKm <= radiusKm) {
    return;
  }

  showAreaNudge(latitude, longitude);
}

function canEvaluateAreaNudge() {
  if (!isAreaNudgeEnabled() || !hasValidUserLocation() || state.ui.isLoadingListings || areaNudgeVisible) {
    return false;
  }

  if (!hasHiddenSplash || elements.splashOverlay?.hidden === false) {
    return false;
  }

  if (tourState.active || elements.tourOverlay?.hidden === false) {
    return false;
  }

  if (isMobileViewport()) {
    if (state.ui.mobileTab) {
      return false;
    }

    if (elements.heroPanel && !elements.heroPanel.classList.contains("is-compact")) {
      return false;
    }
  } else if (state.ui.desktopPanel === "add") {
    return false;
  }

  if (!mapViewActiveSinceMs) {
    return false;
  }

  return true;
}

function getNearestListingDistanceKm() {
  if (!hasValidUserLocation()) {
    return Number.POSITIVE_INFINITY;
  }

  if (!state.listings.length) {
    return Number.POSITIVE_INFINITY;
  }

  let nearestDistanceKm = Number.POSITIVE_INFINITY;

  state.listings.forEach((listing) => {
    const distanceKm = getDistanceFromUser(listing);
    if (distanceKm < nearestDistanceKm) {
      nearestDistanceKm = distanceKm;
    }
  });

  return nearestDistanceKm;
}

function getAreaNudgeGridKey(latitude, longitude) {
  return `${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
}

function readAreaNudgeCooldownMap() {
  try {
    const raw = window.localStorage.getItem(AREA_NUDGE_COOLDOWN_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function isAreaNudgeCooldownActive(latitude, longitude) {
  const cooldownMap = readAreaNudgeCooldownMap();
  const shownAt = cooldownMap[getAreaNudgeGridKey(latitude, longitude)];

  return typeof shownAt === "number" && Date.now() - shownAt < AREA_NUDGE_COOLDOWN_MS;
}

function markAreaNudgeShown(latitude, longitude) {
  try {
    const cooldownMap = readAreaNudgeCooldownMap();
    const now = Date.now();
    const nextMap = {};

    Object.entries(cooldownMap).forEach(([key, value]) => {
      if (typeof value === "number" && now - value < AREA_NUDGE_COOLDOWN_MS) {
        nextMap[key] = value;
      }
    });

    nextMap[getAreaNudgeGridKey(latitude, longitude)] = now;
    window.localStorage.setItem(AREA_NUDGE_COOLDOWN_STORAGE_KEY, JSON.stringify(nextMap));
  } catch {
    // Ignore storage failures.
  }
}

function syncAreaNudgeChipMessage() {
  if (!elements.areaNudgeChipText) {
    return;
  }

  const radiusM = getAreaNudgeRadiusMeters();
  elements.areaNudgeChipText.textContent =
    `No listings within ${radiusM} m. Know a spot? Add one to help others find the right toilet!`;
}

function showAreaNudge(latitude, longitude) {
  if (!elements.areaNudgeChip || areaNudgeVisible) {
    return;
  }

  areaNudgeVisible = true;
  syncAreaNudgeChipMessage();

  if (isMobileViewport()) {
    clearHeroCompactTimer();
    elements.heroPanel?.classList.add("is-compact");
    refreshHeroSummary();
  }

  elements.heroPanel?.classList.add("is-hidden-by-area-nudge");

  if (prefersReducedMotion()) {
    elements.areaNudgeChip.classList.add("is-instant");
    elements.heroPanel?.classList.add("is-instant");
  }

  elements.areaNudgeChip.hidden = false;
  updateMapControlLayout();
  window.requestAnimationFrame(() => {
    elements.areaNudgeChip.classList.add("is-visible");
  });
}

function hideAreaNudge(options = {}) {
  const { recordCooldown = true } = options;

  if (!elements.areaNudgeChip) {
    return;
  }

  const wasVisible = areaNudgeVisible;
  areaNudgeVisible = false;
  elements.areaNudgeChip.classList.remove("is-visible");
  elements.heroPanel?.classList.remove("is-hidden-by-area-nudge", "is-instant");
  elements.areaNudgeChip.classList.remove("is-instant");
  updateMapControlLayout();

  const settleMs = prefersReducedMotion() ? 0 : 240;

  window.setTimeout(() => {
    if (!areaNudgeVisible) {
      elements.areaNudgeChip.hidden = true;
    }
    updateMapControlLayout();
  }, settleMs);

  if (wasVisible && recordCooldown && hasValidUserLocation()) {
    markAreaNudgeShown(userLocation.latitude, userLocation.longitude);
  }

  if (isMobileViewport()) {
    ensureHeroCompactMode();
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function openContributeFromAreaNudge() {
  hideAreaNudge();

  if (isMobileViewport()) {
    setMobileTab("add");
    return;
  }

  setDesktopPanel("add");
}

function dismissAreaNudgeIfVisible() {
  if (areaNudgeVisible) {
    hideAreaNudge({ recordCooldown: false });
  }
}

function syncAreaNudgeMapViewState() {
  if (isMapViewActiveForAreaNudge()) {
    refreshMapViewActiveTimer();
    return;
  }

  resetMapViewActiveTimer();
}

function renderUserLocation(latitude, longitude, accuracy = 50) {
  if (!userLocationLayer) {
    return;
  }

  const latLng = [latitude, longitude];
  userLocationLayer.clearLayers();

  L.circleMarker(latLng, {
    radius: 18,
    color: "#2457f5",
    weight: 2,
    opacity: 0.35,
    fillColor: "#2457f5",
    fillOpacity: 0.12,
    className: "user-location-pulse"
  }).addTo(userLocationLayer);

  L.circle(latLng, {
    radius: Math.max(accuracy, 30),
    color: "#2457f5",
    weight: 1.5,
    opacity: 0.35,
    fillColor: "#2457f5",
    fillOpacity: 0.12
  }).addTo(userLocationLayer);

  L.circleMarker(latLng, {
    radius: 8,
    color: "#ffffff",
    weight: 3,
    fillColor: "#2457f5",
    fillOpacity: 1
  }).addTo(userLocationLayer);
}

function setLocateButtonState(isLocating) {
  isLocatingUser = isLocating;

  if (!elements.locateButton) {
    return;
  }

  elements.locateButton.disabled = isLocating;
  elements.locateButton.classList.toggle("is-locating", isLocating);
  updateLocateButtonActiveState();
}

function updateLocateButtonActiveState() {
  if (!elements.locateButton) {
    return;
  }

  const isLocationActive = hasValidUserLocation();
  elements.locateButton.classList.toggle("is-active", isLocationActive);
  elements.locateButton.setAttribute(
    "aria-label",
    isLocatingUser
      ? "Locating current position"
      : isLocationActive
        ? "Location enabled"
        : "Use my location"
  );
  elements.locateButton.title = isLocatingUser
    ? "Locating..."
    : isLocationActive
      ? "Location enabled"
      : "Use my location";
}

function showLocationEnabledToast() {
  if (hasShownLocationEnabledToast) {
    return;
  }

  hasShownLocationEnabledToast = true;
  showToast("Location enabled. Centered on you.", "success");
}

function setSubmitButtonState(isSubmitting) {
  if (!elements.submitButton) {
    return;
  }

  elements.submitButton.disabled = isSubmitting;

  if (isSubmitting) {
    elements.submitButton.textContent = "Submitting...";
    return;
  }

  elements.submitButton.textContent = isUsingSupabase() ? "Submit for Review" : "Save listing";
}

function showToast(message, variant = "success") {
  if (!elements.toast) {
    return;
  }

  window.clearTimeout(toastTimeoutId);
  elements.toast.textContent = String(message || "").replace(/\s+/g, " ").trim();
  elements.toast.classList.remove("is-success", "is-error");
  elements.toast.classList.add("is-visible", variant === "error" ? "is-error" : "is-success");

  toastTimeoutId = window.setTimeout(() => {
    hideToast();
  }, 3600);
}

function hideToast() {
  if (!elements.toast) {
    return;
  }

  elements.toast.classList.remove("is-visible", "is-success", "is-error");
}

function syncDataModeUI() {
  if (isUsingSupabase()) {
    elements.resetButton.hidden = true;
    elements.addFormNote.textContent = "Entries submitted here are sent for review before appearing on the public map.";
    setSubmitButtonState(false);
    return;
  }

  elements.resetButton.hidden = false;
  elements.addFormNote.textContent = "Entries added here stay in local browser storage for demo use.";
  setSubmitButtonState(false);
}

function getLocationErrorMessage(error) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission was denied.";
    case error.POSITION_UNAVAILABLE:
      return "Current location could not be determined.";
    case error.TIMEOUT:
      return "Location request timed out. Please try again.";
    default:
      return "Unable to get your current location right now.";
  }
}

function renderCards(listings) {
  elements.cardGrid.innerHTML = "";

  if (state.ui.isLoadingListings) {
    const loadingState = document.createElement("div");
    loadingState.className = "empty-state";
    loadingState.textContent = "Loading approved listings...";
    elements.cardGrid.appendChild(loadingState);
    return;
  }

  if (state.ui.remoteError) {
    const errorState = document.createElement("div");
    errorState.className = "empty-state";
    errorState.textContent = state.ui.remoteError;
    elements.cardGrid.appendChild(errorState);
    return;
  }

  if (!listings.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No toilets match the current filters. Try broadening the search.";
    elements.cardGrid.appendChild(emptyState);
    return;
  }

  listings.forEach((listing) => {
    const fragment = elements.cardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".toilet-card");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Focus ${listing.name} on the map`);
    fragment.querySelector(".card-title").textContent = listing.name;
    fragment.querySelector(".card-location").textContent = listing.location;
    fragment.querySelector(".cleanliness-badge").textContent = `Cleanliness ${listing.cleanliness}/5`;
    fragment.querySelector(".card-notes").textContent = listing.notes;
    fragment.querySelector(".card-fee").textContent = listing.paymentRequired
      ? `Fee required: PHP ${listing.fee || 0}`
      : "Free access";

    const tagRow = fragment.querySelector(".tag-row");
    tagRow.appendChild(buildTag(listing.hasBidet ? "Bidet available" : "No bidet"));
    tagRow.appendChild(buildTag(listing.hasTissue ? "Tissue available" : "No tissue"));
    tagRow.appendChild(buildTag(listing.paymentRequired ? "Paid entry" : "Free entry", listing.paymentRequired));
    if (listing.hasBidet && listing.pressureLevel) {
      fragment.querySelector(".pressure-row").appendChild(buildPressureBadge(listing.pressureLevel));
    }

    card.dataset.listingId = String(listing.id);
    syncAccuracySection(fragment.querySelector(".accuracy-section"), listing);

    card.addEventListener("click", (event) => {
      if (event.target.closest(".accuracy-section")) {
        return;
      }

      focusListingOnMap(listing);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      focusListingOnMap(listing);
    });

    elements.cardGrid.appendChild(fragment);
  });
}

function focusListingOnMap(listing) {
  if (!map) {
    return;
  }

  if (isMobileViewport()) {
    state.ui.mobileTab = null;
    updateMobileUI();
  }

  const marker = listingMarkerMap.get(listing);

  if (!marker) {
    return;
  }

  const targetZoom = Math.max(map.getZoom(), 16);
  const currentCenter = map.getCenter();
  const markerLatLng = marker.getLatLng();
  const isAlreadyFocused =
    Math.abs(currentCenter.lat - markerLatLng.lat) < 0.00001 &&
    Math.abs(currentCenter.lng - markerLatLng.lng) < 0.00001 &&
    map.getZoom() === targetZoom;

  if (isAlreadyFocused) {
    openAndOffsetListingPopup(marker);
    return;
  }

  map.once("moveend", () => {
    openAndOffsetListingPopup(marker);
  });

  map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 16), {
    animate: true,
    duration: 0.6
  });
}

function openAndOffsetListingPopup(marker) {
  marker.openPopup();
  window.setTimeout(() => {
    adjustListingPopupOffset(marker);
  }, 40);
}

function adjustListingPopupOffset(marker) {
  if (!map) {
    return;
  }

  const popupElement = marker.getPopup()?.getElement();

  if (!popupElement) {
    return;
  }

  const markerPoint = map.latLngToContainerPoint(marker.getLatLng());
  const popupHeight = popupElement.offsetHeight || 0;
  const targetPoint = getListingPopupTargetPoint(markerPoint, popupHeight);
  const offset = [
    0,
    markerPoint.y - targetPoint.y
  ];

  if (Math.abs(offset[1]) < 4) {
    return;
  }

  map.panBy(offset, {
    animate: true,
    duration: 0.35
  });
}

function getListingPopupTargetPoint(markerPoint, popupHeight) {
  const minVisibleTop = getVisibleMapTopBoundary();
  const targetY = Math.max(markerPoint.y, minVisibleTop + popupHeight + 52);

  return {
    x: markerPoint.x,
    y: targetY
  };
}

function getVisibleMapTopBoundary() {
  const header = document.querySelector(".hero-panel");

  if (!header) {
    return isMobileViewport() ? 106 : 28;
  }

  const headerRect = header.getBoundingClientRect();
  return Math.max(isMobileViewport() ? 118 : 40, headerRect.bottom + 28);
}

function renderSummary(listings) {
  if (state.ui.isLoadingListings) {
    elements.resultsSummary.textContent = "Loading approved listings...";
    return;
  }

  if (state.ui.remoteError) {
    elements.resultsSummary.textContent = "Could not load approved listings.";
    return;
  }

  const suffix = listings.length === 1 ? "listing" : "listings";
  elements.resultsSummary.textContent = `Showing ${listings.length} ${suffix} from ${state.listings.length} total.`;
}

function setHeroSummary(text) {
  if (elements.mapSummary) {
    elements.mapSummary.textContent = text;
  }
}

function refreshHeroSummary(listings = getVisibleListings()) {
  if (!elements.mapSummary) {
    return;
  }

  if (isMobileViewport() && state.ui.mobileTab === "listings") {
    if (state.ui.isLoadingListings) {
      setHeroSummary("Loading listings...");
      return;
    }

    if (state.ui.remoteError) {
      setHeroSummary("Could not load listings.");
      return;
    }

    const suffix = listings.length === 1 ? "listing" : "listings";
    setHeroSummary(`Showing ${listings.length} ${suffix} from ${state.listings.length} total.`);
    return;
  }

  if (isMobileViewport() && state.ui.mobileTab === "filters") {
    if (hasActiveFilters()) {
      const suffix = listings.length === 1 ? "pin" : "pins";
      setHeroSummary(`${listings.length} ${suffix} match your filters.`);
      return;
    }

    setHeroSummary("Filter by bidet, payment, and cleanliness.");
    return;
  }

  if (isMobileViewport() && state.ui.mobileTab === "add") {
    setHeroSummary("Place or drag the pin.");
    return;
  }

  if (state.ui.isLoadingListings) {
    setHeroSummary("Loading approved listings...");
    return;
  }

  if (state.ui.remoteError) {
    setHeroSummary(state.ui.remoteError);
    return;
  }

  if (!listings.length) {
    setHeroSummary("No map pins match the current filters.");
    return;
  }

  const suffix = listings.length === 1 ? "pin" : "pins";
  setHeroSummary(`Showing ${listings.length} ${suffix} on the map.`);
}

function ensureHeroCompactMode() {
  if (!elements.heroPanel || !isMobileViewport()) {
    return;
  }

  clearHeroCompactTimer();
  elements.heroPanel.classList.add("is-compact");
  refreshHeroSummary();
  updateMapControlLayout();
}

function clearHeroCompactTimer() {
  if (!heroCompactTimeoutId) {
    return;
  }

  window.clearTimeout(heroCompactTimeoutId);
  heroCompactTimeoutId = 0;
}

function scheduleHeroCompactMode() {
  clearHeroCompactTimer();

  if (!elements.heroPanel || !isMobileViewport()) {
    elements.heroPanel?.classList.remove("is-compact");
    updateMapControlLayout();
    return;
  }

  elements.heroPanel.classList.remove("is-compact");
  updateMapControlLayout();

  heroCompactTimeoutId = window.setTimeout(() => {
    heroCompactTimeoutId = 0;

    if (!elements.heroPanel || !isMobileViewport()) {
      return;
    }

    elements.heroPanel.classList.add("is-compact");
    refreshHeroSummary();
    syncAreaNudgeMapViewState();
    queueAreaNudgeEvaluation();
    updateMapControlLayout();
  }, HERO_COMPACT_DELAY_MS);
}

function handleHeroCompactResize() {
  if (!elements.heroPanel) {
    return;
  }

  if (!isMobileViewport()) {
    clearHeroCompactTimer();
    elements.heroPanel.classList.remove("is-compact");
    updateMapControlLayout();
    return;
  }

  if (!elements.heroPanel.classList.contains("is-compact")) {
    scheduleHeroCompactMode();
  }

  updateMapControlLayout();
}

function handleHeroPanelClick() {
  dismissAreaNudgeIfVisible();

  if (!elements.heroPanel || !isMobileViewport() || !elements.heroPanel.classList.contains("is-compact")) {
    return;
  }

  elements.heroPanel.classList.remove("is-compact");
  scheduleHeroCompactMode();
  updateMapControlLayout();
}

function getVisibleListings() {
  return sortListings(getFilteredListings());
}

function sortListings(listings) {
  const nextListings = [...listings];

  if (state.sort === "alpha") {
    nextListings.sort((a, b) => a.name.localeCompare(b.name));
    return nextListings;
  }

  if (state.sort === "nearest" && userLocation) {
    nextListings.sort((a, b) => {
      const distanceA = getDistanceFromUser(a);
      const distanceB = getDistanceFromUser(b);
      return distanceA - distanceB;
    });
  }

  return nextListings;
}

function syncFilterUI() {
  elements.searchInput.value = state.filters.search;
  elements.bidetFilter.value = state.filters.bidet;
  elements.paymentFilter.value = state.filters.payment;
  elements.cleanlinessFilter.value = String(state.filters.cleanliness);
  window.SitCheckCustomSelect?.refreshAll();
  elements.clearFiltersButton.hidden = !hasActiveFilters();

  const matchCount = getFilteredListings().length;
  const resultLabel = matchCount === 1 ? "toilet" : "toilets";

  if (elements.filterResultsCount) {
    elements.filterResultsCount.textContent = hasActiveFilters()
      ? `${matchCount} matching ${resultLabel}.`
      : `All ${matchCount} ${resultLabel} are shown.`;
  }

  if (elements.viewFilterResultsButton) {
    elements.viewFilterResultsButton.textContent =
      matchCount === 1 ? "View 1 result on map" : `View ${matchCount} results on map`;
  }
}

function syncSortUI() {
  if (!elements.sortButtons.length) {
    return;
  }

  if (state.sort === "nearest" && !userLocation) {
    state.sort = "default";
  }

  elements.sortButtons.forEach((button) => {
    const sortOption = button.dataset.sortOption;
    const isActive = sortOption === state.sort;
    const needsLocation = sortOption === "nearest" && !userLocation;

    button.classList.toggle("primary", isActive);
    button.classList.toggle("secondary", !isActive);
    button.classList.toggle("is-muted", needsLocation && !isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.title = needsLocation ? "Enable location to use nearest sort." : "";
  });
}

function hasActiveFilters() {
  return Boolean(
    state.filters.search ||
    state.filters.bidet !== "any" ||
    state.filters.payment !== "any" ||
    state.filters.cleanliness !== 0
  );
}

function resetFilters() {
  state.filters.search = "";
  state.filters.bidet = "any";
  state.filters.payment = "any";
  state.filters.cleanliness = 0;
}

function showFilteredResultsOnMap() {
  if (!isMobileViewport()) {
    return;
  }

  state.ui.mobileTab = null;
  syncAreaNudgeMapViewState();
  updateMobileUI();
  refreshHeroSummary();
  ensureHeroCompactMode();

  requestAnimationFrame(() => {
    map?.invalidateSize();
  });
}

function getDistanceFromUser(listing) {
  if (!userLocation || !Number.isFinite(listing.latitude) || !Number.isFinite(listing.longitude)) {
    return Number.POSITIVE_INFINITY;
  }

  return getDistanceBetweenCoordinates(
    userLocation.latitude,
    userLocation.longitude,
    listing.latitude,
    listing.longitude
  );
}

function getDistanceBetweenCoordinates(latitudeA, longitudeA, latitudeB, longitudeB) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(latitudeB - latitudeA);
  const dLng = toRadians(longitudeB - longitudeA);
  const lat1 = toRadians(latitudeA);
  const lat2 = toRadians(latitudeB);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value) {
  return value * (Math.PI / 180);
}

async function initializeRemoteListings() {
  try {
    const listings = await fetchSupabaseListings();
    state.listings = listings;
    state.ui.remoteError = "";
  } catch (error) {
    state.listings = [];
    state.ui.remoteError = error.message || "Could not load approved listings from Supabase.";
  } finally {
    state.ui.isLoadingListings = false;

    try {
      render();
    } catch (renderError) {
      console.error("Failed to render listings after remote load:", renderError);
    }

    scheduleSplashHide();
    scheduleAutoLocateUser();
    queueAreaNudgeEvaluation();
  }
}

function scheduleAutoLocateUser() {
  if (hasAttemptedAutoLocate) {
    return;
  }

  hasAttemptedAutoLocate = true;
  window.setTimeout(() => {
    locateUser({
      silentOnError: true
    });
  }, AUTO_LOCATE_DELAY_MS);
}

function scheduleSplashHide() {
  if (hasHiddenSplash || !elements.splashOverlay) {
    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      hideSplashOverlay();
    });
  });
}

function hideSplashOverlay() {
  if (hasHiddenSplash || !elements.splashOverlay) {
    return;
  }

  const elapsedMs = Date.now() - splashStartedAtMs;
  const delayMs = Math.max(0, SPLASH_MIN_DURATION_MS - elapsedMs);

  window.setTimeout(() => {
    if (hasHiddenSplash || !elements.splashOverlay) {
      return;
    }

    hasHiddenSplash = true;
    stopSplashLineRotation();
    markSplashSeenInSession();
    elements.splashOverlay.classList.add("is-hiding");

    window.setTimeout(() => {
      if (!elements.splashOverlay) {
        return;
      }

      elements.splashOverlay.hidden = true;
      syncAreaNudgeMapViewState();
      maybeScheduleAppTour();
      maybeShowContributionReminderNotice();
      maybeOpenAddFromQuery();
      scheduleHeroCompactMode();
    }, SPLASH_FADE_DURATION_MS + 40);
  }, delayMs);
}

function initializeSplashVisibility() {
  if (!elements.splashOverlay || !hasSeenSplashInSession()) {
    return;
  }

  hasHiddenSplash = true;
  elements.splashOverlay.hidden = true;
  syncAreaNudgeMapViewState();
}

function hasSeenSplashInSession() {
  try {
    return window.sessionStorage.getItem(SPLASH_SEEN_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markSplashSeenInSession() {
  try {
    window.sessionStorage.setItem(SPLASH_SEEN_SESSION_KEY, "1");
  } catch {
    // Ignore storage write issues and continue splash flow.
  }
}

function initializeSplashLineRotation() {
  if (!elements.splashLine || hasHiddenSplash) {
    return;
  }

  setNextSplashLine();
  splashLineIntervalId = window.setInterval(setNextSplashLine, SPLASH_LINE_CYCLE_MS);
}

function stopSplashLineRotation() {
  if (!splashLineIntervalId) {
    return;
  }

  window.clearInterval(splashLineIntervalId);
  splashLineIntervalId = 0;
}

function setNextSplashLine() {
  if (!elements.splashLine || !SPLASH_LOADING_LINES.length) {
    return;
  }

  let nextIndex = Math.floor(Math.random() * SPLASH_LOADING_LINES.length);

  if (SPLASH_LOADING_LINES.length > 1 && nextIndex === lastSplashLineIndex) {
    nextIndex = (nextIndex + 1) % SPLASH_LOADING_LINES.length;
  }

  lastSplashLineIndex = nextIndex;
  elements.splashLine.textContent = SPLASH_LOADING_LINES[nextIndex];
}

async function fetchSupabaseListings() {
  let data;
  let error;

  ({ data, error } = await supabaseClient
    .from(SUPABASE_TABLES.toilets)
    .select("id, name, location_text, latitude, longitude, has_bidet, has_tissue, cleanliness, pressure_level, payment_required, fee, notes, confirm_count, last_confirmed_at, inaccurate_count"));

  // Fallback if accuracy columns are not applied yet in Supabase.
  if (error) {
    ({ data, error } = await supabaseClient
      .from(SUPABASE_TABLES.toilets)
      .select("id, name, location_text, latitude, longitude, has_bidet, has_tissue, cleanliness, pressure_level, payment_required, fee, notes"));
  }

  if (error) {
    throw new Error("Could not load approved listings from Supabase.");
  }

  return (data || []).map((listing, index) => normalizeListing({
    id: listing.id,
    name: listing.name,
    location: listing.location_text,
    latitude: listing.latitude,
    longitude: listing.longitude,
    hasBidet: listing.has_bidet,
    hasTissue: listing.has_tissue,
    cleanliness: listing.cleanliness,
    pressureLevel: listing.pressure_level,
    paymentRequired: listing.payment_required,
    fee: listing.fee,
    notes: listing.notes,
    confirmCount: listing.confirm_count,
    lastConfirmedAt: listing.last_confirmed_at,
    inaccurateCount: listing.inaccurate_count
  }, index));
}

async function submitSupabaseListing(listing) {
  const { error } = await supabaseClient
    .from(SUPABASE_TABLES.submissions)
    .insert({
      name: listing.name,
      location_text: listing.location,
      latitude: listing.latitude,
      longitude: listing.longitude,
      has_bidet: listing.hasBidet,
      has_tissue: listing.hasTissue,
      cleanliness: listing.cleanliness,
      pressure_level: listing.hasBidet ? clampPressure(Number(listing.pressureLevel)) : null,
      payment_required: listing.paymentRequired,
      fee: listing.paymentRequired ? Math.max(0, Number(listing.fee) || 0) : 0,
      notes: listing.notes,
      status: "pending"
    });

  if (error) {
    console.error("Supabase submission error:", error);
    throw new Error(
      error.message || "Could not submit contribution. Check your Supabase table columns and RLS policies."
    );
  }
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

function canShowListingAccuracy(listing) {
  if (!listing || listing.id == null || listing.id === "") {
    return false;
  }

  if (isUsingSupabase()) {
    return true;
  }

  return String(listing.id).startsWith("local-");
}

function loadAccuracyVotes() {
  try {
    const raw = window.localStorage.getItem(ACCURACY_VOTES_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAccuracyVotes(votes) {
  try {
    window.localStorage.setItem(ACCURACY_VOTES_STORAGE_KEY, JSON.stringify(votes));
  } catch {
    // Ignore storage failures.
  }
}

function getAccuracyVoteState(listingId) {
  const votes = loadAccuracyVotes();
  const entry = votes[String(listingId)];

  if (!entry || typeof entry !== "object") {
    return null;
  }

  return {
    at: Number(entry.at) || 0,
    accurate: entry.accurate === true
  };
}

function isAccuracyCooldownActive(listingId) {
  const voteState = getAccuracyVoteState(listingId);

  if (!voteState || !voteState.at) {
    return false;
  }

  return Date.now() - voteState.at < ACCURACY_VOTE_COOLDOWN_MS;
}

function markAccuracyVote(listingId, isAccurate) {
  const votes = loadAccuracyVotes();
  votes[String(listingId)] = {
    at: Date.now(),
    accurate: Boolean(isAccurate)
  };
  saveAccuracyVotes(votes);
}

function findListingById(listingId) {
  return state.listings.find((listing) => String(listing.id) === String(listingId)) || null;
}

function applyAccuracyResultToListing(listingId, result) {
  const listing = findListingById(listingId);

  if (!listing || !result) {
    return null;
  }

  listing.confirmCount = Math.max(0, Number(result.confirmCount ?? result.confirm_count) || 0);
  listing.inaccurateCount = Math.max(0, Number(result.inaccurateCount ?? result.inaccurate_count) || 0);
  listing.lastConfirmedAt = result.lastConfirmedAt ?? result.last_confirmed_at ?? listing.lastConfirmedAt;

  if (!isUsingSupabase()) {
    persistListings();
  }

  return listing;
}

function formatRelativeTime(value) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 48) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function getAccuracyStatusMessage(isAccurate) {
  return isAccurate ? "Thanks — marked accurate" : "Thanks — we noted this";
}

function getAccuracyMetaMessage(listing) {
  if (!listing.lastConfirmedAt || listing.confirmCount <= 0) {
    return "";
  }

  return `Last confirmed ${formatRelativeTime(listing.lastConfirmedAt)}`;
}

function getAccuracyCountsMessage(listing) {
  const yesCount = Math.max(0, Number(listing.confirmCount) || 0);
  const noCount = Math.max(0, Number(listing.inaccurateCount) || 0);
  return `Accuracy feedback: ${yesCount} Yes · ${noCount} No`;
}

function buildAccuracyBlockMarkup(listing) {
  if (!canShowListingAccuracy(listing)) {
    return "";
  }

  const listingId = escapeHtml(String(listing.id));
  const voteState = getAccuracyVoteState(listing.id);
  const cooldownActive = isAccuracyCooldownActive(listing.id);
  const metaMessage = escapeHtml(getAccuracyMetaMessage(listing));

  if (cooldownActive && voteState) {
    return `
      <section class="accuracy-section accuracy-section-popup" aria-label="Listing accuracy feedback">
        <p class="accuracy-question">Listing still accurate?</p>
        <p class="accuracy-status">${escapeHtml(getAccuracyStatusMessage(voteState.accurate))}</p>
        ${metaMessage ? `<p class="accuracy-meta">${metaMessage}</p>` : ""}
      </section>
    `;
  }

  return `
    <section class="accuracy-section accuracy-section-popup" aria-label="Listing accuracy feedback">
      <p class="accuracy-question">Listing still accurate?</p>
      <div class="accuracy-actions" role="group" aria-label="Confirm listing accuracy">
        <button type="button" class="button secondary accuracy-btn" data-accuracy="yes" data-toilet-id="${listingId}">Yes</button>
        <button type="button" class="button secondary accuracy-btn" data-accuracy="no" data-toilet-id="${listingId}">No</button>
      </div>
      ${metaMessage ? `<p class="accuracy-meta">${metaMessage}</p>` : ""}
    </section>
  `;
}

function syncAccuracySection(section, listing) {
  if (!section) {
    return;
  }

  if (!canShowListingAccuracy(listing)) {
    section.hidden = true;
    return;
  }

  section.hidden = false;

  const actions = section.querySelector(".accuracy-actions");
  const status = section.querySelector(".accuracy-status");
  const meta = section.querySelector(".accuracy-meta");
  const counts = section.querySelector(".accuracy-counts");
  const buttons = section.querySelectorAll(".accuracy-btn");
  const voteState = getAccuracyVoteState(listing.id);
  const cooldownActive = isAccuracyCooldownActive(listing.id);
  const metaMessage = getAccuracyMetaMessage(listing);
  const isCardSection = !section.classList.contains("accuracy-section-popup");

  if (isCardSection && counts) {
    counts.hidden = false;
    counts.textContent = getAccuracyCountsMessage(listing);
  }

  if (cooldownActive && voteState) {
    if (actions) {
      actions.hidden = true;
    }

    if (status) {
      status.hidden = false;
      status.textContent = getAccuracyStatusMessage(voteState.accurate);
    }
  } else {
    if (actions) {
      actions.hidden = false;
    }

    if (status) {
      status.hidden = true;
      status.textContent = "";
    }

    buttons.forEach((button) => {
      button.disabled = false;
    });
  }

  if (meta) {
    if (metaMessage) {
      meta.hidden = false;
      meta.textContent = metaMessage;
    } else {
      meta.hidden = true;
      meta.textContent = "";
    }
  }
}

function setAccuracyButtonsDisabled(section, disabled) {
  section?.querySelectorAll(".accuracy-btn").forEach((button) => {
    button.disabled = disabled;
  });
}

async function recordListingAccuracy(listing, isAccurate) {
  if (!listing || !canShowListingAccuracy(listing)) {
    throw new Error("This listing cannot receive accuracy feedback right now.");
  }

  if (isUsingSupabase() && supabaseClient && !String(listing.id).startsWith("local-")) {
    const { data, error } = await supabaseClient.rpc("record_listing_accuracy", {
      p_toilet_id: String(listing.id),
      p_is_accurate: Boolean(isAccurate)
    });

    if (error) {
      throw new Error(error.message || "Could not save your response right now.");
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      throw new Error("Could not save your response right now.");
    }

    return {
      confirmCount: row.confirm_count,
      inaccurateCount: row.inaccurate_count,
      lastConfirmedAt: row.last_confirmed_at
    };
  }

  const nextCounts = {
    confirmCount: listing.confirmCount || 0,
    inaccurateCount: listing.inaccurateCount || 0,
    lastConfirmedAt: listing.lastConfirmedAt
  };

  if (isAccurate) {
    nextCounts.confirmCount += 1;
    nextCounts.lastConfirmedAt = new Date().toISOString();
  } else {
    nextCounts.inaccurateCount += 1;
  }

  return nextCounts;
}

async function handleListingAccuracyResponse(listing, isAccurate, uiContext = {}) {
  const listingId = listing?.id;

  if (!listingId || !canShowListingAccuracy(listing)) {
    return;
  }

  if (isAccuracyCooldownActive(listingId)) {
    syncAccuracySection(uiContext.section, listing);
    refreshListingPopup(listing);
    return;
  }

  setAccuracyButtonsDisabled(uiContext.section, true);

  try {
    const result = await recordListingAccuracy(listing, isAccurate);
    markAccuracyVote(listingId, isAccurate);
    const updatedListing = applyAccuracyResultToListing(listingId, result);
    syncAccuracySection(uiContext.section, updatedListing || listing);
    refreshListingPopup(updatedListing || listing);
    showToast(getAccuracyStatusMessage(isAccurate), "success");
  } catch (error) {
    setAccuracyButtonsDisabled(uiContext.section, false);
    showToast(error.message || "Could not save your response right now.", "error");
  }
}

function refreshListingPopup(listing) {
  if (!map || !listing) {
    return;
  }

  const marker = listingMarkerMap.get(listing);

  if (!marker) {
    return;
  }

  marker.setPopupContent(buildPopupMarkup(listing));
}

function bindAccuracyInteractions() {
  if (elements.cardGrid) {
    elements.cardGrid.addEventListener("click", (event) => {
      const button = event.target.closest(".accuracy-btn[data-accuracy]");

      if (!button) {
        return;
      }

      event.stopPropagation();

      const card = button.closest(".toilet-card");
      const section = button.closest(".accuracy-section");
      const listingId = card?.dataset.listingId;

      if (!listingId) {
        return;
      }

      const listing = findListingById(listingId);

      if (!listing) {
        return;
      }

      void handleListingAccuracyResponse(listing, button.dataset.accuracy === "yes", { section });
    });
  }

  const mapElement = document.querySelector("#map");

  if (mapElement) {
    mapElement.addEventListener("click", (event) => {
      const button = event.target.closest(".accuracy-btn[data-accuracy][data-toilet-id]");

      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const listing = findListingById(button.dataset.toiletId);

      if (!listing) {
        return;
      }

      void handleListingAccuracyResponse(listing, button.dataset.accuracy === "yes", {
        section: button.closest(".accuracy-section")
      });
    });
  }
}

function buildPopupMarkup(listing) {
  const feeText = listing.paymentRequired ? `Fee: PHP ${listing.fee || 0}` : "Free access";

  return `
    <div class="map-popup">
      <h3>${escapeHtml(listing.name)}</h3>
      <p>${escapeHtml(listing.location)}</p>
      <div class="popup-meta">
        <span class="tag">${listing.hasBidet ? "Bidet available" : "No bidet"}</span>
        <span class="tag">${listing.hasTissue ? "Tissue available" : "No tissue"}</span>
        <span class="tag">${feeText}</span>
        <span class="tag">Cleanliness ${listing.cleanliness}/5</span>
        ${listing.hasBidet && listing.pressureLevel ? `<span class="tag pressure-inline">${escapeHtml(getPressureSummary(listing.pressureLevel))}</span>` : ""}
      </div>
      ${buildAccuracyBlockMarkup(listing)}
    </div>
  `;
}

function normalizeListing(listing, index) {
  const fallback = getFallbackCoordinates(index);
  const latitude = Number(listing.latitude);
  const longitude = Number(listing.longitude);
  const listingId = listing.id ?? listing.uuid ?? null;
  const useLocalId = !listingId && !isUsingSupabase();

  return {
    id: useLocalId ? `local-${index}` : listingId,
    name: String(listing.name || "Unnamed restroom").trim(),
    location: String(listing.location || "Location not provided").trim(),
    latitude: Number.isFinite(latitude) ? latitude : fallback.latitude,
    longitude: Number.isFinite(longitude) ? longitude : fallback.longitude,
    hasBidet: Boolean(listing.hasBidet),
    hasTissue: Boolean(listing.hasTissue),
    cleanliness: clampCleanliness(Number(listing.cleanliness)),
    pressureLevel: Boolean(listing.hasBidet) ? clampPressure(Number(listing.pressureLevel)) : null,
    paymentRequired: Boolean(listing.paymentRequired),
    fee: Math.max(0, Number(listing.fee) || 0),
    notes: String(listing.notes || "No additional notes yet.").trim(),
    confirmCount: Math.max(0, Number(listing.confirmCount ?? listing.confirm_count) || 0),
    inaccurateCount: Math.max(0, Number(listing.inaccurateCount ?? listing.inaccurate_count) || 0),
    lastConfirmedAt: listing.lastConfirmedAt ?? listing.last_confirmed_at ?? null
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

function closeContributePanel() {
  if (isMobileViewport()) {
    if (state.ui.mobileTab !== "add") {
      return;
    }

    state.ui.mobileTab = null;
    updateMobileUI();
    refreshHeroSummary();
    ensureHeroCompactMode();
    return;
  }

  if (state.ui.desktopPanel === "add") {
    setDesktopPanel("listings");
  }
}

function setMobileTab(tab) {
  dismissAreaNudgeIfVisible();

  if (isMobileViewport() && state.ui.mobileTab === tab) {
    state.ui.mobileTab = null;
  } else {
    state.ui.mobileTab = tab;
  }

  syncAreaNudgeMapViewState();
  updateMobileUI();
  refreshHeroSummary();

  if (isMobileViewport() && !state.ui.mobileTab) {
    ensureHeroCompactMode();
  }

  if (state.ui.mobileTab) {
    scrollPanelToTop(state.ui.mobileTab);
  }

  if (state.ui.mobileTab === "add") {
    prepareContributionDraftForAddPanel();
  }
}

function setDesktopPanel(panel) {
  dismissAreaNudgeIfVisible();

  if (panel !== "listings" && panel !== "add") {
    return;
  }

  state.ui.desktopPanel = panel;
  syncAreaNudgeMapViewState();
  updateDesktopUI();
  scrollPanelToTop(panel);

  if (panel === "add") {
    prepareContributionDraftForAddPanel();
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

  updateAboutButtonVisibility();
  updateContributionMarkerVisibility();
}

function updateAboutButtonVisibility() {
  if (!elements.aboutButton) {
    return;
  }

  const shouldHideOnMobile = isMobileViewport() && Boolean(state.ui.mobileTab);
  elements.aboutButton.hidden = shouldHideOnMobile;
}

function openAppMenu() {
  if (!elements.appMenu) {
    return;
  }

  elements.appMenu.hidden = false;
  elements.aboutButton?.setAttribute("aria-expanded", "true");
  document.body.classList.add("app-menu-open");
  elements.appMenu.querySelector(".app-menu-close")?.focus();
}

function closeAppMenu() {
  if (!elements.appMenu) {
    return;
  }

  elements.appMenu.hidden = true;
  elements.aboutButton?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("app-menu-open");
  elements.aboutButton?.focus();
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

function scrollPanelToTop(panelName) {
  const mobilePanel = Array.from(elements.mobilePanels).find((panel) => panel.dataset.mobilePanel === panelName);
  const targetPanel = isMobileViewport()
    ? mobilePanel
    : panelName === "listings" || panelName === "add"
      ? elements.overlayRight
      : elements.overlayLeft;

  if (!targetPanel) {
    return;
  }

  resetScrollTop(targetPanel);
}

function resetScrollTop(element) {
  const scrollToTop = () => {
    element.scrollTop = 0;
    if (typeof element.scrollTo === "function") {
      element.scrollTo({
        top: 0,
        behavior: "auto"
      });
    }
  };

  scrollToTop();
  window.requestAnimationFrame(scrollToTop);
  window.setTimeout(scrollToTop, 220);
}

function isMobileViewport() {
  return window.innerWidth <= 860;
}

function shouldStartAppTour(force = false) {
  if (!isMobileViewport() || !elements.tourOverlay) {
    return false;
  }

  if (force || tourState.force) {
    return true;
  }

  try {
    return window.localStorage.getItem(TOUR_COMPLETE_STORAGE_KEY) !== "1";
  } catch {
    return false;
  }
}

function maybeScheduleAppTour() {
  if (tourState.active) {
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get("tour") === "1") {
    tourState.force = true;
    clearTourQueryParam();
  }

  if (!shouldStartAppTour(tourState.force)) {
    return;
  }

  window.setTimeout(() => {
    if (!shouldStartAppTour(tourState.force)) {
      return;
    }

    startAppTour();
  }, 420);
}

function clearTourQueryParam() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("tour");
    window.history.replaceState({}, "", url);
  } catch {
    // Ignore URL API issues and continue tour flow.
  }
}

function initContributionReminderRuntime() {
  const reminders = window.SitCheckContributionReminders;
  if (!reminders || typeof reminders.init !== "function") {
    return Promise.resolve();
  }

  return reminders.init();
}

function maybeShowContributionReminderNotice() {
  const reminders = window.SitCheckContributionReminders;
  if (!reminders || typeof reminders.showNoticeIfNeeded !== "function") {
    return;
  }

  reminders.showNoticeIfNeeded(showToast);
}

function maybeOpenAddFromQuery() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("add") !== "1") {
      return;
    }

    clearAddQueryParam();

    window.setTimeout(() => {
      if (isMobileViewport()) {
        setMobileTab("add");
        return;
      }

      setDesktopPanel("add");
    }, 280);
  } catch {
    // Ignore URL API issues.
  }
}

function clearAddQueryParam() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("add");
    window.history.replaceState({}, "", url);
  } catch {
    // Ignore URL API issues.
  }
}

function startAppTour() {
  if (!elements.tourOverlay || !isMobileViewport()) {
    return;
  }

  dismissAreaNudgeIfVisible();
  setAppMenuOpenForTour(false);
  tourState.active = true;
  tourState.stepIndex = 0;
  state.ui.mobileTab = null;
  updateMobileUI();

  elements.tourOverlay.hidden = false;
  document.body.classList.add("app-tour-open");
  renderAppTourStep();
}

function advanceAppTour() {
  if (!tourState.active) {
    return;
  }

  if (tourState.stepIndex >= TOUR_STEPS.length - 1) {
    completeAppTour();
    return;
  }

  tourState.stepIndex += 1;
  renderAppTourStep();
}

function completeAppTour() {
  if (!tourState.active) {
    return;
  }

  tourState.active = false;
  tourState.stepIndex = 0;
  tourState.force = false;

  if (elements.tourOverlay) {
    elements.tourOverlay.hidden = true;
  }

  document.body.classList.remove("app-tour-open");
  elements.tourOverlay?.classList.remove("is-menu-step");
  setAppMenuOpenForTour(false);

  try {
    window.localStorage.setItem(TOUR_COMPLETE_STORAGE_KEY, "1");
  } catch {
    // Ignore storage write issues and continue app flow.
  }
}

function renderAppTourStep() {
  const step = TOUR_STEPS[tourState.stepIndex];

  if (!step || !elements.tourOverlay) {
    completeAppTour();
    return;
  }

  setAppMenuOpenForTour(Boolean(step.openMenu));
  elements.tourOverlay.classList.toggle("is-menu-step", Boolean(step.menuStep));

  const target = document.querySelector(step.targetSelector);

  if (!target) {
    completeAppTour();
    return;
  }

  if (elements.tourStepLabel) {
    elements.tourStepLabel.textContent = `Step ${tourState.stepIndex + 1} of ${TOUR_STEPS.length}`;
  }

  if (elements.tourTitle) {
    elements.tourTitle.textContent = step.title;
  }

  if (elements.tourBody) {
    elements.tourBody.textContent = step.body;
  }

  if (elements.tourNextButton) {
    elements.tourNextButton.textContent =
      tourState.stepIndex >= TOUR_STEPS.length - 1 ? "Got it" : "Next";
  }

  positionAppTourSpotlight(target);
}

function setAppMenuOpenForTour(shouldOpen) {
  if (!elements.appMenu) {
    return;
  }

  elements.appMenu.hidden = !shouldOpen;
  elements.aboutButton?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  document.body.classList.toggle("app-menu-open", shouldOpen);
}

function positionAppTourSpotlight(target) {
  if (!elements.tourSpotlight || !target) {
    return;
  }

  const rect = target.getBoundingClientRect();
  const padding = target.matches("[data-tour-target='add-tab']") ? 4 : 8;
  const top = Math.max(8, rect.top - padding);
  const left = Math.max(8, rect.left - padding);
  const width = Math.min(window.innerWidth - left - 8, rect.width + padding * 2);
  const height = Math.min(window.innerHeight - top - 8, rect.height + padding * 2);

  elements.tourSpotlight.style.top = `${top}px`;
  elements.tourSpotlight.style.left = `${left}px`;
  elements.tourSpotlight.style.width = `${width}px`;
  elements.tourSpotlight.style.height = `${height}px`;
}

function handleTourResize() {
  if (!tourState.active) {
    return;
  }

  if (!isMobileViewport()) {
    completeAppTour();
    return;
  }

  renderAppTourStep();
}

function isUsingSupabase() {
  return state.ui.dataMode === "supabase";
}

function getZoomControlPosition() {
  return isMobileViewport() ? "topright" : "bottomleft";
}

function updateMapControlLayout() {
  if (!isMobileViewport()) {
    document.body.classList.remove("map-controls-elevated", "map-controls-nudge");
    return;
  }

  document.body.classList.toggle("map-controls-nudge", areaNudgeVisible);

  const isCompactHeroVisible = Boolean(
    elements.heroPanel?.classList.contains("is-compact") &&
    !elements.heroPanel.classList.contains("is-hidden-by-area-nudge")
  );
  document.body.classList.toggle("map-controls-elevated", isCompactHeroVisible && !areaNudgeVisible);
}

function syncMapControls(force = false) {
  const nextPosition = getZoomControlPosition();

  if (!map || (!force && mapControls && nextPosition === mapControlsPosition)) {
    return;
  }

  if (mapControls) {
    map.removeControl(mapControls);
  }

  mapControls = createMapControls(nextPosition);
  mapControlsPosition = nextPosition;
  updateMapControlLayout();
}

function createMapControls(position) {
  const MapControls = L.Control.extend({
    options: {
      position
    },
    onAdd() {
      const container = L.DomUtil.create("div", "leaflet-control-map-stack");
      const zoomGroup = L.DomUtil.create("div", "map-control-group map-control-zoom-group leaflet-bar", container);
      const zoomInButton = L.DomUtil.create("button", "map-control-button map-control-zoom-button", zoomGroup);
      const zoomOutButton = L.DomUtil.create("button", "map-control-button map-control-zoom-button", zoomGroup);
      const locateGroup = L.DomUtil.create("div", "map-control-group map-control-locate-group leaflet-bar", container);
      const locateButton = L.DomUtil.create("button", "map-control-button map-control-locate-button", locateGroup);

      zoomInButton.type = "button";
      zoomInButton.title = "Zoom in";
      zoomInButton.setAttribute("aria-label", "Zoom in");
      zoomInButton.textContent = "+";

      zoomOutButton.type = "button";
      zoomOutButton.title = "Zoom out";
      zoomOutButton.setAttribute("aria-label", "Zoom out");
      zoomOutButton.textContent = "\u2212";

      locateButton.type = "button";
      locateButton.title = "Use my location";
      locateButton.setAttribute("aria-label", "Use my location");
      locateButton.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke-width="2"></circle>
          <path d="M12 2V5" stroke-width="2" stroke-linecap="round"></path>
          <path d="M12 19V22" stroke-width="2" stroke-linecap="round"></path>
          <path d="M2 12H5" stroke-width="2" stroke-linecap="round"></path>
          <path d="M19 12H22" stroke-width="2" stroke-linecap="round"></path>
        </svg>
      `;

      elements.locateButton = locateButton;
      setLocateButtonState(isLocatingUser);

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.on(zoomInButton, "click", (event) => {
        L.DomEvent.stop(event);
        map.zoomIn();
      });
      L.DomEvent.on(zoomOutButton, "click", (event) => {
        L.DomEvent.stop(event);
        map.zoomOut();
      });
      L.DomEvent.on(locateButton, "click", (event) => {
        L.DomEvent.stop(event);
        locateUser();
      });

      return container;
    }
  });

  return new MapControls().addTo(map);
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

  const panToTarget = () => {
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
  };

  waitForContributionFocusReady(() => {
    window.requestAnimationFrame(() => {
      panToTarget();
    });
  });
}

function waitForContributionFocusReady(callback) {
  const settleDelayMs = isMobileViewport() ? 320 : 120;

  const waitForLayout = () => {
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(callback);
      });
    }, settleDelayMs);
  };

  if (!map || !map._panAnim?._inProgress) {
    waitForLayout();
    return;
  }

  map.once("moveend", waitForLayout);
}

function syncPressureFieldVisibility() {
  if (!elements.hasBidetInput || !elements.pressureFieldset) {
    return;
  }

  elements.pressureFieldset.hidden = !elements.hasBidetInput.checked;
}

function syncFeeFieldState() {
  if (!elements.feeInput || !elements.paymentRequiredInput) {
    return;
  }

  const isPaymentRequired = elements.paymentRequiredInput.checked;

  if (elements.feeField) {
    elements.feeField.hidden = !isPaymentRequired;
  }

  elements.feeInput.disabled = !isPaymentRequired;

  if (!isPaymentRequired) {
    elements.feeInput.value = "0";
  }
}

function resetContributionDraft() {
  state.draft.nameTouched = false;
  state.draft.locationTouched = false;
  state.draft.latitude = null;
  state.draft.longitude = null;

  elements.nameInput.value = "";
  elements.locationInput.value = "";
  elements.pinStatus.textContent = "Drag the orange pin on the map to the right spot. We will suggest the location details automatically.";

  if (!contributionMarker) {
    return;
  }

  elements.latitudeInput.value = "";
  elements.longitudeInput.value = "";
}

function applyContributionPosition(latitude, longitude) {
  state.draft.latitude = latitude;
  state.draft.longitude = longitude;
  elements.latitudeInput.value = String(latitude);
  elements.longitudeInput.value = String(longitude);
  reverseGeocode(latitude, longitude);
}

function hasContributionDraftPosition() {
  return Number.isFinite(state.draft.latitude) && Number.isFinite(state.draft.longitude);
}

function prepareContributionDraftForAddPanel() {
  if (!contributionMarker) {
    return;
  }

  if (hasContributionDraftPosition()) {
    contributionMarker.setLatLng([state.draft.latitude, state.draft.longitude]);
    elements.latitudeInput.value = String(state.draft.latitude);
    elements.longitudeInput.value = String(state.draft.longitude);
    elements.pinStatus.textContent = "Draft pin restored. Drag to refine the location if needed.";
    focusContributionPin();
    return;
  }

  elements.pinStatus.textContent = userLocation
    ? "Pin placed at your detected location. Drag to set the exact toilet location."
    : "Pin placed near the center of the current map view. Drag to set the exact location.";
  placeContributionPinAtPreferredLocation({
    focusAfterPlacement: true
  });
}

function placeContributionPinAtPreferredLocation(options = {}) {
  if (!contributionMarker) {
    return;
  }

  const { focusAfterPlacement = false } = options;

  getPreferredContributionPosition((latitude, longitude) => {
    contributionMarker.setLatLng([latitude, longitude]);
    applyContributionPosition(latitude, longitude);

    if (focusAfterPlacement) {
      focusContributionPin();
    }
  });
}

function placeContributionPinFromCurrentView(options = {}) {
  if (!contributionMarker) {
    return;
  }

  const { focusAfterPlacement = false } = options;

  getSettledMapCenter((latitude, longitude) => {
    contributionMarker.setLatLng([latitude, longitude]);
    applyContributionPosition(latitude, longitude);

    if (focusAfterPlacement) {
      focusContributionPin();
    }
  });
}

function getPreferredContributionPosition(callback) {
  if (hasValidUserLocation()) {
    callback(userLocation.latitude, userLocation.longitude);
    return;
  }

  getSettledMapCenter(callback);
}

function hasValidUserLocation() {
  return Boolean(userLocation) &&
    Number.isFinite(userLocation.latitude) &&
    Number.isFinite(userLocation.longitude);
}

function getSettledMapCenter(callback) {
  if (!map) {
    callback(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
    return;
  }

  let resolved = false;
  let timeoutId = 0;
  const onMoveEnd = () => {
    window.clearTimeout(timeoutId);
    complete();
  };

  const complete = () => {
    if (resolved) {
      return;
    }

    resolved = true;
    map.off("moveend", onMoveEnd);
    const center = map.getCenter();
    callback(center.lat, center.lng);
  };

  timeoutId = window.setTimeout(complete, 180);
  map.on("moveend", onMoveEnd);
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
    const visibleBounds = getVisibleContributionMapBounds(size);

    return {
      x: size.x / 2,
      y: (visibleBounds.top + visibleBounds.bottom) / 2
    };
  }

  return {
    x: size.x * 0.58,
    y: size.y * 0.48
  };
}

function getVisibleContributionMapBounds(size) {
  const top = Math.min(size.y, getVisibleMapTopBoundary());
  const activeAddPanel = document.querySelector('#add-form.mobile-panel.is-active');

  if (!activeAddPanel) {
    return {
      top,
      bottom: size.y * 0.84
    };
  }

  const panelRect = activeAddPanel.getBoundingClientRect();
  const mapRect = map.getContainer().getBoundingClientRect();
  const panelTop = Math.max(0, panelRect.top - mapRect.top);
  const bottom = Math.max(top + 80, panelTop - 16);

  return {
    top,
    bottom: Math.min(size.y, bottom)
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
