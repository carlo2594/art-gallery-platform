const express = require('express');
const { createLimiter } = require('@middlewares/createLimiter');
const { pdfUploadSingle } = require('@middlewares/uploadPdf');
const requireUser = require('@middlewares/requireUser');
const restrictTo = require('@middlewares/restrictTo');
const artistApplicationController = require('@controllers/artistApplicationController');

const router = express.Router();

const limiter = createLimiter({ windowMs: 15 * 60 * 1000, limit: 5 });

router.post('/', limiter, requireUser, restrictTo('collector'), pdfUploadSingle('resume', 10), artistApplicationController.create);

module.exports = router;
