// services/emailTemplates.js
const { renderEmailLayout } = require('./emailLayout');

function artworkStatusSubject(status) {
  if (status === 'under_review' || status === 'submitted') return 'Tu obra está en revisión';
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

function artworkStatusHtml({ status, artistName = '', artworkTitle = '', reason = '', artworkUrl = '' } = {}) {
  const normalizedStatus = status === 'submitted' ? 'under_review' : status;
  let previewText = 'Actualización de tu obra';
  let title = 'Actualización de tu obra';
  const bodyLines = [];

  if (normalizedStatus === 'under_review') {
    previewText = 'Tu obra está en revisión.';
    title = 'Tu obra está en revisión';
    bodyLines.push(`Tu obra "${artworkTitle}" ha iniciado el proceso de revisión.`);
    bodyLines.push('Te avisaremos tan pronto sea aprobada o rechazada.');
  } else if (normalizedStatus === 'approved') {
    previewText = '¡Tu obra fue aprobada!';
    title = '¡Tu obra fue aprobada!';
    bodyLines.push(`¡Felicidades! Tu obra "${artworkTitle}" ha sido aprobada para exhibición.`);
    bodyLines.push('Ya es visible para los coleccionistas que visitan la galería.');
  } else if (normalizedStatus === 'rejected') {
    title = 'Tu obra fue rechazada';
    bodyLines.push(`Lamentamos informarte que tu obra "${artworkTitle}" fue rechazada.`);
    if (reason) bodyLines.push(`Motivo: ${reason}`);
  } else {
    bodyLines.push(`Hay una actualización sobre tu obra "${artworkTitle}".`);
  }

  return renderEmailLayout({
    previewText,
    title,
    greeting: artistName || '',
    bodyLines,
    actionLabel: artworkUrl ? 'Ver obra' : undefined,
    actionUrl: artworkUrl
  });
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

function purchaseInquiryTextHtml({ artworkTitle = '', artistName = '', buyerName = '', buyerEmail = '', message = '', artworkUrl = '' } = {}) {
  const bodyLines = [
    `${buyerName || 'Un coleccionista'} (${buyerEmail || ''}) está interesado(a) en comprar la obra "${artworkTitle || 'de la galería'}".`,
    'Puedes responder a este correo para coordinar precio final, métodos de pago y envío.'
  ];
  if (message && String(message).trim()) {
    bodyLines.push('Mensaje del comprador:');
    bodyLines.push(String(message).trim());
  }

  return renderEmailLayout({
    previewText: `Nueva consulta sobre "${artworkTitle || 'tu obra'}".`,
    title: 'Consulta de compra',
    greeting: artistName || '',
    bodyLines,
    actionLabel: artworkUrl ? 'Ver obra' : undefined,
    actionUrl: artworkUrl,
    footerLines: [
      `Este correo se envió también a ${buyerName || 'el comprador'} (${buyerEmail || ''}) para que ambos tengan el mismo hilo.`
    ]
  });
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
  artworkStatusHtml,
  adminSubmissionSubject,
  adminSubmissionText,
  // Nuevos helpers para consulta de compra
  purchaseInquirySubject,
  purchaseInquiryTextHtml,
  purchaseInquiryTextPlain
};
