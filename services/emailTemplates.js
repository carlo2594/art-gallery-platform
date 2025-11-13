// services/emailTemplates.js

function artworkStatusSubject(status) {
  if (status === 'under_review') return 'Tu obra está en revisión';
  if (status === 'approved') return '¡Tu obra fue aprobada!';
  if (status === 'rejected') return 'Tu obra fue rechazada';
  return 'Actualización de tu obra';
}

function artworkStatusText({ status, artistName = '', artworkTitle = '', reason = '' }) {
  if (status === 'under_review') {
    return `Hola ${artistName || ''}, tu obra "${artworkTitle}" ha iniciado el proceso de revisión.\n\nTan pronto sea aprobada o rechazada, te notificaremos.`;
  }
  if (status === 'approved') {
    return `¡Felicidades ${artistName || ''}! Tu obra "${artworkTitle}" ha sido aprobada para exhibición.\n\nYa es visible para el público que visita la página.`;
  }
  if (status === 'rejected') {
    return `Hola ${artistName || ''}, lamentamos informarte que tu obra "${artworkTitle}" fue rechazada.\nMotivo: ${reason}`;
  }
  return `Hola ${artistName || ''}, hay una actualización sobre tu obra "${artworkTitle}".`;
}

function adminSubmissionSubject() {
  return 'Nueva obra enviada para revisión';
}

function adminSubmissionText({ art, artist }) {
  const info = [
    `Título: ${art.title}`,
    `Descripción: ${art.description || '(sin descripción)'}`,
    `Artista: ${artist?.name} (${artist?.email})`,
    `ID de obra: ${art._id}`
  ].join('\n');
  const extra = `\n\nEste correo ha sido enviado a otros administradores.\nSi no ves la obra en el queue de aprobación, es posible que ya fue aprobada o rechazada por otro administrador.\nPuedes consultar el historial de aprobaciones para validar el estado final de la obra.`;
  return `${info}${extra}`;
}

// ------- Nuevos templates: Consulta de compra -------
function purchaseInquirySubject({ artworkTitle = '' } = {}) {
  return `Consulta de compra: ${artworkTitle || 'obra'}`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function purchaseInquiryTextHtml({ artworkTitle = '', artistName = '', buyerName = '', buyerEmail = '', message = '', artworkUrl = '' } = {}) {
  const safeMsg = escapeHtml(message || '');
  return `
    <p><strong>${escapeHtml(buyerName)}</strong> (${escapeHtml(buyerEmail)}) está interesado(a) en comprar la obra <strong>${escapeHtml(artworkTitle)}</strong>.</p>
    <p>Pueden continuar por email para coordinar detalles (precio final, métodos de pago, envío).</p>
    ${safeMsg ? `<p><strong>Mensaje del comprador:</strong></p><blockquote style="border-left:4px solid #ddd;padding-left:12px;color:#444;">${safeMsg.replace(/\n/g,'<br>')}</blockquote>` : ''}
    ${artworkUrl ? `<p><a href="${escapeHtml(artworkUrl)}" target="_blank" rel="noopener noreferrer">Ver obra en la galería</a></p>` : ''}
    <hr>
    <p style="color:#888;font-size:12px;">Este correo fue enviado a ${escapeHtml(artistName)} con copia a ${escapeHtml(buyerName)}.</p>
  `;
}

function purchaseInquiryTextPlain({ artworkTitle = '', artistName = '', buyerName = '', buyerEmail = '', message = '', artworkUrl = '' } = {}) {
  const parts = [];
  parts.push(`${buyerName} (${buyerEmail}) está interesado(a) en comprar la obra "${artworkTitle}".`);
  parts.push('Pueden continuar por email para coordinar detalles (precio final, métodos de pago, envío).');
  if (message && String(message).trim()) {
    parts.push('\nMensaje del comprador:');
    parts.push(String(message).trim());
  }
  if (artworkUrl) {
    parts.push(`\nVer obra: ${artworkUrl}`);
  }
  parts.push('\n---');
  parts.push(`Este correo fue enviado a ${artistName} con copia a ${buyerName}.`);
  return parts.join('\n');
}

module.exports = {
  artworkStatusSubject,
  artworkStatusText,
  adminSubmissionSubject,
  adminSubmissionText,
  // Nuevos helpers para consulta de compra
  purchaseInquirySubject,
  purchaseInquiryTextHtml,
  purchaseInquiryTextPlain
};
