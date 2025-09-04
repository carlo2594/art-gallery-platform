// utils/cloudinaryImage.js
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const cloudinary = require('@services/cloudinary');

// Multer storage para subir imágenes a Cloudinary
defaultFolder = 'galeria-del-ox';
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: defaultFolder,
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, crop: 'limit' }]
  }
});

const upload = multer({ storage });

// Función para eliminar una imagen de Cloudinary
async function deleteImage(publicId) {
  if (!publicId) return;
  return cloudinary.uploader.destroy(publicId);
}

// Función para actualizar una imagen (borra la anterior y sube la nueva)
// Debe usarse junto con el middleware upload.single('image')
async function updateImage(oldPublicId, file) {
  if (oldPublicId) await deleteImage(oldPublicId);
  // file debe ser req.file después de pasar por upload.single('image')
  return {
    imageUrl: file.path,
    imagePublicId: file.filename
  };
}

module.exports = {
  upload,         // Middleware para subir imágenes
  deleteImage,    // Eliminar imagen de Cloudinary
  updateImage     // Actualizar imagen (borra la anterior y retorna info de la nueva)
};
