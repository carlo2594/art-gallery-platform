const express = require('express');
const artworkController = require('@controllers/artworkController');
const requireUser = require('@middlewares/requireUser');
const isOwner = require('@middlewares/isOwner');
const Artwork = require('@models/artworkModel');

const router = express.Router();

router.get('/', artworkController.getAllArtworks);
router.get('/:id', artworkController.getArtwork);

router.post('/', requireUser, artworkController.createArtwork);
router.patch('/:id', requireUser, isOwner(Artwork, 'artist'), artworkController.updateArtwork);
router.delete('/:id', requireUser, isOwner(Artwork, 'artist'), artworkController.deleteArtwork);

module.exports = router;
