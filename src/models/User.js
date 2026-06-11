const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  phone:         { type: String, default: "" },
  location:      { type: String, default: "" },
  category:      { type: String, default: "" },
  experience:    { type: Number, default: 0 },
  description:   { type: String, default: "" },
  dailyRate:     { type: Number, default: 0 },
  skills:        [{ type: String }],
  isAvailable:   { type: Boolean, default: true },
  isApproved:    { type: Boolean, default: false },
  isVerified:    { type: Boolean, default: false },

  // Stats (auto-calculated)
  score:         { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  reviewCount:   { type: Number, default: 0 },
  hireCount:     { type: Number, default: 0 },
  viewCount:     { type: Number, default: 0 },
});

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email:       { type: String, default: "" },
    name:        { type: String, required: true, trim: true },
    photo:       { type: String, default: "" },
    provider:    { type: String, enum: ["google.com", "facebook.com", "phone"], default: "google.com" },
    role:        { type: String, enum: ["user", "admin", "superAdmin"], default: "user" },
    isActive:    { type: Boolean, default: true },
    profile:     { type: profileSchema, default: () => ({}) },
    lastLogin:   { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Auto-calculate profile score before save
userSchema.pre("save", function (next) {
  if (this.profile) {
    this.profile.score = calculateScore(this.profile, this);
  }
  next();
});

function calculateScore(profile, user) {
  let score = 0;

  // Profile completeness (0–30)
  if (user.photo) score += 10;
  if (profile.description?.length > 30) score += 10;
  if (profile.skills?.length > 0) score += 10;

  // Rating (0–30)
  score += (profile.averageRating || 0) * 6;

  // Hire count (0–20, capped)
  score += Math.min(profile.hireCount || 0, 20);

  // View count (0–10, every 10 views = 1 point)
  score += Math.min(Math.floor((profile.viewCount || 0) / 10), 10);

  // Verified bonus (0–10)
  if (profile.isVerified) score += 10;

  return Math.round(score);
}

module.exports = mongoose.model("User", userSchema);
