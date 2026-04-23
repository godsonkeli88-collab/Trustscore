// src/routes/public.js — Unauthenticated endpoints
const express = require("express");
const User    = require("../models/User");
const router  = express.Router();

// ── GET /api/public/profile/:username ─────────────────────
// Used for shareable links and embed widgets
router.get("/profile/:username", async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.params.username.toLowerCase(),
      suspended: false,
    }).select("name username avatar avatarInitials avatarColor title occupation location trustScore verified verifyLevel badges deals reviews joinDate bio skills scoreBreakdown responseRate premium");

    if (!user) return res.status(404).json({ error: "Profile not found" });
    await User.findByIdAndUpdate(user._id, { $inc: { profileViews: 1 } });
    res.json({ profile: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/public/trust/:username ───────────────────────
// Minimal API endpoint for third-party integrations
router.get("/trust/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase(), suspended: false })
      .select("name username trustScore verified badges scoreBreakdown reviews deals");
    if (!user) return res.status(404).json({ error: "Not found" });

    res.json({
      username:   user.username,
      name:       user.name,
      trustScore: user.trustScore,
      verified:   user.verified,
      badges:     user.badges,
      reviewCount: user.reviews.length,
      deals:      user.deals,
      breakdown:  user.scoreBreakdown,
      link:       `${process.env.FRONTEND_URL}/u/${user.username}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
