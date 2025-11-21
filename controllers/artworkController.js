// =======================
// IMPORTS Y CONSTANTES
// =======================
const AppError = require('@utils/appError');
const filterObject = require('@utils/filterObject');
const sendResponse = require('@utils/sendResponse');
const { sendMail } = require('@services/mailer');
const { upload, deleteImage } = require('@utils/cloudinaryImage');
const Artwork = require('@models/artworkModel');
const arrayUnique = require('@utils/arrayUnique');
const isValidObjectId = require('@utils/isValidObjectId');
const catchAsync = require('@utils/catchAsync');
const { toCentsOrThrow } = require('@utils/priceInput');
const { getInvalidFields, isEmptyBody } = require('@utils/validation');
// Reglas de proporción deshabilitadas: utilidades no-op para compatibilidad
const verifyAspect = () => ({ ok: true });
const buildTransformedUrl = (secureUrl) => secureUrl;
const getAspectPolicy = () => 'none';
const buildAspectErrorPayload = () => ({ code: 'ASPECT_VALIDATION_DISABLED' });

const ALLOWED_STATUS = ['draft', 'submitted', 'approved', 'rejected'];


// =======================
// HELPERS
// =======================
function checkAlreadyInStatus(res, art, status, mensaje) {
  // Allow idempotent state changes: never block
  return false;
}

// moved to @utils/priceInput


// =======================
// PATCH /:id/start-review  submitted → (no-op, solo marca revisor)
// =======================
exports.startReview = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null }).populate('artist');
  if (!art) return next(new AppError('Obra no encontrada.', 404));

  // Mantener estado "submitted"; solo marca quién inicia revisión
  art.review = { reviewedBy: req.user.id };
  await art.save();
  
  // Notificar al artista que su obra fue tomada para revisión
  if (art.artist && art.artist.email) {
    const { artworkStatusSubject, artworkStatusText } = require('@services/emailTemplates');
    await sendMail({
      to: art.artist.email,
      subject: artworkStatusSubject('submitted'),
      text: artworkStatusText({ status: 'submitted', artistName: art.artist.name, artworkTitle: art.title })
    });
  }
  
  sendResponse(res, art, 'La revisión de la obra ha iniciado.');
});

// =======================
// PATCH /:id/approve  under_review → approved (admin)
// =======================
exports.approveArtwork = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null }).populate('artist');
  if (!art) return next(new AppError('Obra no encontrada.', 404));

  if (art.status === 'approved') {
    return res.status(400).json({ status: 'fail', message: 'La obra ya está aprobada.' });
  }

  // Validar que tenga campos mínimos antes de aprobar
  const missing = [];
  if (!art.imageUrl) missing.push('imageUrl');
  if (!Number.isFinite(art.width_cm)) missing.push('width_cm');
  if (!Number.isFinite(art.height_cm)) missing.push('height_cm');
  if (!Number.isFinite(art.price_cents)) missing.push('price_cents');
  if (missing.length) {
    return res.status(400).json({
      status: 'fail',
      message: 'Faltan campos requeridos para aprobar la obra.',
      missing
    });
  }

  art.status = 'approved';
  art.review = { reviewedBy: req.user.id, reviewedAt: new Date() };
  await art.save();

  // Notificar al artista que su obra fue aprobada
  if (art.artist && art.artist.email) {
    const { artworkStatusSubject, artworkStatusText } = require('@services/emailTemplates');
    await sendMail({
      to: art.artist.email,
      subject: artworkStatusSubject('approved'),
      text: artworkStatusText({ status: 'approved', artistName: art.artist.name, artworkTitle: art.title })
    });
  }

  sendResponse(res, art, 'La obra fue aprobada.');
});

