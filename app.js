const STORAGE_KEY = "sitcheck-demo-listings";

const defaultListings = [
  {
    name: "Central Mall 2F Restroom",
    location: "Makati, near the food court",
    hasBidet: true,
    cleanliness: 4,
    paymentRequired: true,
    fee: 10,
    notes: "Well-maintained and usually stocked, but the queue gets longer after lunch."
  },
  {
    name: "Ayala Triangle Park Comfort Room",
    location: "Legazpi Village park entrance",
    hasBidet: false,
    cleanliness: 3,
    paymentRequired: false,
    fee: 0,
    notes: "Free access and easy to find, though supplies can run low during busy hours."
  },
  {
    name: "North Station Concourse Restroom",
    location: "Transit level beside ticketing",
    hasBidet: true,
    cleanliness: 5,
    paymentRequired: false,
    fee: 0,
    notes: "Clean, accessible, and reliable for commuters needing a quick stop."
  },
  {
    name: "Weekend Market Washroom",
    location: "Open-air market rear side",
    hasBidet: false,
    cleanliness: 2,
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
  cardGrid: document.querySelector("#card-grid"),
  form: document.querySelector("#listing-form"),
  resetButton: document.querySelector("#reset-demo"),
  cardTemplate: document.querySelector("#toilet-card-template")
};

bindEvents();
render();

function bindEvents() {
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

    const newListing = {
      name: formData.get("name").toString().trim(),
      location: formData.get("location").toString().trim(),
      hasBidet: formData.get("hasBidet") === "true",
      cleanliness: Number(formData.get("cleanliness")),
      paymentRequired: formData.get("paymentRequired") === "true",
      fee: Number(formData.get("fee")) || 0,
      notes: formData.get("notes").toString().trim() || "No additional notes yet."
    };

    state.listings = [newListing, ...state.listings];
    persistListings();
    elements.form.reset();
    render();
  });

  elements.resetButton.addEventListener("click", () => {
    state.listings = [...defaultListings];
    persistListings();
    render();
  });
}

function render() {
  const visibleListings = getFilteredListings();
  renderStats();
  renderCards(visibleListings);
  renderSummary(visibleListings);
}

function renderStats() {
  elements.totalCount.textContent = state.listings.length;
  elements.bidetCount.textContent = state.listings.filter((listing) => listing.hasBidet).length;
  elements.freeCount.textContent = state.listings.filter((listing) => !listing.paymentRequired).length;
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

function loadListings() {
  const storedValue = window.localStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return [...defaultListings];
  }

  try {
    const parsed = JSON.parse(storedValue);
    return Array.isArray(parsed) && parsed.length ? parsed : [...defaultListings];
  } catch {
    return [...defaultListings];
  }
}

function persistListings() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.listings));
}
