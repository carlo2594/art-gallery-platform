// utils/boundsUtils.js
function swapIfGreater(a, b) {
  if (a != null && b != null && a > b) {
    return [b, a];
  }
  return [a, b];
}
module.exports = { swapIfGreater };