// =======================
// PATCH /:id/reject  under_review → rejected (admin)
// =======================
exports.rejectArtwork = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null }).populate('artist');
  if (!art) return next(new AppError('Obra no encontrada.', 404));

  if (art.status === 'rejected') {
    return res.status(400).json({ status: 'fail', message: 'La obra ya está rechazada.' });
  }

  if (!req.body.reason || typeof req.body.reason !== 'string' || req.body.reason.trim() === '') {
    return next(new AppError('Debes especificar el motivo del rechazo.', 400));
  }

  art.status = 'rejected';
  art.review = { reviewedBy: req.user.id, reviewedAt: new Date(), rejectReason: req.body.reason };
  await art.save();

  // Notificar al artista que su obra fue rechazada
  if (art.artist && art.artist.email) {
    const { artworkStatusSubject, artworkStatusText } = require('@services/emailTemplates');
    await sendMail({
      to: art.artist.email,
      subject: artworkStatusSubject('rejected'),
      text: artworkStatusText({ status: 'rejected', artistName: art.artist.name, artworkTitle: art.title, reason: req.body.reason })
    });
  }

  sendResponse(res, art, 'La obra fue rechazada.');
});

/* ------------------------------------------------------------------ */
/*  Disponibilidad y Ventas                                           */
/* ------------------------------------------------------------------ */

// PATCH /:id/mark-sold - Marcar obra como vendida (admin)
exports.markArtworkSold = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido', 400));
  }

  const artwork = await Artwork.findOne({ _id: req.params.id, deletedAt: null }).populate('artist');
  if (!artwork) {
    return next(new AppError('Obra no encontrada', 404));
  }

  if (artwork.availability === 'sold') {
    return next(new AppError('La obra ya está marcada como vendida', 400));
  }

  const saleData = {
    price_cents: req.body.price_cents,
    currency: req.body.currency,
    buyerName: req.body.buyerName,
    buyerEmail: req.body.buyerEmail,
    channel: req.body.channel,
    orderId: req.body.orderId
  };

  await artwork.markSold(saleData);

  if (artwork.artist && artwork.artist.email) {
    try {
      await sendMail({
        to: artwork.artist.email,
        subject: `¡Tu obra "${artwork.title}" ha sido vendida!`,
        text: `Hola ${artwork.artist.name},\n\nTe informamos que tu obra "${artwork.title}" ha sido vendida exitosamente.\n\nFelicidades por esta venta.\n\nSaludos,\nEquipo Galería del Ox`
      });
    } catch (emailError) {
      console.error('Error enviando email de venta:', emailError);
    }
  }

  sendResponse(res, artwork, 'Obra marcada como vendida correctamente.');
});

// PATCH /:id/reserve - Reservar obra (admin)
exports.reserveArtwork = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido', 400));
  }

  const artwork = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!artwork) {
    return next(new AppError('Obra no encontrada', 404));
  }

  if (artwork.availability === 'reserved') {
    return next(new AppError('La obra ya está reservada', 400));
  }
  if (artwork.availability === 'sold') {
    return next(new AppError('No se puede reservar una obra vendida', 400));
  }

  const reserveUntil = req.body.reservedUntil ? new Date(req.body.reservedUntil) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await artwork.reserve(reserveUntil);
  sendResponse(res, artwork, 'Obra reservada correctamente.');
});

// PATCH /:id/unreserve - Quitar reserva (admin)
exports.unreserveArtwork = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido', 400));
  }
  const artwork = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!artwork) {
    return next(new AppError('Obra no encontrada', 404));
  }
  if (artwork.availability !== 'reserved') {
    return next(new AppError('La obra no está reservada', 400));
  }
  await artwork.unreserve();
  sendResponse(res, artwork, 'Reserva removida correctamente.');
});

// PATCH /:id/not-for-sale - Marcar como no disponible para venta (admin)
exports.setNotForSale = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido', 400));
  }
  const artwork = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!artwork) {
    return next(new AppError('Obra no encontrada', 404));
  }
  await artwork.setNotForSale();
  sendResponse(res, artwork, 'Obra marcada como no disponible para venta.');
});

// PATCH /:id/on-loan - Marcar como en préstamo (admin)
exports.setOnLoan = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido', 400));
  }
  const artwork = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!artwork) {
    return next(new AppError('Obra no encontrada', 404));
  }
  await artwork.setOnLoan();
  sendResponse(res, artwork, 'Obra marcada como en préstamo.');
});

