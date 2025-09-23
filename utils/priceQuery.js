/**
 * Utilidades para procesar y limpiar valores de precio en queries.
 * Permite convertir precios a centavos y limpiar formatos monetarios para búsquedas y filtros.
 */
// utils/priceQuery.js
function cleanMoney(v) {
  return String(v).replace(/[$,\s]/g, '');
}
function readMinCentsFromQuery(q) {
  if (q.minPrice !== undefined && q.minPrice !== null && q.minPrice !== '')
    return Math.max(0, Math.round(Number(cleanMoney(q.minPrice)) * 100));
  if (q.minPriceCents !== undefined && q.minPriceCents !== null && q.minPriceCents !== '')
    return Math.max(0, parseInt(q.minPriceCents, 10));
  return null;
}
function readMaxCentsFromQuery(q) {
  if (q.maxPrice !== undefined && q.maxPrice !== null && q.maxPrice !== '')
    return Math.max(0, Math.round(Number(cleanMoney(q.maxPrice)) * 100));
  if (q.maxPriceCents !== undefined && q.maxPriceCents !== null && q.maxPriceCents !== '')
    return Math.max(0, parseInt(q.maxPriceCents, 10));
  return null;
}
module.exports = { cleanMoney, readMinCentsFromQuery, readMaxCentsFromQuery };