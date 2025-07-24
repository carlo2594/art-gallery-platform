const User = require('@models/userModel');
const catchAsync = require('@utils/catchAsync');
const sendResponse = require('@utils/sendResponse');
const factory = require('@utils/handlerFactory');
const filterObject = require('@utils/filterObject');
const AppError = require('@utils/appError'); // ❗ Esto faltaba

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
