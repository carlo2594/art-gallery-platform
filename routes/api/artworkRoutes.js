// routes/artworkRoutes.js
const express           = require('express');
const artworkController = require('@controllers/artworkController');
const requireUser       = require('@middlewares/requireUser');
const isOwner           = require('@middlewares/isOwner');
const restrictTo        = require('@middlewares/restrictTo');
const Artwork           = require('@models/artworkModel');
const multer            = require('multer');
const upload            = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file || !file.mimetype) return cb(null, false);
    if (/^image\//i.test(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de archivo no permitido. Se requieren imágenes.'));
  }
});

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
  upload.single('image'),
  artworkController.createArtwork           // siempre inicia en 'draft'
);

router.patch(
  '/:id',
  requireUser,
  isOwner(Artwork, 'artist'),               // dueño o admin
  upload.single('image'),
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

// Marcar como vendida (solo admin)
router.patch(
  '/:id/mark-sold',
  requireUser,
  restrictTo('admin'),
  artworkController.markArtworkSold
);

// Reservar obra (solo admin)
router.patch(
  '/:id/reserve',
  requireUser,
  restrictTo('admin'),
  artworkController.reserveArtwork
);

// Quitar reserva (solo admin)
router.patch(
  '/:id/unreserve',
  requireUser,
  restrictTo('admin'),
  artworkController.unreserveArtwork
);

// Marcar como no disponible para venta (solo admin)
router.patch(
  '/:id/not-for-sale',
  requireUser,
  restrictTo('admin'),
  artworkController.setNotForSale
);

// Marcar como en préstamo (solo admin)
router.patch(
  '/:id/on-loan',
  requireUser,
  restrictTo('admin'),
  artworkController.setOnLoan
);

// Volver a poner en venta (solo admin)
router.patch(
  '/:id/for-sale',
  requireUser,
  restrictTo('admin'),
  artworkController.setForSale
);

// Lectura privada: ver cualquier obra si eres dueño o admin
router.get(
  '/private/:id',
  requireUser,
  isOwner(Artwork, 'artist'),
  artworkController.getArtwork
);

module.exports = router;
