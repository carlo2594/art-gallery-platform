// utils/artistSearch.js
/**
 * Utilities for building artist filters and sort objects for queries.
 */
function buildArtistFilter(q, search) {
  const filter = {
    role: 'artist' // Solo usuarios con role de artista
  };
  
  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }
  if (q.name) {
    filter.name = { $regex: q.name, $options: 'i' };
  }
  // Add more filters here if needed (e.g., by country, style, etc.)
  return filter;
}

module.exports = { buildArtistFilter };
