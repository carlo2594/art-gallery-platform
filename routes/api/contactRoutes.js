const express = require('express');
const rateLimit = require('express-rate-limit');
const contactController = require('@controllers/contactController');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/', limiter, contactController.submit);

module.exports = router;

