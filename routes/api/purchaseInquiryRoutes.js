const express = require('express');
const rateLimit = require('express-rate-limit');
const requireUser = require('@middlewares/requireUser');
const purchaseInquiryController = require('@controllers/purchaseInquiryController');

const router = express.Router();

// Limitar consultas para evitar spam
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/', limiter, requireUser, purchaseInquiryController.submit);

module.exports = router;

