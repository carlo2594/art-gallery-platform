// utils/http.js

function wantsHTML(req) {
  try {
    return req.accepts(['html', 'json']) === 'html';
  } catch (_) {
    return false;
  }
}

function wantsJSON(req) {
  try {
    const accept = (req.headers && req.headers.accept && req.headers.accept.toLowerCase()) || '';
    if (accept.includes('application/json') || accept.includes('json')) return true;
    if (req.xhr === true) return true;
    const requestedWith = req.headers && req.headers['x-requested-with'];
    return requestedWith && String(requestedWith).toLowerCase() === 'xmlhttprequest';
  } catch (_) {
    return false;
  }
}

function getSafeInternalPath(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\/(?!\/)/.test(trimmed) ? trimmed : null;
}

function isHoneypotFilled(req, field = 'company') {
  try {
    const raw = req && req.body ? req.body[field] : '';
    if (Array.isArray(raw)) {
      return raw.some(item => String(item || '').trim().length > 0);
    }
    return String(raw || '').trim().length > 0;
  } catch (_) {
    return false;
  }
}

module.exports = { wantsHTML, wantsJSON, getSafeInternalPath, isHoneypotFilled };
