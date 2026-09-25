const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

router.post("/login", (req, res) => {
  const { email, password, role } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email or Medical ID is required" });
  }

  const assignedRole = role || (email.includes("gov") || email.includes("emt") ? "staff" : "citizen");

  const payload = {
    email,
    name: email.split("@")[0],
    role: assignedRole
  };

  const secret = process.env.JWT_SECRET || "pulsepoint_emergency_super_secret_jwt_key_2026";
  const token = jwt.sign(payload, secret, { expiresIn: "24h" });

  res.json({
    success: true,
    message: "Authenticated successfully",
    token,
    user: payload
  });
});

module.exports = router;