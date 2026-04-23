// src/routes/reviews.js
const express = require("express");
const User    = require("../models/User");
const { auth } = require("../middleware/auth");
const router  = express.Router();

// ── POST /api/reviews/:username ───────────────────────────
router.post("/:username", auth, async (req, res) => {
  try {
    const { rating, text, category } = req.body;
    if (!rating || !text) return res.status(400).json({ error: "Rating and text are required" });

    const target = await User.findOne({ username: req.params.username.toLowerCase() });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target._id.toString() === req.user._id.toString())
      return res.status(400).json({ error: "You cannot review yourself" });

    // Prevent duplicate review within 30 days
    const recent = target.reviews.find(r =>
      r.author.toString() === req.user._id.toString() &&
      new Date() - new Date(r.createdAt) < 30 * 24 * 60 * 60 * 1000
    );
    if (recent) return res.status(400).json({ error: "You already reviewed this user recently" });

    const review = {
      author:      req.user._id,
      authorName:  req.user.name,
      authorAvatar: req.user.avatar || req.user.avatarInitials,
      rating:      Number(rating),
      text,
      category:    category || "General",
      date:        new Date(),
    };

    target.reviews.unshift(review);
    target.deals += 1;

    // Award badge milestones
    if (target.reviews.length === 5  && !target.badges.includes("Rising Star"))  target.badges.push("Rising Star");
    if (target.reviews.length === 20 && !target.badges.includes("Established"))  target.badges.push("Established");
    if (target.reviews.every(r => r.rating >= 4) && target.reviews.length >= 5 && !target.badges.includes("5-Star Streak"))
      target.badges.push("5-Star Streak");

    // Recalculate top rated
    if (target.reviews.filter(r=>r.rating===5).length >= 10 && !target.badges.includes("Top Rated"))
      target.badges.push("Top Rated");

    target.recalculateTrustScore();
    await target.save();

    res.status(201).json({ message: "Review submitted", review: target.reviews[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/reviews/:username/:reviewId ───────────────
router.delete("/:username/:reviewId", auth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "User not found" });

    const review = user.reviews.id(req.params.reviewId);
    if (!review) return res.status(404).json({ error: "Review not found" });

    // Only reviewer or admin can delete
    if (review.author.toString() !== req.user._id.toString() && req.user.role !== "admin")
      return res.status(403).json({ error: "Not authorised" });

    review.remove();
    user.recalculateTrustScore();
    await user.save();

    res.json({ message: "Review removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
