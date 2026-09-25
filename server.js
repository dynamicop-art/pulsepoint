const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

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

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "*" }));
app.use(express.json());

// MongoDB Atlas Database Connection
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("✅ Successfully connected to MongoDB Atlas!"))
    .catch((err) => console.error("❌ MongoDB Error:", err.message));
} else {
  console.warn("⚠️ Warning: MONGO_URI is not set!");
}

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ONLINE",
    database: mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED",
    timestamp: new Date().toISOString()
  });
});

// Root welcome route
app.get("/", (req, res) => {
  res.send("PulsePoint Emergency Care API is Live and Connected to MongoDB Atlas!");
});

// Mount Hospital Routes
if (hospitalRoutes) {
  app.use("/api/hospitals", hospitalRoutes);
  app.use("/hospitals", hospitalRoutes);
}

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`🚀 PulsePoint Server running on port ${PORT}`);
});
