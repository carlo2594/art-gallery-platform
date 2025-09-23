/**
 * Clase personalizada para manejar errores de aplicación.
 * Permite distinguir entre errores operacionales y errores de programación,
 * y facilita el manejo centralizado de errores en la API.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
