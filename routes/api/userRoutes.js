const express          = require('express');
const userController   = require('@controllers/userController');
const requireUser      = require('@middlewares/requireUser');
const restrictTo       = require('@middlewares/restrictTo');
const isOwner          = require('@middlewares/isOwner');
const favoriteController = require('@controllers/favoriteController');

const router = express.Router();

/* ---- Perfil propio ---- */
router.get('/me',           requireUser, userController.getMe);
router.patch('/update-me',  requireUser, userController.updateMe);
router.patch('/update-password', requireUser, userController.updatePassword);
router.delete('/delete-me', requireUser, userController.deleteMe);
router.get('/my-profile',   requireUser, userController.getMyProfileWithArt);

/* ---- Favoritos propios (más práctico) ---- */
router.get('/my-favorites', requireUser, favoriteController.getFavoritesByUser);

/* ---- Admin ---- */
router.get('/',          requireUser, restrictTo('admin'), userController.getAllUsers);
router.get('/:id',       requireUser, restrictTo('admin'), userController.getUser);
router.patch('/:id',     requireUser, restrictTo('admin'), userController.updateUser);
router.delete('/:id',    requireUser, restrictTo('admin'), userController.deleteUser);

router.patch('/:id/role',          requireUser, restrictTo('admin'), userController.changeUserRole);
router.patch('/:id/reset-password', requireUser, restrictTo('admin'), userController.resetUserPassword);
router.patch('/:id/reactivate',     requireUser, restrictTo('admin'), userController.reactivateUser);

/* ---- (Opcional) favoritos de un usuario concreto ---- */
router.get('/:id/favorites', requireUser, restrictTo('admin'), favoriteController.getFavoritesByUser);

module.exports = router;