// PATCH /:id/for-sale - Volver a poner en venta (admin)
exports.setForSale = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido', 400));
  }
  const artwork = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!artwork) {
    return next(new AppError('Obra no encontrada', 404));
  }
  if (artwork.availability === 'sold') {
    return next(new AppError('No se puede poner en venta una obra vendida', 400));
  }
  artwork.availability = 'for_sale';
  artwork.reservedUntil = undefined;
  await artwork.save();
  sendResponse(res, artwork, 'Obra puesta en venta correctamente.');
});




/* ------------------------------------------------------------------ */
/*  Lectura                                                           */
/* ------------------------------------------------------------------ */

exports.getAllArtworks = catchAsync(async (req, res, next) => {
  let filter = { deletedAt: null };

  const statusParam = req.query.status;
  if (statusParam) {
    if (!ALLOWED_STATUS.includes(statusParam))
      return next(new AppError('El parámetro de estado es inválido.', 400));

    if (
      statusParam !== 'approved' &&
      (!req.user || (req.user.role !== 'admin' && req.query.artist !== 'my'))
    ) {
      return next(new AppError('No tienes autorización para ver este estado.', 403));
    }

    filter.status = statusParam;
  } else {
    if (req.query.include !== 'all') filter.status = 'approved';
    else if (!req.user || req.user.role !== 'admin')
      return next(new AppError('El parámetro include=all es solo para administradores.', 403));
  }

  if (req.query.artist === 'my') {
    if (!req.user) return next(new AppError('Debes iniciar sesión.', 401));
    filter.artist = req.user.id;
    if (!statusParam) delete filter.status;
  }


  // Filtros normalizados
  const normArr = a => (Array.isArray(a) ? a : a ? [a] : []).map(norm);
  if (req.query.type)      filter.type_norm      = { $in: normArr(req.query.type) };
  if (req.query.technique) filter.technique_norm = { $in: normArr(req.query.technique) };

  // Filtro por precio (acepta minPrice/maxPrice en USD o minPriceCents/maxPriceCents)
  const priceFilter = {};
  const hasMinUSD = req.query.minPrice !== undefined;
  const hasMaxUSD = req.query.maxPrice !== undefined;
  const hasMinCts = req.query.minPriceCents !== undefined;
  const hasMaxCts = req.query.maxPriceCents !== undefined;

  if (hasMinUSD)  priceFilter.$gte = Math.max(0, Math.round(Number(String(req.query.minPrice).replace(/[$,\s]/g, '')) * 100));
  if (hasMaxUSD)  priceFilter.$lte = Math.max(0, Math.round(Number(String(req.query.maxPrice).replace(/[$,\s]/g, '')) * 100));
  if (hasMinCts)  priceFilter.$gte = Math.max(0, parseInt(req.query.minPriceCents, 10));
  if (hasMaxCts)  priceFilter.$lte = Math.max(0, parseInt(req.query.maxPriceCents, 10));

  if (Object.keys(priceFilter).length) {
    filter.price_cents = priceFilter;
  }

  const docs = await Artwork.find(filter).populate('artist exhibitions');
  sendResponse(res, docs, 'Obras encontradas.');
});

exports.getArtwork = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  const art = await Artwork.findOne({ _id: req.params.id }).populate('artist exhibitions');
  if (!art) return next(new AppError('Obra no encontrada.', 404));

  // Validar status
  if (!ALLOWED_STATUS.includes(art.status)) {
    return next(new AppError('Estado de la obra inválido.', 400));
  }

  sendResponse(res, art, 'Detalle de la obra.');
});

/* ------------------------------------------------------------------ */
/*  Crear                                                             */
/* ------------------------------------------------------------------ */

