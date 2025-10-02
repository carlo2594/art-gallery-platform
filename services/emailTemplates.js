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

module.exports = {
  artworkStatusSubject,
  artworkStatusText,
  adminSubmissionSubject,
  adminSubmissionText
};
