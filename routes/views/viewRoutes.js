
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

// =================== ARTISTAS ==========================
router.get('/artists', viewsController.getArtistsView);

// =================== OBRAS =============================
router.get('/artworks', viewsController.getArtworks);

// =================== EXPOSICIONES ======================
// Vista de exposiciones públicas (alias en ES y EN)
router.get('/exposiciones', viewsController.getExhibitionsView);
router.get('/exhibitions', viewsController.getExhibitionsView);

// =================== BÚSQUEDA GLOBAL ===================
router.get('/search', viewsController.getSearchResults);

module.exports = router;
