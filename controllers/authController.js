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
const { renderEmailLayout } = require('@services/emailLayout');
const {
  generatePolicyCompliantPassword,
  isModeratePassword,
  MODERATE_PASSWORD_MESSAGE
} = require('@utils/passwordPolicy');

const getSafeInternalPath = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\/(?!\/)/.test(trimmed) ? trimmed : null;
};

// Wrapper simple por si cambias proveedor de correo
async function sendEmail({ to, subject, text, html }) {
  return sendMail({ to, subject, text, html });
}

/* ------------------------------------------------------------------ */
/*  Signup                                                            */
/* ------------------------------------------------------------------ */
exports.signup = catchAsync(async (req, res) => {
  const { email } = req.body;
  const desiredReturnTo = getSafeInternalPath(
    req.body?.next || req.body?.returnTo || req.query?.returnTo || req.query?.next
  );

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
      url.searchParams.set('error', 'Email already registered. Please sign in.');
      if (desiredReturnTo) url.searchParams.set('returnTo', desiredReturnTo);
      return res.redirect(303, url.toString());
    }
    return sendResponse(res, null, 'Email already registered.', 400);
  }

  // Creamos con password temporal (hook del modelo lo hashea)
  const tempPassword = generatePolicyCompliantPassword();
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

  const createPasswordHtml = renderEmailLayout({
    previewText: 'Create your password to finish your registration at Ox Gallery.',
    title: 'Create your password',
    greeting: name || newUser.name || '',
    bodyLines: [
      'Thank you for joining Ox Gallery.',
      'Click the button to create your password and start exploring the community.',
      'This link expires in 24 hours to keep your account secure.'
    ],
    actionLabel: 'Create password',
    actionUrl: createPasswordLink,
    footerLines: ['If you did not start this registration, you can ignore this email.']
  });

  await sendEmail({
    to: newUser.email,
    subject: 'Create your password',
    text: `Welcome, ${name}\nClick the link below to create your password:\n${createPasswordLink}\nThis link expires in 24 hours.`,
    html: createPasswordHtml
  });

  if (wantsHTML(req)) {
    const url = new URL(`${req.protocol}://${req.get('host')}/login`);
    url.searchParams.set('success', 'Registration started. Check your email to create your password.');
    if (desiredReturnTo) url.searchParams.set('returnTo', desiredReturnTo);
    return res.redirect(303, url.toString());
  }
  return sendResponse(res, null, 'Registration started. Check your email to create your password.', 201);
});

/* ------------------------------------------------------------------ */
/*  Login                                                             */
/* ------------------------------------------------------------------ */
exports.login = catchAsync(async (req, res, next) => {
  const { email, password, remember } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const desiredReturnTo = getSafeInternalPath(
    req.body?.next ||
    req.body?.returnTo ||
    req.query?.returnTo ||
    req.query?.next ||
    (req.session && req.session.returnTo)
  );

  // El schema oculta password → hay que seleccionarlo para comparar
  const user = await User.findOne({ email: normalizedEmail, active: true })
    .select('+password lastLoginAt');

  if (!user || !(await user.correctPassword(password))) {
    if (wantsHTML(req)) {
      const url = new URL(`${req.protocol}://${req.get('host')}/login`);
      url.searchParams.set('error', 'Email or password is incorrect.');
      if (desiredReturnTo) url.searchParams.set('returnTo', desiredReturnTo);
      return res.redirect(303, url.toString());
    }
    return next(new AppError('Email or password is incorrect.', 401));
  }

  const token = signToken(user._id);

  // "remember" puede venir como on/true/1/etc.
  const rememberMe = parseRememberMe(remember);
  const cookieOptions = getJwtCookieOptions({ rememberMe });
  res.cookie('jwt', token, cookieOptions);

  const isFirstLogin = !user.lastLoginAt;
  await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() }, { runValidators: false });

  // open-redirect safe
  const nextFromBody = getSafeInternalPath(req.body?.next || req.body?.returnTo);
  const nextFromQuery = getSafeInternalPath(req.query?.next || req.query?.returnTo);
  const nextFromSession = getSafeInternalPath(req.session?.returnTo);
  if (req.session && req.session.returnTo) req.session.returnTo = undefined;

  const fallbackUrl = isFirstLogin ? '/welcome' : '/?welcome=1';
  const destination = nextFromBody || nextFromSession || nextFromQuery || fallbackUrl;

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
  return sendResponse(res, null, 'Session closed.');
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
    return sendResponse(res, null, 'If the email exists, we will send a link.');
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

  const forgotPasswordHtml = renderEmailLayout({
    previewText: 'Use this temporary link to reset your Ox Gallery password.',
    title: 'Reset your password',
    greeting: user.name || '',
    bodyLines: [
      'We received a request to reset your password.',
      'Click the button to continue. This link is valid for 15 minutes.',
      'If you did not request this change, you can ignore this message.'
    ],
    actionLabel: 'Reset password',
    actionUrl: resetLink
  });

  await sendEmail({
    to: user.email,
    subject: 'Reset your password',
    text: `Click the link below to reset your password:\n${resetLink}\nThis link expires in 15 minutes.`,
    html: forgotPasswordHtml
  });

  // Flujos HTML: redirigir con mensaje amigable
  if (wantsHTML(req)) {
    const url = new URL(`${req.protocol}://${req.get('host')}/forgot-password`);
    url.searchParams.set('success', 'If the email exists, we will send you a link to reset your password.');
    return res.redirect(303, url.toString());
  }

  return sendResponse(res, null, 'If the email exists, we will send a link.');
});

