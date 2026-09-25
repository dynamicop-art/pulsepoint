// ==========================================
// 🏥 PulsePoint Live Frontend Logic (fixed)
// ==========================================

const API_BASE_URL = "https://pulsepoint-api-x7fp.onrender.com";

// গ্লোবাল ভ্যারিয়েবল যাতে সার্চ করার সময় বারবার API কল না করতে হয়
let allHospitals = [];

// ০. ব্যাকএন্ড স্ট্যাটাস ব্যাজ + রিফ্রেশ বাটন — আগে কোথাও ওয়্যার করা ছিল না
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

    // API থেকে অ্যারে নেওয়া
    allHospitals = result.data || result || [];

    // পেজে হাসপাতাল ও ব্লাড ম্যাট্রিক্স রেন্ডার করা
    renderFacilityCards(allHospitals, detailsContainer);
    renderBloodMatrix(allHospitals);

  } catch (error) {
    console.error("Fetch Error:", error);
    if (detailsContainer) {
      detailsContainer.innerHTML = `
        <div style="text-align:center; padding:20px; color:#dc2626; background:#fef2f2; border-radius:12px;">
          ❌ Could not load live hospital data. Render service may be waking up, please refresh in 30 seconds.
        </div>
      `;
    }
  }
}

// ২. Facility কার্ডগুলো রেন্ডার করা — লাইভ ব্যাকএন্ডের আসল ফিল্ড নাম অনুযায়ী
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
    const stock = h.bloodStock || {};
    const availableTypes = Object.keys(stock).filter(k => stock[k] > 0);

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

    card.innerHTML = `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
          <h3 style="margin:0; font-size:1.2rem; color:#0f172a; font-weight:700;">${h.name}</h3>
          <span style="background:#dcfce7; color:#166534; font-size:0.75rem; font-weight:700; padding:4px 8px; border-radius:999px;">LIVE</span>
        </div>
        <p style="color:#64748b; margin:6px 0 14px 0; font-size:0.9rem;">📍 <strong>Location:</strong> ${h.address || "N/A"}</p>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:14px;">
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:10px; border-radius:8px;">
            <div style="font-size:0.8rem; color:#166534; font-weight:600;">General Beds</div>
            <div style="font-size:1.3rem; font-weight:800; color:#15803d;">${h.generalBeds ?? "N/A"}</div>
          </div>
          <div style="background:#fef2f2; border:1px solid #fecaca; padding:10px; border-radius:8px;">
            <div style="font-size:0.8rem; color:#991b1b; font-weight:600;">ICU Beds / Vent</div>
            <div style="font-size:1.3rem; font-weight:800; color:#dc2626;">${h.icuBeds ?? "N/A"} / ${h.ventilators ?? "N/A"}</div>
          </div>
        </div>

        <div style="font-size:0.85rem; color:#475569; margin-bottom:12px;">
          🩸 <strong>Blood Stock:</strong> ${availableTypes.length ? availableTypes.join(", ") : "Not reported"}
        </div>
      </div>

      <div style="margin-top:10px;">
        <a href="tel:${h.phone || h.emergencyLine || ''}" style="display:block; text-align:center; background:#ef4444; color:#ffffff; font-weight:700; text-decoration:none; padding:10px; border-radius:8px; font-size:0.9rem;">
          📞 Emergency Call (${h.phone || h.emergencyLine || "N/A"})
        </a>
      </div>
    `;
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

// ৩. Regional Blood Stock Matrix টেবিলটি লাইভ ডেটা দিয়ে পূরণ করা
function renderBloodMatrix(hospitals) {
  const tableBody = document.getElementById("bloodTableBody") || document.querySelector("table tbody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  hospitals.forEach(h => {
    const stock = h.bloodStock || {};
    const cell = type => (stock[type] > 0 ? `✅ ${stock[type]}` : "❌ Low");
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight:600;">${h.name}</td>
      <td>${cell("O-")}</td>
      <td>${cell("O+")}</td>
      <td>${cell("A+")}</td>
      <td>${cell("B+")}</td>
      <td>${cell("AB+")}</td>
      <td><a href="tel:${h.phone || ''}" style="color:#ef4444; font-weight:600; text-decoration:none;">${h.phone || "N/A"}</a></td>
    `;
    tableBody.appendChild(row);
  });
}

// ৪. সার্চ এবং ফিল্টার সিস্টেম সক্রিয় করা
function setupSearchAndFilters() {
  const searchInput = document.getElementById("hospitalSearch") || document.querySelector("input[type='text']");
  const filterSelect = document.getElementById("filterType") || document.querySelector("select");

  function applyFilters() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const filterVal = filterSelect ? filterSelect.value : "all";

    const filtered = allHospitals.filter(h => {
      const name = (h.name || "").toLowerCase();
      const address = (h.address || "").toLowerCase();
      const category = (h.category || "").toLowerCase();
      const matchesSearch = !query || name.includes(query) || address.includes(query);

      let matchesCare = true;
      if (filterVal === "icu") matchesCare = (h.icuBeds || 0) > 0;
      else if (filterVal === "vent") matchesCare = (h.ventilators || 0) > 0;
      else if (filterVal === "govt") matchesCare = category.includes("government");

      return matchesSearch && matchesCare;
    });

    const detailsContainer = document.getElementById("hospitalsGrid");
    renderFacilityCards(filtered, detailsContainer);
  }

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (filterSelect) filterSelect.addEventListener("change", applyFilters);
}

// ৫. Refresh বাটন — আগে কোনো লিসেনারই ছিল না
function setupRefreshButton() {
  const btn = document.getElementById("btnRefreshData");
  if (!btn) return;
  btn.addEventListener("click", () => {
    checkBackendHealth();
    fetchAndRenderHospitals();
  });
}

// DOM পেজ পুরোপুরি লোড হলে চলবে
document.addEventListener("DOMContentLoaded", () => {
  checkBackendHealth();
  fetchAndRenderHospitals();
  setupSearchAndFilters();
  setupRefreshButton();
});
