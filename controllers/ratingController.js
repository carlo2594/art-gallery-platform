// controllers/ratingController.js
const Rating      = require('@models/ratingViewModel'); // tu modelo de rating
const Artwork     = require('@models/artworkModel');
const catchAsync  = require('@utils/catchAsync');
const AppError    = require('@utils/appError');
const sendResponse = require('@utils/sendResponse');
const mongoose = require('mongoose'); // Agrega esto arriba

/* Helper para promedio y conteo */
const recalcArtworkRating = async artworkId => {
  const objectId = typeof artworkId === 'string' ? new mongoose.Types.ObjectId(artworkId) : artworkId;
  const stats = await Rating.aggregate([
    { $match: { artwork: objectId } },
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
  // Permite artworkId o artwork
  const artworkId = req.body.artworkId || req.body.artwork;
  const { rating } = req.body;
  const userId = req.user._id;

  if (typeof artworkId === 'undefined' || typeof rating === 'undefined') {
    return next(new AppError('El body debe incluir los campos artworkId (o artwork) y rating', 400));
  }

  const parsedRating = Number(rating);

  if (
    !Number.isInteger(parsedRating) ||
    parsedRating < 1 ||
    parsedRating > 5
  ) {
    return next(new AppError('Rating debe ser un número entero entre 1 y 5', 400));
  }

  const ratingDoc = await Rating.findOneAndUpdate(
    { artwork: artworkId, user: userId },
    { rating: parsedRating },
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
