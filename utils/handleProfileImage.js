/**
 * Utilidad para gestionar la imagen de perfil de un usuario.
 * Permite subir, actualizar o eliminar la imagen de perfil en Cloudinary y sincronizar los datos del usuario.
 */
const { upload, uploadBuffer, deleteImage } = require('@utils/cloudinaryImage');

async function handleProfileImage(user, req, filteredBody) {
  // Si viene una nueva imagen, elimina la anterior y sube la nueva
  if (req.file) {
    if (user.profileImagePublicId) {
      await deleteImage(user.profileImagePublicId);
    }
    let imageResult;
    if (req.file.path) {
      imageResult = await upload(req.file.path);
    } else if (req.file.buffer) {
      imageResult = await uploadBuffer(req.file.buffer);
    } else {
      throw new Error('Archivo de imagen no disponible para subir');
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
