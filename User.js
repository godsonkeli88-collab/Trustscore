// src/models/User.js
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const reviewSchema = new mongoose.Schema({
  author:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  authorName: String,
  authorAvatar: String,
  rating:   { type: Number, min: 1, max: 5, required: true },
  text:     { type: String, required: true, maxlength: 1000 },
  category: { type: String, enum: ["Professionalism","Reliability","Communication","Quality","Honesty","Timeliness","Design Work","Development","Consulting","Delivery","Rental","General"], default: "General" },
  date:     { type: Date, default: Date.now },
  verified: { type: Boolean, default: true },
  flagged:  { type: Boolean, default: false },
}, { _id: true, timestamps: true });

const userSchema = new mongoose.Schema({
  // ── Identity ──────────────────────────────────────────────
  name:          { type: String, required: true, trim: true, maxlength: 100 },
  username:      { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9._-]{3,30}$/ },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:         { type: String, trim: true },
  password:      { type: String, required: true, minlength: 8, select: false },

  // ── Profile ───────────────────────────────────────────────
  title:         { type: String, trim: true, maxlength: 100 },
  occupation:    { type: String, trim: true },
  location:      { type: String, trim: true },
  bio:           { type: String, trim: true, maxlength: 500 },
  skills:        [{ type: String, trim: true }],
  avatar:        { type: String, default: null },         // URL to uploaded image
  avatarInitials:{ type: String, maxlength: 3 },
  avatarColor:   { type: String, default: "#2a7a6e" },
  premium:       { type: Boolean, default: false },

  // ── Verification ─────────────────────────────────────────
  verified:      { type: String, enum: ["phone","standard","advanced"], default: "phone" },
  verifyLevel:   { type: Number, default: 1, min: 0, max: 3 },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  idVerified:    { type: Boolean, default: false },

  // ── TrustScore ────────────────────────────────────────────
  trustScore:    { type: Number, default: 0, min: 0, max: 100 },
  scoreBreakdown:{
    reliability:    { type: Number, default: 0 },
    quality:        { type: Number, default: 0 },
    communication:  { type: Number, default: 0 },
    ethics:         { type: Number, default: 0 },
    timeliness:     { type: Number, default: 0 },
  },

  // ── Activity ─────────────────────────────────────────────
  deals:         { type: Number, default: 0 },
  responseRate:  { type: Number, default: 0 },
  badges:        [{ type: String }],
  reviews:       [reviewSchema],

  // ── Stats ─────────────────────────────────────────────────
  profileViews:  { type: Number, default: 0 },
  joinDate:      { type: String },

  // ── Flags ─────────────────────────────────────────────────
  reported:      { type: Boolean, default: false },
  suspended:     { type: Boolean, default: false },
  role:          { type: String, enum: ["user","admin"], default: "user" },

  // ── Tokens ───────────────────────────────────────────────
  otpCode:       { type: String, select: false },
  otpExpiry:     { type: Date,   select: false },
  resetToken:    { type: String, select: false },
  resetExpiry:   { type: Date,   select: false },

}, { timestamps: true });

// ── Hash password before save ──────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);

  // Auto-set initials
  if (!this.avatarInitials && this.name) {
    this.avatarInitials = this.name
      .split(" ")
      .map(w => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  // Auto-set joinDate
  if (!this.joinDate) {
    this.joinDate = new Date().toLocaleDateString("en-NG", { month: "short", year: "numeric" });
  }

  next();
});

// ── Compare password ───────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Recalculate TrustScore ─────────────────────────────────
userSchema.methods.recalculateTrustScore = function () {
  const reviews = this.reviews.filter(r => !r.flagged);
  if (!reviews.length) { this.trustScore = 0; return; }

  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const ratings = reviews.map(r => r.rating);
  const baseScore = avg(ratings) * 20; // 1-5 → 0-100

  // Verification bonus
  const verBonus = { phone: 0, standard: 3, advanced: 8 }[this.verified] || 0;

  // Volume bonus (caps at 5 points)
  const volBonus = Math.min(5, reviews.length * 0.25);

  // Deal completion bonus (caps at 5 points)
  const dealBonus = Math.min(5, this.deals * 0.1);

  this.trustScore = Math.min(100, Math.round(baseScore + verBonus + volBonus + dealBonus));

  // Update breakdown
  const catMap = { reliability:[], quality:[], communication:[], ethics:[], timeliness:[] };
  reviews.forEach(r => {
    const key = r.category.toLowerCase();
    if (catMap[key]) catMap[key].push(r.rating * 20);
    else {
      catMap.reliability.push(r.rating * 20);
      catMap.quality.push(r.rating * 20);
    }
  });

  Object.keys(catMap).forEach(k => {
    this.scoreBreakdown[k] = catMap[k].length ? Math.round(avg(catMap[k])) : this.trustScore;
  });
};

// ── Clean public output ────────────────────────────────────
userSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otpCode;
  delete obj.otpExpiry;
  delete obj.resetToken;
  delete obj.resetExpiry;
  delete obj.email;
  delete obj.phone;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
