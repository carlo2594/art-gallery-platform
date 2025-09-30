// utils/handleDuplicateKeyError.js
// Maneja errores de clave duplicada de MongoDB/Mongoose (por ejemplo, email único)
// Devuelve un mensaje amigable para el usuario

module.exports = function handleDuplicateKeyError(err, res, next) {
  if (err && err.code === 11000) {
    // Extrae el campo duplicado
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    return res.status(400).json({
      status: 'fail',
      message: `Ya existe un usuario con ese ${field}: ${value}`
    });
  }
  return next(err);
};
