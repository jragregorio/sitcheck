const SUPABASE_TABLES = {
  submissions: "toilet_submissions",
  toilets: "toilets"
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
  queueSearch: "",
  canModerate: true,
  editingSubmissionId: null
};

const reviewConfirmState = {
  action: null,
  submissionId: null,
  approveButton: null,
  rejectButton: null
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
  queueFilterButtons: document.querySelectorAll("[data-queue-filter]"),
  queueSearch: document.querySelector("#queue-search"),
  queueList: document.querySelector("#queue-list"),
  sessionLabel: document.querySelector("#session-label"),
  reviewConfirmModal: document.querySelector("#review-confirm-modal"),
  reviewConfirmTitle: document.querySelector("#review-confirm-title"),
  reviewConfirmName: document.querySelector("#review-confirm-name"),
  reviewConfirmLocation: document.querySelector("#review-confirm-location"),
  reviewConfirmMessage: document.querySelector("#review-confirm-message"),
  reviewConfirmCancel: document.querySelector("#review-confirm-cancel"),
  reviewConfirmConfirm: document.querySelector("#review-confirm-confirm")
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

  elements.queueFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextFilter = button.dataset.queueFilter || "pending";
      if (state.queueFilter === nextFilter) {
        return;
      }

      state.queueFilter = nextFilter;
      syncQueueFilterButtons();
      void loadQueue();
    });
  });

  syncQueueFilterButtons();

  if (elements.queueSearch) {
    elements.queueSearch.addEventListener("input", () => {
      state.queueSearch = elements.queueSearch.value.trim().toLowerCase();
      void loadQueue({ silent: true });
    });
  }

  bindReviewConfirmEvents();
}

