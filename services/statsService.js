const ArtworkView = require('@models/artworkViewModel');

exports.getTopArtworks = async (limit = 3) => {
  const data = await ArtworkView.aggregate([
    { $group: { _id: '$artwork', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'artworks',
        localField: '_id',
        foreignField: '_id',
        as: 'artwork'
      }
    },
    { $unwind: '$artwork' },
    {
      $lookup: {
        from: 'users',
        localField: 'artwork.artist',
        foreignField: '_id',
        as: 'artist'
      }
    },
    { $unwind: '$artist' }
  ]);

  return data.map(d => d.artwork);
};

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

exports.getTopGalleries = async (limit = 3) => {
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
    { $unwind: '$artwork.galleries' },
    {
      $group: {
        _id: '$artwork.galleries',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'galleries',
        localField: '_id',
        foreignField: '_id',
        as: 'gallery'
      }
    },
    { $unwind: '$gallery' }
  ]);

  return data.map(d => d.gallery);
};
