// src/routes/profiles.js
const express = require("express");
const User    = require("../models/User");
const { auth } = require("../middleware/auth");

const router = express.Router();

// ── GET /api/profiles — Search & list ────────────────────
router.get("/", async (req, res) => {
  try {
    const { q, occupation, minScore = 0, verified, sort = "trustScore", page = 1, limit = 20 } = req.query;

    const filter = { suspended: false };
    if (q) {
      filter.$or = [
        { name:       { $regex: q, $options: "i" } },
        { username:   { $regex: q, $options: "i" } },
        { occupation: { $regex: q, $options: "i" } },
        { location:   { $regex: q, $options: "i" } },
        { title:      { $regex: q, $options: "i" } },
      ];
    }
    if (occupation) filter.occupation = { $regex: occupation, $options: "i" };
    if (minScore)   filter.trustScore = { $gte: Number(minScore) };
    if (verified === "true") filter.verified = { $in: ["standard","advanced"] };

    const sortMap = { trustScore: { trustScore: -1 }, reviews: { "reviews.length": -1 }, name: { name: 1 } };
    const sortOpt = sortMap[sort] || { trustScore: -1 };

    const skip = (Number(page) - 1) * Number(limit);
    const [profiles, total] = await Promise.all([
      User.find(filter).sort(sortOpt).skip(skip).limit(Number(limit))
          .select("-password -email -phone -otpCode -otpExpiry -resetToken -resetExpiry"),
      User.countDocuments(filter),
    ]);

    res.json({ profiles, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/profiles/:username — Public profile ──────────
router.get("/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase(), suspended: false })
      .select("-password -email -phone -otpCode -otpExpiry -resetToken -resetExpiry");
    if (!user) return res.status(404).json({ error: "Profile not found" });

    // Increment view count
    await User.findByIdAndUpdate(user._id, { $inc: { profileViews: 1 } });

    res.json({ profile: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/profiles/me — Update own profile ───────────
router.patch("/me", auth, async (req, res) => {
  try {
    const allowed = ["name","title","occupation","location","bio","skills","avatarColor"];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    // Re-compute initials if name changed
    if (updates.name) {
      updates.avatarInitials = updates.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true })
      .select("-password -email -phone -otpCode -otpExpiry -resetToken -resetExpiry");

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/profiles/upgrade-verify ────────────────────
router.post("/upgrade-verify", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const levels  = ["phone","standard","advanced"];
    const current = levels.indexOf(user.verified);
    if (current >= 2) return res.status(400).json({ error: "Already at maximum verification level" });

    const next = levels[current + 1];
    user.verified    = next;
    user.verifyLevel = current + 2;

    // Add badge
    const badgeMap = { standard:"Verified", advanced:"Verified ID" };
    if (badgeMap[next] && !user.badges.includes(badgeMap[next])) {
      user.badges.push(badgeMap[next]);
    }

    user.recalculateTrustScore();
    await user.save();

    res.json({ message: `Verification upgraded to ${next}`, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
