// src/routes/reports.js
const express = require("express");
const Report  = require("../models/Report");
const { auth } = require("../middleware/auth");
const router  = express.Router();

router.post("/", auth, async (req, res) => {
  try {
    const { target, type, detail } = req.body;
    if (!target || !type || !detail) return res.status(400).json({ error: "All fields required" });

    const report = await Report.create({
      reporter:    req.user._id,
      reporterName: req.user.name,
      target, type, detail,
    });
    res.status(201).json({ message: "Report submitted", report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/mine", auth, async (req, res) => {
  try {
    const reports = await Report.find({ reporter: req.user._id }).sort({ createdAt: -1 });
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
