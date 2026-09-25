const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  bloodGroup: { type: String, required: true },
  unitsRequired: { type: Number, default: 1 },
  hospital: { type: String, required: true },
  contactNumber: { type: String, required: true },
  urgency: { type: String, enum: ["Critical", "Urgent", "Standard"], default: "Urgent" },
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now }
});

const BloodRequest = mongoose.models.BloodRequest || mongoose.model("BloodRequest", requestSchema);

// GET: সব ব্লাড রিকোয়েস্ট দেখা
router.get("/requests", async (req, res) => {
  try {
    const requests = await BloodRequest.find().sort({ createdAt: -1 });
    res.json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST: নতুন এমার্জেন্সি ব্লাড রিকোয়েস্ট তৈরি করা
router.post("/requests", async (req, res) => {
  try {
    const newReq = new BloodRequest(req.body);
    const saved = await newReq.save();
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
