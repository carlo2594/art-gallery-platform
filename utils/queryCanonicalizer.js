/**
 * Utilidad para estandarizar y limpiar queries de búsqueda.
 * Genera una versión canónica de los parámetros de consulta para evitar duplicados y mejorar la navegación.
 */
// utils/queryCanonicalizer.js
function canonicalizeQuery(req, appliedPrice, priceBounds) {
  // Helper to get sorted array values for a key
  function getSortedArray(obj, key) {
    const arr = Array.isArray(obj[key]) ? obj[key] : (obj[key] ? [obj[key]] : []);
    return arr.filter(Boolean).sort();
  }

  // Build canonical params
  const canonical = new URLSearchParams();
  ['type','orientation','material'].forEach(k => {
    getSortedArray(req.query, k).forEach(v => {
      if (v !== undefined && v !== null && v !== '') canonical.append(k, v);
    });
  });
  [['minw'],['maxw'],['minh'],['maxh']].forEach(([k]) => {
    const v = req.query[k];
    if (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v))) {
      // Only add if not empty string and is a valid number
      canonical.set(k, String(Number(v)));
    }
  });
  // Only add sort if not empty string
  if (req.query.sort && req.query.sort !== '') canonical.set('sort', req.query.sort);
  // Only add minPrice/maxPrice if not empty string and not default
  if (appliedPrice.minUSD != null && priceBounds.minUSD != null && appliedPrice.minUSD !== priceBounds.minUSD && appliedPrice.minUSD !== '' && String(appliedPrice.minUSD) !== '') {
    canonical.set('minPrice', appliedPrice.minUSD.toFixed(2));
  }
  if (appliedPrice.maxUSD != null && priceBounds.maxUSD != null && appliedPrice.maxUSD !== priceBounds.maxUSD && appliedPrice.maxUSD !== '' && String(appliedPrice.maxUSD) !== '') {
    canonical.set('maxPrice', appliedPrice.maxUSD.toFixed(2));
  }

  // Build original params, but sort array values for comparison
  const original = new URLSearchParams();
  ['type','orientation','material'].forEach(k => {
    getSortedArray(req.query, k).forEach(v => {
      if (v !== undefined && v !== null && v !== '') original.append(k, v);
    });
  });
  [['minw'],['maxw'],['minh'],['maxh']].forEach(([k]) => {
    const v = req.query[k];
    if (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v))) {
      // Only add if not empty string and is a valid number
      original.set(k, String(Number(v)));
    }
  });
  // Only add sort if not empty string
  if (req.query.sort && req.query.sort !== '') original.set('sort', req.query.sort);
  // Only add minPrice/maxPrice if not empty string
  if (req.query.minPrice && req.query.minPrice !== '') original.set('minPrice', req.query.minPrice);
  if (req.query.maxPrice && req.query.maxPrice !== '') original.set('maxPrice', req.query.maxPrice);

  // Compare sorted key-value pairs
  const asKey = (sp) => [...sp.entries()].sort((a,b) => (a[0]+a[1]).localeCompare(b[0]+b[1])) + '';
  const origStr = asKey(original);
  const canonStr = asKey(canonical);

  if (origStr !== canonStr) {
    const qs = canonical.toString();
    return req.path + (qs ? `?${qs}` : '');
  }
  return null;
}
module.exports = { canonicalizeQuery };