const router = require("express").Router();
const { body, validationResult } = require("express-validator");
const admin  = require("../config/firebase-admin");
const User   = require("../models/User");
const { ok, fail } = require("../utils/response");

/**
 * POST /api/auth/login
 * Firebase login → MongoDB এ user তৈরি বা আপডেট করে
 */
router.post(
  "/login",
  [
    body("firebaseUid").notEmpty().withMessage("firebaseUid প্রয়োজন"),
    body("name").notEmpty().withMessage("নাম প্রয়োজন"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return fail(res, "ইনপুট ত্রুটি", 400, errors.array());
    }

    try {
      const { firebaseUid, email, name, photo, provider } = req.body;

      // Upsert user in MongoDB
      let user = await User.findOneAndUpdate(
        { firebaseUid },
        {
          $set: {
            email:     email || "",
            name:      name  || "ব্যবহারকারী",
            photo:     photo || "",
            provider:  provider || "google.com",
            lastLogin: new Date(),
          },
          $setOnInsert: { role: "user" },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return ok(res, { data: { user } }, "সফলভাবে লগইন হয়েছেন");
    } catch (err) {
      console.error("Login error:", err);
      return fail(res, "লগইন করতে সমস্যা হয়েছে", 500);
    }
  }
);

module.exports = router;
