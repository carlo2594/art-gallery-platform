// utils/sortUtils.js
function getSort(sortParam) {
  return sortParam === 'populares'  ? { views: -1 }
    : sortParam === 'recientes'     ? { createdAt: -1 }
    : sortParam === 'precio_asc'    ? { price_cents: 1, _id: -1 }
    : sortParam === 'precio_desc'   ? { price_cents: -1, _id: -1 }
    : { _id: -1 };
}
module.exports = { getSort };