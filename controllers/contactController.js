const validator = require('validator');
const catchAsync = require('@utils/catchAsync');
const { sendMail } = require('@services/mailer');

const escapeHtml = s => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function wantsJson(req) {
  const accept = (req.headers.accept || '').toLowerCase();
  return accept.includes('application/json') || accept.includes('json');
}

exports.submit = catchAsync(async (req, res) => {
  const { name = '', email = '', message = '', company = '' } = req.body || {};

  // Honeypot: si está presente, hacemos como que todo salió bien
  if (company && String(company).trim().length > 0) {
    if (wantsJson(req)) return res.json({ ok: true, spam: true });
    return res.redirect(303, '/contact?success=1');
  }

  const n = String(name).trim();
  const e = String(email).trim().toLowerCase();
  const m = String(message).trim();

  const invalid = !n || n.length < 2 || !validator.isEmail(e) || m.length < 10;
  if (invalid) {
    const msg = 'Completa nombre válido, email válido y un mensaje de al menos 10 caracteres.';
    if (wantsJson(req)) return res.status(400).json({ ok: false, error: msg, data: { name: n, email: e, message: m } });
    // Guardar datos en cookie temporal para repoblar el formulario
    const secure = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    res.cookie('contact_form', JSON.stringify({ name: n, email: e, message: m }), {
      maxAge: 5 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/'
    });
    return res.redirect(303, `/contact?error=${encodeURIComponent(msg)}`);
  }

  const to = process.env.CONTACT_EMAIL_TO || 'soporte@galeriadelox.com';
  const subject = `Contacto web: ${n}`;
  const text = `Nombre: ${n}\nEmail: ${e}\n\nMensaje:\n${m}\n\nIP: ${req.ip || ''}`;
  const html = `
    <p><strong>Nombre:</strong> ${escapeHtml(n)}</p>
    <p><strong>Email:</strong> ${escapeHtml(e)}</p>
    <p><strong>Mensaje:</strong></p>
    <pre style="white-space:pre-wrap">${escapeHtml(m)}</pre>
    <hr>
    <p style="color:#888">IP: ${escapeHtml(req.ip || '')}</p>
  `;

  await sendMail({ to, subject, text, html, replyTo: e });

  try { res.clearCookie('contact_form', { path: '/' }); } catch (_) {}

  if (wantsJson(req)) return res.json({ ok: true });
  return res.redirect(303, '/contact?success=1');
});
