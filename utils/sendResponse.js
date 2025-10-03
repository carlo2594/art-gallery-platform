/**
 * Utilidad para enviar respuestas JSON estandarizadas en la API.
 * Facilita el envío de datos, mensajes y códigos de estado de forma consistente.
 */
// utils/sendResponse.js
function deriveStatus(statusCode) {
  if (statusCode >= 200 && statusCode < 400) return 'success';
  if (statusCode >= 400 && statusCode < 500) return 'fail';
  return 'error';
}

module.exports = (res, data, message = 'success', statusCode = 200, extra = {}) => {
  const status = extra.status || deriveStatus(statusCode);
  res.status(statusCode).json({
    status,
    message,
    data,
    ...extra
  });
};
