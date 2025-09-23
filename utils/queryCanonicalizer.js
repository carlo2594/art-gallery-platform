/**
 * Utilidad para estandarizar y limpiar queries de búsqueda.
 * Genera una versión canónica de los parámetros de consulta para evitar duplicados y mejorar la navegación.
 */
// utils/queryCanonicalizer.js
function canonicalizeQuery(req, appliedPrice, priceBounds) {
  const original = new URLSearchParams(req.query);
  const canonical = new URLSearchParams();

  ['type','orientation','material'].forEach(k => {
    const arr = Array.isArray(req.query[k]) ? req.query[k] : (req.query[k] ? [req.query[k]] : []);
    arr.forEach(v => { if (v) canonical.append(k, v); });
  });

  [['minw'],['maxw'],['minh'],['maxh']].forEach(([k]) => {
    const v = req.query[k];
    if (v !== undefined && v !== '' && !Number.isNaN(Number(v))) {
      canonical.set(k, String(Number(v)));
    }
  });

  if (req.query.sort) canonical.set('sort', req.query.sort);

  if (appliedPrice.minUSD != null && priceBounds.minUSD != null && appliedPrice.minUSD !== priceBounds.minUSD) {
    canonical.set('minPrice', appliedPrice.minUSD.toFixed(2));
  }
  if (appliedPrice.maxUSD != null && priceBounds.maxUSD != null && appliedPrice.maxUSD !== priceBounds.maxUSD) {
    canonical.set('maxPrice', appliedPrice.maxUSD.toFixed(2));
  }

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