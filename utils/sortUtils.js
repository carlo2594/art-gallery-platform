/**
 * Utility to build sorting criteria for queries.
 * Maps sort parameters to sort objects for database queries.
 */
// utils/sortUtils.js
function getSort(sortParam) {
  return sortParam === 'popular'         ? { views: -1 }
    : sortParam === 'recent'             ? { createdAt: -1 }
    : sortParam === 'price_asc'          ? { price_cents: 1, _id: -1 }
    : sortParam === 'price_desc'         ? { price_cents: -1, _id: -1 }
    : { _id: -1 };
}
module.exports = { getSort };