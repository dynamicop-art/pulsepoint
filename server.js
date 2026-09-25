const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

// রাউট লোড করা (ফাইল নাম singular বা plural যাই হোক হ্যান্ডেল করবে)
let hospitalRoutes;
try {
  hospitalRoutes = require("./routes/hospitals");
} catch (e) {
  try {
    hospitalRoutes = require("./routes/hospital");
  } catch (err) {
    console.error("Could not load hospital routes:", err);
  }
}

let doctorRoutes;
try {
  doctorRoutes = require("./routes/doctor");
} catch (e) {
  try {
    doctorRoutes = require("./routes/doctors");
  } catch (err) {}
}

let bloodOrganRoutes;
try {
  bloodOrganRoutes = require("./routes/bloodOrgan");
} catch (e) {}

let authRoutes;
try {
  authRoutes = require("./routes/auth");
} catch (e) {}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "*" }));
app.use(express.json());

// MongoDB Atlas কানেকশন
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("✅ Successfully connected to MongoDB Atlas!"))
    .catch((err) => console.error("❌ MongoDB Error:", err.message));
} else {
  console.warn("⚠️ Warning: MONGO_URI is not set!");
}

// Health Check রুট
app.get("/api/health", (req, res) => {
  res.json({
    status: "ONLINE",
    database: mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED"
  });
});

// রাউট মাউন্ট করা
if (hospitalRoutes) {
  app.use("/api/hospitals", hospitalRoutes);
  app.use("/hospitals", hospitalRoutes);
}
if (doctorRoutes) {
  app.use("/api/doctors", doctorRoutes);
}
if (bloodOrganRoutes) {
  app.use("/api/blood-organ", bloodOrganRoutes);
}
if (authRoutes) {
  app.use("/api/auth", authRoutes);
}

// Fallback 404 handler (কোন রুটে রিকোয়েস্ট এসেছে তাও দেখাবে)
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`🚀 PulsePoint Server running on port ${PORT}`);
});
