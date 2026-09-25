const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const hospitalRoutes = require("./routes/hospitals");
const bloodOrganRoutes = require("./routes/bloodOrgan");
const doctorRoutes = require("./routes/doctor");

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors({ origin: "*" }));
app.use(express.json());

// ==========================================
// 🔌 MongoDB Atlas Database Connection
// ==========================================
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.warn("⚠️ Warning: MONGO_URI is missing in environment variables!");
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log("✅ Successfully connected to MongoDB Atlas Database!");
    })
    .catch((err) => {
      console.error("❌ MongoDB Connection Error:", err.message);
    });
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ONLINE",
    message: "PulsePoint Emergency Care API Active",
    database: mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED",
    timestamp: new Date().toISOString()
  });
});

// Root welcome route
app.get("/", (req, res) => {
  res.send("PulsePoint Emergency Care API is live and connected to MongoDB Atlas!");
});

// Mount modular API routes
app.use("/api/auth", authRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/blood-organ", bloodOrganRoutes);
app.use("/api/doctors", doctorRoutes);

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Internal Server Error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(` PulsePoint Emergency Care Backend Running`);
  console.log(` Port: ${PORT}`);
  console.log(` Health Check: http://localhost:${PORT}/api/health`);
  console.log(`=================================================\n`);
});
