/**
 * Utilidad para gestionar la imagen de perfil de un usuario.
 * Permite subir, actualizar o eliminar la imagen de perfil en Cloudinary y sincronizar los datos del usuario.
 */
const { upload, uploadBuffer, deleteImage } = require('@utils/cloudinaryImage');
const AppError = require('@utils/appError');
const sizeOf = require('image-size');

async function handleProfileImage(user, req, filteredBody) {
  // Si viene una nueva imagen, elimina la anterior y sube la nueva
  if (req.file) {
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
    } catch (err) {
      throw new AppError('No se pudo validar la imagen seleccionada.', 400);
    }

    if (!dimensions || !dimensions.width || !dimensions.height) {
      throw new AppError('No se pudo verificar el tamano de la imagen.', 400);
    }

    if (dimensions.width <= dimensions.height) {
      throw new AppError('La foto de perfil debe ser horizontal (mas ancha que alta).', 400);
    }

    if (user.profileImagePublicId) {
      await deleteImage(user.profileImagePublicId);
    }

    let imageResult;
    if (req.file.path) {
      imageResult = await upload(req.file.path);
    } else {
      imageResult = await uploadBuffer(req.file.buffer);
    }
    filteredBody.profileImage = imageResult.secure_url;
    filteredBody.profileImagePublicId = imageResult.public_id;
  }

  // Si se solicita eliminar la imagen
  if (
    ('profileImage' in filteredBody) &&
    (!filteredBody.profileImage || filteredBody.profileImage === 'null' || filteredBody.profileImage === '')
  ) {
    if (user.profileImagePublicId) {
      await deleteImage(user.profileImagePublicId);
    }
    user.profileImage = undefined;
    user.profileImagePublicId = undefined;
    delete filteredBody.profileImage;
    delete filteredBody.profileImagePublicId;
  }
}

module.exports = handleProfileImage;
