// routes/api/ratingRoutes.js
const express         = require('express');
const ratingController = require('@controllers/ratingController');
const requireUser     = require('@middlewares/requireUser');

const router = express.Router();

// Ratings de un artwork (público)
router.get('/:artworkId', ratingController.getRatingsByArtwork);

// Crear/actualizar rating (auth)
router.post('/', requireUser, ratingController.upsertRating);

// Eliminar mi rating
router.delete('/:artworkId', requireUser, ratingController.deleteMyRating);

module.exports = router;