exports.createArtwork = catchAsync(async (req, res, next) => {
  req.body.status = 'draft'; // fuerza borrador
  const draftOnly = (() => {
    try {
      const raw = String(req.body._draftOnly || req.body.mode || '').toLowerCase();
      return raw === '1' || raw === 'true' || raw === 'draft';
    } catch (_) { return false; }
  })();
  try { delete req.body._draftOnly; delete req.body.mode; } catch (_) {}

  // Permitimos amount (USD) o price_cents (entero)
  const allowed = [
    'title', 'description', 'type', 'width_cm', 'height_cm', 'technique',
    'exhibitions', 'status', 'amount', 'price_cents', 'images', 'completedAt'
  ];
  // Permitir que admin indique el artista destino
  if (req.user && req.user.role === 'admin') allowed.push('artist');

  if (!draftOnly && isEmptyBody(req.body)) {
    return res.status(400).json({
      status: 'fail',
      error: { code: 'INVALID_BODY', message: 'El cuerpo de la solicitud no puede estar vacío.' }
    });
  }

  const invalidFields = getInvalidFields(req.body, allowed);
  if (invalidFields.length > 0) {
    return res.status(400).json({
      status: 'fail',
      error: { code: 'INVALID_FIELDS', message: `Campos no permitidos: ${invalidFields.join(', ')}` }
    });
  }

  if (!('title' in req.body) || typeof req.body.title !== 'string' || req.body.title.trim() === '') {
    return res.status(400).json({
      status: 'fail',
      error: { code: 'INVALID_TITLE', message: 'El campo "title" es obligatorio.' }
    });
  }

  if (!draftOnly) {
    if (!req.file && (!req.body.images || req.body.images.length === 0)) {
      return res.status(400).json({
        status: 'fail',
        error: { code: 'NO_IMAGE', message: 'Debes subir al menos una imagen.' }
      });
    }
  }

  if (!draftOnly) {
  // Precio: primero intentamos amount (USD), si no viene usamos price_cents
  let priceCents;
  if (req.body.amount !== undefined && req.body.amount !== null && req.body.amount !== '') {
    priceCents = toCentsOrThrow(req.body.amount, 'amount');
  } else if (req.body.price_cents !== undefined) {
    const parsed = parseInt(req.body.price_cents, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return next(new AppError('"price_cents" debe ser un entero no negativo.', 400));
    }
    priceCents = parsed;
  } else {
    return next(new AppError('Debes especificar el precio (amount en USD o price_cents).', 400));
  }
  }

  // Sube la imagen principal a Cloudinary
  let imageResult = null;
  if (req.file) {
    if (req.file.path) {
      imageResult = await upload(req.file.path);
    } else if (req.file.buffer) {
      const { uploadBuffer } = require('@utils/cloudinaryImage');
      imageResult = await uploadBuffer(req.file.buffer);
    }
  }
  const widthCm = (req.body.width_cm !== undefined && req.body.width_cm !== '') ? Number(req.body.width_cm) : undefined;
  const heightCm = (req.body.height_cm !== undefined && req.body.height_cm !== '') ? Number(req.body.height_cm) : undefined;
  const imgW = imageResult ? imageResult.width : undefined;
  const imgH = imageResult ? imageResult.height : undefined;

  // Validar dimensiones (obligatorio solo si no es borrador)
  if (!draftOnly) {
    if (!isFinite(widthCm) || !isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
      return res.status(400).json({
        status: 'fail',
        error: { code: 'INVALID_DIMENSIONS', message: 'Las dimensiones declaradas deben ser mayores a cero y finitas.' }
      });
    }
  }

  let imageUrlToSave = imageResult ? imageResult.secure_url : (req.body.images && req.body.images[0]);
  let imagePublicId = imageResult ? imageResult.public_id : undefined;
  let imageWidth_px = imgW;
  let imageHeight_px = imgH;

  // Sin validación de aspecto: usamos secure_url tal cual

  const data = filterObject(req.body, ...allowed);
  // Normalizar completedAt si viene como string (YYYY-MM-DD)
  if (typeof data.completedAt === 'string') {
    if (data.completedAt.trim() === '') {
      delete data.completedAt;
    } else {
      const d = new Date(data.completedAt);
      if (isNaN(d.getTime())) {
        delete data.completedAt;
      } else {
        data.completedAt = d;
      }
    }
  }
  // Asignar artista: si es admin y envía artist válido, usarlo; si no, usar el propio
  if (req.user && req.user.role === 'admin' && req.body && req.body.artist) {
    const isValidObjectId = require('@utils/isValidObjectId');
    if (!isValidObjectId(req.body.artist)) {
      return next(new AppError('ID de artista inválido.', 400));
    }
    data.artist = req.body.artist;
  } else {
    data.artist = req.user.id;
  }
  // Límite de borradores por artista
  try {
    const MAX_DRAFTS = parseInt(process.env.MAX_DRAFTS_PER_ARTIST || '10', 10);
    const draftsCount = await Artwork.countDocuments({ artist: data.artist, status: 'draft', deletedAt: null });
    if (Number.isFinite(MAX_DRAFTS) && draftsCount >= MAX_DRAFTS) {
      return res.status(429).json({
        status: 'fail',
        error: { code: 'MAX_DRAFTS_REACHED', message: `Has alcanzado el límite de ${MAX_DRAFTS} borradores. Elimina algún borrador o edita uno existente.` }
      });
    }
  } catch (_) {}
  if (imageUrlToSave) data.imageUrl = imageUrlToSave;
  if (imagePublicId)  data.imagePublicId = imagePublicId;
  if (imageWidth_px)  data.imageWidth_px = imageWidth_px;
  if (imageHeight_px) data.imageHeight_px = imageHeight_px;
  if (typeof priceCents === 'number') data.price_cents = priceCents; // <-- guarda el precio en centavos si vino

  // Si se subieron imágenes adicionales, guárdalas en el array images
  if (req.body.images && Array.isArray(req.body.images)) {
    data.images = arrayUnique([imageUrlToSave, ...req.body.images.filter(Boolean)]);
  } else if (imageUrlToSave) {
    data.images = [imageUrlToSave];
  }

  const artwork = await Artwork.create(data);
  sendResponse(res, artwork, 'Obra creada correctamente.', 201);
});