/* ------------------------------------------------------------------ */
/*  Reset Password                                                    */
/* ------------------------------------------------------------------ */
exports.resetPassword = catchAsync(async (req, res) => {
  const { uid, token, newPassword, remember } = req.body;
  if (!uid || !token || !newPassword) {
    return sendResponse(res, null, 'Incomplete data.', 400);
  }

  if (!isModeratePassword(newPassword)) {
    if (wantsHTML(req)) {
      const url = new URL(`${req.protocol}://${req.get('host')}/reset-password`);
      url.searchParams.set('uid', uid);
      url.searchParams.set('token', token);
      if (req.body.type) url.searchParams.set('type', req.body.type);
      url.searchParams.set('policyError', MODERATE_PASSWORD_MESSAGE);
      return res.redirect(303, url.toString());
    }
    return sendResponse(res, null, MODERATE_PASSWORD_MESSAGE, 400);
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
    return sendResponse(res, null, 'Invalid or expired token.', 400);
  }

  const user = await User.findById(uid).select('+email +lastLoginAt');
  if (!user) {
    return sendResponse(res, null, 'User not found.', 404);
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

  const passwordUpdatedHtml = renderEmailLayout({
    previewText: 'Password change confirmation from Ox Gallery.',
    title: 'Your password has been changed',
    greeting: user.name || '',
    bodyLines: [
      'Your password was updated successfully.',
      'If you do not recognize this change, contact us immediately at soporte@galeriadelox.com.'
    ]
  });

  await sendEmail({
    to: user.email,
    subject: 'Your password has been changed',
    text: `Hi ${user.name || ''}\nYour password has been updated successfully.`,
    html: passwordUpdatedHtml
  });

  // Redirige si es HTML (siempre) al welcome
  if (wantsHTML(req)) {
    return res.redirect(303, '/welcome');
  }
  // Para clientes API, indicar siguiente destino
  return sendResponse(res, { next: '/welcome' }, 'Password updated successfully.');
});

/* ------------------------------------------------------------------ */
/*  Update Password (usuario autenticado)                             */
/* ------------------------------------------------------------------ */
exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};
  const userId = req.user?.id || req.user?._id;

  if (!userId) return next(new AppError('Not authorized', 401));
  if (!currentPassword || !newPassword) {
    return sendResponse(res, null, 'You must send the current and new password.', 400);
  }

  if (!isModeratePassword(newPassword)) {
    return sendResponse(res, null, MODERATE_PASSWORD_MESSAGE, 400);
  }

  const user = await User.findById(userId).select('+password +email +lastLoginAt');
  if (!user || !(await user.correctPassword(currentPassword))) {
    return sendResponse(res, null, 'Your current password is incorrect.', 400);
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

  const authPasswordUpdatedHtml = renderEmailLayout({
    previewText: 'Password change confirmation from Ox Gallery.',
    title: 'Your password has been changed',
    greeting: user.name || '',
    bodyLines: [
      'Your password was updated successfully.',
      'If you do not recognize this change, contact us immediately at soporte@galeriadelox.com.'
    ]
  });

  await sendEmail({
    to: user.email,
    subject: 'Your password has been changed',
    text: `Hi ${user.name || ''}\nYour password has been updated successfully.`,
    html: authPasswordUpdatedHtml
  });

  // Redirige si es HTML y es el primer login
  const wantsHTML = req.accepts(['html', 'json']) === 'html';
  if (wantsHTML && isFirstLogin) {
    return res.redirect(303, '/welcome');
  }
  if (isFirstLogin) {
    return sendResponse(res, { next: '/welcome' }, 'Password updated successfully.');
  }
  return sendResponse(res, null, 'Password updated successfully.');
});
