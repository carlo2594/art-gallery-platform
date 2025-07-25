// routes/viewRoutes.js

const express = require('express');
const router = express.Router();

// Página de inicio
// routes/views/viewRoutes.js


router.get('/', viewsController.getHome);


module.exports = router;
