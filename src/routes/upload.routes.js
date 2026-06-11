const router     = require("express").Router();
const multer     = require("multer");
const cloudinary = require("../config/cloudinary");
const { requireAuth } = require("../middleware/auth.middleware");
const User       = require("../models/User");
const { ok, fail } = require("../utils/response");

// Multer — memory storage (Cloudinary-তে সরাসরি পাঠাব)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("শুধুমাত্র JPG, PNG বা WebP ছবি আপলোড করা যাবে"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

/**
 * Stream buffer to Cloudinary
 */
const uploadToCloudinary = (buffer, folder, publicId) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        overwrite: true,
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

// POST /api/upload/profile — প্রোফাইল ছবি আপলোড
router.post(
  "/profile",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) return fail(res, "ছবি পাওয়া যায়নি");

      const publicId = `grameen-karmobondhu/profiles/${req.user._id}`;
      const result = await uploadToCloudinary(req.file.buffer, "grameen-karmobondhu/profiles", req.user._id.toString());

      // DB-তে photo URL আপডেট করো
      await User.findByIdAndUpdate(req.user._id, { photo: result.secure_url });

      return ok(
        res,
        { data: { url: result.secure_url, publicId: result.public_id } },
        "ছবি আপলোড হয়েছে ✅"
      );
    } catch (err) {
      console.error("Upload error:", err);
      return fail(res, err.message || "ছবি আপলোড করতে সমস্যা হয়েছে", 500);
    }
  }
);

// POST /api/upload/portfolio — পোর্টফোলিও ছবি আপলোড
router.post(
  "/portfolio",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) return fail(res, "ছবি পাওয়া যায়নি");

      const ts = Date.now();
      const result = await uploadToCloudinary(
        req.file.buffer,
        "grameen-karmobondhu/portfolio",
        `${req.user._id}_${ts}`
      );

      return ok(res, { data: { url: result.secure_url } }, "পোর্টফোলিও ছবি আপলোড হয়েছে ✅");
    } catch (err) {
      return fail(res, err.message || "আপলোড করতে সমস্যা হয়েছে", 500);
    }
  }
);

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return fail(res, "ছবির সাইজ ৫MB এর বেশি হতে পারবে না");
    }
  }
  return fail(res, err.message || "আপলোড সমস্যা", 400);
});

module.exports = router;
