// ==========================================
// 🏥 PulsePoint Live Frontend Logic (fixed)
// ==========================================

const API_BASE_URL = "https://pulsepoint-api-x7fp.onrender.com";

// গ্লোবাল ভ্যারিয়েবল যাতে সার্চ করার সময় বারবার API কল না করতে হয়
let allHospitals = [];

// --- হাসপাতালের ডেটা দুই রকম ব্যাকএন্ড থেকে আসতে পারে (Mongo বনাম লোকাল JSON) ---
// এই ফাংশন দুই ফরম্যাটকেই একই কমন শেপে নরমালাইজ করে, যাতে ব্যাকএন্ড যেটাই থাকুক UI ভাঙবে না।
function normalizeHospital(h) {
  const bloodStock = h.bloodStock || null; // { 'O+': 18, ... }
  const bloodAvailable = Array.isArray(h.bloodAvailable) ? h.bloodAvailable : null; // ['A+','O+']
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

// ১. ব্যাকএন্ড থেকে ডেটা ফেচ করা
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
    defaultHospitalsCache = allHospitals; // সার্চ বক্স খালি করলে এই তালিকায় ফিরে যাবে

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

// ২. Facility কার্ডগুলো রেন্ডার করা
function renderFacilityCards(hospitals, container) {
  if (!container) return;
  container.innerHTML = "";

  if (!hospitals || hospitals.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:24px; color:#64748b; background:#f8fafc; border-radius:12px;">
        🔍 No matching hospitals or facilities found.
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

// ৪. সার্চ এবং ফিল্টার সিস্টেম
// আগে এটা শুধু প্রথমে লোড হওয়া কয়েকটা হাসপাতালের মধ্যেই খুঁজত, তাই
// "howrah" এর মতো নতুন জায়গা লিখলে কিছু পাওয়া যেত না। এখন সার্চ বক্সে
// কিছু টাইপ করলে সেটা সরাসরি ব্যাকএন্ডে পাঠানো হয়, ব্যাকএন্ড সেই জায়গার
// আশেপাশের real হাসপাতাল OpenStreetMap থেকে খুঁজে Mongo-তে সেভ করে
// ফেরত দেয় — ফলে ভারতের যেকোনো জায়গা সার্চ করা যায়।
let defaultHospitalsCache = [];   // প্রথমবার লোড হওয়া তালিকা (সার্চ খালি করলে এটায় ফিরে যাবে)
let searchDebounceTimer = null;

async function searchHospitalsOnServer(query) {
  const detailsContainer = document.getElementById("hospitalsGrid");
  if (detailsContainer) {
    detailsContainer.innerHTML = `
      <div style="text-align:center; padding:24px; font-weight:600; color:#0284c7; background:#f0f9ff; border-radius:12px; border:1px solid #bae6fd;">
        🔎 Searching hospitals near "${query}" across India…
      </div>
    `;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/hospitals?search=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const raw = result.data || [];
    allHospitals = raw.map(normalizeHospital);
    applyLocalFilter();
  } catch (error) {
    console.error("Search fetch error:", error);
    if (detailsContainer) {
      detailsContainer.innerHTML = `
        <div style="text-align:center; padding:20px; color:#dc2626; background:#fef2f2; border-radius:12px;">
          ❌ Could not search right now. Please try again in a few seconds.
        </div>
      `;
    }
  }
}

function applyLocalFilter() {
  const filterSelect = document.getElementById("filterType") || document.querySelector("select");
  const filterVal = filterSelect ? filterSelect.value : "all";

  const filtered = allHospitals.filter(h => {
    const category = (h.category || "").toLowerCase();
    const address = (h.address || "").toLowerCase();
    let matchesCare = true;
    if (filterVal === "icu") matchesCare = (h.icuBeds || 0) > 0;
    else if (filterVal === "vent") matchesCare = (h.ventilators || 0) > 0;
    else if (filterVal === "govt") matchesCare = category.includes("government") || address.includes("government");
    return matchesCare;
  });

  renderFacilityCards(filtered, document.getElementById("hospitalsGrid"));
}

function setupSearchAndFilters() {
  const searchInput = document.getElementById("hospitalSearch") || document.querySelector("input[type='text']");
  const filterSelect = document.getElementById("filterType") || document.querySelector("select");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim();
      clearTimeout(searchDebounceTimer);

      searchDebounceTimer = setTimeout(() => {
        if (query.length === 0) {
          allHospitals = defaultHospitalsCache;
          applyLocalFilter();
        } else if (query.length >= 2) {
          searchHospitalsOnServer(query);
        }
      }, 500); // ইউজার টাইপ করা থামলে তবেই সার্চ হবে, প্রতি key press এ না
    });
  }

  if (filterSelect) filterSelect.addEventListener("change", applyLocalFilter);
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

// ৬. "Use my location" — বাস্তব জিওলোকেশন দিয়ে সবচেয়ে কাছের হাসপাতাল খুঁজে বের করা
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
      (pos) => {
        const { latitude, longitude } = pos.coords;

        allHospitals.forEach(h => {
          if (h.lat != null && h.lng != null) {
            h.distanceKm = haversineKm(latitude, longitude, h.lat, h.lng);
          }
        });

        allHospitals.sort((a, b) => {
          const da = a.distanceKm ?? Infinity;
          const db = b.distanceKm ?? Infinity;
          return da - db;
        });

        renderFacilityCards(allHospitals, document.getElementById("hospitalsGrid"));

        btn.disabled = false;
        btn.innerHTML = originalLabel;
        document.getElementById("section-hospitals")?.scrollIntoView({ behavior: "smooth" });
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
