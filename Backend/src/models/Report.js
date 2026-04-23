// src/models/Report.js
const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  reporter:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reporterName:{ type: String },
  target:      { type: String, required: true },
  targetUser:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type:        { type: String, enum: ["Scam/Fraud","Fake Review","Impersonation","Abuse/Harassment","Suspicious Activity","Other"], required: true },
  detail:      { type: String, required: true, maxlength: 2000 },
  status:      { type: String, enum: ["pending","reviewing","resolved","dismissed"], default: "pending" },
  adminNote:   { type: String },
  resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  resolvedAt:  { type: Date },
}, { timestamps: true });

module.exports = mongoose.model("Report", reportSchema);
