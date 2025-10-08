const express = require('express');
const newsletterController = require('@controllers/newsletterController');
const requireUser = require('@middlewares/requireUser');
const restrictTo = require('@middlewares/restrictTo');
const rateLimiter = require('@middlewares/rateLimiter');

const router = express.Router();

// Público
router.post('/subscribe', rateLimiter, newsletterController.subscribe);
router.get('/unsubscribe/:token', newsletterController.unsubscribe);

// Admin solamente
router.use(requireUser);
router.use(restrictTo('admin'));

router.get('/stats', newsletterController.getStats);
router.get('/subscribers', newsletterController.getSubscribers);

module.exports = router;