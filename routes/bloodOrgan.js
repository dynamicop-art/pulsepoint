const express = require("express");
const router = express.Router();
const { hospitals, requisitions } = require("../data/db");

// GET /api/blood-matrix
router.get("/blood-matrix", (req, res) => {
  const totalStock = { "O-": 0, "O+": 0, "A+": 0, "B+": 0, "AB+": 0 };
  
  const facilities = hospitals.slice(0, 100).map(h => {
    Object.keys(totalStock).forEach(type => {
      totalStock[type] += (h.bloodStock && h.bloodStock[type]) || 0;
    });
    return {
      hospitalId: h.id,
      hospitalName: h.name,
      phone: h.phone,
      bloodStock: h.bloodStock
    };
  });

  res.json({ success: true, totalStock, facilities });
});

// GET /api/organs
router.get("/organs", (req, res) => {
  const organRegistry = [];
  hospitals.forEach(h => {
    (h.organs || []).forEach(o => {
      organRegistry.push({
        ...o,
        hospitalId: h.id,
        hospitalName: h.name,
        emergencyPhone: h.phone
      });
    });
  });
  res.json({ success: true, count: organRegistry.length, data: organRegistry.slice(0, 100) });
});

// POST /api/requisitions (Urgent Blood/Organ Requisition)
router.post("/requisitions", (req, res) => {
  const { patientName, item, units, receivingHospital, contactPhone } = req.body;
  
  if (!patientName || !item || !receivingHospital || !contactPhone) {
    return res.status(400).json({ success: false, message: "Missing required parameters" });
  }

  const newRequisition = {
    id: "req_" + Date.now(),
    patientName,
    item,
    units: parseInt(units || 1, 10),
    receivingHospital,
    contactPhone,
    status: "DISPATCH_BROADCASTED",
    createdAt: new Date().toISOString()
  };

  requisitions.unshift(newRequisition);
  res.status(201).json({ success: true, message: "Requisition broadcasted", data: newRequisition });
});

module.exports = router;