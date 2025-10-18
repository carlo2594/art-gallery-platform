// routes/views/adminRoutes.js
const express = require('express');
const router  = express.Router();

const viewsAdminController = require('@controllers/viewsAdminController');
const requireUser = require('@middlewares/requireUser');
const restrictTo  = require('@middlewares/restrictTo'); // asumiendo que ya existe

// Todas las páginas del panel requieren sesión y rol admin
router.use(requireUser, restrictTo('admin'));

// Dashboard
router.get('/', viewsAdminController.getDashboard);

// Exhibiciones
router.get('/exhibitions',        viewsAdminController.getExhibitions);
router.get('/exhibitions/:id',    viewsAdminController.getExhibitionPreview);

// Obras
router.get('/artworks',           viewsAdminController.getArtworks);
router.get('/artworks/:id',       viewsAdminController.getArtwork);

// Usuarios
router.get('/users',              viewsAdminController.getUsers);
router.get('/collectors',         viewsAdminController.getCollectors);
router.get('/users/:id',          viewsAdminController.getUser);

module.exports = router;
