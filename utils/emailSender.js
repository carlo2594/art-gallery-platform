/**
 * Utilidad para enviar correos electrónicos de manera sencilla.
 * Facilita el envío de emails usando un servicio de mailer configurado en la aplicación.
 */
const { sendMail } = require('@services/mailer');

/**
 * Envía un email de forma sencilla.
 * @param {Object} options - Opciones para el email.
 * @param {string} options.to - Destinatario.
 * @param {string} options.subject - Asunto.
 * @param {string} [options.text] - Texto plano.
 * @param {string} [options.html] - HTML opcional.
 */
async function sendEmail({ to, subject, text, html }) {
  return sendMail({ to, subject, text, html });
}

module.exports = { sendEmail };