function syncQueueFilterButtons() {
  elements.queueFilterButtons.forEach((button) => {
    const isActive = button.dataset.queueFilter === state.queueFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function bindReviewConfirmEvents() {
  if (!elements.reviewConfirmModal) {
    return;
  }

  elements.reviewConfirmCancel.addEventListener("click", () => {
    closeReviewConfirm();
  });

  elements.reviewConfirmConfirm.addEventListener("click", () => {
    void confirmReviewAction();
  });

  elements.reviewConfirmModal.querySelectorAll("[data-review-confirm-dismiss]").forEach((node) => {
    node.addEventListener("click", () => {
      closeReviewConfirm();
    });
  });

  document.addEventListener("keydown", handleReviewConfirmKeydown);
}

function openReviewConfirm({ action, record, approveButton, rejectButton }) {
  if (!elements.reviewConfirmModal || !record) {
    return;
  }

  const isApprove = action === "approved";

  elements.reviewConfirmTitle.textContent = isApprove
    ? "Approve this listing?"
    : "Reject this listing?";
  elements.reviewConfirmName.textContent = record.name || "Unnamed restroom";
  elements.reviewConfirmLocation.textContent = record.location_text || "Location not provided";
  elements.reviewConfirmMessage.textContent = isApprove
    ? "This listing will appear on the public map for everyone."
    : "This listing will be marked rejected. If it was previously approved, it will be removed from the public map.";
  elements.reviewConfirmMessage.className = `review-confirm-message ${isApprove ? "is-approve" : "is-reject"}`;

  elements.reviewConfirmConfirm.textContent = isApprove ? "Approve" : "Reject";
  elements.reviewConfirmConfirm.className = isApprove ? "button success" : "button danger";
  elements.reviewConfirmConfirm.disabled = false;

  reviewConfirmState.action = action;
  reviewConfirmState.submissionId = record.id;
  reviewConfirmState.approveButton = approveButton;
  reviewConfirmState.rejectButton = rejectButton;

  elements.reviewConfirmModal.hidden = false;
  elements.reviewConfirmModal.classList.remove("hidden");
  elements.reviewConfirmCancel.focus();
}

function closeReviewConfirm() {
  if (!elements.reviewConfirmModal) {
    return;
  }

  elements.reviewConfirmModal.hidden = true;
  elements.reviewConfirmModal.classList.add("hidden");
  elements.reviewConfirmConfirm.disabled = false;

  reviewConfirmState.action = null;
  reviewConfirmState.submissionId = null;
  reviewConfirmState.approveButton = null;
  reviewConfirmState.rejectButton = null;
}

function handleReviewConfirmKeydown(event) {
  if (elements.reviewConfirmModal?.hidden) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeReviewConfirm();
  }
}

async function confirmReviewAction() {
  const { action, submissionId, approveButton, rejectButton } = reviewConfirmState;

  if (!action || !submissionId || !approveButton || !rejectButton) {
    return;
  }

  elements.reviewConfirmConfirm.disabled = true;
  closeReviewConfirm();
  await updateReviewState(submissionId, action, approveButton, rejectButton);
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

async function loadQueue(options = {}) {
  if (!supabaseClient || !state.user) {
    return;
  }

  const { silent = false } = options;

  elements.refreshButton.disabled = true;
  elements.refreshButton.textContent = "Refreshing...";
  if (!silent) {
    hideStatus();
  }

  try {
    const records = await fetchSubmissions();
    const withAccuracy = await attachAccuracyCounts(records);
    renderQueue(filterQueueRecords(withAccuracy));
  } catch (error) {
    renderQueue([]);
    showStatus(error.message || "Could not load submissions.", true);
  } finally {
    elements.refreshButton.disabled = false;
    elements.refreshButton.textContent = "Refresh";
  }
}

function filterQueueRecords(records) {
  const term = state.queueSearch;

  if (!term) {
    return records;
  }

  return records.filter((record) => {
    const haystack = [
      record.name,
      record.location_text,
      record.notes
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(term);
  });
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

async function attachAccuracyCounts(records) {
  if (!Array.isArray(records) || !records.length || !supabaseClient) {
    return records || [];
  }

  const submissionIds = records.map((record) => record.id).filter(Boolean);

  if (!submissionIds.length) {
    return records.map((record) => ({
      ...record,
      confirm_count: null,
      inaccurate_count: null,
      last_confirmed_at: null,
      accuracyLinked: false
    }));
  }

  const accuracyBySubmissionId = new Map();

  try {
    const bySubmissionId = await supabaseClient
      .from(SUPABASE_TABLES.toilets)
      .select("submission_id, source_submission_id, confirm_count, inaccurate_count, last_confirmed_at")
      .in("submission_id", submissionIds);

    if (!bySubmissionId.error && Array.isArray(bySubmissionId.data)) {
      bySubmissionId.data.forEach((row) => {
        if (row.submission_id != null) {
          accuracyBySubmissionId.set(String(row.submission_id), row);
        }
      });
    }

    const missingIds = submissionIds.filter((id) => !accuracyBySubmissionId.has(String(id)));

    if (missingIds.length) {
      const bySourceId = await supabaseClient
        .from(SUPABASE_TABLES.toilets)
        .select("submission_id, source_submission_id, confirm_count, inaccurate_count, last_confirmed_at")
        .in("source_submission_id", missingIds.map(String));

      if (!bySourceId.error && Array.isArray(bySourceId.data)) {
        bySourceId.data.forEach((row) => {
          const key = row.source_submission_id != null
            ? String(row.source_submission_id)
            : row.submission_id != null
              ? String(row.submission_id)
              : null;

          if (key && !accuracyBySubmissionId.has(key)) {
            accuracyBySubmissionId.set(key, row);
          }
        });
      }
    }
  } catch {
    // Accuracy columns/RPC may not be applied yet; still render the queue.
  }

  return records.map((record) => {
    const accuracy = accuracyBySubmissionId.get(String(record.id));

    if (!accuracy) {
      return {
        ...record,
        confirm_count: null,
        inaccurate_count: null,
        last_confirmed_at: null,
        accuracyLinked: false
      };
    }

    return {
      ...record,
      confirm_count: Math.max(0, Number(accuracy.confirm_count) || 0),
      inaccurate_count: Math.max(0, Number(accuracy.inaccurate_count) || 0),
      last_confirmed_at: accuracy.last_confirmed_at || null,
      accuracyLinked: true
    };
  });
}

function getAccuracyFeedbackText(record) {
  if (record.accuracyLinked) {
    const yesCount = Math.max(0, Number(record.confirm_count) || 0);
    const noCount = Math.max(0, Number(record.inaccurate_count) || 0);
    return `Accuracy feedback: ${yesCount} Yes ${noCount} No`;
  }

  if ((record.status || "").toLowerCase() === "approved") {
    return "Accuracy feedback: no live listing linked";
  }

  return "Accuracy feedback: not published yet";
}

function getLastConfirmedText(record) {
  if (!record.accuracyLinked || !record.last_confirmed_at) {
    return "";
  }

  const confirmedAt = new Date(record.last_confirmed_at);
  return Number.isNaN(confirmedAt.getTime())
    ? ""
    : `Last confirmed ${confirmedAt.toLocaleString()}`;
}

function renderQueue(records) {
  elements.queueList.innerHTML = "";
  state.editingSubmissionId = null;

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
    meta.appendChild(createTag(`Pressure ${Number(record.pressure_level) || 0}/5`));
    meta.appendChild(createTag(record.payment_required ? `Fee PHP ${Number(record.fee) || 0}` : "Free"));

    const accuracy = document.createElement("p");
    accuracy.className = "accuracy-counts";
    accuracy.textContent = getAccuracyFeedbackText(record);

    const lastConfirmed = document.createElement("p");
    lastConfirmed.className = "accuracy-last-confirmed";
    lastConfirmed.textContent = getLastConfirmedText(record);
    lastConfirmed.hidden = !lastConfirmed.textContent;

    const notes = document.createElement("p");
    notes.textContent = record.notes || "No notes provided.";

    const submitted = document.createElement("p");
    const createdAt = record.created_at ? new Date(record.created_at) : null;
    submitted.textContent = createdAt && !Number.isNaN(createdAt.getTime())
      ? `Submitted ${createdAt.toLocaleString()}`
      : "Submission timestamp unavailable";

    const actions = document.createElement("div");
    actions.className = "queue-actions";

    const editButton = document.createElement("button");
    editButton.className = "button secondary";
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.disabled = !state.canModerate;
    const editPanel = createSubmissionEditPanel(record);

    const approveButton = document.createElement("button");
    approveButton.className = "button success";
    approveButton.type = "button";
    approveButton.textContent = "Approve";
    approveButton.disabled = !state.canModerate || record.status === "approved";
    approveButton.addEventListener("click", () => {
      openReviewConfirm({
        action: "approved",
        record,
        approveButton,
        rejectButton
      });
    });

    const rejectButton = document.createElement("button");
    rejectButton.className = "button danger";
    rejectButton.type = "button";
    rejectButton.textContent = "Reject";
    rejectButton.disabled = !state.canModerate || record.status === "rejected";
    rejectButton.addEventListener("click", () => {
      openReviewConfirm({
        action: "rejected",
        record,
        approveButton,
        rejectButton
      });
    });

    editButton.addEventListener("click", () => {
      toggleEditPanel(card, editPanel, record.id);
    });

    actions.append(editButton, approveButton, rejectButton);
    card.append(title, location, snapshot, meta, accuracy, lastConfirmed, notes, submitted, actions, editPanel);
    elements.queueList.appendChild(card);
  });
}

function createSubmissionEditPanel(record) {
  const panel = document.createElement("div");
  panel.className = "queue-edit-panel hidden";
  panel.dataset.submissionId = record.id;

  const form = document.createElement("form");
  form.className = "queue-edit-form";
  form.noValidate = true;

  const toggleStack = document.createElement("div");
  toggleStack.className = "toggle-stack";
  toggleStack.append(
    createToggleRow("Has Bidet?", `edit-bidet-${record.id}`, "hasBidet", Boolean(record.has_bidet)),
    createToggleRow("Has Tissue?", `edit-tissue-${record.id}`, "hasTissue", Boolean(record.has_tissue)),
    createToggleRow("Payment required?", `edit-payment-${record.id}`, "paymentRequired", Boolean(record.payment_required))
  );

  const cleanlinessField = document.createElement("label");
  cleanlinessField.className = "field";
  cleanlinessField.innerHTML = `
    <span>Cleanliness</span>
    <select name="cleanliness">
      <option value="5">5 - Very clean</option>
      <option value="4">4 - Clean</option>
      <option value="3">3 - Acceptable</option>
      <option value="2">2 - Needs work</option>
      <option value="1">1 - Poor</option>
    </select>
  `;
  cleanlinessField.querySelector("select").value = String(clampCleanliness(Number(record.cleanliness)));

  const pressureField = document.createElement("label");
  pressureField.className = "field";
  pressureField.dataset.pressureField = "true";
  if (!record.has_bidet) {
    pressureField.classList.add("hidden");
  }
  pressureField.innerHTML = `
    <span>Pressure level</span>
    <select name="pressureLevel">
      <option value="1">1 - Polite Drizzle</option>
      <option value="2">2 - Gentle Splash</option>
      <option value="3">3 - Steady Spray</option>
      <option value="4">4 - Power Rinse</option>
      <option value="5">5 - Firehose Energy</option>
    </select>
  `;
  pressureField.querySelector("select").value = String(clampPressure(Number(record.pressure_level)));

  const feeField = document.createElement("label");
  feeField.className = "field";
  feeField.dataset.feeField = "true";
  if (!record.payment_required) {
    feeField.classList.add("hidden");
  }
  feeField.innerHTML = `
    <span>Fee amount</span>
    <input name="fee" type="number" min="0" step="1" placeholder="0">
  `;
  feeField.querySelector("input").value = String(Math.max(0, Number(record.fee) || 0));

  const notesField = document.createElement("label");
  notesField.className = "field";
  notesField.innerHTML = `
    <span>Notes</span>
    <textarea name="notes" rows="3" placeholder="Notes about this restroom"></textarea>
  `;
  notesField.querySelector("textarea").value = record.notes || "";

  const actions = document.createElement("div");
  actions.className = "queue-edit-actions";

  const saveButton = document.createElement("button");
  saveButton.className = "button primary";
  saveButton.type = "submit";
  saveButton.textContent = "Save changes";

  const cancelButton = document.createElement("button");
  cancelButton.className = "button";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => {
    panel.classList.add("hidden");
    state.editingSubmissionId = null;
  });

  actions.append(saveButton, cancelButton);
  form.append(toggleStack, cleanlinessField, pressureField, feeField, notesField, actions);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveSubmissionEdits(record, form, saveButton);
  });

  bindEditFormInteractions(form);
  panel.appendChild(form);
  return panel;
}

