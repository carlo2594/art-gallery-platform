// utils/emailUtils.js

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

module.exports = { normalizeEmail };
