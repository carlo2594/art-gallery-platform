// utils/artistSearch.js
/**
 * Utilities for building artist filters and sort objects for queries.
 */
function buildArtistFilter(q, search) {
  const filter = {
    $or: [
      { roles: 'artist' },
      { role: 'artist' }
    ]
  }; // Solo usuarios que tengan rol de artista, incluso legacy
  
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
