// utils/pagination.js

/**
 * Returns validated pagination params from query.
 * @param {object} query - Express req.query
 * @param {number} defaultPerPage
 * @param {number} maxPerPage
 * @returns { page, perPage, skip }
 */
function getPaginationParams(query, defaultPerPage = 15, maxPerPage = 100) {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const perPage = Math.max(1, Math.min(maxPerPage, parseInt(query.perPage || defaultPerPage, 10)));
  const skip = (page - 1) * perPage;
  return { page, perPage, skip };
}

module.exports = { getPaginationParams };