function createToggleRow(labelText, inputId, name, checked) {
  const row = document.createElement("div");
  row.className = "toggle-row";

  const label = document.createElement("span");
  label.className = "toggle-label";
  label.textContent = labelText;

  const switchLabel = document.createElement("label");
  switchLabel.className = "toggle-switch toggle-switch-fill";
  switchLabel.htmlFor = inputId;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "toggle-input";
  input.id = inputId;
  input.name = name;
  input.value = "true";
  input.checked = checked;

  const track = document.createElement("span");
  track.className = "toggle-track";
  track.setAttribute("aria-hidden", "true");

  switchLabel.append(input, track);
  row.append(label, switchLabel);
  return row;
}

function bindEditFormInteractions(form) {
  const bidetInput = form.querySelector('input[name="hasBidet"]');
  const pressureField = form.querySelector('[data-pressure-field="true"]');
  const paymentInput = form.querySelector('input[name="paymentRequired"]');
  const feeField = form.querySelector('[data-fee-field="true"]');
  const feeInput = form.querySelector('input[name="fee"]');

  if (bidetInput && pressureField) {
    const syncPressureField = () => {
      pressureField.classList.toggle("hidden", !bidetInput.checked);
    };

    bidetInput.addEventListener("change", syncPressureField);
    syncPressureField();
  }

  if (!paymentInput || !feeInput || !feeField) {
    return;
  }

  const syncFeeField = () => {
    const isPaymentRequired = paymentInput.checked;
    feeField.classList.toggle("hidden", !isPaymentRequired);
    feeInput.disabled = !isPaymentRequired;

    if (!isPaymentRequired) {
      feeInput.value = "0";
    }
  };

  paymentInput.addEventListener("change", syncFeeField);
  syncFeeField();
}

