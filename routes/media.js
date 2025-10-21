const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const upload = multer({ dest: path.join(__dirname, '..', 'tmp') });

const {
  uploadOriginal,
  signedOriginalUrl,
  buildPublicSrcSet,
  buildImgTag
} = require('@utils/media');

const router = express.Router();

// POST /api/upload  (multipart, campo: file)
router.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const { id, width, height } = await uploadOriginal(req.file.path);
    // cleanup multer temp file if still present
    try { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (_) {}
    return res.status(201).json({ id, width, height });
  } catch (err) {
    console.error('upload error:', err);
    return res.status(500).json({ message: 'Upload failed' });
  }
});

// GET /media/:id/public  -> JSON con src/srcset/sizes y html <img>
router.get('/media/:id/public', async (req, res) => {
  try {
    const publicId = req.params.id;
    const widths = (req.query.widths || '').split(',').map(s => parseInt(s, 10)).filter(n => Number.isFinite(n) && n > 0);
    const widthAttr = req.query.width ? parseInt(req.query.width, 10) : undefined;
    const heightAttr = req.query.height ? parseInt(req.query.height, 10) : undefined;
    const sizes = req.query.sizes || '(max-width: 800px) 100vw, 800px';
    const opts = { widths: widths.length ? widths : [400,800,1200], sizes, widthAttr, heightAttr };
    const data = buildPublicSrcSet(publicId, opts);
    const html = buildImgTag(publicId, opts);
    return res.json({ ...data, html });
  } catch (err) {
    console.error('media public error:', err);
    return res.status(500).json({ message: 'Failed to build public media' });
  }
});

// GET /admin/media/:id/original  -> requiere x-admin-secret
router.get('/admin/media/:id/original', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const publicId = req.params.id;
    const url = signedOriginalUrl(publicId);
    // Redirige a la URL firmada
    return res.redirect(302, url);
  } catch (err) {
    console.error('media original error:', err);
    return res.status(500).json({ message: 'Failed to generate original URL' });
  }
});

module.exports = router;
