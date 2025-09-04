const cloudinary = require('@services/cloudinary');
const fs = require('fs');

// Sube una imagen a Cloudinary
async function upload(filePath, folder = 'galeria-del-ox') {
  const result = await cloudinary.uploader.upload(filePath, { folder });
  // Borra el archivo temporal si existe
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return result;
}

// Elimina una imagen de Cloudinary por public_id
async function deleteImage(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

// Actualiza una imagen: elimina la anterior y sube la nueva
async function updateImage(oldPublicId, newFilePath, folder = 'galeria-del-ox') {
  await deleteImage(oldPublicId);
  return upload(newFilePath, folder);
}

module.exports = {
  upload,
  deleteImage,
  updateImage
};