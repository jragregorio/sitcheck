const SUPABASE_TABLES = {
  submissions: "toilet_submissions"
};

const SUBMISSION_FIELDS_WITH_REVIEW = "id, created_at, name, location_text, latitude, longitude, has_bidet, has_tissue, cleanliness, pressure_level, payment_required, fee, notes, status, reviewed_at";
const SUBMISSION_FIELDS_BASE = "id, created_at, name, location_text, latitude, longitude, has_bidet, has_tissue, cleanliness, pressure_level, payment_required, fee, notes";
const EMBED_DELTA = 0.0045;

const supabaseConfig = window.SITCHECK_CONFIG || {};
const supabaseUrl = typeof supabaseConfig.supabaseUrl === "string" ? supabaseConfig.supabaseUrl.trim() : "";
const supabaseAnonKey = typeof supabaseConfig.supabaseAnonKey === "string" ? supabaseConfig.supabaseAnonKey.trim() : "";

const supabaseClient = supabaseUrl && supabaseAnonKey && window.supabase?.createClient
  ? window.supabase.createClient(supabaseUrl, supabaseAnonKey)
  : null;

const state = {
  user: null,
  queueFilter: "pending",
  canModerate: true
};

const elements = {
  pageStatus: document.querySelector("#page-status"),
  authCard: document.querySelector("#auth-card"),
  queueCard: document.querySelector("#queue-card"),
  authForm: document.querySelector("#auth-form"),
  emailInput: document.querySelector("#email-input"),
  passwordInput: document.querySelector("#password-input"),
  signInButton: document.querySelector("#sign-in-button"),
  signOutButton: document.querySelector("#sign-out-button"),
  refreshButton: document.querySelector("#refresh-button"),
  queueFilter: document.querySelector("#queue-filter"),
  queueList: document.querySelector("#queue-list"),
  sessionLabel: document.querySelector("#session-label")
};

bindEvents();
void init();

function bindEvents() {
  elements.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseClient) {
      showStatus("Supabase is not configured. Check config.js.", true);
      return;
    }

    setSignInBusy(true);
    hideStatus();

    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error || !data.user) {
        throw new Error("Sign in failed. Check your credentials.");
      }

      state.user = data.user;
      renderAuthState();
      await loadQueue();
      showStatus("Signed in as moderator.", false, true);
    } catch (error) {
      showStatus(error.message || "Sign in failed.", true);
    } finally {
      setSignInBusy(false);
    }
  });

  elements.signOutButton.addEventListener("click", async () => {
    if (!supabaseClient) {
      return;
    }

    await supabaseClient.auth.signOut();
    state.user = null;
    renderAuthState();
    elements.queueList.innerHTML = "";
    showStatus("Signed out.", false, true);
  });

  elements.refreshButton.addEventListener("click", () => {
    void loadQueue();
  });

  elements.queueFilter.addEventListener("change", () => {
    state.queueFilter = elements.queueFilter.value;
    void loadQueue();
  });
}

async function init() {
  if (!supabaseClient) {
    renderAuthState();
    showStatus("Supabase is not configured. Add supabaseUrl and supabaseAnonKey in config.js.", true);
    return;
  }

  const { data } = await supabaseClient.auth.getUser();
  state.user = data.user || null;
  renderAuthState();

  if (state.user) {
    await loadQueue();
  }
}

function renderAuthState() {
  const isSignedIn = Boolean(state.user);
  elements.authCard.classList.toggle("hidden", isSignedIn);
  elements.queueCard.classList.toggle("hidden", !isSignedIn);
  elements.signOutButton.classList.toggle("hidden", !isSignedIn);
  elements.sessionLabel.textContent = isSignedIn ? `Signed in as ${state.user.email || "moderator"}` : "";
}

function setSignInBusy(isBusy) {
  elements.signInButton.disabled = isBusy;
  elements.signInButton.textContent = isBusy ? "Signing in..." : "Sign in";
}

async function loadQueue() {
  if (!supabaseClient || !state.user) {
    return;
  }

  elements.refreshButton.disabled = true;
  elements.refreshButton.textContent = "Refreshing...";
  hideStatus();

  try {
    const records = await fetchSubmissions();
    renderQueue(records);
  } catch (error) {
    renderQueue([]);
    showStatus(error.message || "Could not load submissions.", true);
  } finally {
    elements.refreshButton.disabled = false;
    elements.refreshButton.textContent = "Refresh";
  }
}

async function fetchSubmissions() {
  const withReviewResult = await querySubmissions(SUBMISSION_FIELDS_WITH_REVIEW, true);
  if (!withReviewResult.error) {
    state.canModerate = true;
    return withReviewResult.data || [];
  }

  const fallbackResult = await querySubmissions(SUBMISSION_FIELDS_BASE, false);
  if (fallbackResult.error) {
    throw new Error("Could not load submissions. Check RLS policies for moderator access.");
  }

  state.canModerate = false;
  showStatus("Queue loaded, but review columns were not found. Add status/reviewed_at to enable approve/reject actions.", true);
  return (fallbackResult.data || []).map((item) => ({ ...item, status: "pending" }));
}

async function querySubmissions(fields, allowStatusFilter) {
  let query = supabaseClient
    .from(SUPABASE_TABLES.submissions)
    .select(fields)
    .order("created_at", { ascending: false })
    .limit(100);

  if (allowStatusFilter && state.queueFilter !== "all") {
    query = query.eq("status", state.queueFilter);
  }

  const { data, error } = await query;
  return { data, error };
}

