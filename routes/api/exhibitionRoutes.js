const express        = require('express');
const exhibitionController = require('@controllers/exhibitionController');
const requireUser    = require('@middlewares/requireUser');
const isOwner        = require('@middlewares/isOwner');
const Exhibition     = require('@models/exhibitionModel');
const multer         = require('multer');
const upload         = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Público: ver exhibiciones
router.get('/',      exhibitionController.getAllExhibitions);
router.get('/:id',   exhibitionController.getExhibition);

// Usuarios autenticados pueden crear
router.post('/', requireUser, exhibitionController.createExhibition);

// Solo el creador o un admin puede editar/eliminar
router.patch('/:id', requireUser, isOwner(Exhibition), exhibitionController.updateExhibition);
router.delete('/:id', requireUser, isOwner(Exhibition), exhibitionController.deleteExhibition);

// Añadir o quitar obras de una exhibición (solo dueño o admin)
router.post('/:id/add-artwork', requireUser, isOwner(Exhibition), exhibitionController.addArtwork);
router.post('/:id/remove-artwork', requireUser, isOwner(Exhibition), exhibitionController.removeArtwork);

// Imagen de portada de la exposición
router.patch(
  '/:id/cover-image',
  requireUser,
  isOwner(Exhibition),
  upload.single('coverImage'),
  exhibitionController.uploadCoverImage
);
router.delete(
  '/:id/cover-image',
  requireUser,
  isOwner(Exhibition),
  exhibitionController.deleteCoverImage
);

// (sin galería adicional)

module.exports = router;
