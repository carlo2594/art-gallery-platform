// utils/request.js

function getClientIp(req) {
  return (
    req.ip ||
    req.headers['x-forwarded-for'] ||
    (req.connection && req.connection.remoteAddress) ||
    ''
  );
}

module.exports = { getClientIp };
