const express      = require('express');
const authController = require('@controllers/authController');
const requireUser  = require('@middlewares/requireUser');
const rateLimiter  = require('@middlewares/rateLimiter');   // ⬅️ nuevo (100 req/15 min)

const router = express.Router();

/* --- Auth --- */
router.post('/signup', rateLimiter, authController.signup); // también limita flood
router.post('/login',  rateLimiter, authController.login);
router.post('/logout', requireUser, authController.logout); // token requerido para borrar cookie
router.post('/password/forgot', authController.forgotPassword);
router.post('/password/reset', authController.resetPassword);

module.exports = router;
