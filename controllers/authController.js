const User = require('@models/userModel');
const { signToken } = require('@utils/jwt');
const sendResponse = require('@utils/sendResponse');
const catchAsync = require('@utils/catchAsync');
const AppError = require('@utils/appError');


exports.signup = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  const newUser = await User.create({ name, email, password, role });

  const token = signToken(newUser._id);

  sendResponse(res, { token, user: { id: newUser._id, name, email, role } }, 'User registered', 201);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !(await user.correctPassword(password))) {
    return next(new AppError('Correo o contraseña incorrectos', 401));
  }

  const token = signToken(user._id);

  sendResponse(res, { token }, 'User logged in');
});

exports.logout = catchAsync(async (req, res, next) => {
  // Nota: En JWT no hay sesión real, el logout se hace en el cliente (borrar token)
  sendResponse(res, null, 'Sesión cerrada');
});
