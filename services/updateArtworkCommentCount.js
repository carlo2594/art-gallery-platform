// utils/updateArtworkCommentCount.js
const Comment = require('../models/commentModel');
const Artwork = require('../models/artworkModel');

const updateArtworkCommentCount = async (artworkId) => {
  const count = await Comment.countDocuments({ artwork: artworkId });
  await Artwork.findByIdAndUpdate(artworkId, { commentsCount: count });
};

module.exports = updateArtworkCommentCount;
