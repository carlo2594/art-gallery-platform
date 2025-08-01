// controllers/ratingController.js
const Rating      = require('@models/ratingViewModel'); // tu modelo de rating
const Artwork     = require('@models/artworkModel');
const catchAsync  = require('@utils/catchAsync');
const AppError    = require('@utils/appError');
const sendResponse = require('@utils/sendResponse');

/* Helper para promedio y conteo */
const recalcArtworkRating = async artworkId => {
  const stats = await Rating.aggregate([
    { $match: { artwork: artworkId } },
    {
      $group: {
        _id: '$artwork',
        count:  { $sum: 1 },
        average:{ $avg: '$rating' }
      }
    }
  ]);

  if (stats.length > 0) {
    await Artwork.findByIdAndUpdate(artworkId, {
      ratings: { count: stats[0].count, average: stats[0].average }
    });
  } else {
    await Artwork.findByIdAndUpdate(artworkId, {
      ratings: { count: 0, average: 0 }
    });
  }
};

/* Crear o actualizar rating (1 × user × artwork) */
exports.upsertRating = catchAsync(async (req, res, next) => {
  const { artworkId, rating } = req.body;
  const userId = req.user._id;

  if (!rating || rating < 1 || rating > 5) {
    return next(new AppError('Rating debe estar entre 1 y 5', 400));
  }

  const ratingDoc = await Rating.findOneAndUpdate(
    { artwork: artworkId, user: userId },
    { rating },
    { new: true, upsert: true, runValidators: true }
  );

  await recalcArtworkRating(artworkId);

  sendResponse(res, ratingDoc, 'Rating guardado', 200);
});

/* Eliminar rating del usuario */
exports.deleteMyRating = catchAsync(async (req, res, next) => {
  const { artworkId } = req.params;
  const userId = req.user._id;

  const deleted = await Rating.findOneAndDelete({ artwork: artworkId, user: userId });
  if (!deleted) return next(new AppError('Rating no encontrado', 404));

  await recalcArtworkRating(artworkId);

  sendResponse(res, null, 'Rating eliminado', 204);
});

/* Obtener ratings de un artwork (público) */
exports.getRatingsByArtwork = catchAsync(async (req, res) => {
  const { artworkId } = req.params;
  const ratings = await Rating.find({ artwork: artworkId }).populate('user', 'name');
  sendResponse(res, { ratings }, 'Ratings retrieved', 200, { results: ratings.length });
});
