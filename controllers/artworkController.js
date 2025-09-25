


// =======================
// IMPORTS Y CONSTANTES
// =======================
const AppError = require('@utils/appError');
const filterObject = require('@utils/filterObject');
const sendResponse = require('@utils/sendResponse');
const { sendMail } = require('@services/mailer');
const { upload, deleteImage } = require('@utils/cloudinaryImage');
const Artwork = require('@models/artworkModel');
const mongoose = require('mongoose');
const catchAsync = require('@utils/catchAsync');
const {
  verifyAspect,
  buildTransformedUrl,
  getAspectPolicy,
  buildAspectErrorPayload
} = require('@utils/aspectUtils');
const ALLOWED_STATUS = ['draft', 'submitted', 'under_review', 'approved', 'rejected'];


// =======================
// HELPERS
// =======================
function checkAlreadyInStatus(res, art, status, mensaje) {
  if (art.status === status) {
    return res.status(400).json({
      status: 'fail',
      message: mensaje
    });
  }
  return false;
}

function toCentsOrThrow(value, fieldName = 'amount') {
  if (value === undefined || value === null || value === '') {
    throw new AppError(`El campo "${fieldName}" es obligatorio.`, 400);
  }
  const cleaned = String(value).replace(/[$,\s]/g, '');
  const num = Number(cleaned);
  if (!isFinite(num)) throw new AppError(`"${fieldName}" no es un número válido.`, 400);
  const cents = Math.round(num * 100);
  if (cents < 0) throw new AppError(`"${fieldName}" no puede ser negativo.`, 400);
  return cents;
}


// =======================
// PATCH /:id/start-review  submitted → under_review (admin)
// =======================
exports.startReview = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null }).populate('artist');
  if (!art) return next(new AppError('Obra no encontrada.', 404));

  if (art.status === 'under_review') {
    return res.status(400).json({ status: 'fail', message: 'La obra ya está en revisión.' });
  }

  art.status = 'under_review';
  art.review = { reviewedBy: req.user.id };
  await art.save();

  // Notificar al artista que su obra está en revisión
  if (art.artist && art.artist.email) {
    await sendMail({
      to: art.artist.email,
      subject: 'Tu obra está en revisión',
      text: `Hola ${art.artist.name || ''}, tu obra "${art.title}" ha iniciado el proceso de revisión.\n\nTan pronto sea aprobada o rechazada, te notificaremos.`
    });
  }

  sendResponse(res, art, 'La revisión de la obra ha iniciado.');
});

// =======================
// PATCH /:id/approve  under_review → approved (admin)
// =======================
exports.approveArtwork = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null }).populate('artist');
  if (!art) return next(new AppError('Obra no encontrada.', 404));

  if (art.status === 'approved') {
    return res.status(400).json({ status: 'fail', message: 'La obra ya está aprobada.' });
  }

  art.status = 'approved';
  art.review = { reviewedBy: req.user.id, reviewedAt: new Date() };
  await art.save();

  // Notificar al artista que su obra fue aprobada
  if (art.artist && art.artist.email) {
    await sendMail({
      to: art.artist.email,
      subject: '¡Tu obra fue aprobada!',
      text: `¡Felicidades ${art.artist.name || ''}! Tu obra "${art.title}" ha sido aprobada para exhibición.\n\nYa es visible para el público que visita la página.`
    });
  }

  sendResponse(res, art, 'La obra fue aprobada.');
});

