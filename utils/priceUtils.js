// utils/priceUtils.js

/**
 * Returns applied price range (min/max) in cents and USD, given query and DB bounds.
 * @param {object} q - Express req.query
 * @param {object} bounds - { minPriceCents, maxPriceCents }
 * @returns { appliedPrice, priceBounds }
 */
function getPriceRanges(q, bounds) {
  const toNumber = v => (v == null || v === '') ? null : Number(v);
  let minCents = toNumber(q.minPrice) != null ? Math.round(Number(q.minPrice) * 100) : null;
  let maxCents = toNumber(q.maxPrice) != null ? Math.round(Number(q.maxPrice) * 100) : null;
  if (minCents === null && bounds.minPriceCents != null) minCents = bounds.minPriceCents;
  if (maxCents === null && bounds.maxPriceCents != null) maxCents = bounds.maxPriceCents;
  if (minCents != null && maxCents != null && minCents > maxCents) [minCents, maxCents] = [maxCents, minCents];
  const priceBounds = {
    minUSD: bounds.minPriceCents != null ? bounds.minPriceCents / 100 : null,
    maxUSD: bounds.maxPriceCents != null ? bounds.maxPriceCents / 100 : null,
    minCents: bounds.minPriceCents,
    maxCents: bounds.maxPriceCents
  };
  const appliedPrice = {
    minUSD: minCents != null ? minCents / 100 : null,
    maxUSD: maxCents != null ? maxCents / 100 : null
  };
  return { appliedPrice, priceBounds };
}

module.exports = { getPriceRanges };