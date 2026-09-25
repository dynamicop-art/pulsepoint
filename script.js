// Render Backend Live Base URL
const API_BASE_URL = "https://pulsepoint-api-x7fp.onrender.com";

// ১. ডেটাবেস থেকে হাসপাতালের তথ্য এনে UI-তে দেখানো
async function loadHospitals(searchTerm = "") {
  const container = document.getElementById("hospital-grid") || document.getElementById("hospitals-container") || document.querySelector(".hospital-cards");
  
  if (!container) return;
  container.innerHTML = `<div style="text-align:center; padding:20px; color:#555;">Loading live data from MongoDB Atlas...</div>`;

  try {
    const url = searchTerm 
      ? `${API_BASE_URL}/api/hospitals?search=${encodeURIComponent(searchTerm)}`
      : `${API_BASE_URL}/api/hospitals`;

    const res = await fetch(url);
    const result = await res.json();
    const hospitals = result.data || [];

    container.innerHTML = "";

    if (hospitals.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:20px;">No hospitals found matching your criteria.</div>`;
      return;
    }

    hospitals.forEach(h => {
      const card = document.createElement("div");
      card.className = "hospital-card";
      card.style = "border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.05);";
      
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; color:#1e293b; font-size:1.25rem;">${h.name}</h3>
          <span style="background:#e0f2fe; color:#0369a1; padding:4px 8px; border-radius:6px; font-size:0.85rem; font-weight:600;">Live</span>
        </div>
        <p style="color:#64748b; margin:8px 0;">📍 <strong>Location:</strong> ${h.location}</p>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin: 12px 0;">
          <div style="background:#f0fdf4; padding:10px; border-radius:8px;">
            <span style="color:#15803d; font-size:0.85rem;">Available Beds</span>
            <div style="font-size:1.4rem; font-weight:700; color:#166534;">${h.availableBeds} <small style="font-size:0.85rem; font-weight:400; color:#64748b;">/ ${h.totalBeds}</small></div>
          </div>
          <div style="background:#fef2f2; padding:10px; border-radius:8px;">
            <span style="color:#b91c1c; font-size:0.85rem;">ICU Beds</span>
            <div style="font-size:1.4rem; font-weight:700; color:#991b1b;">${h.icuBeds}</div>
          </div>
        </div>

        <p style="margin:8px 0; font-size:0.9rem;">🩸 <strong>Blood Stock:</strong> ${h.bloodAvailable ? h.bloodAvailable.join(", ") : "Available on Request"}</p>
        
        <div style="margin-top:14px; display:flex; gap:10px;">
          <a href="tel:${h.contact}" style="flex:1; text-align:center; background:#ef4444; color:#fff; text-decoration:none; padding:10px; border-radius:8px; font-weight:600;">📞 Call Emergency</a>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Fetch Error:", err);
    container.innerHTML = `<div style="color:red; text-align:center; padding:20px;">Failed to connect to backend server. Make sure Render service is awake.</div>`;
  }
}

// পেজ লোড হলে কল হবে
document.addEventListener("DOMContentLoaded", () => {
  loadHospitals();

  // লাইভ সার্চ ফিল্টারিং
  const searchInput = document.getElementById("search-input") || document.querySelector("input[type='search']");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      loadHospitals(e.target.value.trim());
    });
  }
});
