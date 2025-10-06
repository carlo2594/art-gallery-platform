
// routes/viewRoutes.js

const express = require('express');
const router = express.Router();
const viewsController = require('@controllers/viewsController');

// =================== PÁGINA DE INICIO ===================
router.get('/', viewsController.getHome);

// =================== AUTENTICACIÓN =====================
router.get('/login', viewsController.getLogin);
router.get('/signup', viewsController.getSignUp);   // alias consistente
router.get('/signUp', viewsController.getSignUp);   // (opcional) mantener compat
router.get('/reset-password', viewsController.getResetPassword);
router.get('/welcome', viewsController.getWelcome);

// =================== QUIÉNES SOMOS =====================
router.get('/about', viewsController.getAbout);

// =================== ARTISTAS ==========================
router.get('/artists', viewsController.getArtistsView);

// =================== OBRAS =============================
router.get('/artworks', viewsController.getArtworks);
router.get('/artworks/:id', viewsController.getArtworkDetail);

// =================== EXPOSICIONES ======================

router.get('/exhibitions', viewsController.getExhibitionsView);

// =================== BÚSQUEDA GLOBAL ===================
router.get('/search', viewsController.getSearchResults);

module.exports = router;
