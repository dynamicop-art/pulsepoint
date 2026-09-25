const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialty: { type: String, required: true },
  hospital: { type: String, required: true },
  availability: { type: String, default: "Available" },
  contact: { type: String, required: true }
});

const Doctor = mongoose.models.Doctor || mongoose.model("Doctor", doctorSchema);

const defaultDoctors = [
  { name: "Dr. Anirban Mukherjee", specialty: "Cardiologist", hospital: "Apollo Hospital", availability: "Available Now", contact: "+91 98300 11223" },
  { name: "Dr. Sourav Banerjee", specialty: "Neurologist", hospital: "Fortis Hospital", availability: "Available on Call", contact: "+91 98301 44556" },
  { name: "Dr. Ritu Sen", specialty: "Critical Care Specialist", hospital: "Medica Hospital", availability: "Available Now", contact: "+91 98302 77889" }
];

// GET: সব ডাক্তারদের তালিকা
router.get("/", async (req, res) => {
  try {
    let doctors = await Doctor.find();
    if (doctors.length === 0) {
      doctors = await Doctor.insertMany(defaultDoctors);
    }
    res.json({ success: true, count: doctors.length, data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST: নতুন ডাক্তার যুক্ত করা
router.post("/", async (req, res) => {
  try {
    const doctor = new Doctor(req.body);
    const saved = await doctor.save();
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
