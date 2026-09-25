const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// Mongoose Hospital Schema
const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  totalBeds: { type: Number, default: 50 },
  availableBeds: { type: Number, default: 10 },
  icuBeds: { type: Number, default: 5 },
  contact: { type: String, required: true },
  bloodAvailable: { type: [String], default: ["A+", "B+", "O+"] },
  updatedAt: { type: Date, default: Date.now }
});

const Hospital = mongoose.models.Hospital || mongoose.model("Hospital", hospitalSchema);

// Initial Sample Data (ডেটাবেস ফাঁকা থাকলে স্বয়ংক্রিয়ভাবে ইনসার্ট হবে)
const defaultHospitals = [
  {
    name: "Apollo Multispeciality Hospital",
    location: "Kolkata",
    totalBeds: 250,
    availableBeds: 42,
    icuBeds: 14,
    contact: "+91 33 2320 3040",
    bloodAvailable: ["A+", "B+", "O+", "AB+"]
  },
  {
    name: "Fortis Hospital",
    location: "Anandapur, Kolkata",
    totalBeds: 180,
    availableBeds: 25,
    icuBeds: 9,
    contact: "+91 33 6628 4444",
    bloodAvailable: ["O+", "O-", "A+", "B-"]
  },
  {
    name: "Medica Superspecialty Hospital",
    location: "Mukundapur, Kolkata",
    totalBeds: 220,
    availableBeds: 38,
    icuBeds: 11,
    contact: "+91 33 6652 0000",
    bloodAvailable: ["A+", "B+", "AB-", "O+"]
  },
  {
    name: "AMRI Hospital",
    location: "Dhakuria, Kolkata",
    totalBeds: 160,
    availableBeds: 19,
    icuBeds: 6,
    contact: "+91 33 6606 3800",
    bloodAvailable: ["B+", "O+", "A-"]
  }
];

// ১. GET: ডেটাবেস থেকে সব হাসপাতাল লোড করা (সার্চ ও ফিল্টার সহ)
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { location: { $regex: search, $options: "i" } }
        ]
      };
    }

    let hospitals = await Hospital.find(query).sort({ updatedAt: -1 });

    // ডেটাবেস সম্পূর্ণ ফাঁকা থাকলে অটো-সিড হবে
    if (hospitals.length === 0 && !search) {
      hospitals = await Hospital.insertMany(defaultHospitals);
    }

    res.json({
      success: true,
      count: hospitals.length,
      data: hospitals
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ২. POST: নতুন হাসপাতাল যুক্ত করা (Checkpoint 4: Viable প্রমাণ করতে)
router.post("/", async (req, res) => {
  try {
    const { name, location, totalBeds, availableBeds, icuBeds, contact, bloodAvailable } = req.body;
    
    if (!name || !location || !contact) {
      return res.status(400).json({ success: false, message: "Name, Location, and Contact are required!" });
    }

    const newHospital = new Hospital({
      name,
      location,
      totalBeds: Number(totalBeds) || 50,
      availableBeds: Number(availableBeds) || 10,
      icuBeds: Number(icuBeds) || 5,
      contact,
      bloodAvailable: Array.isArray(bloodAvailable) ? bloodAvailable : ["O+", "A+"]
    });

    const saved = await newHospital.save();
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ৩. PATCH: বেড সংখ্যা রিয়েল-টাইম আপডেট করা
router.patch("/:id/beds", async (req, res) => {
  try {
    const { availableBeds, icuBeds } = req.body;
    const updated = await Hospital.findByIdAndUpdate(
      req.params.id,
      { availableBeds, icuBeds, updatedAt: Date.now() },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
