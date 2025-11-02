const User = require('@models/userModel');
const catchAsync = require('@utils/catchAsync');
const sendResponse = require('@utils/sendResponse');
const factory = require('@utils/handlerFactory');
const filterObject = require('@utils/filterObject');
const AppError = require('@utils/appError');
const Artwork = require('@models/artworkModel');
const Exhibition = require('@models/exhibitionModel');
const crypto = require('crypto');
const PasswordResetToken = require('@models/passwordResetTokenModel');
const { normalizeEmail } = require('@utils/emailUtils');
const { sendMail } = require('@services/mailer');

const { upload, deleteImage } = require('@utils/cloudinaryImage');
const handleProfileImage = require('@utils/handleProfileImage');
const handleDuplicateKeyError = require('@utils/handleDuplicateKeyError');

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
  const DEBUG = process.env.NODE_ENV !== 'production';
  const dlog = (...args) => { try { if (DEBUG) console.log('[updateMe]', ...args); } catch(_) {} };
  if (req.body.password || req.body.newPassword) {
    return next(new AppError('Esta ruta no es para actualizar la contraseña.', 400));
  }

  // Solo permite actualizar estos campos
  const filteredBody = filterObject(
    req.body,
    'name',
    'email',
    'profileImage',
    'bio',
    'firstName',
    'lastName',
    'headline',
    'location',
    'website',
    'country',
    'social'
  );

  // Busca el usuario actual
  const user = await User.findById(req.user.id);
  if (!user) return next(new AppError('Usuario no encontrado.', 404));

  const oldEmail = user.email;
  dlog('incoming body keys', Object.keys(req.body || {}));
  dlog('has file?', !!req.file, req.file && { mimetype: req.file.mimetype, size: req.file.size, originalname: req.file.originalname });

  // Manejo de imagen de perfil (subir/actualizar/eliminar)
  try {
    await handleProfileImage(user, req, filteredBody);
  } catch (e) {
    if (e instanceof AppError) return next(e);
    return next(new AppError('No se pudo procesar la imagen de perfil.', 500));
  }

  // Normalizar objeto social para evitar campos inesperados
  if (filteredBody.social && typeof filteredBody.social === 'object') {
    const allowedSocial = ['instagram', 'x', 'facebook', 'linkedin', 'youtube', 'tiktok'];
    const s = {};
    for (const k of allowedSocial) {
      if (Object.prototype.hasOwnProperty.call(filteredBody.social, k) && filteredBody.social[k] !== undefined) {
        s[k] = filteredBody.social[k];
      }
    }
    filteredBody.social = s;
  }

  // Si llegan firstName/lastName y no se envía name, construir name a partir de ellos
  if (!('name' in filteredBody)) {
    const fn = (filteredBody.firstName || '').trim();
    const ln = (filteredBody.lastName || '').trim();
    const combined = `${fn} ${ln}`.trim();
    if (combined) filteredBody.name = combined;
  }

  // Actualiza los campos permitidos
  Object.assign(user, filteredBody);
  try {
    await user.save();
  } catch (err) {
    return handleDuplicateKeyError(err, res, next);
  }

  // Si se subió/eliminó imagen, eliminar la anterior después de guardar (no bloquear respuesta)
  if (req._oldProfileImagePublicId && req._oldProfileImagePublicId !== user.profileImagePublicId) {
    deleteImage(req._oldProfileImagePublicId).catch(() => {});
  }
  dlog('saved user image', { profileImage: user.profileImage, profileImagePublicId: user.profileImagePublicId });

  // Si el email cambió, notifica al nuevo email
  if (filteredBody.email && filteredBody.email !== oldEmail) {
    await sendMail({
      to: filteredBody.email,
      subject: 'Confirmación de cambio de correo',
      text: `Hola ${user.name}, tu correo ha sido actualizado exitosamente en Galería del Ox. 
Si no realizaste este cambio, por favor contáctanos de inmediato en soporte@galeriadelox.com.`
    });
  }

  const acceptHeader = req.headers.accept || '';
  if (!acceptHeader.includes('application/json')) {
    return res.redirect(303, '/edit-profile?status=perfil-actualizado');
  }
  return sendResponse(res, user, 'Perfil actualizado');
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
  const { role } = req.body || {};
  if (!['admin', 'artist', 'collector'].includes(role)) {
    return next(new AppError('Rol inválido', 400));
  }

  const target = await User.findById(req.params.id).select('+role');
  if (!target) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  // Evita que un admin se baje a sí mismo
  if (String(req.user._id) === String(target._id) && role !== 'admin') {
    return next(new AppError('No puedes cambiar tu propio rol a un rol inferior.', 403));
  }

  // Evita cambiar el rol de otro admin (a menos que sea él mismo)
  if (target.role === 'admin' && String(req.user._id) !== String(target._id)) {
    return next(new AppError('No puedes cambiar el rol de otro administrador.', 403));
  }

  if (target.role === role) {
    return sendResponse(res, target, 'Rol sin cambios');
  }

  target.role = role;
  await target.save();
  sendResponse(res, target, 'Rol actualizado');
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
  const user = await User.findById(req.params.id).select('+active');

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
  const filteredBody = filterObject(
    req.body,
    'name',
    'email',
    'profileImage',
    'bio',
    'location',
    'website',
    'social',
    'active'
  );

  const user = await User.findById(req.params.id).select('+active');
  if (!user) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  try {
    await handleProfileImage(user, req, filteredBody);
  } catch (e) {
    if (e instanceof AppError) return next(e);
    return next(new AppError('No se pudo procesar la imagen de perfil. ' + (e && e.message ? e.message : ''), 500));
  }

  Object.assign(user, filteredBody);
  try {
    await user.save();
  } catch (err) {
    return handleDuplicateKeyError(err, res, next);
  }

  sendResponse(res, user, 'Usuario actualizado');
});

