// ═══════════════════════════════════════════════════════════
//  TrustScore Backend — Node.js / Express
//  Entry Point: src/index.js
// ═══════════════════════════════════════════════════════════

require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const rateLimit    = require("express-rate-limit");
const morgan       = require("morgan");
const path         = require("path");
const connectDB    = require("./config/db");

// Route imports
const authRoutes    = require("./routes/auth");
const profileRoutes = require("./routes/profiles");
const reviewRoutes  = require("./routes/reviews");
const reportRoutes  = require("./routes/reports");
const uploadRoutes  = require("./routes/upload");
const adminRoutes   = require("./routes/admin");
const publicRoutes  = require("./routes/public");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Connect Database ────────────────────────────────────────
connectDB();

// ── Security Middleware ─────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

// ── Rate Limiting ───────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests, please try again later." },
});
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: "Too many auth attempts, please try again later." },
});

app.use("/api/auth", authLimiter);
app.use("/api", limiter);

// ── Body Parsing ────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Logging ─────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ── Static Uploads ───────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ── API Routes ───────────────────────────────────────────────
app.use("/api/auth",     authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/reviews",  reviewRoutes);
app.use("/api/reports",  reportRoutes);
app.use("/api/upload",   uploadRoutes);
app.use("/api/admin",    adminRoutes);
app.use("/api/public",   publicRoutes);   // unauthenticated public lookup

// ── Health Check ─────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), version: "1.0.0" });
});

// ── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛡  TrustScore API running on port ${PORT}`);
  console.log(`📌  Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗  Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
