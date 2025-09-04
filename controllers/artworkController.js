// controllers/artworkController.js
const mongoose = require('mongoose');
const Artwork      = require('@models/artworkModel');
const catchAsync   = require('@utils/catchAsync');
const AppError     = require('@utils/appError');
const filterObject = require('@utils/filterObject');
const sendResponse = require('@utils/sendResponse');
const { sendMail } = require('@services/mailer');

const ALLOWED_STATUS = ['draft', 'submitted', 'under_review', 'approved', 'rejected'];

/* ------------------------------------------------------------------ */
/*  Helper para status                                                */
/* ------------------------------------------------------------------ */

/**
 * Si la obra ya está en el status solicitado, responde con un mensaje y no continúa.
 * @param {Object} res - response de express
 * @param {Object} art - documento de obra
 * @param {String} status - status a verificar
 * @param {String} mensaje - mensaje a mostrar si ya está en ese status
 * @returns {Boolean} true si ya estaba en ese status, false si no
 */
function checkAlreadyInStatus(res, art, status, mensaje) {
  if (art.status === status) {
    return res.status(400).json({
      status: 'fail',
      message: mensaje
    });
  }
  return false;
}

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
  const allowed = ['title', 'description', 'imageUrl', 'type', 'size', 'material', 'exhibitions', 'status'];

  // Verifica que el body no esté vacío y detiene la función si es así
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new AppError('El cuerpo de la solicitud no puede estar vacío.', 400));
  }

  // Verifica que todos los campos sean válidos
  const invalidFields = Object.keys(req.body).filter(key => !allowed.includes(key));
  if (invalidFields.length > 0) {
    return next(new AppError(`Campos no permitidos: ${invalidFields.join(', ')}`, 400));
  }

  // Verifica que el campo title sea obligatorio
  if (!('title' in req.body) || typeof req.body.title !== 'string' || req.body.title.trim() === '') {
    return next(new AppError('El campo "title" es obligatorio.', 400));
  }

  const data = filterObject(req.body, ...allowed);
  const artwork = await Artwork.create({ ...data, artist: req.user.id });
  sendResponse(res, artwork, 'Obra creada correctamente.', 201);
});

/* ------------------------------------------------------------------ */
/*  Actualizar (whitelist, ignora papelera)                            */
/* ------------------------------------------------------------------ */

exports.updateArtwork = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  const artistAllowed = ['title', 'description', 'imageUrl', 'type', 'size', 'material'];
  const adminAllowed  = [...artistAllowed, 'exhibitions'];
  const allowedFields = req.user.role === 'admin' ? adminAllowed : artistAllowed;

  const dataToUpdate = filterObject(req.body, ...allowedFields);

  if (Object.keys(req.body).some(key => !allowedFields.includes(key)))
    return next(new AppError('La solicitud contiene campos no permitidos.', 400));

  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null });
  if (!art) return next(new AppError('Obra no encontrada o está en la papelera.', 404));

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

/** PATCH /:id/start-review  submitted → under_review (admin) */
exports.startReview = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null }).populate('artist');
  if (!art) return next(new AppError('Obra no encontrada.', 404));

  if (checkAlreadyInStatus(res, art, 'under_review', 'La obra ya está en revisión.')) return;

  await art.startReview(req.user.id);

  // Notificar al artista que su obra está en revisión
  if (art.artist && art.artist.email) {
    await sendMail({
      to: art.artist.email,
      subject: 'Tu obra está en revisión',
      text: `Hola ${art.artist.name || ''}, tu obra "${art.title}" ha iniciado el proceso de revisión.

Tan pronto sea aprobada o rechazada, te notificaremos`
    });
  }

  sendResponse(res, art, 'La revisión de la obra ha iniciado.');
});

/** PATCH /:id/approve  under_review → approved (admin) */
exports.approveArtwork = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null }).populate('artist');
  if (!art) return next(new AppError('Obra no encontrada.', 404));

  if (checkAlreadyInStatus(res, art, 'approved', 'La obra ya está aprobada.')) return;

  await art.approve(req.user.id);

  // Notificar al artista que su obra fue aprobada
  if (art.artist && art.artist.email) {
    await sendMail({
      to: art.artist.email,
      subject: '¡Tu obra fue aprobada!',
      text: `¡Felicidades ${art.artist.name || ''}! Tu obra "${art.title}" ha sido aprobada para exhibición.

Ya es visible para el público que visita la página de`
    });
  }

  sendResponse(res, art, 'La obra fue aprobada.');
});

/** PATCH /:id/reject  under_review → rejected (admin) */
exports.rejectArtwork = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return next(new AppError('ID de obra inválido.', 400));
  }
  const art = await Artwork.findOne({ _id: req.params.id, deletedAt: null }).populate('artist');
  if (!art) return next(new AppError('Obra no encontrada.', 404));

  if (checkAlreadyInStatus(res, art, 'rejected', 'La obra ya está rechazada.')) return;

  // Validar que venga motivo de rechazo
  if (!req.body.reason || typeof req.body.reason !== 'string' || req.body.reason.trim() === '') {
    return next(new AppError('Debes especificar el motivo del rechazo.', 400));
  }

  await art.reject(req.user.id, req.body.reason);

  // Notificar al artista que su obra fue rechazada
  if (art.artist && art.artist.email) {
    await sendMail({
      to: art.artist.email,
      subject: 'Tu obra fue rechazada',
      text: `Hola ${art.artist.name || ''}, lamentamos informarte que tu obra "${art.title}" fue rechazada.
Motivo: ${req.body.reason}`
    });
  }

  sendResponse(res, art, 'La obra fue rechazada.');
});

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
