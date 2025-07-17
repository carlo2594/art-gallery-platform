// utils/sendResponse.js
module.exports = (res, data, message = 'success', statusCode = 200, extra = {}) => {
  res.status(statusCode).json({
    status: 'success',
    message,
    data,
    ...extra
  });
};
