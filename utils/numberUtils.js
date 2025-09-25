/**
 * Utilidad para convertir valores a número.
 * Proporciona funciones para asegurar la conversión segura de datos a tipo numérico.
 */
// utils/numberUtils.js
function toNumber(x) {
  if (x === undefined || x === null || x === '') return null;
  const n = Number(x);
  return isNaN(n) ? null : n;
}
module.exports = { toNumber };