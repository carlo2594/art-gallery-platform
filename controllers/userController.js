const User = require('@models/userModel');
const catchAsync = require('@utils/catchAsync');
const sendResponse = require('@utils/sendResponse');
const factory = require('@utils/handlerFactory');
const filterObject = require('@utils/filterObject');
const AppError = require('@utils/appError');
const Artwork = require('@models/artworkModel');
const Exhibition = require('@models/exhibitionModel');

// CRUD estándar
exports.getAllUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);

// Obtener perfil autenticado
exports.getMe = catchAsync(async (req, res, next) => {
  sendResponse(res, req.user, 'Perfil del usuario');
});

// Actualizar perfil (limitado)
exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password) {
    return next(new AppError('Esta ruta no es para actualizar la contraseña.', 400));
  }

  const filteredBody = filterObject(req.body, 'name', 'email');

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  sendResponse(res, updatedUser, 'Perfil actualizado');
});

// Desactivar cuenta (soft delete)
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });
  sendResponse(res, null, 'Cuenta desactivada', 204);
});

// Cambiar contraseña autenticado
exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');

  if (!(await user.correctPassword(req.body.currentPassword))) {
    return next(new AppError('La contraseña actual es incorrecta', 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendResponse(res, null, 'Contraseña actualizada correctamente');
});

// Obtener perfil completo con relaciones
exports.getMyProfileWithArt = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  // Busca artworks donde el usuario es el artista
  const artworks = await Artwork.find({ artist: user._id });

  // Busca exhibitions donde el usuario es el creador
  const exhibitions = await Exhibition.find({ createdBy: user._id });

  sendResponse(
    res,
    { user, artworks, exhibitions },
    'Perfil completo del usuario'
  );
});

// ADMIN: Cambiar el rol de un usuario
exports.changeUserRole = catchAsync(async (req, res, next) => {
  const { role } = req.body;
  if (!['admin', 'artist'].includes(role)) {
    return next(new AppError('Rol inválido', 400));
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, {
    new: true,
    runValidators: true
  });

  if (!user) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  sendResponse(res, user, 'Rol actualizado');
});

// ADMIN: Forzar cambio de contraseña
exports.resetUserPassword = catchAsync(async (req, res, next) => {
  const { newPassword } = req.body;

  if (!newPassword) {
    return next(new AppError('Debes proporcionar una nueva contraseña', 400));
  }

  const user = await User.findById(req.params.id).select('+password');
  if (!user) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  user.password = newPassword;
  await user.save();

  sendResponse(res, null, 'Contraseña restablecida por admin');
});

// ADMIN: Reactivar un usuario desactivado
exports.reactivateUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  if (user.active) {
    return next(new AppError('El usuario ya está activo.', 400));
  }

  user.active = true;
  await user.save();

  sendResponse(res, user, 'Usuario reactivado');
});

// ADMIN: Actualizar usuario (sin permitir cambiar contraseña aquí)
exports.updateUser = catchAsync(async (req, res, next) => {
  if (req.body.password) {
    return next(new AppError('No puedes actualizar la contraseña desde esta ruta.', 400));
  }

  // Solo permite actualizar estos campos
  const filteredBody = filterObject(req.body, 'name', 'email', 'profileImage', 'bio', 'active');

  const updatedUser = await User.findByIdAndUpdate(req.params.id, filteredBody, {
    new: true,
    runValidators: true
  });

  if (!updatedUser) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  sendResponse(res, updatedUser, 'Usuario actualizado');
});

// ADMIN: Desactivar un usuario (soft delete)
exports.deactivateUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  if (!user.active) {
    return next(new AppError('El usuario ya está desactivado.', 400));
  }

  user.active = false;
  await user.save();

  sendResponse(res, user, 'Usuario desactivado');
});
