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
  const { email } = req.body;

  let name;
  if (req.body.name) {
    name = req.body.name;
  } else if (email) {
    name = email.split('@')[0];
  }

  const normalizedEmail = (email || '').trim().toLowerCase();
  // Verifica si el usuario ya existe
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return sendResponse(res, null, 'El correo ya está registrado.', 400);
  }

  // Crea el usuario con password temporal y estado pendiente
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const newUser = await User.create({ name, email: normalizedEmail, password: tempPassword});

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
  text: `Bienvenido, ${name}\nHaz clic en el siguiente enlace para crear tu contraseña:\n${createPasswordLink}\nEste enlace expira en 24 horas.`
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
  const normalizedEmail = (email || '').trim().toLowerCase();

  // trae hash y verifica que la cuenta esté activa
  const user = await User.findOne({ email: normalizedEmail, active: true })
    .select('+password lastLoginAt'); // <-- incluir lastLoginAt

  if (!user || !(await user.correctPassword(password))) {
    return next(new AppError('Correo o contraseña incorrectos', 401));
  }

  const token = signToken(user._id);

  // "Recuérdame" puede venir como boolean, "on", "true", 1, etc.
  const rememberMe =  
    remember === true ||
    remember === 'true' ||
    remember === 'on' ||
    remember === 1 ||
    remember === '1' ||
    remember === 'remember-me';

  // Si el usuario marcó "Recuérdame", la cookie dura 30 días; si no, 7 días
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000 // 30 días o 7 días
  };
  res.cookie('jwt', token, cookieOptions);

  // -------------------------------
  // Smart redirect vs JSON response
  // -------------------------------

  // helper interno para permitir SOLO rutas internas (evita open redirects)
  const getSafePath = (p) => (typeof p === 'string' && /^\/(?!\/)/.test(p) ? p : null);

  // ¿Es primer login? (si no existe lastLoginAt)
  const isFirstLogin = !user.lastLoginAt;
  // registra última entrada (ignoramos validaciones por compat)
  await User.findByIdAndUpdate(
    user._id,
    { lastLoginAt: new Date() },
    { runValidators: false }
  );

  // Prioridad: next (query o sesión), luego bienvenida si es primer login, si no home con toast
  const nextFromQuery = getSafePath(req.query?.next);
  const nextFromSession = getSafePath(req.session?.returnTo);
  if (req.session && req.session.returnTo) req.session.returnTo = undefined;

  // authController.js (dentro de exports.login)
  const fallbackUrl = isFirstLogin ? '/welcome' : '/?welcome=1';

  const destination = nextFromSession || nextFromQuery || fallbackUrl;

  // Si el cliente espera HTML → redirect; si no, mantenemos JSON (compat SPA/XHR)
  const wantsHTML = req.accepts(['html', 'json']) === 'html';
  if (wantsHTML) {
    return res.redirect(303, destination);
  }

  // JSON: incluimos "next" para que el frontend sepa a dónde ir
  return sendResponse(res, { token, next: destination }, 'User logged in');
});


/* ------------------------------------------------------------------ */
/*  Logout (borra cookie)                                             */
/* ------------------------------------------------------------------ */
exports.logout = catchAsync(async (req, res, next) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });

  const wantsHTML = req.accepts(['html','json']) === 'html';
  if (wantsHTML) return res.redirect(303, '/');
  return sendResponse(res, null, 'Sesión cerrada');
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
  // ...existing code...

  if (!uid || !token || !newPassword) {
  // ...existing code...
    return sendResponse(res, null, 'Datos incompletos.', 400);
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  // ...existing code...

  const resetToken = await PasswordResetToken.findOne({
    userId: uid,
    tokenHash,
    expiresAt: { $gt: Date.now() },
    used: false
  });
  // ...existing code...


  if (!resetToken) {
  // ...existing code...
    return sendResponse(res, null, 'Token inválido o expirado.', 400);
  }

  // Actualizar contraseña
  const user = await User.findById(uid).select('+email');
  // ...existing code...

  if (!user) {
  // ...existing code...
    return sendResponse(res, null, 'Usuario no encontrado.', 404);
  }

  user.password = req.body.newPassword;
  await user.save();

  // Activar si era alta nueva
  if (user.active === false) {
    await User.findByIdAndUpdate(uid, { active: true }, { new: true, strict: false });
  // ...existing code...
  }

  // Iniciar sesión automática
  const jwtToken = signToken(user._id);
  res.cookie('jwt', jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
  });

  // Marcar token como usado
  resetToken.used = true;
  await resetToken.save({ validateBeforeSave: false });

  // Notifica al usuario
  await sendEmail({
    to: user.email,
    subject: 'Tu contraseña ha sido cambiada',
    text: `Hola ${user.name}, tu contraseña en Galería del Ox ha sido cambiada exitosamente.\nSi no realizaste este cambio, por favor contáctanos de inmediato en soporte@galeriadelox.com.`
  });

  return res.status(200).json({
    success: true,
    message: '¡Listo! Tu cuenta está activa y tu sesión se inició.',
    token: jwtToken
  });
});
