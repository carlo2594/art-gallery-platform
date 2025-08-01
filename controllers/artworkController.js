const Artwork = require('@models/artworkModel');
const factory = require('@utils/handlerFactory');

exports.getAllArtworks = factory.getAll(Artwork);
exports.getArtwork = factory.getOne(Artwork, { path: 'artist exhibitions' });
exports.createArtwork = factory.createOne(Artwork);
exports.updateArtwork = factory.updateOne(Artwork);
exports.deleteArtwork = factory.deleteOne(Artwork);
