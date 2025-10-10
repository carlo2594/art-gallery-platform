// utils/artworkSearch.js
const Artwork = require('@models/artworkModel');
const { norm, normArr } = require('@utils/normalizer');

const { toNumber } = require('@utils/numberUtils');
const { getSort } = require('@utils/sortUtils');

function coerceSingle(val) {
  if (Array.isArray(val)) {
    return val.find(v => v != null && String(v).trim() !== '') ?? '';
  }
  return val;
}

function readAvail(q) {
  let raw = coerceSingle(q && q.avail);
  if (raw == null) return "";
  try {
    raw = String(raw);
    const s = raw.toLowerCase();
    if (s.includes('unavailable')) return 'unavailable';
    if (s.includes('available')) return 'available';
    return "";
  } catch { return ""; }
}

function buildArtworkFilter(q) {
  const filter = { 
    status: 'approved', 
    deletedAt: null
  };
  const typesN = normArr(q.type);
  const techsN = normArr(q.technique);
  if (typesN.length) filter.type_norm      = { $in: typesN };
  if (techsN.length) filter.technique_norm = { $in: techsN };

  // TamaÃ±o
  const minw = toNumber(q.minw), maxw = toNumber(q.maxw), minh = toNumber(q.minh), maxh = toNumber(q.maxh);
  if (minw || maxw) filter.width_cm  = { ...(minw?{$gte:minw}:{}), ...(maxw?{$lte:maxw}:{}) };
  if (minh || maxh) filter.height_cm = { ...(minh?{$gte:minh}:{}), ...(maxh?{$lte:maxh}:{}) };

  // Precio
  const minPrice = toNumber(q.minPrice), maxPrice = toNumber(q.maxPrice);
  if (minPrice != null || maxPrice != null) {
    const pf = {};
    if (minPrice != null) pf.$gte = Math.round(minPrice * 100);
    if (maxPrice != null) pf.$lte = Math.round(maxPrice * 100);
    filter.price_cents = pf;
  }

  // Búsqueda por texto si hay q
  const queryText = coerceSingle(q && q.q);
  const avail = readAvail(q);
  if (queryText) {
    const qn = norm(queryText);
    filter.$or = [
      { title: { $regex: queryText, $options: 'i' } },
      { title_norm: { $regex: qn, $options: 'i' } },
      { slug: { $regex: queryText, $options: 'i' } }
    ];
  }
  
  if (avail === 'available') {
    // Solo obras en venta (no incluye reservadas)
    filter.availability = { $in: ['for_sale'] };
  } else if (avail === 'unavailable') {
    // No en venta: incluye reservadas, vendidas, en préstamo o no a la venta
    filter.availability = { $in: ['reserved', 'sold', 'not_for_sale', 'on_loan'] };
  } else if (!queryText) {
    filter.availability = { $in: ['for_sale', 'reserved'] };
  }
  return filter;
}

// Nueva funciÃ³n para filtros de artista sin restricciÃ³n de availability
function buildArtistArtworkFilter(q) {
  const filter = { 
    status: 'approved', 
    deletedAt: null
    // NO incluye filtro de availability para mostrar todas las obras del artista
  };
  const typesN = normArr(q.type);
  const techsN = normArr(q.technique);
  if (typesN.length) filter.type_norm      = { $in: typesN };
  if (techsN.length) filter.technique_norm = { $in: techsN };

  // TamaÃ±o
  const minw = toNumber(q.minw), maxw = toNumber(q.maxw), minh = toNumber(q.minh), maxh = toNumber(q.maxh);
  if (minw || maxw) filter.width_cm  = { ...(minw?{$gte:minw}:{}), ...(maxw?{$lte:maxw}:{}) };
  if (minh || maxh) filter.height_cm = { ...(minh?{$gte:minh}:{}), ...(maxh?{$lte:maxh}:{}) };

  // Precio
  const minPrice = toNumber(q.minPrice), maxPrice = toNumber(q.maxPrice);
  if (minPrice != null || maxPrice != null) {
    const pf = {};
    if (minPrice != null) pf.$gte = Math.round(minPrice * 100);
    if (maxPrice != null) pf.$lte = Math.round(maxPrice * 100);
    filter.price_cents = pf;
  }

  // BÃºsqueda por tÃ­tulo si hay q
  if (q.q) filter.title = { $regex: q.q, $options: 'i' };

  return filter;
}


function getArtworkSort(sort) {
  return getSort(sort);
}

module.exports = { buildArtworkFilter, buildArtistArtworkFilter, getArtworkSort };

