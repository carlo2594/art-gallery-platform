const express = require('express');
const followController = require('@controllers/followController');
const requireUser = require('@middlewares/requireUser');

const router = express.Router();

// Público: obtener conteo y lista (opcional) de seguidores por artista
router.get('/artist/:artistId', followController.getArtistFollowers);

// Protegidas
router.use(requireUser);

router
  .route('/')
  .post(followController.followArtist);

router
  .route('/me')
  .get(followController.getMyFollowing);

router
  .route('/:artistId')
  .delete(followController.unfollowArtist);

module.exports = router;