// ADMIN: Desactivar un usuario (soft delete)
exports.deactivateUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('+active');

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

// ADMIN: Crear usuario (similar a signup) y enviar correo para definir contraseña
exports.adminCreateUser = catchAsync(async (req, res, next) => {
  const { email, name, role } = req.body || {};
  if (!email) {
    return next(new AppError('El email es requerido', 400));
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return next(new AppError('El correo ya está registrado.', 400));
  }

  const tempPassword = crypto.randomBytes(16).toString('hex');
  const payload = { name: name || normalizedEmail.split('@')[0], email: normalizedEmail, password: tempPassword };
  if (role && ['collector','artist','admin'].includes(role)) payload.role = role;

  const newUser = await User.create(payload);

  // Generar token para que el usuario cree su contraseña
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h
  await PasswordResetToken.create({ userId: newUser._id, tokenHash, expiresAt, used: false });

  const createPasswordLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?uid=${newUser._id}&token=${token}&type=new`;

  await sendMail({
    to: newUser.email,
    subject: 'Crea tu contraseña',
    text: `Bienvenido, ${newUser.name}\nHaz clic en el siguiente enlace para crear tu contraseña:\n${createPasswordLink}\nEste enlace expira en 24 horas.`
  });

  return sendResponse(res, { userId: newUser._id }, 'Usuario creado. Se envió un correo para crear la contraseña.', 201);
});

// Subir/actualizar o eliminar imagen de perfil del usuario autenticado
// Acepta multipart/form-data con campo 'profileImage'. Si se envía profileImage vacío en body, elimina la imagen.
exports.updateMyProfileImage = catchAsync(async (req, res, next) => {
  const DEBUG = process.env.NODE_ENV !== 'production';
  const dlog = (...args) => { try { if (DEBUG) console.log('[updateMyProfileImage]', ...args); } catch(_) {} };
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  const filteredBody = {};
  // Permitir eliminación explícita si llega un campo profileImage vacío
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'profileImage')) {
    filteredBody.profileImage = req.body.profileImage;
  }
  dlog('accept', req.headers && req.headers.accept);
  dlog('body keys', Object.keys(req.body || {}));
  dlog('has file?', !!req.file, req.file && { mimetype: req.file.mimetype, size: req.file.size, originalname: req.file.originalname });

  try {
    await handleProfileImage(user, req, filteredBody);
  } catch (e) {
    if (e instanceof AppError) return next(e);
    return next(new AppError('No se pudo procesar la imagen de perfil. ' + (e && e.message ? e.message : ''), 500));
  }

  Object.assign(user, filteredBody);
  try {
    await user.save();
  } catch (err) {
    return handleDuplicateKeyError(err, res, next);
  }

  // Eliminar imagen anterior post-guardado si aplica
  if (req._oldProfileImagePublicId && req._oldProfileImagePublicId !== user.profileImagePublicId) {
    deleteImage(req._oldProfileImagePublicId).catch(() => {});
  }
  dlog('saved user image', { profileImage: user.profileImage, profileImagePublicId: user.profileImagePublicId, removedOld: !!req._oldProfileImagePublicId });

  // Si la petición no es JSON (fallback de formularios), redirigir a la vista
  const acceptHeader = req.headers.accept || '';
  if (!acceptHeader.includes('application/json')) {
    return res.redirect(303, '/edit-profile?tab=foto&status=foto-actualizada');
  }
  sendResponse(res, user, 'Imagen de perfil actualizada');
});

// ADMIN: Subir/actualizar o eliminar imagen de perfil del usuario
// Acepta multipart/form-data con campo 'profileImage'. Si se envía profileImage vacío en body, elimina la imagen.
exports.updateUserProfileImage = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('+active');
  if (!user) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  const filteredBody = {};
  // Permitir eliminación explícita si llega un campo profileImage vacío
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'profileImage')) {
    filteredBody.profileImage = req.body.profileImage;
  }

  try {
    await handleProfileImage(user, req, filteredBody);
  } catch (e) {
    if (e instanceof AppError) return next(e);
    return next(new AppError('No se pudo procesar la imagen de perfil. ' + (e && e.message ? e.message : ''), 500));
  }

  Object.assign(user, filteredBody);
  try {
    await user.save();
  } catch (err) {
    return handleDuplicateKeyError(err, res, next);
  }

  // Eliminar imagen anterior post-guardado si aplica
  if (req._oldProfileImagePublicId && req._oldProfileImagePublicId !== user.profileImagePublicId) {
    deleteImage(req._oldProfileImagePublicId).catch(() => {});
  }

  sendResponse(res, user, 'Imagen de perfil actualizada');
});

// ADMIN: Lookup de usuario por email (para validación en UI)
exports.lookupByEmail = catchAsync(async (req, res, next) => {
  const { normalizeEmail } = require('@utils/emailUtils');
  const raw = (req.query && req.query.email) || '';
  if (!raw) {
    return res.status(400).json({ status: 'fail', message: 'Email requerido' });
  }
  const email = normalizeEmail(raw);
  const user = await User.findOne({ email }).select('+email +role name _id');
  if (!user) {
    return sendResponse(res, { exists: false }, 'OK');
  }
  return sendResponse(res, {
    exists: true,
    user: {
      _id: user._id,
      name: user.name,
      role: user.role,
      email: user.email
    }
  }, 'OK');
});

// ADMIN: Buscar usuarios por nombre o email (limitado)
exports.searchUsers = catchAsync(async (req, res, next) => {
  const q = (req.query && (req.query.q || req.query.query)) || '';
  const role = (req.query && req.query.role) || '';
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  if (!q || String(q).trim() === '') {
    return sendResponse(res, { users: [] }, 'OK');
  }
  const s = String(q).trim();
  const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(escaped, 'i');
  const filter = { $or: [ { name: rx }, { email: rx } ] };
  if (role) filter.role = role;
  const users = await User.find(filter)
    .limit(limit)
    .sort({ lastLoginAt: -1, createdAt: -1 })
    .select('name email profileImage role')
    .lean();
  return sendResponse(res, { users }, 'OK');
});