// =======================
// PATCH /:id/reject  under_review → rejected (admin)
// =======================
exports.rejectArtwork = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
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
    await sendMail({
      to: art.artist.email,
      subject: 'Tu obra fue rechazada',
      text: `Hola ${art.artist.name || ''}, lamentamos informarte que tu obra "${art.title}" fue rechazada.\nMotivo: ${req.body.reason}`
    });
  }

  sendResponse(res, art, 'La obra fue rechazada.');
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
  if (req.query.type)     filter.type_norm     = { $in: normArr(req.query.type) };
  if (req.query.material) filter.material_norm = { $in: normArr(req.query.material) };

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
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
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

  // Permitimos amount (USD) o price_cents (entero)
  const allowed = [
    'title', 'description', 'type', 'width_cm', 'height_cm', 'material',
    'exhibitions', 'status', 'amount', 'price_cents'
  ];

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      status: 'fail',
      error: { code: 'INVALID_BODY', message: 'El cuerpo de la solicitud no puede estar vacío.' }
    });
  }

  const invalidFields = Object.keys(req.body).filter(key => !allowed.includes(key));
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

  if (!req.file) {
    return res.status(400).json({
      status: 'fail',
      error: { code: 'NO_IMAGE', message: 'Debes subir una imagen.' }
    });
  }

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

  // Sube la imagen a Cloudinary
  const imageResult = await upload(req.file.path);
  const widthCm = Number(req.body.width_cm);
  const heightCm = Number(req.body.height_cm);
  const imgW = imageResult.width;
  const imgH = imageResult.height;

  // Validar dimensiones
  if (!isFinite(widthCm) || !isFinite(heightCm) || widthCm <= 0 || heightCm <= 0) {
    return res.status(400).json({
      status: 'fail',
      error: { code: 'INVALID_DIMENSIONS', message: 'Las dimensiones declaradas deben ser mayores a cero y finitas.' }
    });
  }

  const tolerance = Number(process.env.ASPECT_TOLERANCE) || 0.03;
  const padBg = process.env.CLOUDINARY_PAD_BG || 'white';
  const aspect = verifyAspect({ widthCm, heightCm, imgW, imgH, tolerance });
  const aspectPolicy = getAspectPolicy();

  let imageUrlToSave = imageResult.secure_url;
  if (!aspect.ok) {
    const payload = buildAspectErrorPayload({
      widthCm, heightCm, imgW, imgH, secureUrl: imageResult.secure_url, tolerance, padBg
    });
    if (aspectPolicy === 'strict' || !['pad','fill'].includes(aspectPolicy)) {
      return res.status(400).json({ status: 'fail', error: payload });
    }
    imageUrlToSave = buildTransformedUrl(imageResult.secure_url, {
      policy: aspectPolicy, widthCm, heightCm, bg: padBg
    });
  }

  const data = filterObject(req.body, ...allowed);
  data.artist = req.user.id;
  data.imageUrl = imageUrlToSave;
  data.imagePublicId = imageResult.public_id;
  data.imageWidth_px = imgW;
  data.imageHeight_px = imgH;
  data.price_cents = priceCents; // <-- guarda el precio en centavos

  const artwork = await Artwork.create(data);
  sendResponse(res, artwork, 'Obra creada correctamente.', 201);
});

/* ------------------------------------------------------------------ */
/*  Actualizar (whitelist, ignora papelera)                            */
/* ------------------------------------------------------------------ */

