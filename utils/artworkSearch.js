// utils/artworkSearch.js
const Artwork = require('@models/artworkModel');
const { normArr } = require('@utils/normalizer');

const { toNumber } = require('@utils/numberUtils');
const { getSort } = require('@utils/sortUtils');

function buildArtworkFilter(q) {
  const filter = { 
    status: 'approved', 
    deletedAt: null, 
    availability: { $in: ['for_sale', 'reserved'] } // Solo obras disponibles
  };
  const typesN = normArr(q.type);
  const techsN = normArr(q.technique);
  if (typesN.length) filter.type_norm      = { $in: typesN };
  if (techsN.length) filter.technique_norm = { $in: techsN };

  // Tamaño
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

  // Búsqueda por título si hay q
  if (q.q) filter.title = { $regex: q.q, $options: 'i' };

  return filter;
}


function getArtworkSort(sort) {
  return getSort(sort);
}

module.exports = { buildArtworkFilter, getArtworkSort };