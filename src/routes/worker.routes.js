const router = require("express").Router();
const User   = require("../models/User");
const Review = require("../models/Review");
const { requireAuth } = require("../middleware/auth.middleware");
const { ok, fail }    = require("../utils/response");

// GET /api/workers — কর্মীদের তালিকা (ফিল্টার + সার্চ)
router.get("/", async (req, res) => {
  try {
    const { category, location, sort = "score", page = 1, limit = 20, search } = req.query;

    const filter = {
      role: "user",
      isActive: true,
      "profile.isApproved": true,
    };

    if (category) filter["profile.category"] = category;
    if (location) filter["profile.location"] = new RegExp(location, "i");
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { "profile.location": new RegExp(search, "i") },
        { "profile.description": new RegExp(search, "i") },
      ];
    }

    const sortMap = {
      score:   { "profile.score": -1 },
      rating:  { "profile.averageRating": -1 },
      jobs:    { "profile.hireCount": -1 },
      newest:  { createdAt: -1 },
    };

    const workers = await User.find(filter)
      .select("-firebaseUid -__v")
      .sort(sortMap[sort] || sortMap.score)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await User.countDocuments(filter);

    return ok(res, { data: { workers, total, page: Number(page) } });
  } catch (err) {
    return fail(res, "কর্মীদের তালিকা লোড করতে সমস্যা হয়েছে", 500);
  }
});

// GET /api/workers/leaderboard — শীর্ষ কর্মীরা
router.get("/leaderboard", async (req, res) => {
  try {
    const workers = await User.find({
      isActive: true,
      "profile.isApproved": true,
    })
      .select("-firebaseUid -__v")
      .sort({ "profile.score": -1 })
      .limit(50)
      .lean();

    return ok(res, { data: { workers } });
  } catch (err) {
    return fail(res, "লিডারবোর্ড লোড করতে সমস্যা হয়েছে", 500);
  }
});

// GET /api/workers/:id — একজন কর্মীর বিবরণ
router.get("/:id", async (req, res) => {
  try {
    const worker = await User.findById(req.params.id)
      .select("-firebaseUid -__v")
      .lean();

    if (!worker) return fail(res, "কর্মী পাওয়া যায়নি", 404);

    // View count বাড়াও (non-blocking)
    User.findByIdAndUpdate(req.params.id, {
      $inc: { "profile.viewCount": 1 },
    }).exec();

    // Reviews আনো
    const reviews = await Review.find({ worker: req.params.id })
      .populate("client", "name photo")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return ok(res, { data: { worker, reviews } });
  } catch (err) {
    return fail(res, "কর্মীর তথ্য লোড করতে সমস্যা হয়েছে", 500);
  }
});

// POST /api/workers/:id/review — রিভিউ দিন
router.post("/:id/review", requireAuth, async (req, res) => {
  try {
    const { rating, comment, hireRequestId } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return fail(res, "১ থেকে ৫ এর মধ্যে রেটিং দিন");
    }
    if (req.params.id === req.user._id.toString()) {
      return fail(res, "নিজেকে রিভিউ দেওয়া যাবে না");
    }

    const existing = await Review.findOne({
      worker: req.params.id,
      client: req.user._id,
      ...(hireRequestId && { hireRequest: hireRequestId }),
    });

    if (existing) return fail(res, "আপনি ইতিমধ্যে এই কর্মীকে রিভিউ দিয়েছেন");

    const review = await Review.create({
      worker: req.params.id,
      client: req.user._id,
      hireRequest: hireRequestId,
      rating: Number(rating),
      comment: comment?.trim() || "",
    });

    return ok(res, { data: { review } }, "রিভিউ দেওয়া হয়েছে ✅", 201);
  } catch (err) {
    return fail(res, "রিভিউ দিতে সমস্যা হয়েছে", 500);
  }
});

module.exports = router;
