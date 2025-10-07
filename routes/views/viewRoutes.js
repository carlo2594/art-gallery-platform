
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
router.get('/artists/:id', viewsController.getArtistDetail);

// =================== OBRAS =============================
router.get('/artworks', viewsController.getArtworks);
router.get('/artworks/:id', viewsController.getArtworkDetail);

// =================== EXPOSICIONES ======================

router.get('/exhibitions', viewsController.getExhibitionsView);

// =================== BÚSQUEDA GLOBAL ===================
router.get('/search', viewsController.getSearchResults);

// =================== GESTIÓN DE VENTAS (Admin) =========
// TODO: Implementar estos controladores en viewsController.js
// router.get('/admin/sales', viewsController.getSalesManagement);
// router.get('/admin/sales/:id', viewsController.getSaleDetail);

module.exports = router;
