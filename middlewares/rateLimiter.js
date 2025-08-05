// middlewares/rateLimiter.js
const rateLimit = require('express-rate-limit');

/**
 * Limita a 100 peticiones cada 15 minutos por IP.
 * Cambia max / windowMs según tus necesidades.
 */
module.exports = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,                 // 100 peticiones
  message: {
    status: 'fail',
    message: 'Demasiados intentos, inténtalo de nuevo en 15 minutos.'
  },
  standardHeaders: true,    // RateLimit-* headers
  legacyHeaders: false
});
