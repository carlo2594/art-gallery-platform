/**
 * Utilidad para gestionar la imagen de perfil de un usuario.
 * Permite subir, actualizar o eliminar la imagen de perfil en Cloudinary y sincronizar los datos del usuario.
 */
const { upload, uploadBuffer } = require('@utils/cloudinaryImage');
const DEBUG = process.env.NODE_ENV !== 'production';
const dlog = (...args) => { try { if (DEBUG) console.log('[handleProfileImage]', ...args); } catch(_) {} };
const AppError = require('@utils/appError');
const sizeOf = require('image-size');

async function handleProfileImage(user, req, filteredBody) {
  // Si viene una nueva imagen, sube la nueva y registra la anterior para eliminarla tras guardar
  if (req.file) {
    dlog('req.file present', {
      hasPath: !!req.file.path,
      hasBuffer: !!req.file.buffer,
      mimetype: req.file.mimetype,
      size: req.file.size,
      originalname: req.file.originalname
    });
    let source = null;
    if (req.file.path) {
      source = req.file.path;
    } else if (req.file.buffer) {
      source = req.file.buffer;
    }
    if (!source) {
      throw new AppError('Archivo de imagen no disponible para subir.', 400);
    }

    let dimensions;
    try {
      dimensions = sizeOf(source);
      dlog('image dimensions', dimensions);
    } catch (err) {
      dlog('sizeOf failed', err && err.message);
      throw new AppError('No se pudo validar la imagen seleccionada.', 400);
    }

    if (!dimensions || !dimensions.width || !dimensions.height) {
      throw new AppError('No se pudo verificar el tamano de la imagen.', 400);
    }

    if (dimensions.width <= dimensions.height) {
      throw new AppError('La foto de perfil debe ser horizontal (mas ancha que alta).', 400);
    }

    // Registrar la imagen anterior (si existía) para eliminarla post-guardado
    if (user.profileImagePublicId) {
      req._oldProfileImagePublicId = user.profileImagePublicId;
      dlog('will remove old image after save', req._oldProfileImagePublicId);
    }

    // Subir a Cloudinary solicitando una derivación optimizada (eager): WebP, ancho máx. 1600px, calidad auto
    const eager = [{ width: 1600, crop: 'limit', format: 'webp', quality: 'auto' }];
    let imageResult;
    if (req.file.path) {
      dlog('uploading via path (with eager transform)');
      imageResult = await upload(req.file.path, 'galeria-del-ox', { eager });
    } else {
      dlog('uploading via buffer (with eager transform)');
      imageResult = await uploadBuffer(req.file.buffer, 'galeria-del-ox', { eager });
    }
    const eagerUrl = imageResult && imageResult.eager && imageResult.eager[0] && imageResult.eager[0].secure_url;
    dlog('uploaded image public_id', imageResult && imageResult.public_id, 'eagerUrl', eagerUrl);
    filteredBody.profileImage = eagerUrl || imageResult.secure_url;
    filteredBody.profileImagePublicId = imageResult.public_id;
  }

  // Si se solicita eliminar la imagen
  if (
    ('profileImage' in filteredBody) &&
    (!filteredBody.profileImage || filteredBody.profileImage === 'null' || filteredBody.profileImage === '')
  ) {
    if (user.profileImagePublicId) {
      req._oldProfileImagePublicId = user.profileImagePublicId;
      dlog('requested deletion of image; will remove old after save', req._oldProfileImagePublicId);
    }
    user.profileImage = undefined;
    user.profileImagePublicId = undefined;
    delete filteredBody.profileImage;
    delete filteredBody.profileImagePublicId;
  }
}

module.exports = handleProfileImage;
