const express          = require('express');
const userController   = require('@controllers/userController');
const requireUser      = require('@middlewares/requireUser');
const restrictTo       = require('@middlewares/restrictTo');
const isOwner          = require('@middlewares/isOwner');
const favoriteController = require('@controllers/favoriteController');
const authController    = require('@controllers/authController');
const AppError          = require('@utils/appError');

const router = express.Router();
const multer = require('multer');
// Usar memoria + límites y filtro de tipo para imágenes
const upload = multer({
  storage: multer.memoryStorage(),
  // Subimos el límite a 50MB para permitir archivos grandes
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB máx.
  fileFilter: (req, file, cb) => {
    try {
      const ok = file && file.mimetype && file.mimetype.toLowerCase().startsWith('image/');
      if (!ok) {
        try { console.warn('[multer:fileFilter] Rechazado', { mimetype: file && file.mimetype, originalname: file && file.originalname }); } catch(_) {}
        return cb(new AppError('Solo se permiten archivos de imagen (máx. 50MB).', 400));
      }
      cb(null, true);
    } catch (e) {
      try { console.warn('[multer:fileFilter] Error', e && e.message); } catch(_) {}
      cb(new AppError('Archivo de imagen inválido.', 400));
    }
  }
});

/* ---- Perfil propio ---- */
router.get('/me',           requireUser, userController.getMe);
router.patch('/update-me',  requireUser, upload.single('profileImage'), userController.updateMe);
// Alias para formularios HTML (POST)
router.post('/update-me',   requireUser, upload.single('profileImage'), userController.updateMe);
// Imagen de perfil (propio): subir/actualizar o eliminar
router.patch('/me/profile-image', requireUser, upload.single('profileImage'), userController.updateMyProfileImage);
router.post('/me/profile-image',  requireUser, upload.single('profileImage'), userController.updateMyProfileImage);
router.patch('/update-password', requireUser, userController.updatePassword);
// Alias POST para formularios HTML
router.post('/update-password', requireUser, userController.updatePassword);
router.delete('/delete-me', requireUser, userController.deleteMe);
router.get('/my-profile',   requireUser, userController.getMyProfileWithArt);

/* ---- Favoritos propios (más práctico) ---- */
router.get('/my-favorites', requireUser, favoriteController.getFavoritesByUser);

/* ---- Admin ---- */
router.get('/',          requireUser, restrictTo('admin'), userController.getAllUsers);
router.post('/',         requireUser, restrictTo('admin'), userController.adminCreateUser);
// Búsqueda rápida por nombre/email (admin)
router.get('/search',    requireUser, restrictTo('admin'), userController.searchUsers);
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
