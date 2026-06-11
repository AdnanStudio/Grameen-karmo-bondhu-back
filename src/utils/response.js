/**
 * সফল রেসপন্স পাঠায়
 */
const ok = (res, data = {}, message = "সফল", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...data,
  });
};

/**
 * এরর রেসপন্স পাঠায়
 */
const fail = (res, message = "সমস্যা হয়েছে", statusCode = 400, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

module.exports = { ok, fail };
