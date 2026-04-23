// src/routes/auth.js
const express = require("express");
const jwt     = require("jsonwebtoken");
const User    = require("../models/User");
const { auth } = require("../middleware/auth");

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

// ── POST /api/auth/signup ─────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    const { name, username, email, phone, password, occupation, location, bio } = req.body;

    if (!name || !username || !email || !password)
      return res.status(400).json({ error: "name, username, email and password are required" });

    if (await User.findOne({ email }))
      return res.status(409).json({ error: "Email already registered" });

    if (await User.findOne({ username: username.toLowerCase() }))
      return res.status(409).json({ error: "Username already taken" });

    // Generate OTP
    const otpCode  = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const user = await User.create({
      name, username: username.toLowerCase(), email: email.toLowerCase(),
      phone, password, occupation, location, bio,
      otpCode, otpExpiry,
    });

    // TODO: send OTP via SMS / email (Twilio / Nodemailer)
    // For now: return in response (development only)
    const token = signToken(user._id);

    res.status(201).json({
      message: "Account created. Please verify your phone.",
      token,
      otpCode: process.env.NODE_ENV !== "production" ? otpCode : undefined,
      user: {
        id:          user._id,
        name:        user.name,
        username:    user.username,
        avatar:      user.avatar,
        avatarInitials: user.avatarInitials,
        avatarColor: user.avatarColor,
        title:       user.title,
        occupation:  user.occupation,
        location:    user.location,
        bio:         user.bio,
        trustScore:  user.trustScore,
        verified:    user.verified,
        verifyLevel: user.verifyLevel,
        badges:      user.badges,
        deals:       user.deals,
        premium:     user.premium,
        role:        user.role,
        joinDate:    user.joinDate,
        skills:      user.skills,
        reviews:     user.reviews,
        scoreBreakdown: user.scoreBreakdown,
        responseRate: user.responseRate,
      },
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Email or username already exists" });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/verify-otp ─────────────────────────────
router.post("/verify-otp", auth, async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.user._id).select("+otpCode +otpExpiry");

    if (!user.otpCode)   return res.status(400).json({ error: "No OTP pending" });
    if (new Date() > user.otpExpiry) return res.status(400).json({ error: "OTP expired" });
    if (user.otpCode !== otp) return res.status(400).json({ error: "Invalid OTP" });

    user.phoneVerified = true;
    user.otpCode  = undefined;
    user.otpExpiry = undefined;

    // Award Verified Phone badge
    if (!user.badges.includes("Verified Phone")) user.badges.push("Verified Phone");

    await user.save();
    res.json({ message: "Phone verified successfully", verified: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: email.toLowerCase() }]
    }).select("+password");

    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: "Invalid credentials" });

    if (user.suspended) return res.status(403).json({ error: "Account suspended" });

    const token = signToken(user._id);
    res.json({
      token,
      user: {
        id:          user._id,
        name:        user.name,
        username:    user.username,
        avatar:      user.avatar,
        avatarInitials: user.avatarInitials,
        avatarColor: user.avatarColor,
        title:       user.title,
        occupation:  user.occupation,
        location:    user.location,
        bio:         user.bio,
        trustScore:  user.trustScore,
        verified:    user.verified,
        verifyLevel: user.verifyLevel,
        badges:      user.badges,
        deals:       user.deals,
        premium:     user.premium,
        role:        user.role,
        joinDate:    user.joinDate,
        skills:      user.skills,
        reviews:     user.reviews,
        scoreBreakdown: user.scoreBreakdown,
        responseRate: user.responseRate,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/resend-otp ─────────────────────────────
router.post("/resend-otp", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+otpCode +otpExpiry");
    const otpCode  = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.otpCode  = otpCode;
    user.otpExpiry = otpExpiry;
    await user.save();
    // TODO: send via SMS
    res.json({ message: "OTP resent", otpCode: process.env.NODE_ENV !== "production" ? otpCode : undefined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ message: "If that email exists, a reset link has been sent." });

    const resetToken  = require("crypto").randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    user.resetToken  = resetToken;
    user.resetExpiry = resetExpiry;
    await user.save();
    // TODO: send reset email
    res.json({ message: "Reset link sent", resetToken: process.env.NODE_ENV !== "production" ? resetToken : undefined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/reset-password ────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({ resetToken: token }).select("+resetToken +resetExpiry");
    if (!user || new Date() > user.resetExpiry) return res.status(400).json({ error: "Invalid or expired reset token" });

    user.password    = password;
    user.resetToken  = undefined;
    user.resetExpiry = undefined;
    await user.save();
    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
