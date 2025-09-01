const express = require('express');
const favoriteController = require('@controllers/favoriteController');
const requireUser = require('@middlewares/requireUser');
const Favorite = require('@models/favoriteModel');

const router = express.Router();

// Ruta pública: favoritos de un usuario (solo artworks con status 'approved')
router.get('/user/:userId', favoriteController.getFavoritesByUser);

// Proteger todas las rutas siguientes con requireUser
router.use(requireUser);

router
  .route('/')
  .get(favoriteController.getMyFavorites)
  .post(favoriteController.addFavorite);

router
  .route('/:artworkId')
  .delete(favoriteController.removeFavorite); // Quita isOwner, no es necesario aquí

module.exports = router;
