const router      = require("express").Router();
const HireRequest = require("../models/HireRequest");
const User        = require("../models/User");
const { requireAuth } = require("../middleware/auth.middleware");
const { createNotification } = require("../utils/notify");
const { ok, fail } = require("../utils/response");

// POST /api/hire — হায়ার রিকোয়েস্ট পাঠান
router.post("/", requireAuth, async (req, res) => {
  try {
    const { workerId, note } = req.body;

    if (!workerId) return fail(res, "workerId প্রয়োজন");
    if (workerId === req.user._id.toString()) {
      return fail(res, "নিজেকে হায়ার করা যাবে না");
    }

    const worker = await User.findById(workerId);
    if (!worker) return fail(res, "কর্মী পাওয়া যায়নি", 404);
    if (!worker.profile?.isAvailable) return fail(res, "এই কর্মী এখন উপলব্ধ নন");

    // Existing pending request check
    const existing = await HireRequest.findOne({
      worker: workerId,
      client: req.user._id,
      status: "pending",
    });
    if (existing) return fail(res, "আপনার একটি অপেক্ষমাণ রিকোয়েস্ট ইতিমধ্যে আছে");

    const hire = await HireRequest.create({
      worker: workerId,
      client: req.user._id,
      note: note?.trim() || "",
    });

    // Notify worker
    await createNotification({
      userId: workerId,
      type: "hire_request",
      title: "নতুন হায়ার রিকোয়েস্ট",
      message: `${req.user.name} আপনাকে হায়ার করতে চাইছেন`,
      link: "/dashboard/hire-requests",
      meta: { hireId: hire._id },
    });

    return ok(res, { data: { hire } }, "হায়ার রিকোয়েস্ট পাঠানো হয়েছে ✅", 201);
  } catch (err) {
    return fail(res, "রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে", 500);
  }
});

// GET /api/hire/my-requests — আমার পাঠানো রিকোয়েস্ট
router.get("/my-requests", requireAuth, async (req, res) => {
  try {
    const requests = await HireRequest.find({ client: req.user._id })
      .populate("worker", "name photo profile")
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, { data: { requests } });
  } catch (err) {
    return fail(res, "রিকোয়েস্ট লোড করতে সমস্যা হয়েছে", 500);
  }
});

// GET /api/hire/received — আমার পাওয়া রিকোয়েস্ট (কর্মী হিসেবে)
router.get("/received", requireAuth, async (req, res) => {
  try {
    const requests = await HireRequest.find({ worker: req.user._id })
      .populate("client", "name photo email")
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, { data: { requests } });
  } catch (err) {
    return fail(res, "রিকোয়েস্ট লোড করতে সমস্যা হয়েছে", 500);
  }
});

// PATCH /api/hire/:id/status — স্ট্যাটাস আপডেট (শুধু worker বা client)
router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["accepted", "rejected", "completed", "cancelled"];
    if (!allowed.includes(status)) return fail(res, "অবৈধ স্ট্যাটাস");

    const hire = await HireRequest.findById(req.params.id)
      .populate("worker", "name")
      .populate("client", "name");

    if (!hire) return fail(res, "রিকোয়েস্ট পাওয়া যায়নি", 404);

    const isWorker = hire.worker._id.toString() === req.user._id.toString();
    const isClient = hire.client._id.toString() === req.user._id.toString();

    if (!isWorker && !isClient) return fail(res, "অনুমতি নেই", 403);
    if (["accepted", "rejected"].includes(status) && !isWorker) return fail(res, "শুধুমাত্র কর্মী গ্রহণ/প্রত্যাখ্যান করতে পারবেন", 403);
    if (status === "cancelled" && !isClient) return fail(res, "শুধুমাত্র ক্লায়েন্ট বাতিল করতে পারবেন", 403);

    hire.status = status;
    if (status === "completed") {
      hire.completedAt = new Date();
      // Increase hireCount on worker
      await User.findByIdAndUpdate(hire.worker._id, { $inc: { "profile.hireCount": 1 } });
    }
    await hire.save();

    // Notification maps
    const notifMap = {
      accepted:  { userId: hire.client._id, type: "hire_accepted",  title: "রিকোয়েস্ট গৃহীত", message: `${hire.worker.name} আপনার রিকোয়েস্ট গ্রহণ করেছেন ✅` },
      rejected:  { userId: hire.client._id, type: "hire_rejected",  title: "রিকোয়েস্ট প্রত্যাখ্যাত", message: `${hire.worker.name} এই মুহূর্তে কাজ নিতে পারছেন না।` },
      completed: { userId: hire.client._id, type: "hire_completed", title: "কাজ সম্পন্ন", message: `${hire.worker.name} কাজটি সম্পন্ন হিসেবে চিহ্নিত করেছেন। রিভিউ দিন!` },
    };
    if (notifMap[status]) {
      await createNotification({ ...notifMap[status], link: "/dashboard/hire-requests" });
    }

    return ok(res, { data: { hire } }, "স্ট্যাটাস আপডেট হয়েছে");
  } catch (err) {
    return fail(res, "স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে", 500);
  }
});

module.exports = router;
