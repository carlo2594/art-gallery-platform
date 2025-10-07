// utils/aggregationHelpers.js
const { viewsCache } = require('./cache');

/**
 * Obtiene todas las técnicas únicas de obras aprobadas (con cache)
 */
const getAllTechniques = async (ArtworkModel) => {
  return viewsCache.getOrCompute('all-techniques', async () => {
    const techniquesAgg = await ArtworkModel.aggregate([
      { $match: { status: 'approved', deletedAt: null } },
      { $group: { _id: '$technique', technique: { $first: '$technique' } } },
      { $project: { _id: 0, technique: 1 } },
      { $sort: { technique: 1 } }
    ]).hint({ status: 1, deletedAt: 1, technique: 1 });
    
    return techniquesAgg.map(m => m.technique).filter(Boolean);
  });
};

/**
 * Obtiene rangos de precio globales (con cache)
 */
const getGlobalPriceBounds = async (ArtworkModel) => {
  return viewsCache.getOrCompute('global-price-bounds', async () => {
    const boundsAgg = await ArtworkModel.aggregate([
      { $match: { status: 'approved', deletedAt: null } },
      { $group: { _id: null, minPriceCents: { $min: '$price_cents' }, maxPriceCents: { $max: '$price_cents' } } },
      { $project: { _id: 0, minPriceCents: 1, maxPriceCents: 1 } }
    ]).hint({ status: 1, deletedAt: 1, createdAt: -1 });
    
    return boundsAgg[0] || { minPriceCents: null, maxPriceCents: null };
  });
};

/**
 * Obtiene técnicas de un artista específico
 */
const getArtistTechniques = async (ArtworkModel, artistId) => {
  const cacheKey = `artist-techniques-${artistId}`;
  
  return viewsCache.getOrCompute(cacheKey, async () => {
    const techniquesAgg = await ArtworkModel.aggregate([
      { $match: { artist: artistId, status: 'approved', deletedAt: null } },
      { $group: { _id: '$technique', technique: { $first: '$technique' } } },
      { $project: { _id: 0, technique: 1 } },
      { $sort: { technique: 1 } }
    ]).hint({ artist: 1, status: 1, deletedAt: 1, createdAt: -1 });
    
    return techniquesAgg.map(m => m.technique).filter(Boolean);
  }, 5 * 60 * 1000); // Cache más corto para artistas específicos (5 min)
};

/**
 * Obtiene rangos de precio de un artista específico
 */
const getArtistPriceBounds = async (ArtworkModel, artistId) => {
  const cacheKey = `artist-price-bounds-${artistId}`;
  
  return viewsCache.getOrCompute(cacheKey, async () => {
    const boundsAgg = await ArtworkModel.aggregate([
      { $match: { artist: artistId, status: 'approved', deletedAt: null } },
      { $group: { _id: null, minPriceCents: { $min: '$price_cents' }, maxPriceCents: { $max: '$price_cents' } } },
      { $project: { _id: 0, minPriceCents: 1, maxPriceCents: 1 } }
    ]).hint({ artist: 1, status: 1, deletedAt: 1, createdAt: -1 });
    
    return boundsAgg[0] || { minPriceCents: null, maxPriceCents: null };
  }, 5 * 60 * 1000);
};

/**
 * Invalidar cache relacionado con artworks cuando hay cambios
 */
const invalidateArtworkCaches = (artistId = null) => {
  viewsCache.invalidate('all-techniques');
  viewsCache.invalidate('global-price-bounds');
  
  if (artistId) {
    viewsCache.invalidate(`artist-techniques-${artistId}`);
    viewsCache.invalidate(`artist-price-bounds-${artistId}`);
  }
};

module.exports = {
  getAllTechniques,
  getGlobalPriceBounds,
  getArtistTechniques,
  getArtistPriceBounds,
  invalidateArtworkCaches
};