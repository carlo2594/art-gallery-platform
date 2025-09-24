
// routes/viewRoutes.js

const express = require('express');
const router = express.Router();
const viewsController = require('@controllers/viewsController'); 

// Búsqueda global
router.get('/search', viewsController.getSearchResults);



// Página de inicio de sesión
router.get('/login', viewsController.getLogin);

router.get('/signup', viewsController.getSignUp);  // alias consistente
router.get('/signUp', viewsController.getSignUp);  // (opcional) mantener compat


// Vista para reset password (antes de otras rutas)
router.get('/reset-password', viewsController.getResetPassword);

router.get('/welcome', viewsController.getWelcome);

router.get('/artworks', viewsController.getArtworks);


// Página de inicio
router.get('/', viewsController.getHome);

module.exports = router;