function toggleEditPanel(card, panel, submissionId) {
  const isOpen = state.editingSubmissionId === submissionId;

  elements.queueList.querySelectorAll(".queue-edit-panel").forEach((entry) => {
    entry.classList.add("hidden");
  });
  state.editingSubmissionId = null;

  if (isOpen) {
    return;
  }

  panel.classList.remove("hidden");
  state.editingSubmissionId = submissionId;
  card.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

async function saveSubmissionEdits(record, form, saveButton) {
  if (!supabaseClient || !state.user) {
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";
  hideStatus();

  const payload = buildSubmissionUpdatePayload(new FormData(form));
  const { error } = await supabaseClient
    .from(SUPABASE_TABLES.submissions)
    .update(payload)
    .eq("id", record.id);

  if (error) {
    showStatus("Could not save edits. Check moderator update permissions on toilet_submissions.", true);
    saveButton.disabled = false;
    saveButton.textContent = "Save changes";
    return;
  }

  const isApproved = (record.status || "").toLowerCase() === "approved";

  if (isApproved) {
    try {
      await syncApprovedListingToToilet(record.id, payload);
    } catch (syncError) {
      showStatus(syncError.message, true);
      saveButton.disabled = false;
      saveButton.textContent = "Save changes";
      return;
    }
  }

  state.editingSubmissionId = null;
  showStatus(
    isApproved ? "Submission and public listing updated." : "Submission updated.",
    false,
    true
  );
  await loadQueue();
}

async function syncApprovedListingToToilet(submissionId, listingPayload) {
  // Always fetch the submission so we can (a) ensure the public row exists and
  // (b) link legacy rows by setting submission_id when it is missing.
  const { data: submission, error: fetchError } = await supabaseClient
    .from(SUPABASE_TABLES.submissions)
    .select("id, name, location_text, latitude, longitude")
    .eq("id", submissionId)
    .single();

  if (fetchError || !submission) {
    throw new Error("Submission saved, but the public listing could not be synced (submission details missing).");
  }

  const toiletPayload = {
    name: submission.name,
    location_text: submission.location_text,
    latitude: submission.latitude,
    longitude: submission.longitude,
    has_bidet: listingPayload.has_bidet,
    has_tissue: listingPayload.has_tissue,
    cleanliness: listingPayload.cleanliness,
    pressure_level: listingPayload.pressure_level,
    payment_required: listingPayload.payment_required,
    fee: listingPayload.fee,
    notes: listingPayload.notes,
    submission_id: submissionId,
    // Keep legacy column populated for backward compatibility / debugging.
    source_submission_id: String(submissionId)
  };

  // 1) Update by submission_id (normal path)
  const attempt = await supabaseClient
    .from(SUPABASE_TABLES.toilets)
    .update(toiletPayload)
    .eq("submission_id", submissionId)
    .select("id");

  if (attempt.error) {
    throw new Error(
      `Submission saved, but the public listing could not be synced. Check moderator update permissions on toilets. (${attempt.error.message})`
    );
  }

  if (attempt.data?.length) {
    return;
  }

  // 1b) Update by legacy source_submission_id (covers rows linked via text column only)
  const legacySourceAttempt = await supabaseClient
    .from(SUPABASE_TABLES.toilets)
    .update(toiletPayload)
    .eq("source_submission_id", String(submissionId))
    .select("id");

  if (legacySourceAttempt.error) {
    throw new Error(
      `Submission saved, but the public listing could not be synced. Check moderator update permissions on toilets. (${legacySourceAttempt.error.message})`
    );
  }

  if (legacySourceAttempt.data?.length) {
    return;
  }

  // 2) Link legacy public rows that were created without submission_id
  const legacyLink = await supabaseClient
    .from(SUPABASE_TABLES.toilets)
    .update(toiletPayload)
    .is("submission_id", null)
    .eq("name", submission.name)
    .eq("location_text", submission.location_text)
    .eq("latitude", submission.latitude)
    .eq("longitude", submission.longitude)
    .select("id");

  if (legacyLink.error) {
    throw new Error(
      `Submission saved, but the public listing could not be synced. Check moderator update permissions on toilets. (${legacyLink.error.message})`
    );
  }

  if (legacyLink.data?.length) {
    return;
  }

  // 3) Insert a new public row if none exists yet (re-approving after reject, etc.)
  const created = await supabaseClient
    .from(SUPABASE_TABLES.toilets)
    .insert(toiletPayload)
    .select("id");

  if (created.error) {
    throw new Error(
      `Submission saved, but the public listing could not be created. Check moderator insert permissions on toilets. (${created.error.message})`
    );
  }
}

function buildSubmissionUpdatePayload(formData) {
  const hasBidet = formData.get("hasBidet") === "true";
  const paymentRequired = formData.get("paymentRequired") === "true";

  return {
    has_bidet: hasBidet,
    has_tissue: formData.get("hasTissue") === "true",
    cleanliness: clampCleanliness(Number(formData.get("cleanliness"))),
    pressure_level: hasBidet ? clampPressure(Number(formData.get("pressureLevel"))) : null,
    payment_required: paymentRequired,
    fee: paymentRequired ? Math.max(0, Number(formData.get("fee")) || 0) : 0,
    notes: String(formData.get("notes") || "").trim() || "No notes provided."
  };
}

function clampPressure(value) {
  if (!Number.isFinite(value)) {
    return 3;
  }

  return Math.min(5, Math.max(1, Math.round(value)));
}

function clampCleanliness(value) {
  if (!Number.isFinite(value)) {
    return 3;
  }

  return Math.min(5, Math.max(1, Math.round(value)));
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

  if (status === "rejected") {
    try {
      await removeListingForSubmission(submissionId);
    } catch (removeError) {
      showStatus(`Submission rejected, but removing the public listing failed: ${removeError.message}`, true);
      approveButton.disabled = false;
      rejectButton.disabled = false;
      return;
    }
  }

  if (status === "approved") {
    const { data: submission, error: fetchError } = await supabaseClient
      .from(SUPABASE_TABLES.submissions)
      .select("has_bidet, has_tissue, cleanliness, pressure_level, payment_required, fee, notes")
      .eq("id", submissionId)
      .single();

    if (!fetchError && submission) {
      try {
        await syncApprovedListingToToilet(submissionId, buildListingPayloadFromRecord(submission));
      } catch (syncError) {
        showStatus(`Submission approved, but public listing sync failed: ${syncError.message}`, true);
        approveButton.disabled = false;
        rejectButton.disabled = false;
        return;
      }
    }
  }

  showStatus(`Submission marked as ${status}.`, false, true);
  await loadQueue();
}

async function removeListingForSubmission(submissionId) {
  // Public listings live in `toilets` and are linked by `submission_id`.
  // Rejecting a submission should remove its previously approved listing (if one exists).
  const attempt = await supabaseClient
    .from(SUPABASE_TABLES.toilets)
    .delete()
    .eq("submission_id", submissionId)
    .select("id");

  if (attempt.error) {
    throw new Error(`Check moderator delete permissions on toilets. (${attempt.error.message})`);
  }

  if (attempt.data?.length) {
    return;
  }

  // Legacy public rows may be missing submission_id; delete by exact coordinates + text.
  const { data: submission, error: fetchError } = await supabaseClient
    .from(SUPABASE_TABLES.submissions)
    .select("name, location_text, latitude, longitude")
    .eq("id", submissionId)
    .single();

  if (fetchError || !submission) {
    return;
  }

  const legacyDelete = await supabaseClient
    .from(SUPABASE_TABLES.toilets)
    .delete()
    .is("submission_id", null)
    .eq("name", submission.name)
    .eq("location_text", submission.location_text)
    .eq("latitude", submission.latitude)
    .eq("longitude", submission.longitude)
    .select("id");

  if (legacyDelete.error) {
    throw new Error(`Check moderator delete permissions on toilets. (${legacyDelete.error.message})`);
  }
}

function buildListingPayloadFromRecord(record) {
  const hasBidet = Boolean(record.has_bidet);
  const paymentRequired = Boolean(record.payment_required);

  return {
    has_bidet: hasBidet,
    has_tissue: Boolean(record.has_tissue),
    cleanliness: clampCleanliness(Number(record.cleanliness)),
    pressure_level: hasBidet ? clampPressure(Number(record.pressure_level)) : null,
    payment_required: paymentRequired,
    fee: paymentRequired ? Math.max(0, Number(record.fee) || 0) : 0,
    notes: String(record.notes || "").trim() || "No notes provided."
  };
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
