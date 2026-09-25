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

app.use(cors({ origin: "*" }));
app.use(express.json());

// MongoDB কানেকশন
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("✅ Successfully connected to MongoDB Atlas!"))
    .catch((err) => console.error("❌ MongoDB Error:", err.message));
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ONLINE", database: mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED" });
});

app.use("/api/auth", authRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/blood-organ", bloodOrganRoutes);
app.use("/api/doctors", doctorRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`PulsePoint Server running on port ${PORT}`);
});
