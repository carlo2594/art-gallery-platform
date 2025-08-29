// routes/artworkRoutes.js
const express           = require('express');
const artworkController = require('@controllers/artworkController');
const requireUser       = require('@middlewares/requireUser');
const isOwner           = require('@middlewares/isOwner');
const restrictTo        = require('@middlewares/restrictTo');
const Artwork           = require('@models/artworkModel');

const router = express.Router();

/* ------------------------------------------------------------------ */
/*  Nuevas Rutas                                                      */
/* ------------------------------------------------------------------ */

// Filtrar artworks por status (solo admin)
router.get(
  '/status/:status',
  requireUser,
  restrictTo('admin'),
  artworkController.getArtworksByStatus
);

/* ------------------------------------------------------------------ */
/*  Lectura pública                                                    */
/* ------------------------------------------------------------------ */
router.get('/',    artworkController.getAllArtworks); // Modifica el controlador para aceptar req.query.status
router.get('/:id', artworkController.getArtwork);

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

// Restaurar desde la papelera (PATCH /artworks/:id/restore) – solo admin
router.patch(
  '/:id/restore',
  requireUser,
  restrictTo('admin'),
  artworkController.restoreArtwork
);

/* ------------------------------------------------------------------ */
/*  Flujo de aprobación                                                */
/* ------------------------------------------------------------------ */

// draft → submitted  (dueño o admin)
router.patch(
  '/:id/submit',
  requireUser,
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

module.exports = router;
