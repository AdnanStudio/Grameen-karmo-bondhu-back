const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB সংযুক্ত: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ MongoDB সংযোগ ব্যর্থ:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
