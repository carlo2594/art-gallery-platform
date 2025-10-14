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
  if (req.body.password || req.body.newPassword) {
    return next(new AppError('Esta ruta no es para actualizar la contraseña.', 400));
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

  // En updateMe y updateUser, después de obtener el usuario y antes de guardar:
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

  // Si el email cambió, notifica al nuevo email
  if (filteredBody.email && filteredBody.email !== oldEmail) {
    await sendMail({
      to: filteredBody.email,
      subject: 'Confirmación de cambio de correo',
      text: `Hola ${user.name}, tu correo ha sido actualizado exitosamente en Galería del Ox. 
Si no realizaste este cambio, por favor contáctanos de inmediato en soporte@galeriadelox.com.`
    });
  }

  sendResponse(res, user, 'Perfil actualizado');
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
  const { role } = req.body;
  if (!['admin', 'artist'].includes(role)) {
    return next(new AppError('Rol inválido', 400));
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, {
    new: true,
    runValidators: true
  });

  if (!user) {
    return next(new AppError('Usuario no encontrado', 404));
  }

  sendResponse(res, user, 'Rol actualizado');
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
  const user = await User.findById(req.params.id);

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
  const filteredBody = filterObject(req.body, 'name', 'email', 'profileImage', 'bio', 'active');

  const user = await User.findById(req.params.id);
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

  // En updateMe y updateUser, después de obtener el usuario y antes de guardar:
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
  const user = await User.findById(req.params.id);

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
