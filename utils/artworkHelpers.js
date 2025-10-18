// utils/artworkHelpers.js
const isValidObjectId = require('./isValidObjectId');
const AppError = require('./appError');

/**
 * Busca una obra por ID o slug con redirección automática
 */
const findArtworkByIdOrSlug = async (ArtworkModel, artworkId) => {
  let artwork;

  if (isValidObjectId(artworkId)) {
    // Buscar por ID
    artwork = await ArtworkModel.findOne({ 
      _id: artworkId, 
      status: 'approved', 
      deletedAt: null 
    })
    .populate({ 
      path: 'artist', 
      select: 'name email profileImage bio location website social' 
    })
    .populate({ 
      path: 'exhibitions', 
      select: 'title description startDate endDate location status coverImage slug'
    });
    
    // Si se encontró por ID y tiene slug, retornar redirección
    if (artwork && artwork.slug) {
      return { 
        artwork, 
        shouldRedirect: true, 
        redirectUrl: `/artworks/${artwork.slug}` 
      };
    }
  } else {
    // Buscar por slug
    artwork = await ArtworkModel.findOne({ 
      slug: artworkId, 
      status: 'approved', 
      deletedAt: null 
    })
    .populate({ 
      path: 'artist', 
      select: 'name email profileImage bio location website social' 
    })
    .populate({ 
      path: 'exhibitions', 
      select: 'title description startDate endDate location status coverImage slug'
    });
  }

  if (!artwork) {
    throw new AppError('Obra no encontrada.', 404);
  }

  return { artwork, shouldRedirect: false };
};

/**
 * Obtiene obras populares para la página de inicio
 */
const getPopularArtworks = async (ArtworkModel, limit = 20) => {
  return ArtworkModel
    .find({ 
      status: 'approved',
      deletedAt: null 
    })
    .sort({ views: -1 })
    .limit(limit)
    .populate({ path: 'artist', select: 'name' });
};

/**
 * Obtiene obras recientes para la página de inicio
 */
const getRecentArtworks = async (ArtworkModel, limit = 20) => {
  return ArtworkModel
    .find({
      status: 'approved',
      deletedAt: null
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate({ path: 'artist', select: 'name' });
};

module.exports = {
  findArtworkByIdOrSlug,
  getPopularArtworks,
  getRecentArtworks
};
