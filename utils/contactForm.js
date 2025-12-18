// utils/contactForm.js
const COOKIE_NAME = 'contact_form';

function sanitizeField(value) {
  return String(value || '').trim();
}

function buildPayload(data = {}) {
  return {
    name: sanitizeField(data.name),
    email: sanitizeField(data.email).toLowerCase(),
    message: sanitizeField(data.message)
  };
}

function getCookieOptions() {
  const secure = (process.env.NODE_ENV || '').toLowerCase() === 'production';
  return {
    maxAge: 5 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/'
  };
}

function rememberContactForm(res, data) {
  try {
    const payload = buildPayload(data);
    res.cookie(COOKIE_NAME, JSON.stringify(payload), getCookieOptions());
    return payload;
  } catch (_) {
    return buildPayload(data);
  }
}

function clearContactFormCookie(res) {
  try {
    res.clearCookie(COOKIE_NAME, { path: '/' });
  } catch (_) {}
}

function consumeContactFormCookie(req, res, { clear = true } = {}) {
  const fallback = buildPayload();
  try {
    const rawCookie = req && req.cookies ? req.cookies[COOKIE_NAME] : null;
    if (!rawCookie) return fallback;
    const parsed = typeof rawCookie === 'string' ? JSON.parse(rawCookie) : rawCookie;
    const payload = buildPayload(parsed);
    if (clear && res) clearContactFormCookie(res);
    return payload;
  } catch (_) {
    if (clear && res) clearContactFormCookie(res);
    return fallback;
  }
}

module.exports = {
  rememberContactForm,
  consumeContactFormCookie,
  clearContactFormCookie
};
