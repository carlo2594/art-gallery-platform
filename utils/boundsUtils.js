/**
 * Utilidades para manipular límites numéricos.
 * Incluye funciones para intercambiar valores si uno es mayor que el otro.
 */
// utils/boundsUtils.js
function swapIfGreater(a, b) {
  if (a != null && b != null && a > b) {
    return [b, a];
  }
  return [a, b];
}
module.exports = { swapIfGreater };