function renderQueue(records) {
  elements.queueList.innerHTML = "";

  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "status";
    empty.textContent = "No submissions found for this filter.";
    elements.queueList.appendChild(empty);
    return;
  }

  records.forEach((record) => {
    const card = document.createElement("article");
    card.className = "queue-item";

    const title = document.createElement("h3");
    title.textContent = record.name || "Unnamed restroom";

    const location = document.createElement("p");
    location.textContent = record.location_text || "Location not provided";

    const snapshot = createLocationSnapshot(record);

    const meta = document.createElement("div");
    meta.className = "queue-meta";
    meta.appendChild(createTag((record.status || "pending").toLowerCase(), (record.status || "pending").toLowerCase()));
    meta.appendChild(createTag(record.has_bidet ? "Bidet available" : "No bidet"));
    meta.appendChild(createTag(record.has_tissue ? "Tissue available" : "No tissue"));
    meta.appendChild(createTag(`Cleanliness ${Number(record.cleanliness) || 0}/5`));
    meta.appendChild(createTag(record.payment_required ? `Fee PHP ${Number(record.fee) || 0}` : "Free"));

    const notes = document.createElement("p");
    notes.textContent = record.notes || "No notes provided.";

    const submitted = document.createElement("p");
    const createdAt = record.created_at ? new Date(record.created_at) : null;
    submitted.textContent = createdAt && !Number.isNaN(createdAt.getTime())
      ? `Submitted ${createdAt.toLocaleString()}`
      : "Submission timestamp unavailable";

    const actions = document.createElement("div");
    actions.className = "queue-actions";

    const approveButton = document.createElement("button");
    approveButton.className = "button warn";
    approveButton.type = "button";
    approveButton.textContent = "Approve";
    approveButton.disabled = !state.canModerate || record.status === "approved";
    approveButton.addEventListener("click", () => {
      void updateReviewState(record.id, "approved", approveButton, rejectButton);
    });

    const rejectButton = document.createElement("button");
    rejectButton.className = "button danger";
    rejectButton.type = "button";
    rejectButton.textContent = "Reject";
    rejectButton.disabled = !state.canModerate || record.status === "rejected";
    rejectButton.addEventListener("click", () => {
      void updateReviewState(record.id, "rejected", approveButton, rejectButton);
    });

    actions.append(approveButton, rejectButton);
    card.append(title, location, snapshot, meta, notes, submitted, actions);
    elements.queueList.appendChild(card);
  });
}

async function updateReviewState(submissionId, status, approveButton, rejectButton) {
  if (!supabaseClient || !state.user) {
    return;
  }

  approveButton.disabled = true;
  rejectButton.disabled = true;
  hideStatus();

  const { error } = await supabaseClient
    .from(SUPABASE_TABLES.submissions)
    .update({
      status,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", submissionId);

  if (error) {
    showStatus("Could not update review status. Check table columns and moderator RLS policies.", true);
    approveButton.disabled = false;
    rejectButton.disabled = false;
    return;
  }

  showStatus(`Submission marked as ${status}.`, false, true);
  await loadQueue();
}

function createTag(text, variant = "") {
  const tag = document.createElement("span");
  tag.className = `tag ${variant}`.trim();
  tag.textContent = text;
  return tag;
}

function createLocationSnapshot(record) {
  const wrapper = document.createElement("div");
  wrapper.className = "queue-location-snapshot";

  const latitude = Number(record.latitude);
  const longitude = Number(record.longitude);

  if (!hasValidCoordinates(latitude, longitude)) {
    const unavailable = document.createElement("p");
    unavailable.textContent = "Map snapshot unavailable: coordinates were not provided.";
    wrapper.appendChild(unavailable);
    return wrapper;
  }

  const mapFrame = document.createElement("iframe");
  mapFrame.loading = "lazy";
  mapFrame.referrerPolicy = "no-referrer-when-downgrade";
  mapFrame.title = `Location snapshot for ${record.name || "submitted restroom"}`;
  mapFrame.src = buildSnapshotEmbedUrl(latitude, longitude);

  const mapLink = document.createElement("a");
  mapLink.className = "snapshot-link";
  mapLink.href = buildExternalMapUrl(latitude, longitude);
  mapLink.target = "_blank";
  mapLink.rel = "noopener noreferrer";
  mapLink.textContent = "Open in map";

  wrapper.append(mapFrame, mapLink);
  return wrapper;
}

function hasValidCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
}

function buildSnapshotEmbedUrl(latitude, longitude) {
  const minLongitude = (longitude - EMBED_DELTA).toFixed(6);
  const minLatitude = (latitude - EMBED_DELTA).toFixed(6);
  const maxLongitude = (longitude + EMBED_DELTA).toFixed(6);
  const maxLatitude = (latitude + EMBED_DELTA).toFixed(6);
  const lat = latitude.toFixed(6);
  const lng = longitude.toFixed(6);
  const bbox = `${minLongitude}%2C${minLatitude}%2C${maxLongitude}%2C${maxLatitude}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function buildExternalMapUrl(latitude, longitude) {
  return `https://www.openstreetmap.org/?mlat=${latitude.toFixed(6)}&mlon=${longitude.toFixed(6)}#map=16/${latitude.toFixed(6)}/${longitude.toFixed(6)}`;
}

function showStatus(message, isError = false, isSuccess = false) {
  elements.pageStatus.textContent = message;
  elements.pageStatus.classList.remove("hidden", "is-error", "is-success");

  if (isError) {
    elements.pageStatus.classList.add("is-error");
    return;
  }

  if (isSuccess) {
    elements.pageStatus.classList.add("is-success");
  }
}

function hideStatus() {
  elements.pageStatus.textContent = "";
  elements.pageStatus.classList.add("hidden");
  elements.pageStatus.classList.remove("is-error", "is-success");
}
