/**
 * Utilidad para gestionar la imagen de portada (cover) de un usuario.
 * Sube, actualiza o elimina la portada en Cloudinary y sincroniza los campos en el usuario.
 */
const { upload, uploadBuffer } = require('@utils/cloudinaryImage');
const AppError = require('@utils/appError');
const sizeOf = require('image-size');

const DEBUG = process.env.NODE_ENV !== 'production';
const dlog = (...args) => { try { if (DEBUG) console.log('[handleCoverImage]', ...args); } catch(_) {} };
const MAX_COVER_DIMENSION = 8000; // px por lado
const COVER_TRANSFORM_WIDTH = 2560; // px maximo al generar la version web

async function handleCoverImage(user, req, filteredBody) {
  // Subir nueva imagen
  if (req.file) {
    dlog('req.file present', {
      hasPath: !!req.file.path,
      hasBuffer: !!req.file.buffer,
      mimetype: req.file.mimetype,
      size: req.file.size,
      originalname: req.file.originalname
    });
    let source = null;
    if (req.file.path) source = req.file.path;
    else if (req.file.buffer) source = req.file.buffer;
    if (!source) throw new AppError('Archivo de imagen no disponible para subir.', 400);

    let dimensions;
    try {
      dimensions = sizeOf(source);
      dlog('image dimensions', dimensions);
    } catch (err) {
      dlog('sizeOf failed', err && err.message);
      throw new AppError('No se pudo validar la imagen seleccionada.', 400);
    }
    if (!dimensions || !dimensions.width || !dimensions.height) {
      throw new AppError('No se pudo verificar el tamaño de la imagen.', 400);
    }
    // Portada debe ser horizontal también
    if (dimensions.width <= dimensions.height) {
      throw new AppError('La portada debe ser horizontal (más ancha que alta).', 400);
    }

    if (dimensions.width > MAX_COVER_DIMENSION || dimensions.height > MAX_COVER_DIMENSION) {
      throw new AppError('La portada no puede superar ' + MAX_COVER_DIMENSION + 'px por lado.', 400);
    }

    // Registrar anterior para eliminar post-guardado
    if (user.coverImagePublicId) {
      req._oldCoverImagePublicId = user.coverImagePublicId;
      dlog('will remove old cover after save', req._oldCoverImagePublicId);
    }

    // Transformación sugerida para portada (máx 2560px ancho, WebP, calidad auto)
    const eager = [{ width: COVER_TRANSFORM_WIDTH, crop: 'limit', format: 'webp', quality: 'auto' }];
    let imageResult;
    if (req.file.path) imageResult = await upload(req.file.path, 'galeria-del-ox', { eager });
    else imageResult = await uploadBuffer(req.file.buffer, 'galeria-del-ox', { eager });
    const eagerUrl = imageResult && imageResult.eager && imageResult.eager[0] && imageResult.eager[0].secure_url;
    filteredBody.coverImage = eagerUrl || imageResult.secure_url;
    filteredBody.coverImagePublicId = imageResult.public_id;
  }

  // Eliminar portada
  if (
    ('coverImage' in filteredBody) &&
    (!filteredBody.coverImage || filteredBody.coverImage === 'null' || filteredBody.coverImage === '')
  ) {
    if (user.coverImagePublicId) {
      req._oldCoverImagePublicId = user.coverImagePublicId;
      dlog('requested deletion of cover; will remove old after save', req._oldCoverImagePublicId);
    }
    user.coverImage = undefined;
    user.coverImagePublicId = undefined;
    delete filteredBody.coverImage;
    delete filteredBody.coverImagePublicId;
  }
}

module.exports = handleCoverImage;

