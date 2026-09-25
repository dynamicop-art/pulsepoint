// ==========================================
// 🏥 PulsePoint Live Frontend Logic (fixed)
// ==========================================

const API_BASE_URL = "https://pulsepoint-api-x7fp.onrender.com";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// গ্লোবাল ভ্যারিয়েবল যাতে সার্চ করার সময় বারবার API কল না করতে হয়
let allHospitals = [];
let indiaSearchDebounceTimer = null;
let indiaSearchToken = 0; // race-condition guard for overlapping async searches

// --- হাসপাতালের ডেটা দুই রকম ব্যাকএন্ড থেকে আসতে পারে (Mongo বনাম লোকাল JSON) ---
function normalizeHospital(h) {
  const bloodStock = h.bloodStock || null;
  const bloodAvailable = Array.isArray(h.bloodAvailable) ? h.bloodAvailable : null;
  const bloodTypes = bloodStock
    ? Object.keys(bloodStock).filter(k => bloodStock[k] > 0)
    : (bloodAvailable || []);

  return {
    id: h.id || h._id || h.name,
    name: h.name || "Unnamed facility",
    address: h.address || h.location || "",
    category: h.category || "",
    generalBeds: h.generalBeds ?? h.availableBeds ?? null,
    totalBeds: h.totalBeds ?? null,
    icuBeds: h.icuBeds ?? 0,
    ventilators: h.ventilators ?? null,
    phone: h.phone || h.contact || h.emergencyLine || "",
    lat: typeof h.lat === "number" ? h.lat : (typeof h.latitude === "number" ? h.latitude : null),
    lng: typeof h.lng === "number" ? h.lng : (typeof h.longitude === "number" ? h.longitude : null),
    distanceKm: typeof h.distanceKm === "number" ? h.distanceKm : null,
    bloodStock,
    bloodTypes
  };
}

// ০. ব্যাকএন্ড স্ট্যাটাস ব্যাজ + রিফ্রেশ বাটন
async function checkBackendHealth() {
  const statusEl = document.getElementById("backendStatus");
  if (!statusEl) return;
  statusEl.textContent = "Connecting to backend…";
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    if (!res.ok) throw new Error("bad status");
    await res.json();
    statusEl.textContent = "✅ Backend connected";
  } catch (err) {
    console.error("Health check failed:", err);
    statusEl.textContent = "⚠️ Backend unreachable — click Refresh data";
  }
}

