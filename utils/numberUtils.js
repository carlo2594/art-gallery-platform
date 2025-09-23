// utils/numberUtils.js
function toNumber(x) {
  return (x !== undefined && x !== '' ? Number(x) : undefined);
}
module.exports = { toNumber };