/* ------------------------------------------------------------------ */
/*  Actualizar (whitelist, ignora papelera)                            */
/* ------------------------------------------------------------------ */

exports.updateArtwork = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }

  // Normalizar completedAtYear (legacy del wizard)
  if (Object.prototype.hasOwnProperty.call(req.body, 'completedAtYear')) {
    const yearNum = Number(req.body.completedAtYear);
    const currentYear = new Date().getFullYear();
    if (Number.isFinite(yearNum) && yearNum >= 1800 && yearNum <= currentYear) {
      req.body.completedAt = new Date(Date.UTC(yearNum, 0, 1));
    }
    delete req.body.completedAtYear;
  }

  // El artista puede editar campos básicos; admin además exhibitions e images.
  const artistAllowed = ['title', 'description', 'type', 'width_cm', 'height_cm', 'technique', 'amount', 'price_cents', 'completedAt'];
  // Admin también puede cambiar estado y motivo de rechazo
  const adminAllowed  = [...artistAllowed, 'exhibitions', 'images', 'status', 'reason', 'rejectReason'];
  const allowedFields = req.user.role === 'admin' ? adminAllowed : artistAllowed;

  // Limpiar flags/meta que puedan venir del formulario
  try { delete req.body._draftOnly; delete req.body.mode; } catch (_) {}

  if (Object.keys(req.body).some(key => !allowedFields.includes(key))) {
    return res.status(400).json({
      status: 'fail',
      error: { code: 'INVALID_FIELDS', message: 'La solicitud contiene campos no permitidos.' }
    });
  }

  const dataToUpdate = filterObject(req.body, ...allowedFields);
  const requestedStatus = Object.prototype.hasOwnProperty.call(dataToUpdate, 'status') ? String(dataToUpdate.status) : undefined;
  const rejectionReason = (dataToUpdate.rejectReason ?? dataToUpdate.reason);
  if (Object.prototype.hasOwnProperty.call(dataToUpdate, 'status')) delete dataToUpdate.status;
  if (Object.prototype.hasOwnProperty.call(dataToUpdate, 'rejectReason')) delete dataToUpdate.rejectReason;
  if (Object.prototype.hasOwnProperty.call(dataToUpdate, 'reason')) delete dataToUpdate.reason;
  // Validar título si viene en actualización
  if (Object.prototype.hasOwnProperty.call(dataToUpdate, 'title')) {
    if (typeof dataToUpdate.title !== 'string' || dataToUpdate.title.trim() === '') {
      return res.status(400).json({
        status: 'fail',
        error: { code: 'INVALID_TITLE', message: 'El campo "title" es obligatorio y no puede estar vacío.' }
      });
    }
  }
  // Normalizar completedAt si viene en actualización (solo admin)
  if ('completedAt' in dataToUpdate) {
    if (typeof dataToUpdate.completedAt === 'string') {
      if (dataToUpdate.completedAt.trim() === '') {
        delete dataToUpdate.completedAt;
      } else {
        const d = new Date(dataToUpdate.completedAt);
        if (isNaN(d.getTime())) {
          delete dataToUpdate.completedAt;
        } else {
          dataToUpdate.completedAt = d;
        }
      }
    }
  }
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!art) return next(new AppError('Obra no encontrada o está en la papelera.', 404));

  // ---- Precio (si viene) ----
  if ('amount' in dataToUpdate && dataToUpdate.amount !== '' && dataToUpdate.amount !== undefined) {
    art.price_cents = toCentsOrThrow(dataToUpdate.amount, 'amount');
    delete dataToUpdate.amount;
  } else if ('price_cents' in dataToUpdate) {
    const parsed = parseInt(dataToUpdate.price_cents, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return next(new AppError('"price_cents" debe ser un entero no negativo.', 400));
    }
    art.price_cents = parsed;
    delete dataToUpdate.price_cents;
  }

  // Si viene una nueva imagen, reemplaza la anterior sin validar aspecto
  if (req.file) {
    let imageResult;
    if (req.file.path) {
      imageResult = await upload(req.file.path);
    } else if (req.file.buffer) {
      const { uploadBuffer } = require('@utils/cloudinaryImage');
      imageResult = await uploadBuffer(req.file.buffer);
    }
    try { if (art.imagePublicId) await deleteImage(art.imagePublicId); } catch {}
    art.imageUrl = imageResult.secure_url;
    art.imagePublicId = imageResult.public_id;
    art.imageWidth_px = imageResult.width;
    art.imageHeight_px = imageResult.height;
    // (3) Si hay un array de images, actualiza también la galería
    if (Array.isArray(art.images)) {
      if (!art.images.includes(art.imageUrl)) {
        art.images.unshift(art.imageUrl);
      }
    } else {
      art.images = [art.imageUrl];
    }
  }
  // Si NO suben imagen nueva pero cambian width_cm/height_cm y hay px guardados
  else if ((dataToUpdate.width_cm || dataToUpdate.height_cm) && art.imageWidth_px && art.imageHeight_px) {
    const widthCm = Number(dataToUpdate.width_cm ?? art.width_cm);
    const heightCm = Number(dataToUpdate.height_cm ?? art.height_cm);
    const imgW = art.imageWidth_px;
    const imgH = art.imageHeight_px;
    const tolerance = Number(process.env.ASPECT_TOLERANCE) || 0.03;
    const padBg = process.env.CLOUDINARY_PAD || 'white';
    const aspect = verifyAspect({ widthCm, heightCm, imgW, imgH, tolerance });
    if (false) {
      const payload = buildAspectErrorPayload({ widthCm, heightCm, imgW, imgH, secureUrl: art.imageUrl, tolerance, padBg });
      return res.status(400).json({ status: 'fail', error: payload });
    }
    // Si es pad/fill, podrías actualizar la URL, pero solo si lo deseas
  }

  // (3) Si el admin envía un array de images, actualiza la galería
  if (req.user.role === 'admin' && Array.isArray(dataToUpdate.images)) {
    art.images = arrayUnique([art.imageUrl, ...dataToUpdate.images.filter(Boolean)]);
    delete dataToUpdate.images;
  }

  // Asignar el resto de cambios primero (sin status)
  Object.assign(art, dataToUpdate);

  // Si el admin solicitó cambio de estado, manejar transiciones
  let alreadySaved = false;
  if (req.user.role === 'admin' && requestedStatus) {
    // Estados permitidos según el esquema (incluye 'trashed')
    const allowedStatuses = (Artwork.schema && Artwork.schema.path('status') && Artwork.schema.path('status').enumValues) || ['draft','submitted','approved','rejected','trashed'];
    if (!allowedStatuses.includes(requestedStatus)) {
      return next(new AppError('Estado solicitado inválido.', 400));
    }

    // Manejar cada transición específicamente
    if (requestedStatus === 'trashed') {
      await art.moveToTrash(req.user._id);
      alreadySaved = true;
    } else if (requestedStatus === 'draft') {
      if (art.deletedAt) {
        await art.restore();
        alreadySaved = true;
      } else {
        art.status = 'draft';
      }
    } else if (requestedStatus === 'submitted') {
      // Requiere los mismos campos mínimos que una obra no-borrador
      const missing = [];
      if (!art.imageUrl) missing.push('imageUrl');
      if (!Number.isFinite(art.width_cm)) missing.push('width_cm');
      if (!Number.isFinite(art.height_cm)) missing.push('height_cm');
      if (!Number.isFinite(art.price_cents)) missing.push('price_cents');
      if (missing.length) {
        return res.status(400).json({
          status: 'fail',
          message: 'Completa los campos requeridos antes de enviar a revisión.',
          missing
        });
      }
      art.status = 'submitted';
      // limpiar metadata de rechazo si hubiera
      if (art.review) art.review.rejectReason = undefined;
    } else if (requestedStatus === 'approved') {
      // Validaciones mínimas para aprobación (misma lógica que approveArtwork)
      const missing = [];
      if (!art.imageUrl) missing.push('imageUrl');
      if (!Number.isFinite(art.width_cm)) missing.push('width_cm');
      if (!Number.isFinite(art.height_cm)) missing.push('height_cm');
      if (!Number.isFinite(art.price_cents)) missing.push('price_cents');
      if (missing.length) {
        return res.status(400).json({
          status: 'fail',
          message: 'Faltan campos requeridos para aprobar la obra.',
          missing
        });
      }
      art.status = 'approved';
      art.review = { reviewedBy: req.user.id, reviewedAt: new Date() };
    } else if (requestedStatus === 'rejected') {
      const reasonStr = (typeof rejectionReason === 'string') ? rejectionReason.trim() : '';
      if (!reasonStr) {
        return next(new AppError('Debes especificar el motivo del rechazo.', 400));
      }
      art.status = 'rejected';
      art.review = { reviewedBy: req.user.id, reviewedAt: new Date(), rejectReason: reasonStr };
    }
  }

  // Guardar si no se guardó ya dentro de una transición especial
  if (!alreadySaved) {
    await art.save({ validateModifiedOnly: true });
  }

  // Notificaciones por email si el admin cambió a approved/rejected
  if (req.user.role === 'admin' && requestedStatus && art.artist) {
    try {
      const { artworkStatusSubject, artworkStatusText } = require('@services/emailTemplates');
      if (requestedStatus === 'approved' && art.artist.email) {
        await sendMail({
          to: art.artist.email,
          subject: artworkStatusSubject('approved'),
          text: artworkStatusText({ status: 'approved', artistName: art.artist.name, artworkTitle: art.title })
        });
      }
      if (requestedStatus === 'rejected' && art.artist.email) {
        await sendMail({
          to: art.artist.email,
          subject: artworkStatusSubject('rejected'),
          text: artworkStatusText({ status: 'rejected', artistName: art.artist.name, artworkTitle: art.title, reason: art?.review?.rejectReason || '' })
        });
      }
    } catch (_) {}
  }

  sendResponse(res, art, 'Obra actualizada correctamente.');
});

