const router = require("express").Router();
const User   = require("../models/User");
const HireRequest = require("../models/HireRequest");
const { requireAuth, requireAdmin, requireSuperAdmin } = require("../middleware/auth.middleware");
const { ok, fail } = require("../utils/response");

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// GET /api/admin/stats — ড্যাশবোর্ড পরিসংখ্যান
router.get("/stats", async (req, res) => {
  try {
    const [
      totalUsers, approvedProfiles, pendingProfiles, admins,
      totalHires, completedHires,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      User.countDocuments({ "profile.isApproved": true }),
      User.countDocuments({ "profile.isApproved": false, role: "user" }),
      User.countDocuments({ role: { $in: ["admin", "superAdmin"] } }),
      HireRequest.countDocuments(),
      HireRequest.countDocuments({ status: "completed" }),
    ]);

    // কর্মী ক্যাটাগরি অনুযায়ী গণনা
    const categoryStats = await User.aggregate([
      { $match: { role: "user", "profile.isApproved": true } },
      { $group: { _id: "$profile.category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    return ok(res, {
      data: {
        stats: {
          totalUsers, approvedProfiles, pendingProfiles, admins,
          totalHires, completedHires, categoryStats,
        },
      },
    });
  } catch (err) {
    return fail(res, "পরিসংখ্যান লোড করতে সমস্যা হয়েছে", 500);
  }
});

// GET /api/admin/users — সব ব্যবহারকারীর তালিকা
router.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 30, search, role, approved } = req.query;
    const filter = {};
    if (role)   filter.role = role;
    if (approved !== undefined) filter["profile.isApproved"] = approved === "true";
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ];
    }

    const users = await User.find(filter)
      .select("-firebaseUid")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await User.countDocuments(filter);
    return ok(res, { data: { users, total } });
  } catch (err) {
    return fail(res, "ব্যবহারকারীদের তালিকা লোড করতে সমস্যা হয়েছে", 500);
  }
});

// PATCH /api/admin/users/:id/approve — প্রোফাইল অনুমোদন
router.patch("/users/:id/approve", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { "profile.isApproved": true } },
      { new: true }
    ).select("-firebaseUid");

    if (!user) return fail(res, "ব্যবহারকারী পাওয়া যায়নি", 404);
    return ok(res, { data: { user } }, "প্রোফাইল অনুমোদন করা হয়েছে ✅");
  } catch (err) {
    return fail(res, "অনুমোদন করতে সমস্যা হয়েছে", 500);
  }
});

// PATCH /api/admin/users/:id/reject — প্রোফাইল প্রত্যাখ্যান
router.patch("/users/:id/reject", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { "profile.isApproved": false } },
      { new: true }
    ).select("-firebaseUid");

    if (!user) return fail(res, "ব্যবহারকারী পাওয়া যায়নি", 404);
    return ok(res, { data: { user } }, "প্রোফাইল প্রত্যাখ্যাত হয়েছে");
  } catch (err) {
    return fail(res, "প্রত্যাখ্যান করতে সমস্যা হয়েছে", 500);
  }
});

// PATCH /api/admin/users/:id/role — রোল পরিবর্তন (শুধু superAdmin)
router.patch("/users/:id/role", requireSuperAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ["user", "admin", "superAdmin"];
    if (!allowed.includes(role)) return fail(res, "অবৈধ রোল");
    if (req.params.id === req.user._id.toString()) return fail(res, "নিজের রোল পরিবর্তন করা যাবে না");

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role } },
      { new: true }
    ).select("-firebaseUid");

    if (!user) return fail(res, "ব্যবহারকারী পাওয়া যায়নি", 404);
    return ok(res, { data: { user } }, `রোল "${role}" এ পরিবর্তন করা হয়েছে`);
  } catch (err) {
    return fail(res, "রোল পরিবর্তন করতে সমস্যা হয়েছে", 500);
  }
});

// PATCH /api/admin/users/:id/toggle-active — অ্যাকাউন্ট চালু/বন্ধ
router.patch("/users/:id/toggle-active", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return fail(res, "ব্যবহারকারী পাওয়া যায়নি", 404);

    user.isActive = !user.isActive;
    await user.save();

    const msg = user.isActive ? "অ্যাকাউন্ট সক্রিয় করা হয়েছে" : "অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে";
    return ok(res, { data: { user } }, msg);
  } catch (err) {
    return fail(res, "আপডেট করতে সমস্যা হয়েছে", 500);
  }
});

// DELETE /api/admin/users/:id — ব্যবহারকারী মুছুন (শুধু superAdmin)
router.delete("/users/:id", requireSuperAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) return fail(res, "নিজেকে মুছে ফেলা যাবে না");
    await User.findByIdAndDelete(req.params.id);
    return ok(res, {}, "ব্যবহারকারী মুছে ফেলা হয়েছে");
  } catch (err) {
    return fail(res, "মুছে ফেলতে সমস্যা হয়েছে", 500);
  }
});

module.exports = router;
