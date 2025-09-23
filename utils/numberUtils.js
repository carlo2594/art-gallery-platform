/**
 * Utilidad para convertir valores a número.
 * Proporciona funciones para asegurar la conversión segura de datos a tipo numérico.
 */
// utils/numberUtils.js
function toNumber(x) {
  return (x !== undefined && x !== '' ? Number(x) : undefined);
}
module.exports = { toNumber };