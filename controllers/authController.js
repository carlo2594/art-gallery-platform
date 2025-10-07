// controllers/authController.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('@models/userModel');
const PasswordResetToken = require('@models/passwordResetTokenModel');
const { signToken } = require('@utils/jwt');
const { parseRememberMe, getJwtCookieOptions } = require('@utils/authUtils');
const { normalizeEmail } = require('@utils/emailUtils');
const sendResponse = require('@utils/sendResponse');
const { wantsHTML } = require('@utils/http');
const catchAsync = require('@utils/catchAsync');
const AppError = require('@utils/appError');
const { sendMail } = require('@services/mailer');

// Wrapper simple por si cambias proveedor de correo
async function sendEmail({ to, subject, text, html }) {
  return sendMail({ to, subject, text, html });
}

/* ------------------------------------------------------------------ */
/*  Signup                                                            */
/* ------------------------------------------------------------------ */
exports.signup = catchAsync(async (req, res) => {
  const { email } = req.body;

  // nombre por defecto del local-part si no mandan name
  let name;
  if (req.body.name) name = req.body.name;
  else if (email) name = email.split('@')[0];

  const normalizedEmail = normalizeEmail(email);

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    if (wantsHTML(req)) {
      // Redirige a login con mensaje
      const url = new URL(`${req.protocol}://${req.get('host')}/login`);
      url.searchParams.set('error', 'El correo ya está registrado. Inicia sesión.');
      return res.redirect(303, url.toString());
    }
    return sendResponse(res, null, 'El correo ya está registrado.', 400);
  }

  // Creamos con password temporal (hook del modelo lo hashea)
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const newUser = await User.create({ name, email: normalizedEmail, password: tempPassword });

  // Token para que el usuario defina su primera contraseña
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h

  await PasswordResetToken.create({
    userId: newUser._id,
    tokenHash,
    expiresAt,
    used: false
  });

  const createPasswordLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?uid=${newUser._id}&token=${token}&type=new`;

  await sendEmail({
    to: newUser.email,
    subject: 'Crea tu contraseña',
    text: `Bienvenido, ${name}\nHaz clic en el siguiente enlace para crear tu contraseña:\n${createPasswordLink}\nEste enlace expira en 24 horas.`
  });

  if (wantsHTML(req)) {
    const url = new URL(`${req.protocol}://${req.get('host')}/login`);
    url.searchParams.set('success', 'Registro iniciado. Revisa tu correo para crear la contraseña.');
    return res.redirect(303, url.toString());
  }
  return sendResponse(res, null, 'Registro iniciado. Revisa tu correo para crear la contraseña.', 201);
});

/* ------------------------------------------------------------------ */
/*  Login                                                             */
/* ------------------------------------------------------------------ */
exports.login = catchAsync(async (req, res, next) => {
  const { email, password, remember } = req.body;
  const normalizedEmail = normalizeEmail(email);

  // El schema oculta password → hay que seleccionarlo para comparar
  const user = await User.findOne({ email: normalizedEmail, active: true })
    .select('+password lastLoginAt');

  if (!user || !(await user.correctPassword(password))) {
    if (wantsHTML(req)) {
      const url = new URL(`${req.protocol}://${req.get('host')}/login`);
      url.searchParams.set('error', 'Correo o contraseña incorrectos');
      return res.redirect(303, url.toString());
    }
    return next(new AppError('Correo o contraseña incorrectos', 401));
  }

  const token = signToken(user._id);

  // "remember" puede venir como on/true/1/etc.
  const rememberMe = parseRememberMe(remember);
  const cookieOptions = getJwtCookieOptions({ rememberMe });
  res.cookie('jwt', token, cookieOptions);

  const isFirstLogin = !user.lastLoginAt;
  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() }, { runValidators: false });

  // open-redirect safe
  const getSafePath = (p) => (typeof p === 'string' && /^\/(?!\/)/.test(p) ? p : null);
  const nextFromQuery = getSafePath(req.query?.next);
  const nextFromSession = getSafePath(req.session?.returnTo);
  if (req.session && req.session.returnTo) req.session.returnTo = undefined;

  const fallbackUrl = isFirstLogin ? '/welcome' : '/?welcome=1';
  const destination = nextFromSession || nextFromQuery || fallbackUrl;

  if (wantsHTML(req)) return res.redirect(303, destination);

  return sendResponse(res, { token, next: destination }, 'User logged in');
});

/* ------------------------------------------------------------------ */
/*  Logout (idempotente)                                              */
/* ------------------------------------------------------------------ */
exports.logout = catchAsync(async (req, res) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });

  if (wantsHTML(req)) return res.redirect(303, '/');
  return sendResponse(res, null, 'Sesión cerrada');
});

