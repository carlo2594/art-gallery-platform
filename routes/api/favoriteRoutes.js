const express = require('express');
const favoriteController = require('@controllers/favoriteController');
const requireUser = require('@middlewares/requireUser');

const router = express.Router();


// Proteger todas las rutas con requireUser
router.use(requireUser);

router
  .route('/')
  .get(favoriteController.getMyFavorites)
  .post(favoriteController.addFavorite);

router
  .route('/:artworkId')
  .delete(favoriteController.removeFavorite);

module.exports = router;
