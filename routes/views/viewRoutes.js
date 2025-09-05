// routes/viewRoutes.js

const express = require('express');
const router = express.Router();
const viewsController = require('@controllers/viewsController'); 



// Página de inicio de sesión
router.get('/login', viewsController.getLogin);
router.get('/signin', viewsController.getSignIn);

// Vista para reset password (antes de otras rutas)
router.get('/reset-password', viewsController.getResetPassword);

// Página de inicio
router.get('/', viewsController.getHome);

module.exports = router;
