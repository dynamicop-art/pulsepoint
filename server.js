const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const hospitalRoutes = require("./routes/hospitals");
const bloodOrganRoutes = require("./routes/bloodOrgan");
const doctorRoutes = require("./routes/doctor"); // Matches doctor.js in your screenshot

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend communication and JSON parsing
app.use(cors({ origin: "*" }));
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ONLINE",
    message: "PulsePoint Emergency Care API Active",
    timestamp: new Date().toISOString()
  });
});

// Mount modular API routes
app.use("/api/auth", authRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api", bloodOrganRoutes);
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