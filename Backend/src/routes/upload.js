// src/routes/upload.js
const express  = require("express");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const User     = require("../models/User");
const { auth } = require("../middleware/auth");
const router   = express.Router();

// ── Local storage (use Cloudinary in production) ──────────
const uploadDir = path.join(__dirname, "../../uploads/avatars");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `avatar-${req.user._id}-${Date.now()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [".jpg",".jpeg",".png",".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error("Only JPG, PNG, and WebP images are allowed"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ── POST /api/upload/avatar ───────────────────────────────
router.post("/avatar", auth, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Delete old avatar file if local
    const existing = await User.findById(req.user._id).select("avatar");
    if (existing?.avatar && existing.avatar.startsWith("/uploads")) {
      const oldPath = path.join(__dirname, "../../", existing.avatar);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // In production: upload to Cloudinary and store URL
    // const cloudinary = require("cloudinary").v2;
    // const result = await cloudinary.uploader.upload(req.file.path, { folder: "trustscore/avatars", width: 400, height: 400, crop: "fill" });
    // const avatarUrl = result.secure_url;

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true }
    ).select("-password -email -phone -otpCode -otpExpiry -resetToken -resetExpiry");

    res.json({ message: "Avatar uploaded", avatar: avatarUrl, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/upload/avatar ─────────────────────────────
router.delete("/avatar", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("avatar");
    if (user?.avatar && user.avatar.startsWith("/uploads")) {
      const oldPath = path.join(__dirname, "../../", user.avatar);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await User.findByIdAndUpdate(req.user._id, { avatar: null });
    res.json({ message: "Avatar removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
