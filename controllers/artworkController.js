// controllers/artworkController.js
const Artwork      = require('@models/artworkModel');
const catchAsync   = require('@utils/catchAsync');
const AppError     = require('@utils/appError');
const filterObject = require('@utils/filterObject');
const sendResponse = require('@utils/sendResponse');

const ALLOWED_STATUS = ['draft', 'submitted', 'under_review', 'approved', 'rejected'];

/* ------------------------------------------------------------------ */
/*  Lectura                                                           */
/* ------------------------------------------------------------------ */

exports.getAllArtworks = catchAsync(async (req, res, next) => {
  let filter = { deletedAt: null };

  // STATUS
  const statusParam = req.query.status;
  if (statusParam) {
    if (!ALLOWED_STATUS.includes(statusParam))
      return next(new AppError('Invalid status parameter', 400));

    // Si no es admin, solo puede filtrar por 'approved' o por sus propias obras
    if (
      statusParam !== 'approved' &&
      (!req.user || (req.user.role !== 'admin' && req.query.artist !== 'my'))
    ) {
      return next(new AppError('Not authorized to view this status', 403));
    }

    filter.status = statusParam;
  } else {
    // Por defecto, solo mostrar aprobadas salvo que sea admin o esté pidiendo sus propias obras
    if (req.query.include !== 'all') filter.status = 'approved';
    else if (!req.user || req.user.role !== 'admin')
      return next(new AppError('include=all reserved for admin', 403));
  }

  // Solo mis obras
  if (req.query.artist === 'my') {
    if (!req.user) return next(new AppError('Must be logged in', 401));
    filter.artist = req.user.id;
    // Si no se especifica status, mostrar todas las del usuario
    if (!statusParam) delete filter.status;
  }

  const docs = await Artwork.find(filter).populate('artist exhibitions');
  sendResponse(res, docs, 'Obras encontradas');
});

/** GET /api/v1/artworks/:id  (oculta papelera al público, solo admin o dueño ve no aprobadas) */
exports.getArtwork = catchAsync(async (req, res, next) => {
  const art = await Artwork.findOne({ _id: req.params.id }).populate('artist exhibitions');
  if (!art) return next(new AppError('Artwork not found', 404));

  // Validar status
  if (!ALLOWED_STATUS.includes(art.status)) {
    return next(new AppError('Invalid artwork status', 400));
  }

  // Si está en papelera, solo admin puede verla
  if (art.deletedAt && req.user?.role !== 'admin')
    return next(new AppError('Artwork is in trash', 404));

  // Permitir solo admin, dueño o público si está aprobada
  const isOwner = req.user && art.artist.equals(req.user.id);
  const isAdmin = req.user && req.user.role === 'admin';
  if (!isAdmin && !isOwner && art.status !== 'approved')
    return next(new AppError('No autorizado para ver esta obra', 403));

  sendResponse(res, art, 'Detalle de obra');
});

/* ------------------------------------------------------------------ */
/*  Crear                                                             */
/* ------------------------------------------------------------------ */

exports.createArtwork = catchAsync(async (req, res, next) => {
  req.body.status = 'draft'; // fuerza borrador
  const allowed = ['title', 'description', 'imageUrl', 'type', 'size', 'material', 'exhibitions', 'status'];
  const data    = filterObject(req.body, ...allowed);

  const artwork = await Artwork.create({ ...data, artist: req.user.id });
  sendResponse(res, artwork, 'Obra creada', 201);
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

  sendResponse(res, art, 'Obra actualizada');
});

/* ------------------------------------------------------------------ */
/*  Papelera (soft-delete)                                            */
/* ------------------------------------------------------------------ */

/** PATCH /:id/trash  → mueve a papelera (TTL 30 días) */
exports.moveToTrash = catchAsync(async (req, res, next) => {
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!art) return next(new AppError('Artwork not found or already trashed', 404));

  await art.moveToTrash(req.user.id);
  sendResponse(res, null, 'Obra movida a papelera', 204);
});

/** PATCH /:id/restore  → saca de papelera (solo admin) */
exports.restoreArtwork = catchAsync(async (req, res, next) => {
  const art = await Artwork.findById(req.params.id);
  if (!art || !art.deletedAt) return next(new AppError('Artwork not in trash', 400));

  await art.restore();
  sendResponse(res, art, 'Obra restaurada');
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
  sendResponse(res, art, 'Obra enviada a revisión');
});

/** PATCH /:id/start-review  submitted → under_review (admin) */
exports.startReview = catchAsync(async (req, res, next) => {
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!art) return next(new AppError('Artwork not found', 404));

  await art.startReview(req.user.id);
  sendResponse(res, art, 'Revisión iniciada');
});

/** PATCH /:id/approve  under_review → approved (admin) */
exports.approveArtwork = catchAsync(async (req, res, next) => {
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!art) return next(new AppError('Artwork not found', 404));

  await art.approve(req.user.id);
  sendResponse(res, art, 'Obra aprobada');
});

/** PATCH /:id/reject  under_review → rejected (admin) */
exports.rejectArtwork = catchAsync(async (req, res, next) => {
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!art) return next(new AppError('Artwork not found', 404));

  await art.reject(req.user.id, req.body.reason);
  sendResponse(res, art, 'Obra rechazada');
});

/* ------------------------------------------------------------------ */
/*  Obtener obras por estado                                          */
/* ------------------------------------------------------------------ */

exports.getArtworksByStatus = catchAsync(async (req, res, next) => {
  const { status } = req.params;
  if (!ALLOWED_STATUS.includes(status)) {
    return next(new AppError('Status inválido', 400));
  }
  const artworks = await Artwork.find({ status, deletedAt: null });
  sendResponse(res, artworks, `Obras con status: ${status}`);
});
