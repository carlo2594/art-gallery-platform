const User = require('@models/userModel');
const catchAsync = require('@utils/catchAsync');
const sendResponse = require('@utils/sendResponse');
const factory = require('@utils/handlerFactory');


exports.getAllUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);

// Obtener perfil autenticado
exports.getMe = catchAsync(async (req, res, next) => {
  sendResponse(res, req.user, 'Perfil del usuario');
});
