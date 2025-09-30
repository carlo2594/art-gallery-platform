const Exhibition = require('@models/exhibitionModel');
const Artwork = require('@models/artworkModel');
const factory = require('@utils/handlerFactory');
const arrayUnique = require('@utils/arrayUnique');
const isValidObjectId = require('@utils/isValidObjectId');
const catchAsync = require('@utils/catchAsync');
const AppError = require('@utils/appError');

exports.getAllExhibitions = factory.getAll(Exhibition);
exports.getExhibition = factory.getOne(Exhibition, { path: 'createdBy participants' });
exports.createExhibition = (req, res, next) => {
  if (req.user && req.user._id) {
    req.body.createdBy = req.user._id;
  }
  return factory.createOne(Exhibition)(req, res, next);
};
exports.updateExhibition = factory.updateOne(Exhibition);
exports.deleteExhibition = factory.deleteOne(Exhibition);

// PATCH /exhibitions/:id/add-artwork
exports.addArtwork = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { artworkId } = req.body;
  if (!isValidObjectId(id) || !isValidObjectId(artworkId)) {
    return next(new AppError('ID inválido.', 400));
  }
  const exhibition = await Exhibition.findById(id);
  if (!exhibition) return next(new AppError('Exposición no encontrada.', 404));
  const artwork = await Artwork.findById(artworkId);
  if (!artwork) return next(new AppError('Obra no encontrada.', 404));

  // Agrega la obra a la exposición (sin duplicados)
  exhibition.artworks = arrayUnique([...(exhibition.artworks || []), artworkId]);
  await exhibition.save();
  // Agrega la exposición a la obra (sin duplicados)
  artwork.exhibitions = arrayUnique([...(artwork.exhibitions || []), id]);
  await artwork.save();

  res.status(200).json({ status: 'success', message: 'Obra agregada a la exposición.', exhibition });
});

// PATCH /exhibitions/:id/remove-artwork
exports.removeArtwork = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { artworkId } = req.body;
  if (!isValidObjectId(id) || !isValidObjectId(artworkId)) {
    return next(new AppError('ID inválido.', 400));
  }
  const exhibition = await Exhibition.findById(id);
  if (!exhibition) return next(new AppError('Exposición no encontrada.', 404));
  const artwork = await Artwork.findById(artworkId);
  if (!artwork) return next(new AppError('Obra no encontrada.', 404));

  // Quita la obra de la exposición
  exhibition.artworks = (exhibition.artworks || []).filter(a => String(a) !== String(artworkId));
  await exhibition.save();
  // Quita la exposición de la obra
  artwork.exhibitions = (artwork.exhibitions || []).filter(e => String(e) !== String(id));
  await artwork.save();

  res.status(200).json({ status: 'success', message: 'Obra removida de la exposición.', exhibition });
});
