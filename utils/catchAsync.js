/**
 * Función utilitaria para manejar errores en funciones asíncronas de rutas Express.
 * Permite capturar errores y pasarlos automáticamente al middleware de manejo de errores.
 */
module.exports = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
