const express = require("express");
const router = express.Router();
const { hospitals } = require("../data/db");

// GET /api/doctors
// Supports filtering by category/specialty: ?spec=Cardiology&limit=50
router.get("/", (req, res) => {
  const { spec, limit = 100 } = req.query;
  const doctors = [];

  hospitals.forEach(h => {
    (h.doctors || []).forEach(d => {
      doctors.push({
        ...d,
        hospitalId: h.id,
        hospitalName: h.name,
        hospitalPhone: h.phone,
        location: h.address
      });
    });
  });

  let filtered = doctors;
  if (spec && spec !== "all") {
    filtered = doctors.filter(d => 
      (d.spec && d.spec.toLowerCase().includes(spec.toLowerCase())) ||
      (d.category && d.category.toLowerCase().includes(spec.toLowerCase()))
    );
  }

  const sliced = filtered.slice(0, parseInt(limit, 10));

  res.json({
    success: true,
    total: filtered.length,
    count: sliced.length,
    data: sliced
  });
});

module.exports = router;