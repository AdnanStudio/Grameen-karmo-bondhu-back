const router  = require("express").Router();
const { body } = require("express-validator");
const { requireAuth } = require("../middleware/auth.middleware");
const User    = require("../models/User");
const Notification = require("../models/Notification");
const { ok, fail } = require("../utils/response");

// GET /api/users/me — নিজের প্রোফাইল দেখুন
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    return ok(res, { data: { user } });
  } catch (err) {
    return fail(res, "প্রোফাইল লোড করতে সমস্যা হয়েছে", 500);
  }
});

// PUT /api/users/me — প্রোফাইল আপডেট
router.put(
  "/me",
  requireAuth,
  [
    body("phone").optional().matches(/^01[3-9]\d{8}$/).withMessage("সঠিক মোবাইল নম্বর দিন"),
    body("experience").optional().isNumeric().withMessage("সংখ্যা দিন"),
    body("dailyRate").optional().isNumeric().withMessage("সংখ্যা দিন"),
  ],
  async (req, res) => {
    try {
      const {
        name, phone, location, category, experience,
        description, skills, dailyRate, photo, isAvailable,
      } = req.body;

      const updateFields = {};
      if (name)     updateFields.name  = name;
      if (photo)    updateFields.photo = photo;

      // Profile sub-document
      const profileFields = {};
      if (phone       !== undefined) profileFields["profile.phone"]       = phone;
      if (location    !== undefined) profileFields["profile.location"]    = location;
      if (category    !== undefined) profileFields["profile.category"]    = category;
      if (experience  !== undefined) profileFields["profile.experience"]  = Number(experience);
      if (description !== undefined) profileFields["profile.description"] = description;
      if (dailyRate   !== undefined) profileFields["profile.dailyRate"]   = Number(dailyRate);
      if (isAvailable !== undefined) profileFields["profile.isAvailable"] = isAvailable;
      if (Array.isArray(skills))     profileFields["profile.skills"]      = skills.slice(0, 10);

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { ...updateFields, ...profileFields } },
        { new: true, runValidators: true }
      );

      // Recalculate score
      await user.save();

      return ok(res, { data: { user } }, "প্রোফাইল সংরক্ষণ হয়েছে");
    } catch (err) {
      return fail(res, "প্রোফাইল সংরক্ষণ করতে সমস্যা হয়েছে", 500);
    }
  }
);

// GET /api/users/notifications — নোটিফিকেশন
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    const unread = notifications.filter((n) => !n.isRead).length;
    return ok(res, { data: { notifications, unread } });
  } catch (err) {
    return fail(res, "নোটিফিকেশন লোড করতে সমস্যা হয়েছে", 500);
  }
});

// PATCH /api/users/notifications/read-all — সব পড়া হিসেবে চিহ্নিত করুন
router.patch("/notifications/read-all", requireAuth, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    return ok(res, {}, "সব নোটিফিকেশন পড়া হয়েছে");
  } catch (err) {
    return fail(res, "আপডেট করতে সমস্যা হয়েছে", 500);
  }
});

module.exports = router;