/* ------------------------------------------------------------------ */
/*  Papelera (soft-delete)                                            */
/* ------------------------------------------------------------------ */

/** PATCH /:id/trash  → mueve a papelera (TTL 30 días) */
exports.moveToTrash = catchAsync(async (req, res, next) => {
  const artwork = await Artwork.findById(req.params.id);
  if (!artwork) return res.status(404).json({ message: 'Obra no encontrada.' });

  if (checkAlreadyInStatus(res, artwork, 'trashed', 'La obra ya está en la papelera. Solo puedes restaurarla a borrador.')) return;

  await artwork.moveToTrash(req.user._id);

  sendResponse(res, artwork, 'La obra fue movida a la papelera correctamente.');
});

exports.restoreArtwork = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  const art = await Artwork.findById(req.params.id);
  if (!art) return next(new AppError('Obra no encontrada.', 404));

  if (checkAlreadyInStatus(res, art, 'draft', 'La obra ya está en estado borrador.')) return;

  await art.restore();
  sendResponse(res, art, 'La obra fue restaurada y está en estado borrador.');
});

/* ------------------------------------------------------------------ */
/*  Flujo de aprobación                                               */
/* ------------------------------------------------------------------ */

/** PATCH /:id/submit  draft → submitted */
exports.submitArtwork = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  // Busca la obra y el artista
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null }).populate('artist');
  if (!art) return next(new AppError('Obra no encontrada.', 404));

  if (checkAlreadyInStatus(res, art, 'submitted', 'La obra ya fue enviada a revisión.')) return;

  // Límite de obras enviadas por artista
  try {
    const MAX_SUBMITTED = parseInt(process.env.MAX_SUBMITTED_PER_ARTIST || '10', 10);
    const submittedCount = await Artwork.countDocuments({ artist: art.artist._id || art.artist, status: 'submitted', deletedAt: null });
    if (Number.isFinite(MAX_SUBMITTED) && submittedCount >= MAX_SUBMITTED) {
      return res.status(429).json({
        status: 'fail',
        error: { code: 'MAX_SUBMITTED_REACHED', message: `Has alcanzado el límite de ${MAX_SUBMITTED} obras enviadas a aprobación. Espera a que se revisen o elimina alguna solicitud.` }
      });
    }
  } catch (_) {}

  // Validaciones mínimas antes de permitir envío a revisión
  const missing = [];
  if (!art.imageUrl) missing.push('imageUrl');
  if (!Number.isFinite(art.width_cm)) missing.push('width_cm');
  if (!Number.isFinite(art.height_cm)) missing.push('height_cm');
  if (!Number.isFinite(art.price_cents)) missing.push('price_cents');
  if (missing.length) {
    return res.status(400).json({
      status: 'fail',
      message: 'Completa los campos requeridos antes de enviar a revisión.',
      missing
    });
  }

  await art.submit();

  // Notifica a todos los administradores
  const User = require('@models/userModel');
  const admins = await User.find({ role: 'admin', active: true });

  const artworkInfo = `
Título: ${art.title}
Descripción: ${art.description || '(sin descripción)'}
Artista: ${art.artist.name} (${art.artist.email})
ID de obra: ${art._id}
`;

  let extraInfo = '';
  if (admins.length > 1) {
    extraInfo = `

Este correo ha sido enviado a otros administradores. 
Si no ves la obra en el queue de aprobación, es posible que ya fue aprobada o rechazada por otro administrador.
Puedes consultar el historial de aprobaciones para validar el estado final de la obra.`;
  }

  const { adminSubmissionSubject, adminSubmissionText } = require('@services/emailTemplates');
  for (const admin of admins) {
    await sendMail({
      to: admin.email,
      subject: adminSubmissionSubject(),
      text: adminSubmissionText({ art, artist: art.artist })
    });
  }

  sendResponse(res, art, 'La obra fue enviada a revisión.');
});


// Los métodos de revisión han sido eliminados porque el modelo ya no soporta review.

/* ------------------------------------------------------------------ */
/*  Obtener obras por estado                                          */
/* ------------------------------------------------------------------ */

exports.getArtworksByStatus = catchAsync(async (req, res, next) => {
  const { status } = req.params;
  if (!ALLOWED_STATUS.includes(status)) {
    return next(new AppError('El estado solicitado es inválido.', 400));
  }

  let filter = { status, deletedAt: null };

  // Si no es admin, solo puede ver sus propias obras
  if (req.user.role !== 'admin') {
    filter.artist = req.user.id;
  }

  const artworks = await Artwork.find(filter).populate('artist exhibitions');
  sendResponse(res, artworks, `Obras con estado: ${status}.`);
});

exports.getApprovedArtwork = catchAsync(async (req, res, next) => {
  if (!isValidObjectId(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  const art = await Artwork.findOne({
    _id: req.params.id,
    status: 'approved',
    deletedAt: null
  }).populate('artist exhibitions');
  if (!art) return next(new AppError('Obra no encontrada o no aprobada.', 404));

  sendResponse(res, art, 'Detalle de la obra aprobada.');
});
