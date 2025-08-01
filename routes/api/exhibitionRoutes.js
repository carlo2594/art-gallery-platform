const express        = require('express');
const exhibitionController = require('@controllers/exhibitionController');
const requireUser    = require('@middlewares/requireUser');
const isOwner        = require('@middlewares/isOwner');
const Exhibition     = require('@models/exhibitionModel');

const router = express.Router();

// Público: ver exhibiciones
router.get('/',      exhibitionController.getAllExhibitions);
router.get('/:id',   exhibitionController.getExhibition);

// Usuarios autenticados pueden crear
router.post('/', requireUser, exhibitionController.createExhibition);

// Solo el creador o un admin puede editar/eliminar
router.patch('/:id', requireUser, isOwner(Exhibition), exhibitionController.updateExhibition);
router.delete('/:id', requireUser, isOwner(Exhibition), exhibitionController.deleteExhibition);

module.exports = router;
