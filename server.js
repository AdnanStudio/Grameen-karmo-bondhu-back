require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const connectDB = require("./src/config/database");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Connect Database ─────────────────────────────
connectDB();

// ─── Security Middleware ──────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    /\.vercel\.app$/,
  ],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: "অনেক বেশি রিকোয়েস্ট করা হয়েছে। একটু পরে আবার চেষ্টা করুন।" },
});
app.use("/api/", limiter);

// ─── Body Parser ──────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ─── Routes ───────────────────────────────────────
app.use("/api/auth",    require("./src/routes/auth.routes"));
app.use("/api/users",   require("./src/routes/user.routes"));
app.use("/api/workers", require("./src/routes/worker.routes"));
app.use("/api/hire",    require("./src/routes/hire.routes"));
app.use("/api/admin",   require("./src/routes/admin.routes"));
app.use("/api/upload",  require("./src/routes/upload.routes"));

// ─── Health Check ─────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "গ্রামীণ কর্মবন্ধু API সচল আছে ✅", timestamp: new Date() });
});

// ─── 404 Handler ──────────────────────────────────
app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "এই রুটটি পাওয়া যায়নি" });
});

// ─── Global Error Handler ─────────────────────────
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।",
  });
});

app.listen(PORT, () => {
  console.log(`🌱 গ্রামীণ কর্মবন্ধু Backend চালু আছে: http://localhost:${PORT}`);
});