exports.updateArtwork = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }

  // El artista puede editar campos básicos; admin además exhibitions.
  // Ambos pueden editar precio mediante amount o price_cents.
  const artistAllowed = ['title', 'description', 'type', 'width_cm', 'height_cm', 'material', 'amount', 'price_cents'];
  const adminAllowed  = [...artistAllowed, 'exhibitions'];
  const allowedFields = req.user.role === 'admin' ? adminAllowed : artistAllowed;

  if (Object.keys(req.body).some(key => !allowedFields.includes(key))) {
    return res.status(400).json({
      status: 'fail',
      error: { code: 'INVALID_FIELDS', message: 'La solicitud contiene campos no permitidos.' }
    });
  }

  const dataToUpdate = filterObject(req.body, ...allowedFields);
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

  const aspectPolicy = getAspectPolicy();

  // Si viene una nueva imagen, sube primero y valida aspecto
  if (req.file) {
    const imageResult = await upload(req.file.path);
    const widthCm = Number(dataToUpdate.width_cm ?? art.width_cm);
    const heightCm = Number(dataToUpdate.height_cm ?? art.height_cm);
    const imgW = imageResult.width;
    const imgH = imageResult.height;
    const tolerance = Number(process.env.ASPECT_TOLERANCE) || 0.03;
    const padBg = process.env.CLOUDINARY_PAD_BG || 'white';
    const aspect = verifyAspect({ widthCm, heightCm, imgW, imgH, tolerance });

    if (!aspect.ok) {
      const payload = buildAspectErrorPayload({
        widthCm, heightCm, imgW, imgH, secureUrl: imageResult.secure_url, tolerance, padBg
      });
      if (aspectPolicy === 'strict' || !['pad','fill'].includes(aspectPolicy)) {
        return res.status(400).json({ status: 'fail', error: payload });
      }
      art.imageUrl = buildTransformedUrl(imageResult.secure_url, { policy: aspectPolicy, widthCm, heightCm, bg: padBg });
    } else {
      await deleteImage(art.imagePublicId);
      art.imageUrl = imageResult.secure_url;
    }
    art.imagePublicId = imageResult.public_id;
    art.imageWidth_px = imgW;
    art.imageHeight_px = imgH;
  }
  // Si NO suben imagen nueva pero cambian width_cm/height_cm y hay px guardados
  else if ((dataToUpdate.width_cm || dataToUpdate.height_cm) && art.imageWidth_px && art.imageHeight_px) {
    const widthCm = Number(dataToUpdate.width_cm ?? art.width_cm);
    const heightCm = Number(dataToUpdate.height_cm ?? art.height_cm);
    const imgW = art.imageWidth_px;
    const imgH = art.imageHeight_px;
    const tolerance = Number(process.env.ASPECT_TOLERANCE) || 0.03;
    const padBg = process.env.CLOUDINARY_PAD_BG || 'white';
    const aspect = verifyAspect({ widthCm, heightCm, imgW, imgH, tolerance });
    if (!aspect.ok && (aspectPolicy === 'strict' || !['pad','fill'].includes(aspectPolicy))) {
      const payload = buildAspectErrorPayload({ widthCm, heightCm, imgW, imgH, secureUrl: art.imageUrl, tolerance, padBg });
      return res.status(400).json({ status: 'fail', error: payload });
    }
    // Si es pad/fill, podrías actualizar la URL, pero solo si lo deseas
  }

  Object.assign(art, dataToUpdate);
  await art.save({ validateModifiedOnly: true });

  sendResponse(res, art, 'Obra actualizada correctamente.');
});

/* ------------------------------------------------------------------ */
/*  Papelera (soft-delete)                                            */
/* ------------------------------------------------------------------ */

/** PATCH /:id/trash  → mueve a papelera (TTL 30 días) */
exports.moveToTrash = async (req, res) => {
  const artwork = await Artwork.findById(req.params.id);
  if (!artwork) return res.status(404).json({ message: 'Obra no encontrada.' });

  if (checkAlreadyInStatus(res, artwork, 'trashed', 'La obra ya está en la papelera. Solo puedes restaurarla a borrador.')) return;

  await artwork.moveToTrash(req.user._id);

  sendResponse(res, artwork, 'La obra fue movida a la papelera correctamente.');
};

exports.restoreArtwork = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
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
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  // Busca la obra y el artista
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null }).populate('artist');
  if (!art) return next(new AppError('Obra no encontrada.', 404));

  if (checkAlreadyInStatus(res, art, 'submitted', 'La obra ya fue enviada a revisión.')) return;

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

  for (const admin of admins) {
    await sendMail({
      to: admin.email,
      subject: 'Nueva obra enviada para revisión',
      text: `Se ha enviado una nueva obra para revisión:\n\n${artworkInfo}\n${extraInfo}`
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
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
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
