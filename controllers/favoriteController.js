const Favorite = require('@models/favoriteModel');
const catchAsync = require('@utils/catchAsync');
const AppError = require('@utils/appError');
const sendResponse = require('@utils/sendResponse');

// Añadir un favorito
exports.addFavorite = catchAsync(async (req, res, next) => {
  const { artworkId } = req.body;
  const userId = req.user._id;

  const favorite = await Favorite.create({ user: userId, artwork: artworkId });

  sendResponse(res, favorite, 'Artwork added to favorites', 201);
});

// Eliminar un favorito
exports.removeFavorite = catchAsync(async (req, res, next) => {
  const { artworkId } = req.params;
  const userId = req.user._id;

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

  sendResponse(res, { favorites }, 'Favorites retrieved', 200, { results: favorites.length });
});


exports.getFavoritesByUser = catchAsync(async (req, res, next) => {
  const { id: userId } = req.params;

  const favorites = await Favorite.find({ user: userId }).populate('artwork');

  sendResponse(res, { favorites }, 'Public favorites retrieved', 200, {
    results: favorites.length
  });
});
