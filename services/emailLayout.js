const BRAND_COLOR = '#111827';
const BORDER_COLOR = '#e5e7eb';
const TEXT_COLOR = '#111827';
const MUTED_COLOR = '#6b7280';

function escapeHtml(str = '') {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderParagraphs(lines = []) {
  return lines
    .filter(Boolean)
    .map((line) => {
      const encoded = escapeHtml(line).replace(/\n/g, '<br>');
      return `<p style="margin:0 0 16px 0; line-height:1.5; color:${TEXT_COLOR};">${encoded}</p>`;
    })
    .join('');
}

function renderList(items = []) {
  if (!items.length) return '';
  const lis = items
    .map((item) => {
      const encoded = escapeHtml(item).replace(/\n/g, '<br>');
      return `<li style="margin-bottom:6px;">${encoded}</li>`;
    })
    .join('');
  return `<ul style="padding-left:20px; margin:0 0 16px 0; color:${TEXT_COLOR};">${lis}</ul>`;
}

function renderActionButton({ actionUrl, actionLabel }) {
  if (!actionUrl || !actionLabel) return '';
  const safeUrl = escapeHtml(actionUrl);
  const safeLabel = escapeHtml(actionLabel);
  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      <tr>
        <td>
          <a href="${safeUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px 0;font-size:13px;color:${MUTED_COLOR};">
      Si el botón no funciona, copia y pega este enlace: <br>
      <a href="${safeUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${safeUrl}</a>
    </p>
  `;
}

function renderEmailLayout({
  previewText = '',
  title = 'Galería del Ox',
  greeting,
  bodyLines = [],
  listItems = [],
  actionLabel,
  actionUrl,
  footerLines = []
} = {}) {
  const safePreview = escapeHtml(previewText);
  const bodyHtml = renderParagraphs(bodyLines) + renderList(listItems);
  const footerHtml = renderParagraphs(footerLines);
  const greetingHtml = greeting
    ? `<p style="margin:0 0 16px 0; font-size:16px; font-weight:600; color:${TEXT_COLOR};">Hola ${escapeHtml(greeting)},</p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;color:transparent;max-height:0;max-width:0;opacity:0;overflow:hidden;">${safePreview}</span>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f9fafb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid ${BORDER_COLOR};border-radius:12px;padding:32px;">
            <tr>
              <td style="text-align:center;padding-bottom:16px;">
                <div style="font-size:22px;font-weight:700;color:${TEXT_COLOR};">Galería del Ox</div>
                <div style="font-size:13px;color:${MUTED_COLOR};">${escapeHtml(title)}</div>
              </td>
            </tr>
            <tr>
              <td>
                ${greetingHtml}
                ${bodyHtml}
                ${renderActionButton({ actionUrl, actionLabel })}
                ${footerHtml}
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:12px;color:${MUTED_COLOR};">
            © ${new Date().getFullYear()} Galería del Ox. Todos los derechos reservados.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

module.exports = { renderEmailLayout };
