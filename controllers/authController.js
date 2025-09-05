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
  const { name, email } = req.body;

  // Verifica si el usuario ya existe
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return sendResponse(res, null, 'El correo ya está registrado.', 400);
  }

  // Crea el usuario con password temporal y estado pendiente
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const newUser = await User.create({ name, email, password: tempPassword, active: false });

  // Genera token para crear contraseña
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 horas

  await PasswordResetToken.create({
    userId: newUser._id,
    tokenHash,
    expiresAt,
    used: false
  });

  // Enviar email con link para crear contraseña (type=new)
  const createPasswordLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?uid=${newUser._id}&token=${token}&type=new`;

  await sendEmail({
    to: newUser.email,
    subject: 'Crea tu contraseña',
    text: `Bienvenido, ${name}! Haz clic en el siguiente enlace para crear tu contraseña:\n${createPasswordLink}\nEste enlace expira en 24 horas.`
  });

  sendResponse(
    res,
    null,
    'Registro iniciado. Revisa tu correo para crear la contraseña.',
    201
  );
});

/* ------------------------------------------------------------------ */
/*  Login                                                             */
/* ------------------------------------------------------------------ */
exports.login = catchAsync(async (req, res, next) => {
  const { email, password, remember } = req.body;

  // trae hash y verifica que la cuenta esté activa
  const user = await User.findOne({ email, active: true }).select('+password');
  if (!user || !(await user.correctPassword(password))) {
    return next(new AppError('Correo o contraseña incorrectos', 401));
  }

  const token = signToken(user._id);

  // Si el usuario marcó "Recuérdame", la cookie dura 30 días; si no, 7 días
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000 // 30 días o 7 días
  };
  res.cookie('jwt', token, cookieOptions);

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

  if (!uid || !token || !newPassword) {
    return sendResponse(res, null, 'Datos incompletos.', 400);
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const resetToken = await PasswordResetToken.findOne({
    userId: uid,
    tokenHash,
    expiresAt: { $gt: Date.now() },
    used: false
  });


  if (!resetToken) {
    return sendResponse(res, null, 'Token inválido o expirado.', 400);
  }

  // Actualizar contraseña
  const user = await User.findById(uid);

  if (!user) {
    return sendResponse(res, null, 'Usuario no encontrado.', 404);
  }

  user.password = req.body.newPassword;
  await user.save();

  // Notifica al usuario
  await sendMail({
    to: user.email,
    subject: 'Tu contraseña ha sido cambiada',
    text: `Hola ${user.name}, tu contraseña en Galería del Ox ha sido cambiada exitosamente. 
Si no realizaste este cambio, por favor contáctanos de inmediato en soporte@galeriadelox.com.`
  });

  resetToken.used = true;
  await resetToken.save();

  sendResponse(res, null, 'Contraseña restablecida correctamente.');
});
