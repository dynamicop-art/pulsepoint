// ==========================================
// 🏥 PulsePoint Live Frontend Logic
// ==========================================

const API_BASE_URL = "https://pulsepoint-api-x7fp.onrender.com";

// গ্লোবাল ভ্যারিয়েবল যাতে সার্চ করার সময় বারবার API কল না করতে হয়
let allHospitals = [];

// ১. ব্যাকএন্ড ও MongoDB থেকে ডেটা ফেচ করা
async function fetchAndRenderHospitals() {
  // HTML-এ Facility Details-এর কন্টেইনার খুঁজে বের করা
  let detailsContainer = document.getElementById("facility-details") 
    || document.getElementById("facility-list") 
    || document.querySelector(".facility-details")
    || document.querySelector("#section-hospitals > div:nth-of-type(2)");

  // যদি নির্দিষ্ট কন্টেইনার না পায়, তবে 'Facility details' হেডিংয়ের পরের ডিভটি ধরবে
  if (!detailsContainer) {
    const headings = Array.from(document.querySelectorAll("h2, h3, h4"));
    const facilityHeading = headings.find(h => h.textContent.includes("Facility details"));
    if (facilityHeading && facilityHeading.nextElementSibling) {
      detailsContainer = facilityHeading.nextElementSibling;
    }
  }

  if (detailsContainer) {
    detailsContainer.innerHTML = `
      <div style="text-align:center; padding:30px; font-weight:600; color:#0284c7; background:#f0f9ff; border-radius:12px; border:1px solid #bae6fd;">
        ⏳ Connecting to live MongoDB Atlas Database... (Please wait a few seconds)
      </div>
    `;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/hospitals`);
    const result = await response.json();
    
    // API থেকে অ্যারে নেওয়া
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

// ২. Facility Details কার্ডগুলো রেন্ডার করা
function renderFacilityCards(hospitals, container) {
  if (!container) return;
  container.innerHTML = "";

  if (hospitals.length === 0) {
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

    card.innerHTML = `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;">
          <h3 style="margin:0; font-size:1.2rem; color:#0f172a; font-weight:700;">${h.name}</h3>
          <span style="background:#dcfce7; color:#166534; font-size:0.75rem; font-weight:700; padding:4px 8px; border-radius:999px;">LIVE DB</span>
        </div>
        <p style="color:#64748b; margin:6px 0 14px 0; font-size:0.9rem;">📍 <strong>Location:</strong> ${h.location}</p>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:14px;">
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:10px; border-radius:8px;">
            <div style="font-size:0.8rem; color:#166534; font-weight:600;">Available Beds</div>
            <div style="font-size:1.3rem; font-weight:800; color:#15803d;">${h.availableBeds} <span style="font-size:0.8rem; color:#64748b; font-weight:400;">/ ${h.totalBeds}</span></div>
          </div>
          <div style="background:#fef2f2; border:1px solid #fecaca; padding:10px; border-radius:8px;">
            <div style="font-size:0.8rem; color:#991b1b; font-weight:600;">ICU Beds</div>
            <div style="font-size:1.3rem; font-weight:800; color:#dc2626;">${h.icuBeds}</div>
          </div>
        </div>
        
        <div style="font-size:0.85rem; color:#475569; margin-bottom:12px;">
          🩸 <strong>Blood Stock:</strong> ${Array.isArray(h.bloodAvailable) ? h.bloodAvailable.join(", ") : "A+, B+, O+"}
        </div>
      </div>

      <div style="margin-top:10px;">
        <a href="tel:${h.contact}" style="display:block; text-align:center; background:#ef4444; color:#ffffff; font-weight:700; text-decoration:none; padding:10px; border-radius:8px; font-size:0.9rem;">
          📞 Emergency Call (${h.contact})
        </a>
      </div>
    `;
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

// ৩. Regional Blood Stock Matrix টেবিলটি লাইভ ডেটা দিয়ে পূরণ করা
function renderBloodMatrix(hospitals) {
  const tableBody = document.querySelector("table tbody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  hospitals.forEach(h => {
    const bloods = h.bloodAvailable || ["O+", "A+", "B+"];
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight:600;">${h.name}</td>
      <td>${bloods.includes("O-") ? "✅ Available" : "❌ Low"}</td>
      <td>${bloods.includes("O+") ? "✅ Available" : "❌ Low"}</td>
      <td>${bloods.includes("A+") ? "✅ Available" : "❌ Low"}</td>
      <td>${bloods.includes("B+") ? "✅ Available" : "❌ Low"}</td>
      <td>${bloods.includes("AB+") ? "✅ Available" : "❌ Low"}</td>
      <td><a href="tel:${h.contact}" style="color:#ef4444; font-weight:600; text-decoration:none;">${h.contact}</a></td>
    `;
    tableBody.appendChild(row);
  });
}

// ৪. সার্চ এবং ফিল্টার সিস্টেম সক্রিয় করা
function setupSearchAndFilters() {
  const searchInput = document.querySelector("input[placeholder*='Search hospital']") 
    || document.querySelector("input[type='text']") 
    || document.getElementById("search-input");

  const filterSelect = document.querySelector("select");

  function applyFilters() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const filterVal = filterSelect ? filterSelect.value : "";

    const filtered = allHospitals.filter(h => {
      const matchesSearch = h.name.toLowerCase().includes(query) || h.location.toLowerCase().includes(query);
      let matchesCare = true;

      if (filterSelect && filterVal.includes("ICU")) {
        matchesCare = h.icuBeds > 0;
      }
      return matchesSearch && matchesCare;
    });

    const detailsContainer = document.getElementById("facility-details") 
      || document.querySelector(".facility-details")
      || document.querySelector("#section-hospitals > div:nth-of-type(2)");

    renderFacilityCards(filtered, detailsContainer);
  }

  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }
  if (filterSelect) {
    filterSelect.addEventListener("change", applyFilters);
  }
}

// DOM পেজ পুরোপুরি লোড হলে চলবে
document.addEventListener("DOMContentLoaded", () => {
  fetchAndRenderHospitals();
  setupSearchAndFilters();
});
