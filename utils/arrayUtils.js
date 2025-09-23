/**
 * Utilidades para trabajar con arreglos.
 * Proporciona funciones para asegurar que un valor sea tratado como un arreglo.
 */
// utils/arrayUtils.js
function inArr(v) {
  return Array.isArray(v) ? v : (v ? [v] : []);
}
module.exports = { inArr };