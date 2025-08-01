// middlewares/ensureDbReady.js
const mongoose = require('mongoose');
const AppError = require('@utils/appError');

module.exports = (req, res, next) => {
  // 1 = connected, 2 = connecting
  if (mongoose.connection.readyState !== 1) {
    return next(
      new AppError('Base de datos inicializando, inténtalo en unos segundos.', 503)
    );
  }
  next();
};
