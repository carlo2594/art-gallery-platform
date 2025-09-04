// controllers/authController.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User            = require('@models/userModel');
const PasswordResetToken = require('@models/passwordResetTokenModel');
const { signToken }   = require('@utils/jwt');
const sendResponse    = require('@utils/sendResponse');
const sendTokenCookie = require('@utils/sendTokenCookie');   
const catchAsync      = require('@utils/catchAsync');
const AppError        = require('@utils/appError');
const { sendMail }    = require('@services/mailer');

async function sendEmail({ to, subject, text, html }) {
  return sendMail({ to, subject, text, html });
}

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

/* ------------------------------------------------------------------ */
/*  Forgot Password                                                   */
/* ------------------------------------------------------------------ */
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email }).select('+email');

  // Siempre responde igual para no revelar si el email existe
  if (!user || !user.email || user.email.trim() === '') {
    return sendResponse(res, null, 'Si el email existe, se enviará un enlace.');
  }

  // Generar token y hash
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = Date.now() + 15 * 60 * 1000;

  // Guardar en la base de datos
  await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
    used: false
  });

  // Enviar email
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?uid=${user._id}&token=${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Restablece tu contraseña',
    text: `Haz clic en el siguiente enlace para restablecer tu contraseña:\n${resetLink}\nEste enlace expira en 15 minutos.`
  });

  sendResponse(res, null, 'Si el email existe, se enviará un enlace.');
});

/* ------------------------------------------------------------------ */
/*  Reset Password                                                    */
/* ------------------------------------------------------------------ */
exports.resetPassword = catchAsync(async (req, res, next) => {
  const { uid, token, newPassword } = req.body;
  console.log('[resetPassword] Datos recibidos:', { uid, token, newPassword: !!newPassword });

  if (!uid || !token || !newPassword) {
    console.log('[resetPassword] Datos incompletos');
    return sendResponse(res, null, 'Datos incompletos.', 400);
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  console.log('[resetPassword] tokenHash:', tokenHash);

  const resetToken = await PasswordResetToken.findOne({
    userId: uid,
    tokenHash,
    expiresAt: { $gt: Date.now() },
    used: false
  });

  console.log('[resetPassword] resetToken encontrado:', !!resetToken);

  if (!resetToken) {
    console.log('[resetPassword] Token inválido o expirado');
    return sendResponse(res, null, 'Token inválido o expirado.', 400);
  }

  // Actualizar contraseña
  const user = await User.findById(uid);
  console.log('[resetPassword] Usuario encontrado:', !!user);

  if (!user) {
    console.log('[resetPassword] Usuario no encontrado');
    return sendResponse(res, null, 'Usuario no encontrado.', 404);
  }

  user.password = newPassword;
  await user.save();
  console.log('[resetPassword] Contraseña actualizada');

  resetToken.used = true;
  await resetToken.save();
  console.log('[resetPassword] Token marcado como usado');

  sendResponse(res, null, 'Contraseña restablecida correctamente.');
});
