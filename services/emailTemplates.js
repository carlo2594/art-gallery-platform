// services/emailTemplates.js
const { renderEmailLayout } = require('./emailLayout');

function artworkStatusSubject(status) {
  if (status === 'under_review' || status === 'submitted') return 'Your artwork is under review';
  if (status === 'approved') return 'Your artwork was approved!';
  if (status === 'rejected') return 'Your artwork was rejected';
  return 'Update about your artwork';
}

function artworkStatusText({ status, artistName = '', artworkTitle = '', reason = '' }) {
  if (status === 'under_review') {
    return `Hi ${artistName || ''}, your artwork "${artworkTitle}" has entered the review process.\n\nWe will let you know as soon as it is approved or rejected.`;
  }
  if (status === 'approved') {
    return `Congratulations ${artistName || ''}! Your artwork "${artworkTitle}" has been approved for exhibition.\n\nIt is now visible to collectors visiting the site.`;
  }
  if (status === 'rejected') {
    return `Hi ${artistName || ''}, we are sorry to inform you that your artwork "${artworkTitle}" was rejected.\nReason: ${reason}`;
  }
  return `Hi ${artistName || ''}, there is an update about your artwork "${artworkTitle}".`;
}

function artworkStatusHtml({ status, artistName = '', artworkTitle = '', reason = '', artworkUrl = '' } = {}) {
  const normalizedStatus = status === 'submitted' ? 'under_review' : status;
  let previewText = 'Update about your artwork';
  let title = 'Update about your artwork';
  const bodyLines = [];

  if (normalizedStatus === 'under_review') {
    previewText = 'Your artwork is under review.';
    title = 'Your artwork is under review';
    bodyLines.push(`Your artwork "${artworkTitle}" has started the review process.`);
    bodyLines.push('We will notify you as soon as it is approved or rejected.');
  } else if (normalizedStatus === 'approved') {
    previewText = 'Your artwork was approved!';
    title = 'Your artwork was approved!';
    bodyLines.push(`Congratulations! Your artwork "${artworkTitle}" has been approved for exhibition.`);
    bodyLines.push('It is now visible to collectors visiting the gallery.');
  } else if (normalizedStatus === 'rejected') {
    previewText = 'Your artwork was rejected.';
    title = 'Your artwork was rejected';
    bodyLines.push(`We are sorry to inform you that your artwork "${artworkTitle}" was rejected.`);
    if (reason) bodyLines.push(`Reason: ${reason}`);
  } else {
    bodyLines.push(`There is an update about your artwork "${artworkTitle}".`);
  }

  return renderEmailLayout({
    previewText,
    title,
    greeting: artistName || '',
    bodyLines,
    actionLabel: artworkUrl ? 'View artwork' : undefined,
    actionUrl: artworkUrl
  });
}

function adminSubmissionSubject() {
  return 'New artwork submitted for review';
}

function adminSubmissionText({ art, artist }) {
  const info = [
    `Title: ${art.title}`,
    `Description: ${art.description || '(no description)'}`,
    `Artist: ${artist?.name} (${artist?.email})`,
    `Artwork ID: ${art._id}`
  ].join('\n');
  const extra = `\n\nThis email was also sent to the other administrators.\nIf you do not see the artwork in the review queue, another admin may have already approved or rejected it.\nYou can check the approval history to confirm the final status of the artwork.`;
  return `${info}${extra}`;
}

// ------- Purchase inquiry templates -------
function purchaseInquirySubject({ artworkTitle = '' } = {}) {
  return `Purchase inquiry: ${artworkTitle || 'artwork'}`;
}

function purchaseInquiryTextHtml({ artworkTitle = '', artistName = '', buyerName = '', buyerEmail = '', message = '', artworkUrl = '' } = {}) {
  const bodyLines = [
    `${buyerName || 'A collector'} (${buyerEmail || ''}) is interested in buying the artwork "${artworkTitle || 'from the gallery'}".`,
    'You can reply to this email to coordinate final pricing, payment methods, and shipping.'
  ];
  if (message && String(message).trim()) {
    bodyLines.push('Message from the collector:');
    bodyLines.push(String(message).trim());
  }

  return renderEmailLayout({
    previewText: `New inquiry about "${artworkTitle || 'your artwork'}".`,
    title: 'Purchase inquiry',
    greeting: artistName || '',
    bodyLines,
    actionLabel: artworkUrl ? 'View artwork' : undefined,
    actionUrl: artworkUrl,
    footerLines: [
      `This email was also sent to ${buyerName || 'the collector'} (${buyerEmail || ''}) so everyone stays on the same thread.`
    ]
  });
}

function purchaseInquiryTextPlain({ artworkTitle = '', artistName = '', buyerName = '', buyerEmail = '', message = '', artworkUrl = '' } = {}) {
  const parts = [];
  parts.push(`${buyerName} (${buyerEmail}) is interested in buying the artwork "${artworkTitle}".`);
  parts.push('Feel free to continue over email to coordinate details (final price, payment methods, shipping).');
  if (message && String(message).trim()) {
    parts.push('\nMessage from the collector:');
    parts.push(String(message).trim());
  }
  if (artworkUrl) {
    parts.push(`\nView artwork: ${artworkUrl}`);
  }
  parts.push('\n---');
  parts.push(`This email was sent to ${artistName} with a copy to ${buyerName}.`);
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
