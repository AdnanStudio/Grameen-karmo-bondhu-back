const Notification = require("../models/Notification");

const createNotification = async ({ userId, type, title, message, link = "", meta = {} }) => {
  try {
    await Notification.create({ user: userId, type, title, message, link, meta });
  } catch (err) {
    console.error("Notification create error:", err.message);
  }
};

module.exports = { createNotification };
