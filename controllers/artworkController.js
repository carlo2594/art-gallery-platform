// controllers/artworkController.js
const Artwork      = require('@models/artworkModel');
const factory      = require('@utils/handlerFactory');        // para getOne básico si lo necesitas
const catchAsync   = require('@utils/catchAsync');
const AppError     = require('@utils/appError');
const filterObject = require('@utils/filterObject');          // whitelist helper

/* ------------------------------------------------------------------ */
/*  Lectura                                                           */
/* ------------------------------------------------------------------ */

exports.getAllArtworks = catchAsync(async (req, res, next) => {
  const ALLOWED_STATUS = ['draft', 'submitted', 'under_review', 'approved', 'rejected'];
  let filter = { deletedAt: null };                 // <── oculta las obras en papelera

  /* STATUS */
  const statusParam = req.query.status;
  if (statusParam) {
    if (!ALLOWED_STATUS.includes(statusParam))
      return next(new AppError('Invalid status parameter', 400));

    if (statusParam !== 'approved' && req.user?.role !== 'admin')
      return next(new AppError('Not authorized to view this status', 403));

    filter.status = statusParam;
  } else {
    if (req.query.include !== 'all') filter.status = 'approved';
    else if (req.user?.role !== 'admin')
      return next(new AppError('include=all reserved for admin', 403));
  }

  /* Solo mis obras */
  if (req.query.artist === 'my') {
    if (!req.user) return next(new AppError('Must be logged in', 401));
    filter.artist = req.user.id;
  }

  const docs = await Artwork.find(filter).populate('artist exhibitions');

  res.status(200).json({
    status:  'success',
    results: docs.length,
    data:    { artworks: docs }
  });
});

/** GET /api/v1/artworks/:id  (oculta papelera al público) */
exports.getArtwork = catchAsync(async (req, res, next) => {
  const art = await Artwork.findOne({ _id: req.params.id }).populate('artist exhibitions');
  if (!art) return next(new AppError('Artwork not found', 404));

  if (art.deletedAt && req.user?.role !== 'admin')
    return next(new AppError('Artwork is in trash', 404));

  res.status(200).json({ status: 'success', data: { artwork: art } });
});

/* ------------------------------------------------------------------ */
/*  Crear                                                             */
/* ------------------------------------------------------------------ */

exports.createArtwork = catchAsync(async (req, res, next) => {
  req.body.status = 'draft';                              // fuerza borrador
  const allowed = ['title', 'description', 'imageUrl', 'type', 'size', 'material', 'exhibitions', 'status'];
  const data    = filterObject(req.body, ...allowed);

  const artwork = await Artwork.create({ ...data, artist: req.user.id });
  res.status(201).json({ status: 'success', data: { artwork } });
});

/* ------------------------------------------------------------------ */
/*  Actualizar (whitelist, ignora papelera)                            */
/* ------------------------------------------------------------------ */

exports.updateArtwork = catchAsync(async (req, res, next) => {
  const artistAllowed = ['title', 'description', 'imageUrl', 'type', 'size', 'material'];
  const adminAllowed  = [...artistAllowed, 'exhibitions'];
  const allowedFields = req.user.role === 'admin' ? adminAllowed : artistAllowed;

  const dataToUpdate = filterObject(req.body, ...allowedFields);

  if (Object.keys(req.body).some(key => !allowedFields.includes(key)))
    return next(new AppError('Contains forbidden fields', 400));

  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!art) return next(new AppError('Artwork not found or in trash', 404));

  Object.assign(art, dataToUpdate);
  await art.save({ validateModifiedOnly: true });

  res.status(200).json({ status: 'success', data: { artwork: art } });
});

/* ------------------------------------------------------------------ */
/*  Papelera (soft-delete)                                            */
/* ------------------------------------------------------------------ */

/** PATCH /:id/trash  → mueve a papelera (TTL 30 días) */
exports.moveToTrash = catchAsync(async (req, res, next) => {
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!art) return next(new AppError('Artwork not found or already trashed', 404));

  await art.moveToTrash(req.user.id);
  res.status(204).json({ status: 'success' });
});

/** PATCH /:id/restore  → saca de papelera (solo admin) */
exports.restoreArtwork = catchAsync(async (req, res, next) => {
  const art = await Artwork.findById(req.params.id);
  if (!art || !art.deletedAt) return next(new AppError('Artwork not in trash', 400));

  await art.restore();
  res.status(200).json({ status: 'success', data: { artwork: art } });
});

/* ------------------------------------------------------------------ */
/*  Flujo de aprobación                                               */
/* ------------------------------------------------------------------ */

/** PATCH /:id/submit  draft → submitted */
exports.submitArtwork = catchAsync(async (req, res, next) => {
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!art) return next(new AppError('Artwork not found', 404));

  if (!art.artist.equals(req.user.id) && req.user.role !== 'admin')
    return next(new AppError('Not authorized', 403));

  await art.submit();
  res.status(200).json({ status: 'success', data: { artwork: art } });
});

/** PATCH /:id/start-review  submitted → under_review (admin) */
exports.startReview = catchAsync(async (req, res, next) => {
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!art) return next(new AppError('Artwork not found', 404));

  await art.startReview(req.user.id);
  res.status(200).json({ status: 'success', data: { artwork: art } });
});

/** PATCH /:id/approve  under_review → approved (admin) */
exports.approveArtwork = catchAsync(async (req, res, next) => {
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!art) return next(new AppError('Artwork not found', 404));

  await art.approve(req.user.id);
  res.status(200).json({ status: 'success', data: { artwork: art } });
});

/** PATCH /:id/reject  under_review → rejected (admin) */
exports.rejectArtwork = catchAsync(async (req, res, next) => {
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!art) return next(new AppError('Artwork not found', 404));

  await art.reject(req.user.id, req.body.reason);
  res.status(200).json({ status: 'success', data: { artwork: art } });
});
