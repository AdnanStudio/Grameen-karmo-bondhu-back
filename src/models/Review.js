const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    worker:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    client:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hireRequest: { type: mongoose.Schema.Types.ObjectId, ref: "HireRequest" },
    rating:      { type: Number, required: true, min: 1, max: 5 },
    comment:     { type: String, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

// One review per hire request
reviewSchema.index({ hireRequest: 1 }, { unique: true });

// After saving a review, update worker's average rating
reviewSchema.post("save", async function () {
  const User = require("./User");
  const Review = this.constructor;

  const stats = await Review.aggregate([
    { $match: { worker: this.worker } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  if (stats.length > 0) {
    await User.findByIdAndUpdate(this.worker, {
      "profile.averageRating": Math.round(stats[0].avg * 10) / 10,
      "profile.reviewCount": stats[0].count,
    });
    // Recalculate score
    const user = await User.findById(this.worker);
    if (user) await user.save();
  }
});

module.exports = mongoose.model("Review", reviewSchema);
