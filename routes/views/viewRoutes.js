// routes/viewRoutes.js

const express = require('express');
const router = express.Router();
const viewsController = require('@controllers/viewsController'); // ✅ import necesario

// Página de inicio
router.get('/', viewsController.getHome);

module.exports = router;
