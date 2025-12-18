const validator = require('validator');
const catchAsync = require('@utils/catchAsync');
const { sendMail } = require('@services/mailer');
const { renderEmailLayout } = require('@services/emailLayout');
const { wantsJSON, isHoneypotFilled } = require('@utils/http');
const { rememberContactForm, clearContactFormCookie } = require('@utils/contactForm');

exports.submit = catchAsync(async (req, res) => {
  const { name = '', email = '', message = '', company = '' } = req.body || {};

  // Honeypot: si está presente, hacemos como que todo salió bien
  if (isHoneypotFilled(req)) {
    if (wantsJSON(req)) return res.json({ ok: true, spam: true });
    return res.redirect(303, '/contact?success=1');
  }

  const n = String(name).trim();
  const e = String(email).trim().toLowerCase();
  const m = String(message).trim();

  const invalid = !n || n.length < 2 || !validator.isEmail(e) || m.length < 10;
  if (invalid) {
    const msg = 'Completa nombre válido, email válido y un mensaje de al menos 10 caracteres.';
    if (wantsJSON(req)) return res.status(400).json({ ok: false, error: msg, data: { name: n, email: e, message: m } });
    rememberContactForm(res, { name: n, email: e, message: m });
    return res.redirect(303, `/contact?error=${encodeURIComponent(msg)}`);
  }

  const to = process.env.CONTACT_EMAIL_TO || 'soporte@galeriadelox.com';
  const subject = `Website contact: ${n}`;
  const text = `Name: ${n}\nEmail: ${e}\n\nMessage:\n${m}\n\nIP: ${req.ip || ''}`;
  const html = renderEmailLayout({
    previewText: `New message from ${n}`,
    title: 'New contact message',
    greeting: 'Team',
    bodyLines: [
      `Name: ${n}`,
      `Email: ${e}`,
      'Message:',
      m
    ],
    actionLabel: e ? 'Reply' : undefined,
    actionUrl: e ? `mailto:${e}` : undefined,
    footerLines: [`IP: ${req.ip || ''}`]
  });

  await sendMail({ to, subject, text, html, replyTo: e });

  clearContactFormCookie(res);

  if (wantsJSON(req)) return res.json({ ok: true });
  return res.redirect(303, '/contact?success=1');
});
