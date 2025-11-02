// middlewares/uploadPdf.js
const multer = require('multer');
const AppError = require('@utils/appError');

function pdfFileFilter(req, file, cb) {
  try {
    const mt = (file && file.mimetype || '').toLowerCase();
    const name = (file && file.originalname || '').toLowerCase();
    const ok = mt === 'application/pdf' || mt === 'application/x-pdf' || name.endsWith('.pdf');
    if (!ok) return cb(new AppError('Solo se aceptan archivos PDF (.pdf).', 400));
    cb(null, true);
  } catch (e) {
    cb(new AppError('Archivo inválido. Adjunta un PDF.', 400));
  }
}

function createPdfMulter(maxMb = 10) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Number(maxMb) * 1024 * 1024 },
    fileFilter: pdfFileFilter
  });
}

function pdfUploadSingle(field = 'resume', maxMb = 10) {
  return createPdfMulter(maxMb).single(field);
}

module.exports = { pdfFileFilter, createPdfMulter, pdfUploadSingle };

