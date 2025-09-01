const express = require('express');
const router = express.Router();
const artworkViewController = require('@controllers/artworkViewController');

// POST /api/v1/artwork-views
router.post('/', artworkViewController.createView);

// GET /api/v1/artwork-views/:artworkId
router.get('/:artworkId', artworkViewController.getViewsByArtwork);

module.exports = router;