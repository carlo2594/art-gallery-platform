const validator = require('validator');
const catchAsync = require('@utils/catchAsync');
const AppError = require('@utils/appError');
const { uploadBuffer } = require('@utils/cloudinaryImage');
const { sendMail } = require('@services/mailer');
const ArtistApplication = require('@models/artistApplicationModel');
const cloudinary = require('@services/cloudinary');

function wantsHTML(req) {
  try { return req.accepts(['html','json']) === 'html'; } catch (_) { return false; }
}

exports.create = catchAsync(async (req, res, next) => {
  const user = req.user;
  if (!user) return next(new AppError('No autorizado', 401));

  // Honeypot anti-spam: si viene relleno, responder éxito sin procesar
  try {
    const company = String(req.body.company || '').trim();
    if (company) {
      if (wantsHTML(req)) return res.redirect(303, '/become-artist?success=1');
      return res.status(201).json({ ok: true, spam: true });
    }
  } catch (_) {}

  // No permitir a artistas ya activos enviar solicitud
  if (user.role === 'artist') {
    const msg = 'Tu cuenta ya es de artista.';
    if (wantsHTML(req)) return res.redirect(303, `/become-artist?error=${encodeURIComponent(msg)}`);
    return next(new AppError(msg, 400));
  }

  // Evitar múltiples solicitudes abiertas
  const existing = await ArtistApplication.findOne({ user: user._id, status: { $in: ['pending','under_review'] } });
  if (existing) {
    const msg = 'Ya tienes una solicitud en revisión.';
    if (wantsHTML(req)) return res.redirect(303, `/become-artist?error=${encodeURIComponent(msg)}`);
    return next(new AppError(msg, 400));
  }

  const statement = String(req.body.statement || '').trim();
  // links puede llegar como 'links' repetido (array) o 'links[]'
  let rawLinks = req.body.links || req.body['links[]'] || req.body.link || [];
  if (!Array.isArray(rawLinks)) rawLinks = [rawLinks];
  const links = rawLinks
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i) // únicos
    .slice(0, 5); // máximo 5 enlaces
  const valid = links.filter(l => validator.isURL(l, { protocols: ['http','https'], require_protocol: true }));
  if (valid.length === 0) {
    const msg = 'Agrega al menos un enlace válido (http/https).';
    if (wantsHTML(req)) return res.redirect(303, `/become-artist?error=${encodeURIComponent(msg)}`);
    return next(new AppError(msg, 400));
  }

  // Archivo PDF obligatorio
  const file = req.file;
  if (!file) {
    const msg = 'Debes adjuntar tu CV en PDF.';
    if (wantsHTML(req)) return res.redirect(303, `/become-artist?error=${encodeURIComponent(msg)}`);
    return next(new AppError(msg, 400));
  }

  // Subir a Cloudinary como recurso "raw" (PDF), privado
  const options = {
    folder: 'artist-applications/resumes',
    resource_type: 'raw',
    type: 'private',
    use_filename: true,
    unique_filename: true,
    overwrite: false
  };
  const uploadRes = await uploadBuffer(file.buffer, options.folder, options);

  // Capturar y sanitizar el nombre original, asegurando extensión .pdf
  let originalName = String(file.originalname || (uploadRes && uploadRes.original_filename) || 'cv').trim();
  try { originalName = originalName.replace(/[\\/\:\*\?\"\<\>\|]+/g, ''); } catch(_) {}
  if (!/\.pdf$/i.test(originalName)) originalName = originalName + '.pdf';

  const appDoc = await ArtistApplication.create({
    user: user._id,
    portfolioUrl: '', // legado vacío
    links: valid,
    statement,
    resumePublicId: uploadRes.public_id,
    resumeUrl: uploadRes.secure_url || '',
    resumeOriginalName: originalName,
    status: 'pending'
  });

  // Notificar a soporte
  const to = process.env.CONTACT_EMAIL_TO || process.env.SUPPORT_EMAIL || 'soporte@galeriadelox.com';
  const subject = `Nueva solicitud de artista – ${user.name || user.email || user._id}`;
  // Generar URL de descarga privada (forzar nombre y descarga como PDF)
  let downloadUrl = '';
  try {
    downloadUrl = cloudinary.utils.private_download_url(uploadRes.public_id, 'pdf', {
      resource_type: 'raw',
      type: 'private',
      attachment: originalName
    });
  } catch(_) {}

  const text = `Usuario: ${user.name || ''} (${user.email || ''})\n` +
               (valid.length ? `Enlaces:\n- ${valid.join('\n- ')}\n` : '') +
               (statement ? `Statement:\n${statement}\n\n` : '') +
               `CV (descarga privada): ${downloadUrl || '(no disponible)'}\n` +
               `Aplicación ID: ${appDoc._id}`;
  try { await sendMail({ to, subject, text }); } catch (_) {}

  if (wantsHTML(req)) return res.redirect(303, '/become-artist?success=1');
  return res.status(201).json({ ok: true, data: { id: appDoc._id } });
});

