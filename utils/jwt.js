/**
 * Utilidades para la gestión de JSON Web Tokens (JWT).
 * Permite firmar y verificar tokens para autenticación y autorización.
 */
const jwt = require('jsonwebtoken');

exports.signToken = userId => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  });
};

exports.verifyToken = token => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
