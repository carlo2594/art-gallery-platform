const express = require('express');
const authController = require('@controllers/authController');
const requireUser = require('@middlewares/requireUser');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', requireUser, authController.logout); // opcional proteger

module.exports = router;
