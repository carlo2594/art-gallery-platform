const express = require('express');
const userController = require('@controllers/userController');
const requireUser = require('@middlewares/requireUser');
const restrictTo = require('@middlewares/restrictTo');

const router = express.Router();

// 👤 Rutas del usuario autenticado
router.get('/me', requireUser, userController.getMe);
router.patch('/update-me', requireUser, userController.updateMe);
router.delete('/delete-me', requireUser, userController.deleteMe);
router.patch('/update-password', requireUser, userController.updatePassword);
router.get('/my-profile', requireUser, userController.getMyProfileWithArt);

// 🔐 Rutas administrativas
router.get('/', requireUser, restrictTo('admin'), userController.getAllUsers);
router.get('/:id', requireUser, restrictTo('admin'), userController.getUser);
router.patch('/:id', requireUser, restrictTo('admin'), userController.updateUser);
router.delete('/:id', requireUser, restrictTo('admin'), userController.deleteUser);

// Admin: cambiar rol, resetear contraseña, reactivar
router.patch('/:id/role', requireUser, restrictTo('admin'), userController.changeUserRole);
router.patch('/:id/reset-password', requireUser, restrictTo('admin'), userController.resetUserPassword);
router.patch('/:id/reactivate', requireUser, restrictTo('admin'), userController.reactivateUser);

module.exports = router;
