// src/routes/admin.js
const express = require("express");
const User    = require("../models/User");
const Report  = require("../models/Report");
const { adminAuth } = require("../middleware/auth");
const router  = express.Router();

// All admin routes require admin role
router.use(adminAuth);

// ── GET /api/admin/stats ──────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const [totalUsers, pendingReports, advancedVerified, allUsers] = await Promise.all([
      User.countDocuments({ suspended: false }),
      Report.countDocuments({ status: "pending" }),
      User.countDocuments({ verified: "advanced" }),
      User.find({ suspended: false }).select("trustScore"),
    ]);
    const avgScore = allUsers.length
      ? Math.round(allUsers.reduce((a, u) => a + u.trustScore, 0) / allUsers.length)
      : 0;
    res.json({ totalUsers, pendingReports, advancedVerified, avgScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/users ──────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const users = await User.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select("-password -otpCode -otpExpiry -resetToken -resetExpiry");
    const total = await User.countDocuments();
    res.json({ users, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/admin/users/:id/suspend ───────────────────
router.patch("/users/:id/suspend", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { suspended: true }, { new: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User suspended", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/admin/users/:id/unsuspend ─────────────────
router.patch("/users/:id/unsuspend", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { suspended: false }, { new: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User unsuspended", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/users/:id ───────────────────────────
router.delete("/users/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/reports ────────────────────────────────
router.get("/reports", async (req, res) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const filter = status ? { status } : {};
    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Report.countDocuments(filter);
    res.json({ reports, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/admin/reports/:id ─────────────────────────
router.patch("/reports/:id", async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const update = { status };
    if (adminNote)        update.adminNote  = adminNote;
    if (status === "resolved") {
      update.resolvedBy = req.user._id;
      update.resolvedAt = new Date();
    }
    const report = await Report.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json({ message: "Report updated", report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
