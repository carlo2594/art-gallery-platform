// routes/viewRoutes.js

const express = require('express');
const router = express.Router();

// Página de inicio
router.get('/', (req, res) => {
  res.render('index', {
    title: 'Galería del Ox',
  });
});

module.exports = router;
