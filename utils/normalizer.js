// utils/normalizer.js
function norm(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
function normArr(a) {
  return (Array.isArray(a) ? a : a ? [a] : []).map(norm);
}
module.exports = { norm, normArr };