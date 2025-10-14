const express          = require('express');
const userController   = require('@controllers/userController');
const requireUser      = require('@middlewares/requireUser');
const restrictTo       = require('@middlewares/restrictTo');
const isOwner          = require('@middlewares/isOwner');
const favoriteController = require('@controllers/favoriteController');
const authController    = require('@controllers/authController');

const router = express.Router();
const multer = require('multer');
// Usar memoria para evitar problemas de filesystem en Windows
const upload = multer({ storage: multer.memoryStorage() });

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
router.post('/',         requireUser, restrictTo('admin'), userController.adminCreateUser);
router.get('/:id',       requireUser, restrictTo('admin'), userController.getUser);
router.patch('/:id',     requireUser, restrictTo('admin'), userController.updateUser);
router.delete('/:id',    requireUser, restrictTo('admin'), userController.deleteUser);
router.patch('/:id/role',          requireUser, restrictTo('admin'), userController.changeUserRole);
router.patch('/:id/reset-password', requireUser, restrictTo('admin'), userController.resetUserPassword);
router.patch('/:id/reactivate',     requireUser, restrictTo('admin'), userController.reactivateUser);
router.patch('/:id/deactivate',     requireUser, restrictTo('admin'), userController.deactivateUser);
// Admin: subir/actualizar o eliminar imagen de perfil (multipart/form-data con campo 'profileImage')
router.patch(
  '/:id/profile-image',
  requireUser,
  restrictTo('admin'),
  upload.single('profileImage'),
  userController.updateUserProfileImage
);

// Admin: lookup por email para prevalidación en UI
router.get(
  '/lookup',
  requireUser,
  restrictTo('admin'),
  userController.lookupByEmail
);

/* ---- (Opcional) favoritos de un usuario concreto ---- */
router.get('/:id/favorites', requireUser, restrictTo('admin'), favoriteController.getFavoritesByUser);

module.exports = router;
