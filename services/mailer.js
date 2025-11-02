// filepath: utils/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true', // true para 465, false para otros
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendMail({ to, subject, text, html, replyTo, cc, bcc, attachments, from }) {
  // Evitar errores si falta destinatario: no bloquear flujos de admin
  if (!to || String(to).trim().length === 0) {
    try { console.warn('sendMail skipped: no recipient defined for subject:', subject); } catch (_) {}
    return { skipped: true, reason: 'no_recipient' };
  }
  return transporter.sendMail({
    from: from || process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
    replyTo,
    cc,
    bcc,
    attachments
  });
}

module.exports = { sendMail };
