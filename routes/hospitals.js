const express = require("express");
const router = express.Router();
const { hospitals } = require("../data/db");
const { verifyStaff } = require("../middleware/auth");

// Calculate real geodesic distance (km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

// GET /api/hospitals?lat=...&lng=...&search=...&filter=...
router.get("/", (req, res) => {
  const { lat, lng, search, filter, limit = 50 } = req.query;

  let results = hospitals.map(h => {
    let distanceKm = 0;
    if (lat && lng) {
      distanceKm = calculateDistance(parseFloat(lat), parseFloat(lng), h.lat, h.lng);
    }
    return { ...h, distanceKm };
  });

  if (lat && lng) {
    results.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  if (search) {
    const q = search.toLowerCase();
    results = results.filter(h => 
      h.name.toLowerCase().includes(q) || 
      (h.address && h.address.toLowerCase().includes(q))
    );
  }

  if (filter === "icu") results = results.filter(h => h.icuBeds > 0);
  else if (filter === "vent") results = results.filter(h => h.ventilators > 0);
  else if (filter === "govt") results = results.filter(h => 
    h.category && (
      h.category.toLowerCase().includes("govt") || 
      h.category.toLowerCase().includes("rural") || 
      h.category.toLowerCase().includes("district")
    )
  );

  const sliced = results.slice(0, parseInt(limit, 10));
  res.json({ success: true, total: results.length, count: sliced.length, data: sliced });
});

// GET /api/hospitals/:id
router.get("/:id", (req, res) => {
  const hospital = hospitals.find(h => h.id === req.params.id);
  if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });
  res.json({ success: true, data: hospital });
});

// PUT /api/hospitals/:id/telemetry (Requires Staff JWT)
router.put("/:id/telemetry", verifyStaff, (req, res) => {
  const hospital = hospitals.find(h => h.id === req.params.id);
  if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

  const { icuBeds, ventilators, generalBeds, bloodStock } = req.body;
  if (icuBeds !== undefined) hospital.icuBeds = parseInt(icuBeds, 10);
  if (ventilators !== undefined) hospital.ventilators = parseInt(ventilators, 10);
  if (generalBeds !== undefined) hospital.generalBeds = parseInt(generalBeds, 10);
  if (bloodStock) hospital.bloodStock = { ...hospital.bloodStock, ...bloodStock };

  res.json({ success: true, message: `Telemetry updated for ${hospital.name}`, data: hospital });
});

module.exports = router;