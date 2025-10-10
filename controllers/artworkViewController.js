const ArtworkView = require('@models/artworkViewModel');
const { getClientIp } = require('@utils/request');
const isValidObjectId = require('@utils/isValidObjectId');
const AppError = require('@utils/appError');
const catchAsync = require('@utils/catchAsync');
const sendResponse = require('@utils/sendResponse');

// Create a new artwork view
exports.createView = catchAsync(async (req, res, next) => {
  const { artwork } = req.body || {};
  if (!artwork || !isValidObjectId(artwork)) {
    return next(new AppError('ID de obra inválido.', 400));
  }

  const ip = getClientIp(req);
  const viewDoc = { artwork, ip };
  if (req.user && (req.user._id || req.user.id)) {
    viewDoc.user = req.user._id || req.user.id;
  }

  const view = await ArtworkView.create(viewDoc);
  return sendResponse(res, view, 'Vista registrada.', 201);
});

// Get all views for an artwork
exports.getViewsByArtwork = catchAsync(async (req, res, next) => {
  const { artworkId } = req.params;
  if (!isValidObjectId(artworkId)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  const views = await ArtworkView.find({ artwork: artworkId }).sort({ createdAt: -1 }).lean();
  return sendResponse(res, views, 'Vistas obtenidas.');
});
