// middlewares/createLimiter.js
const rateLimit = require('express-rate-limit');

/**
 * Factory para crear limitadores por ruta.
 * Ejemplo: createLimiter({ windowMs: 15*60*1000, limit: 5 })
 */
function createLimiter(opts = {}) {
  const windowMs = Number(opts.windowMs || (15 * 60 * 1000));
  const limit = Number(opts.limit || 100);
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false
  });
}

module.exports = { createLimiter };

