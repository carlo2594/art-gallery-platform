const ArtworkView = require('@models/artworkViewModel');
const Artwork = require('@models/artworkModel');
const Gallery = require('@models/galleryModel');
const User = require('@models/userModel');

// 🖼️ Obtener obras más recientes
exports.getRecentArtworks = async (limit = 3) => {
  return await Artwork.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('artist');
};

// 👤 Obtener artistas con más vistas
exports.getTopArtists = async (limit = 3) => {
  const data = await ArtworkView.aggregate([
    {
      $lookup: {
        from: 'artworks',
        localField: 'artwork',
        foreignField: '_id',
        as: 'artwork'
      }
    },
    { $unwind: '$artwork' },
    {
      $group: {
        _id: '$artwork.artist',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'artist'
      }
    },
    { $unwind: '$artist' }
  ]);

  return data.map(d => d.artist);
};

// 🖼️ Obtener galerías más recientes
exports.getRecentGalleries = async (limit = 3) => {
  return await Gallery.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('createdBy');
};