// ১. ব্যাকএন্ড থেকে স্যাম্পল ডেটা ফেচ করা (আপনার ৫টি ডেমো হাসপাতাল)
async function fetchAndRenderHospitals() {
  const detailsContainer = document.getElementById("hospitalsGrid");

  if (detailsContainer) {
    detailsContainer.innerHTML = `
      <div style="text-align:center; padding:30px; font-weight:600; color:#0284c7; background:#f0f9ff; border-radius:12px; border:1px solid #bae6fd;">
        ⏳ Loading live facility data... (Please wait a few seconds — free Render instances can take ~30-50s to wake up)
      </div>
    `;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/hospitals`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    const raw = result.data || result || [];
    allHospitals = raw.map(normalizeHospital);

    renderFacilityCards(allHospitals, detailsContainer);
    renderBloodMatrix(allHospitals);

  } catch (error) {
    console.error("Fetch Error:", error);
    allHospitals = [];
    if (detailsContainer) {
      detailsContainer.innerHTML = `
        <div style="text-align:center; padding:20px; color:#dc2626; background:#fef2f2; border-radius:12px;">
          ❌ Could not load live hospital data. Render service may be waking up, please refresh in 30 seconds.
        </div>
      `;
    }
  }
}

// ২. Facility কার্ডগুলো রেন্ডার করা (ডেমো ডেটাবেস)
function renderFacilityCards(hospitals, container) {
  if (!container) return;
  container.innerHTML = "";

  if (!hospitals || hospitals.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:24px; color:#64748b; background:#f8fafc; border-radius:12px;">
        🔍 No matching hospitals in the sample database. Try the "Hospitals across India" results below.
      </div>
    `;
    return;
  }

  const grid = document.createElement("div");
  grid.style = "display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px; width:100%;";

  hospitals.forEach(h => {
    const card = document.createElement("div");
    card.style = `
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    `;

    const bedsLine = h.totalBeds != null
      ? `${h.generalBeds ?? "N/A"} <span style="font-size:0.8rem; color:#64748b; font-weight:400;">/ ${h.totalBeds}</span>`
      : `${h.generalBeds ?? "N/A"}`;

    const distanceBadge = h.distanceKm != null
      ? `<span style="background:#e0f2fe; color:#0369a1; font-size:0.75rem; font-weight:700; padding:4px 8px; border-radius:999px;">${h.distanceKm.toFixed(1)} km</span>`
      : "";

    card.innerHTML = `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px; gap:8px;">
          <h3 style="margin:0; font-size:1.2rem; color:#0f172a; font-weight:700;">${h.name}</h3>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            ${distanceBadge}
            <span style="background:#dcfce7; color:#166534; font-size:0.75rem; font-weight:700; padding:4px 8px; border-radius:999px;">LIVE</span>
          </div>
        </div>
        <p style="color:#64748b; margin:6px 0 14px 0; font-size:0.9rem;">📍 <strong>Location:</strong> ${h.address || "N/A"}</p>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:14px;">
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:10px; border-radius:8px;">
            <div style="font-size:0.8rem; color:#166534; font-weight:600;">General Beds</div>
            <div style="font-size:1.3rem; font-weight:800; color:#15803d;">${bedsLine}</div>
          </div>
          <div style="background:#fef2f2; border:1px solid #fecaca; padding:10px; border-radius:8px;">
            <div style="font-size:0.8rem; color:#991b1b; font-weight:600;">ICU Beds${h.ventilators != null ? " / Vent" : ""}</div>
            <div style="font-size:1.3rem; font-weight:800; color:#dc2626;">${h.icuBeds ?? "N/A"}${h.ventilators != null ? ` / ${h.ventilators}` : ""}</div>
          </div>
        </div>

        <div style="font-size:0.85rem; color:#475569; margin-bottom:12px;">
          🩸 <strong>Blood Stock:</strong> ${h.bloodTypes.length ? h.bloodTypes.join(", ") : "Not reported"}
        </div>
      </div>

      <div style="margin-top:10px;">
        <a href="tel:${h.phone}" style="display:block; text-align:center; background:#ef4444; color:#ffffff; font-weight:700; text-decoration:none; padding:10px; border-radius:8px; font-size:0.9rem;">
          📞 Emergency Call ${h.phone ? `(${h.phone})` : ""}
        </a>
      </div>
    `;
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

// ৩. Regional Blood Stock Matrix
function renderBloodMatrix(hospitals) {
  const tableBody = document.getElementById("bloodTableBody") || document.querySelector("table tbody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  hospitals.forEach(h => {
    const stock = h.bloodStock;
    const cell = type => {
      if (stock) return stock[type] > 0 ? `✅ ${stock[type]}` : "❌ Low";
      return h.bloodTypes.includes(type) ? "✅ Available" : "❌ Low";
    };
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight:600;">${h.name}</td>
      <td>${cell("O-")}</td>
      <td>${cell("O+")}</td>
      <td>${cell("A+")}</td>
      <td>${cell("B+")}</td>
      <td>${cell("AB+")}</td>
      <td><a href="tel:${h.phone}" style="color:#ef4444; font-weight:600; text-decoration:none;">${h.phone || "N/A"}</a></td>
    `;
    tableBody.appendChild(row);
  });
}

// ৪. সার্চ এবং ফিল্টার — লোকাল ডেমো ডেটাবেস + ভারতজুড়ে OpenStreetMap সার্চ ট্রিগার করে
function setupSearchAndFilters() {
  const searchInput = document.getElementById("hospitalSearch") || document.querySelector("input[type='text']");
  const filterSelect = document.getElementById("filterType") || document.querySelector("select");

  function applyLocalFilters() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const filterVal = filterSelect ? filterSelect.value : "all";

    const filtered = allHospitals.filter(h => {
      const name = h.name.toLowerCase();
      const address = h.address.toLowerCase();
      const category = h.category.toLowerCase();
      const matchesSearch = !query || name.includes(query) || address.includes(query);

      let matchesCare = true;
      if (filterVal === "icu") matchesCare = (h.icuBeds || 0) > 0;
      else if (filterVal === "vent") matchesCare = (h.ventilators || 0) > 0;
      else if (filterVal === "govt") matchesCare = category.includes("government") || address.includes("government");

      return matchesSearch && matchesCare;
    });

    renderFacilityCards(filtered, document.getElementById("hospitalsGrid"));
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      applyLocalFilters();

      const q = searchInput.value.trim();
      clearTimeout(indiaSearchDebounceTimer);
      if (q.length < 3) {
        const el = document.getElementById("indiaWideResults");
        if (el) el.innerHTML = "";
        return;
      }
      // ৩ অক্ষরের বেশি টাইপ করলে, ৭০০ms পরে সারা ভারতে সার্চ চালানো হয় (rate-limit বাঁচাতে debounce)
      indiaSearchDebounceTimer = setTimeout(() => searchAcrossIndia(q), 700);
    });
  }
  if (filterSelect) filterSelect.addEventListener("change", applyLocalFilters);
}

// ৫. Refresh বাটন
function setupRefreshButton() {
  const btn = document.getElementById("btnRefreshData");
  if (!btn) return;
  btn.addEventListener("click", () => {
    checkBackendHealth();
    fetchAndRenderHospitals();
  });
}

// ৬. দূরত্ব হিসাব (haversine)
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ৭. সারা ভারতে হাসপাতাল খোঁজা — OpenStreetMap (Nominatim + Overpass), কোনো API key লাগে না
function ensureIndiaResultsContainer() {
  let el = document.getElementById("indiaWideResults");
  if (!el) {
    el = document.createElement("div");
    el.id = "indiaWideResults";
    el.style = "margin-top:28px;";
    const grid = document.getElementById("hospitalsGrid");
    (grid?.parentElement || document.getElementById("section-hospitals"))?.appendChild(el);
  }
  return el;
}

function osmHospitalCardHtml(h) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`;
  return `
    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.06);">
      <div style="display:flex; justify-content:space-between; gap:8px; align-items:start;">
        <h4 style="margin:0; font-size:1.05rem; color:#0f172a;">${h.name}</h4>
        ${h.distanceKm != null ? `<span style="background:#e0f2fe;color:#0369a1;font-size:0.7rem;font-weight:700;padding:3px 7px;border-radius:999px; white-space:nowrap;">${h.distanceKm.toFixed(1)} km</span>` : ""}
      </div>
      <p style="color:#64748b; font-size:0.85rem; margin:6px 0;">📍 ${h.address || "Address not tagged on OpenStreetMap"}</p>
      <div style="display:flex; gap:8px; margin-top:10px;">
        ${h.phone ? `<a href="tel:${h.phone}" style="flex:1; text-align:center; background:#ef4444; color:#fff; padding:8px; border-radius:8px; text-decoration:none; font-size:0.85rem; font-weight:700;">📞 Call</a>` : ""}
        <a href="${mapsUrl}" target="_blank" rel="noopener" style="flex:1; text-align:center; background:#0284c7; color:#fff; padding:8px; border-radius:8px; text-decoration:none; font-size:0.85rem; font-weight:700;">🧭 Directions</a>
      </div>
    </div>
  `;
}

function renderIndiaResults(hospitals, headingText) {
  const container = ensureIndiaResultsContainer();
  const headingBar = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px; flex-wrap:wrap; gap:6px;">
      <h3 style="font-size:1rem;color:#0f172a;margin:0;">${headingText}</h3>
      <span style="font-size:0.75rem;color:#94a3b8;">Source: OpenStreetMap contributors</span>
    </div>
  `;

  if (!hospitals.length) {
    container.innerHTML = `
      ${headingBar}
      <div style="text-align:center;padding:20px;color:#64748b;background:#f8fafc;border-radius:12px;">
        No hospitals tagged on OpenStreetMap were found for this area.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    ${headingBar}
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px;">
      ${hospitals.map(osmHospitalCardHtml).join("")}
    </div>
  `;
}

async function fetchOverpassHospitals(lat, lon, radiusM = 15000) {
  const query = `[out:json][timeout:25];(node["amenity"="hospital"](around:${radiusM},${lat},${lon});way["amenity"="hospital"](around:${radiusM},${lat},${lon}););out center 40;`;
  const res = await fetch(OVERPASS_URL, { method: "POST", body: query });
  if (!res.ok) throw new Error("Overpass request failed");
  const data = await res.json();

  return (data.elements || [])
    .map(el => {
      const tags = el.tags || {};
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      const addressParts = [
        tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"],
        tags["addr:city"], tags["addr:state"]
      ].filter(Boolean);
      return {
        name: tags.name || "Unnamed hospital",
        address: tags["addr:full"] || addressParts.join(", "),
        phone: tags.phone || tags["contact:phone"] || "",
        lat: elLat,
        lng: elLon,
        distanceKm: (elLat != null && elLon != null) ? haversineKm(lat, lon, elLat, elLon) : null
      };
    })
    .filter(h => h.lat != null && h.lng != null)
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

async function geocodeIndia(query) {
  const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding failed");
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), label: data[0].display_name };
}

async function searchAcrossIndia(query) {
  const myToken = ++indiaSearchToken;
  const container = ensureIndiaResultsContainer();
  container.innerHTML = `<div style="text-align:center;padding:16px;color:#0284c7;">🔎 Searching hospitals across India for "${query}"...</div>`;

  try {
    const place = await geocodeIndia(query);
    if (myToken !== indiaSearchToken) return; // a newer search started meanwhile
    if (!place) {
      container.innerHTML = `<div style="text-align:center;padding:16px;color:#64748b;">No location in India matched "${query}".</div>`;
      return;
    }
    const results = await fetchOverpassHospitals(place.lat, place.lon, 20000);
    if (myToken !== indiaSearchToken) return;
    renderIndiaResults(results, `Hospitals near ${place.label.split(",")[0]}`);
  } catch (err) {
    console.error("India-wide search failed", err);
    if (myToken !== indiaSearchToken) return;
    container.innerHTML = `<div style="text-align:center;padding:16px;color:#dc2626;">Could not search nationwide hospital data right now. Please try again.</div>`;
  }
}

// ৮. "Use my location" — GPS + OpenStreetMap দিয়ে বাস্তব কাছের হাসপাতাল
function setupLocationButton() {
  const btn = document.getElementById("btnGpsCalc");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Your browser does not support location access.");
      return;
    }

    const originalLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Locating…`;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        // ডেমো ডেটাবেসের ৫টি হাসপাতালের দূরত্ব রিক্যালকুলেট করা
        allHospitals.forEach(h => {
          if (h.lat != null && h.lng != null) {
            h.distanceKm = haversineKm(latitude, longitude, h.lat, h.lng);
          }
        });
        allHospitals.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
        renderFacilityCards(allHospitals, document.getElementById("hospitalsGrid"));

        btn.disabled = false;
        btn.innerHTML = originalLabel;
        document.getElementById("section-hospitals")?.scrollIntoView({ behavior: "smooth" });

        // সেই একই GPS পয়েন্ট দিয়ে OpenStreetMap থেকে আসল আশেপাশের হাসপাতাল খোঁজা
        const myToken = ++indiaSearchToken;
        const container = ensureIndiaResultsContainer();
        container.innerHTML = `<div style="text-align:center;padding:16px;color:#0284c7;">🔎 Finding real hospitals near your location...</div>`;
        try {
          const results = await fetchOverpassHospitals(latitude, longitude, 15000);
          if (myToken !== indiaSearchToken) return;
          renderIndiaResults(results, "Hospitals near your current location");
        } catch (err) {
          console.error("Nearby OSM search failed", err);
          if (myToken !== indiaSearchToken) return;
          container.innerHTML = `<div style="text-align:center;padding:16px;color:#dc2626;">Could not fetch nearby hospitals right now. Please try again.</div>`;
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        btn.disabled = false;
        btn.innerHTML = originalLabel;
        alert("Could not get your location. Please allow location access in your browser and try again.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

// DOM পেজ পুরোপুরি লোড হলে চলবে
document.addEventListener("DOMContentLoaded", () => {
  checkBackendHealth();
  fetchAndRenderHospitals();
  setupSearchAndFilters();
  setupRefreshButton();
  setupLocationButton();
});