/* ------------------------------------------------------------------ */
/*  Forgot Password                                                   */
/* ------------------------------------------------------------------ */
exports.forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  // tu modelo oculta email → hay que seleccionarlo explícitamente
  const user = await User.findOne({ email }).select('+email'); // :contentReference[oaicite:1]{index=1}

  // Siempre respondemos igual para no filtrar existencia de cuentas
  if (!user || !user.email || user.email.trim() === '') {
    return sendResponse(res, null, 'Si el email existe, se enviará un enlace.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min

  await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
    used: false
  });

  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?uid=${user._id}&token=${token}`;

  await sendEmail({
    to: user.email,
    subject: 'Restablece tu contraseña',
    text: `Haz clic en el siguiente enlace para restablecer tu contraseña:\n${resetLink}\nEste enlace expira en 15 minutos.`
  });

  // Flujos HTML: redirigir con mensaje amigable
  if (wantsHTML(req)) {
    const url = new URL(`${req.protocol}://${req.get('host')}/forgot-password`);
    url.searchParams.set('success', 'Si el email existe, te enviaremos un enlace para restablecer tu contraseña.');
    return res.redirect(303, url.toString());
  }

  return sendResponse(res, null, 'Si el email existe, se enviará un enlace.');
});

/* ------------------------------------------------------------------ */
/*  Reset Password                                                    */
/* ------------------------------------------------------------------ */
exports.resetPassword = catchAsync(async (req, res) => {
  const { uid, token, newPassword, remember } = req.body;
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
    if (wantsHTML(req)) {
      return res.redirect(303, '/reset-link-invalid');
    }
    return sendResponse(res, null, 'Token inválido o expirado.', 400);
  }

  const user = await User.findById(uid).select('+email +lastLoginAt');
  if (!user) {
    return sendResponse(res, null, 'Usuario no encontrado.', 404);
  }


  const isFirstLogin = !user.lastLoginAt;
  user.password = newPassword; // el hook del modelo lo hashea
  await user.save();
  // Actualiza el lastLoginAt si es el primer login
  if (isFirstLogin) {
    user.lastLoginAt = new Date();
    await user.save();
  }

  // Por si el alta venía inactiva, lo activamos sin romper schema
  if (user.active === false) {
    await User.findByIdAndUpdate(uid, { active: true }, { new: true, strict: false });
  }

  // Autologin post-reset
  const jwtToken = signToken(user._id);

  // "remember" puede venir como on/true/1/etc.
  const rememberMe = parseRememberMe(remember);
  const cookieOptions = getJwtCookieOptions({ rememberMe });
  res.cookie('jwt', jwtToken, cookieOptions);

  resetToken.used = true;
  await resetToken.save({ validateBeforeSave: false });

  await sendEmail({
    to: user.email,
    subject: 'Tu contraseña ha sido cambiada',
    text: `Hola ${user.name || ''}\nTu contraseña se ha actualizado correctamente.`
  });

  // Redirige si es HTML (siempre) al welcome
  if (wantsHTML(req)) {
    return res.redirect(303, '/welcome');
  }
  // Para clientes API, indicar siguiente destino
  return sendResponse(res, { next: '/welcome' }, 'Contraseña actualizada correctamente.');
});

/* ------------------------------------------------------------------ */
/*  Update Password (usuario autenticado)                             */
/* ------------------------------------------------------------------ */
exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};
  const userId = req.user?.id || req.user?._id;

  if (!userId) return next(new AppError('No autorizado', 401));
  if (!currentPassword || !newPassword) {
    return sendResponse(res, null, 'Debes enviar la contraseña actual y la nueva.', 400);
  }

  const user = await User.findById(userId).select('+password +email +lastLoginAt');
  if (!user || !(await user.correctPassword(currentPassword))) {
    return sendResponse(res, null, 'Tu contraseña actual no es correcta.', 400);
  }

  const isFirstLogin = !user.lastLoginAt;

  user.password = newPassword;
  await user.save();

  // Actualiza el lastLoginAt si es el primer login
  if (isFirstLogin) {
    user.lastLoginAt = new Date();
    await user.save();
  }

  const jwtToken = signToken(user._id);
  res.cookie('jwt', jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  await sendEmail({
    to: user.email,
    subject: 'Tu contraseña ha sido cambiada',
    text: `Hola ${user.name || ''}\nTu contraseña se ha actualizado correctamente.`
  });

  // Redirige si es HTML y es el primer login
  const wantsHTML = req.accepts(['html', 'json']) === 'html';
  if (wantsHTML && isFirstLogin) {
    return res.redirect(303, '/welcome');
  }
  if (isFirstLogin) {
    return sendResponse(res, { next: '/welcome' }, 'Contraseña actualizada correctamente.');
  }
  return sendResponse(res, null, 'Contraseña actualizada correctamente.');
});
