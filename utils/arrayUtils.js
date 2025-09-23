// utils/arrayUtils.js
function inArr(v) {
  return Array.isArray(v) ? v : (v ? [v] : []);
}
module.exports = { inArr };