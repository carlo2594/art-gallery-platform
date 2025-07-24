const express = require('express');
const galleryController = require('@controllers/galleryController');
const requireUser = require('@middlewares/auth/requireUser');
const isOwner = require('@middlewares/isOwner');
const Gallery = require('@models/galleryModel');

const router = express.Router();

// Público: ver galerías
router.get('/', galleryController.getAllGalleries);
router.get('/:id', galleryController.getGallery);

// Usuarios autenticados pueden crear
router.post('/', requireUser, galleryController.createGallery);

// Solo el creador o un admin puede editar/eliminar
router.patch('/:id', requireUser, isOwner(Gallery), galleryController.updateGallery);
router.delete('/:id', requireUser, isOwner(Gallery), galleryController.deleteGallery);

module.exports = router;
