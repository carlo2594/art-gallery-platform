// scripts/upload-watermark.js
// Sube el logo de marca de agua a Cloudinary con public_id: "Logos/GOX_LOGO_09"
require('dotenv').config();
require('module-alias/register');
const path = require('path');
const fs = require('fs');
const cloudinary = require('@services/cloudinary');

(async () => {
  try {
    const localPath = path.resolve(__dirname, '..', 'public', 'Logos', 'GOX_LOGO_09.png');
    if (!fs.existsSync(localPath)) {
      console.error('Archivo no encontrado:', localPath);
      process.exit(1);
    }
    const res = await cloudinary.uploader.upload(localPath, {
      public_id: 'Logos/GOX_LOGO_09',
      overwrite: true,
      resource_type: 'image'
    });
    console.log('Uploaded public_id:', res.public_id);
    process.exit(0);
  } catch (err) {
    console.error('Upload failed:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
