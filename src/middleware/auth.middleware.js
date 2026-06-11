const admin  = require("../config/firebase-admin");
const User   = require("../models/User");
const { fail } = require("../utils/response");

/**
 * requireAuth — Firebase token যাচাই করে req.user সেট করে
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return fail(res, "অনুমতি নেই। টোকেন পাওয়া যায়নি।", 401);
    }

    const token = authHeader.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(token);

    // MongoDB থেকে user আনো
    const user = await User.findOne({ firebaseUid: decoded.uid });
    if (!user) {
      return fail(res, "ব্যবহারকারী পাওয়া যায়নি। আবার লগইন করুন।", 401);
    }
    if (!user.isActive) {
      return fail(res, "আপনার অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে।", 403);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.code === "auth/id-token-expired") {
      return fail(res, "সেশন মেয়াদোত্তীর্ণ। আবার লগইন করুন।", 401);
    }
    return fail(res, "অবৈধ টোকেন।", 401);
  }
};

/**
 * requireAdmin — admin অথবা superAdmin প্রয়োজন
 */
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin" && req.user?.role !== "superAdmin") {
    return fail(res, "এই কাজের জন্য অ্যাডমিন অনুমতি প্রয়োজন।", 403);
  }
  next();
};

/**
 * requireSuperAdmin — শুধুমাত্র superAdmin পারবে
 */
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "superAdmin") {
    return fail(res, "এই কাজের জন্য সুপার অ্যাডমিন অনুমতি প্রয়োজন।", 403);
  }
  next();
};

module.exports = { requireAuth, requireAdmin, requireSuperAdmin };
