/* ------------------------------------------------------------------ */
/*  Gestión de Disponibilidad y Ventas - Controladores Adicionales   */
/* ------------------------------------------------------------------ */

const AppError = require('@utils/appError');
const sendResponse = require('@utils/sendResponse');
const { sendMail } = require('@services/mailer');
const Artwork = require('@models/artworkModel');
const isValidObjectId = require('@utils/isValidObjectId');
const catchAsync = require('@utils/catchAsync');

// PATCH /:id/mark-sold - Marcar obra como vendida
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

  // Extraer datos de venta del body
  const saleData = {
    price_cents: req.body.price_cents,
    currency: req.body.currency,
    buyerName: req.body.buyerName,
    buyerEmail: req.body.buyerEmail,
    channel: req.body.channel,
    orderId: req.body.orderId
  };

  await artwork.markSold(saleData);

  // Notificar al artista sobre la venta
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

// PATCH /:id/reserve - Reservar obra
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

  // Fecha de reserva (por defecto 7 días)
  const reserveUntil = req.body.reservedUntil ? new Date(req.body.reservedUntil) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await artwork.reserve(reserveUntil);
  sendResponse(res, artwork, 'Obra reservada correctamente.');
});

// PATCH /:id/unreserve - Quitar reserva
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

// PATCH /:id/not-for-sale - Marcar como no disponible para venta
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

// PATCH /:id/on-loan - Marcar como en préstamo
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

// PATCH /:id/for-sale - Volver a poner en venta
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

  // Usar el método unreserve que ya resetea a for_sale
  artwork.availability = 'for_sale';
  artwork.reservedUntil = undefined;
  await artwork.save();

  sendResponse(res, artwork, 'Obra puesta en venta correctamente.');
});

module.exports = {
  markArtworkSold: exports.markArtworkSold,
  reserveArtwork: exports.reserveArtwork,
  unreserveArtwork: exports.unreserveArtwork,
  setNotForSale: exports.setNotForSale,
  setOnLoan: exports.setOnLoan,
  setForSale: exports.setForSale
};