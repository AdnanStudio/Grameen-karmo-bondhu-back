const mongoose = require("mongoose");

const hireRequestSchema = new mongoose.Schema(
  {
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    note: {
      type: String,
      maxlength: [500, "নোট ৫০০ অক্ষরের বেশি হতে পারবে না"],
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "completed", "cancelled"],
      default: "pending",
    },
    completedAt: { type: Date },
    reviewGiven: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent duplicate pending requests from same client to same worker
hireRequestSchema.index(
  { worker: 1, client: 1, status: 1 },
  { unique: false }
);

module.exports = mongoose.model("HireRequest", hireRequestSchema);
