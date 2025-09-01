const Favorite = require('@models/favoriteModel');
const catchAsync = require('@utils/catchAsync');
const AppError = require('@utils/appError');
const sendResponse = require('@utils/sendResponse');
const mongoose = require('mongoose');

// Añadir un favorito
exports.addFavorite = catchAsync(async (req, res, next) => {
  const artworkId = req.body.artworkId || req.body.artwork;
  const userId = req.user._id;

  if (!artworkId) {
    return next(new AppError('Debes enviar el ID de la obra', 400));
  }

  // Verifica que la obra exista y no esté eliminada
  const artwork = await require('@models/artworkModel').findById(artworkId);
  if (!artwork) {
    return next(new AppError('La obra no existe', 404));
  }

  // Verifica si ya es favorito
  const alreadyFavorite = await Favorite.findOne({ user: userId, artwork: artworkId });
  if (alreadyFavorite) {
    return next(new AppError('La obra ya está en favoritos', 400));
  }

  const favorite = await Favorite.create({ user: userId, artwork: artworkId });

  sendResponse(res, favorite, 'Artwork added to favorites', 201);
});

// Eliminar un favorito
exports.removeFavorite = catchAsync(async (req, res, next) => {
  const { artworkId } = req.params;
  const userId = req.user._id;

  // Validar formato de ObjectId
  if (!mongoose.Types.ObjectId.isValid(artworkId)) {
    return next(new AppError('ID inválido', 400));
  }

  const result = await Favorite.findOneAndDelete({ user: userId, artwork: artworkId });

  if (!result) {
    return next(new AppError('Favorite not found', 404));
  }

  sendResponse(res, null, 'Artwork removed from favorites', 204);
});

// Obtener los favoritos del usuario autenticado
exports.getMyFavorites = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const favorites = await Favorite.find({ user: userId }).populate('artwork');
const validFavorites = favorites.filter(fav => fav.artwork);
sendResponse(res, { favorites: validFavorites }, 'Favorites retrieved', 200, { results: validFavorites.length });
});

exports.getFavoritesByUser = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const favorites = await Favorite.find({ user: userId })
    .populate({
      path: 'artwork',
      match: { status: 'approved' }
    });

  // Filtra los favoritos cuyo artwork fue populado (status approved)
  const filtered = favorites.filter(fav => fav.artwork);

  sendResponse(res, filtered, 'Favoritos públicos del usuario', 200, {
    results: filtered.length
  });
});
