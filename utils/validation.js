// utils/validation.js

function getInvalidFields(body = {}, allowed = []) {
  if (!body || typeof body !== 'object') return [];
  const keys = Object.keys(body);
  return keys.filter((k) => !allowed.includes(k));
}

function isEmptyBody(body) {
  return !body || (typeof body === 'object' && Object.keys(body).length === 0);
}

module.exports = { getInvalidFields, isEmptyBody };
