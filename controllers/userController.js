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

// CRUD estÃ¡ndar
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
  if (req.body.password || req.body.newPassword) {
    return next(new AppError('Esta ruta no es para actualizar la contraseÃ±a.', 400));
  }

  // Solo permite actualizar estos campos
  const filteredBody = filterObject(req.body, 'name', 'email', 'profileImage', 'bio');

  // Busca el usuario actual
  const user = await User.findById(req.user.id);
  if (!user) return next(new AppError('Usuario no encontrado.', 404));

  const oldEmail = user.email;

  // Si viene una nueva imagen, elimina la anterior y sube la nueva
  if (req.file) {
    if (user.profileImagePublicId) {
      await deleteImage(user.profileImagePublicId);
    }
    const imageResult = await upload(req.file.path);
    filteredBody.profileImage = imageResult.secure_url;
    filteredBody.profileImagePublicId = imageResult.public_id;
  }

  // En updateMe y updateUser, despuÃ©s de obtener el usuario y antes de guardar:
  if (
    ('profileImage' in filteredBody) &&
    (!filteredBody.profileImage || filteredBody.profileImage === 'null' || filteredBody.profileImage === '')
  ) {
    if (user.profileImagePublicId) {
      await deleteImage(user.profileImagePublicId);
    }
    user.profileImage = undefined;
    user.profileImagePublicId = undefined;
    // Elimina el campo para que no quede la referencia
    delete filteredBody.profileImage;
    delete filteredBody.profileImagePublicId;
  }

  await handleProfileImage(user, req, filteredBody);

  // Actualiza los campos permitidos
  Object.assign(user, filteredBody);
  try {
    await user.save();
  } catch (err) {
    return handleDuplicateKeyError(err, res, next);
  }

  // Si el email cambiÃ³, notifica al nuevo email
  if (filteredBody.email && filteredBody.email !== oldEmail) {
    await sendMail({
      to: filteredBody.email,
      subject: 'ConfirmaciÃ³n de cambio de correo',
      text: `Hola ${user.name}, tu correo ha sido actualizado exitosamente en GalerÃ­a del Ox. 
Si no realizaste este cambio, por favor contÃ¡ctanos de inmediato en soporte@galeriadelox.com.`
    });
  }

  sendResponse(res, user, 'Perfil actualizado');
});

// Desactivar cuenta (soft delete)
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });
  sendResponse(res, null, 'Cuenta desactivada', 204);
});

// Cambiar contraseÃ±a autenticado
exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');

  if (!(await user.correctPassword(req.body.currentPassword))) {
    return next(new AppError('La contraseÃ±a actual es incorrecta', 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendResponse(res, null, 'ContraseÃ±a actualizada correctamente');
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


// ADMIN: Forzar cambio de contraseÃ±a
exports.resetUserPassword = catchAsync(async (req, res, next) => {
  const { newPassword } = req.body;

  if (!newPassword) {
    return next(new AppError('Debes proporcionar una nueva contraseÃ±a', 400));
  }

  const user = await User.findById(req.params.id).select('+password');
  if (!user) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  user.password = newPassword;
  await user.save();

  sendResponse(res, null, 'ContraseÃ±a restablecida por admin');
});

// ADMIN: Reactivar un usuario desactivado
exports.reactivateUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('+active');

  if (!user) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  if (user.active) {
    return next(new AppError('El usuario ya estÃ¡ activo.', 400));
  }

  user.active = true;
  await user.save();

  sendResponse(res, user, 'Usuario reactivado');
});

// ADMIN: Actualizar usuario (sin permitir cambiar contraseÃ±a aquÃ­)
exports.updateUser = catchAsync(async (req, res, next) => {
  if (req.body.password) {
    return next(new AppError('No puedes actualizar la contraseÃ±a desde esta ruta.', 400));
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

  // Si viene una nueva imagen, elimina la anterior y sube la nueva
  if (req.file) {
    if (user.profileImagePublicId) {
      await deleteImage(user.profileImagePublicId);
    }
    const imageResult = await upload(req.file.path);
    filteredBody.profileImage = imageResult.secure_url;
    filteredBody.profileImagePublicId = imageResult.public_id;
  }

  // En updateMe y updateUser, despuÃ©s de obtener el usuario y antes de guardar:
  if (
    ('profileImage' in filteredBody) &&
    (!filteredBody.profileImage || filteredBody.profileImage === 'null' || filteredBody.profileImage === '')
  ) {
    if (user.profileImagePublicId) {
      await deleteImage(user.profileImagePublicId);
    }
    user.profileImage = undefined;
    user.profileImagePublicId = undefined;
    // Elimina el campo para que no quede la referencia
    delete filteredBody.profileImage;
    delete filteredBody.profileImagePublicId;
  }

  await handleProfileImage(user, req, filteredBody);

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
    return next(new AppError('El usuario ya estÃ¡ desactivado.', 400));
  }

  user.active = false;
  await user.save();

  sendResponse(res, user, 'Usuario desactivado');
});

// ADMIN: Crear usuario (similar a signup) y enviar correo para definir contraseÃ±a
exports.adminCreateUser = catchAsync(async (req, res, next) => {
  const { email, name, role } = req.body || {};
  if (!email) {
    return next(new AppError('El email es requerido', 400));
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return next(new AppError('El correo ya estÃ¡ registrado.', 400));
  }

  const tempPassword = crypto.randomBytes(16).toString('hex');
  const payload = { name: name || normalizedEmail.split('@')[0], email: normalizedEmail, password: tempPassword };
  if (role && ['collector','artist','admin'].includes(role)) payload.role = role;

  const newUser = await User.create(payload);

  // Generar token para que el usuario cree su contraseÃ±a
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h
  await PasswordResetToken.create({ userId: newUser._id, tokenHash, expiresAt, used: false });

  const createPasswordLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?uid=${newUser._id}&token=${token}&type=new`;

  await sendMail({
    to: newUser.email,
    subject: 'Crea tu contraseÃ±a',
    text: `Bienvenido, ${newUser.name}\nHaz clic en el siguiente enlace para crear tu contraseÃ±a:\n${createPasswordLink}\nEste enlace expira en 24 horas.`
  });

  return sendResponse(res, { userId: newUser._id }, 'Usuario creado. Se enviÃ³ un correo para crear la contraseÃ±a.', 201);
});

// ADMIN: Subir/actualizar o eliminar imagen de perfil del usuario
// Acepta multipart/form-data con campo 'profileImage'. Si se envÃ­a profileImage vacÃ­o en body, elimina la imagen.
exports.updateUserProfileImage = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('+active');
  if (!user) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  const filteredBody = {};
  // Permitir eliminaciÃ³n explÃ­cita si llega un campo profileImage vacÃ­o
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'profileImage')) {
    filteredBody.profileImage = req.body.profileImage;
  }

  try {
    await handleProfileImage(user, req, filteredBody);
  } catch (e) {
    return next(new AppError('No se pudo procesar la imagen de perfil. ' + (e && e.message ? e.message : ''), 500));
  }

  Object.assign(user, filteredBody);
  try {
    await user.save();
  } catch (err) {
    return handleDuplicateKeyError(err, res, next);
  }

  sendResponse(res, user, 'Imagen de perfil actualizada');
});

// ADMIN: Lookup de usuario por email (para validaciÃ³n en UI)
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
