// controllers/authController.js
const User            = require('@models/userModel');
const { signToken }   = require('@utils/jwt');
const sendResponse    = require('@utils/sendResponse');
const sendTokenCookie = require('@utils/sendTokenCookie');   
const catchAsync      = require('@utils/catchAsync');
const AppError        = require('@utils/appError');

/* ------------------------------------------------------------------ */
/*  Signup                                                            */
/* ------------------------------------------------------------------ */
exports.signup = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  const newUser = await User.create({ name, email, password, role });
  const token   = signToken(newUser._id);

  // Jwt en cookie HttpOnly + JSON opcional
  sendTokenCookie(res, token);

  sendResponse(
    res,
    { token, user: { id: newUser._id, name, email, role } },
    'User registered',
    201
  );
});

/* ------------------------------------------------------------------ */
/*  Login                                                             */
/* ------------------------------------------------------------------ */
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // trae hash y verifica que la cuenta esté activa
  const user = await User.findOne({ email, active: true }).select('+password');
  if (!user || !(await user.correctPassword(password))) {
    return next(new AppError('Correo o contraseña incorrectos', 401));
  }

  const token = signToken(user._id);
  sendTokenCookie(res, token);

  sendResponse(res, { token }, 'User logged in');
});

/* ------------------------------------------------------------------ */
/*  Logout (borra cookie)                                             */
/* ------------------------------------------------------------------ */
exports.logout = catchAsync(async (req, res, next) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/' // <-- igual que en sendTokenCookie.js
  });

  sendResponse(res, null, 'Sesión cerrada');
});
