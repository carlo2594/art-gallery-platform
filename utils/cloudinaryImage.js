/**
 * Utilidades para gestionar imágenes en Cloudinary.
 * Permite subir, eliminar y actualizar imágenes en la nube, manejando archivos temporales locales.
 */
const cloudinary = require('@services/cloudinary');
const fs = require('fs');
const stream = require('stream');

// Sube una imagen a Cloudinary
async function upload(filePath, folder = 'galeria-del-ox') {
  const result = await cloudinary.uploader.upload(filePath, { folder });
  // Borra el archivo temporal si existe
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return result;
}

// Sube una imagen a Cloudinary desde un Buffer
async function uploadBuffer(buffer, folder = 'galeria-del-ox') {
  return new Promise((resolve, reject) => {
    const pass = new stream.PassThrough();
    const options = { folder };
    const uploadStream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    pass.end(buffer);
    pass.pipe(uploadStream);
  });
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
  uploadBuffer,
  deleteImage,
  updateImage
};
