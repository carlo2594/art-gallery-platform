// utils/artistHelpers.js
const isValidObjectId = require('./isValidObjectId');
const AppError = require('./appError');

/**
 * Busca un artista por ID o slug con redirección automática
 * Optimizado para usar los índices correctos
 */
const findArtistByIdOrSlug = async (UserModel, artistId) => {
  let artist;

  if (isValidObjectId(artistId)) {
    // Buscar por ID con orden que coincide con índice
    artist = await UserModel.findOne({
      _id: artistId,
      role: 'artist'
    }).select('name bio profileImage createdAt slug email location website social +role');
    
    // Si se encontró por ID y tiene slug, retornar redirección
    if (artist && artist.slug) {
      return { 
        artist, 
        shouldRedirect: true, 
        redirectUrl: `/artists/${artist.slug}` 
      };
    }
  } else {
    // Buscar por slug - usar índice optimizado
    artist = await UserModel.findOne({
      role: 'artist',
      slug: artistId
    }).select('name bio profileImage createdAt slug email location website social +role');
  }

  if (!artist) {
    throw new AppError('Artista no encontrado', 404);
  }

  return { artist, shouldRedirect: false };
};

/**
 * Obtiene obras relacionadas de un artista (optimizado)
 */
const getRelatedArtworks = async (ArtworkModel, artistId, excludeId, limit = 6) => {
  return ArtworkModel.find({
    artist: artistId,
    status: 'approved',
    deletedAt: null,
    _id: { $ne: excludeId }
  })
  .populate({ path: 'artist', select: 'name' })
  .sort({ createdAt: -1 })
  .limit(limit);
};

/**
 * Construye estadísticas del artista
 */
const buildArtistStats = (allArtworks) => {
  return {
    totalArtworks: allArtworks.length,
    techniques: [...new Set(allArtworks.map(artwork => artwork.technique).filter(Boolean))]
  };
};

module.exports = {
  findArtistByIdOrSlug,
  getRelatedArtworks,
  buildArtistStats
};