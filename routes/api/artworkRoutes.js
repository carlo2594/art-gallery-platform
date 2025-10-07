// routes/artworkRoutes.js
const express           = require('express');
const artworkController = require('@controllers/artworkController');
const artworkAvailabilityController = require('@controllers/artworkAvailabilityController');
const requireUser       = require('@middlewares/requireUser');
const isOwner           = require('@middlewares/isOwner');
const restrictTo        = require('@middlewares/restrictTo');
const Artwork           = require('@models/artworkModel');

const router = express.Router();

/* ------------------------------------------------------------------ */
/*  Nuevas Rutas                                                      */
/* ------------------------------------------------------------------ */

// Filtrar artworks por status 
router.get(
  '/status/:status',
  requireUser,
  artworkController.getArtworksByStatus
);

/* ------------------------------------------------------------------ */
/*  Lectura pública                                                    */
/* ------------------------------------------------------------------ */


router.get('/',    artworkController.getAllArtworks); // acepta req.query.status/include
router.get('/:id', artworkController.getApprovedArtwork);
/* ------------------------------------------------------------------ */
/*  CRUD básico (usuario logueado)                                     */
/* ------------------------------------------------------------------ */
router.post(
  '/',
  requireUser,
  artworkController.createArtwork           // siempre inicia en 'draft'
);

router.patch(
  '/:id',
  requireUser,
  isOwner(Artwork, 'artist'),               // dueño o admin
  artworkController.updateArtwork
);

/* ------------------------------------------------------------------ */
/*  Papelera (soft-delete)                                             */
/* ------------------------------------------------------------------ */

// Enviar a la papelera (PATCH /artworks/:id/trash) – dueño o admin
router.patch(
  '/:id/trash',
  requireUser,
  isOwner(Artwork, 'artist'),
  artworkController.moveToTrash
);

// Cambiar a estado draft (PATCH /artworks/:id/draft)
router.patch(
  '/:id/draft',
  requireUser,
  isOwner(Artwork, 'artist'),
  artworkController.restoreArtwork
);

/* ------------------------------------------------------------------ */
/*  Flujo de aprobación                                                */
/* ------------------------------------------------------------------ */

// draft → submitted  (dueño o admin)
router.patch(
  '/:id/submit',
  requireUser,
  isOwner(Artwork, 'artist'), // <-- aquí validas que sea dueño o admin
  artworkController.submitArtwork
);

// submitted → under_review  (solo admin)
router.patch(
  '/:id/start-review',
  requireUser,
  restrictTo('admin'),
  artworkController.startReview
);

// under_review → approved  (solo admin)
router.patch(
  '/:id/approve',
  requireUser,
  restrictTo('admin'),
  artworkController.approveArtwork
);

// under_review → rejected  (solo admin)
router.patch(
  '/:id/reject',
  requireUser,
  restrictTo('admin'),
  artworkController.rejectArtwork
);

/* ------------------------------------------------------------------ */
/*  Gestión de Disponibilidad y Ventas                                */
/* ------------------------------------------------------------------ */

// Marcar como vendida (admin o dueño)
router.patch(
  '/:id/mark-sold',
  requireUser,
  isOwner(Artwork, 'artist'),
  artworkAvailabilityController.markArtworkSold
);

// Reservar obra (admin o dueño)
router.patch(
  '/:id/reserve',
  requireUser,
  isOwner(Artwork, 'artist'),
  artworkAvailabilityController.reserveArtwork
);

// Quitar reserva (admin o dueño)
router.patch(
  '/:id/unreserve',
  requireUser,
  isOwner(Artwork, 'artist'),
  artworkAvailabilityController.unreserveArtwork
);

// Marcar como no disponible para venta (admin o dueño)
router.patch(
  '/:id/not-for-sale',
  requireUser,
  isOwner(Artwork, 'artist'),
  artworkAvailabilityController.setNotForSale
);

// Marcar como en préstamo (admin o dueño)
router.patch(
  '/:id/on-loan',
  requireUser,
  isOwner(Artwork, 'artist'),
  artworkAvailabilityController.setOnLoan
);

// Volver a poner en venta (admin o dueño)
router.patch(
  '/:id/for-sale',
  requireUser,
  isOwner(Artwork, 'artist'),
  artworkAvailabilityController.setForSale
);

// Lectura privada: ver cualquier obra si eres dueño o admin
router.get(
  '/private/:id',
  requireUser,
  isOwner(Artwork, 'artist'),
  artworkController.getArtwork
);

module.exports = router;
