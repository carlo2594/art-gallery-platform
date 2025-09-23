/**
 * Utilidad para enviar respuestas JSON estandarizadas en la API.
 * Facilita el envío de datos, mensajes y códigos de estado de forma consistente.
 */
// utils/sendResponse.js
module.exports = (res, data, message = 'success', statusCode = 200, extra = {}) => {
  res.status(statusCode).json({
    status: 'success',
    message,
    data,
    ...extra
  });
};
