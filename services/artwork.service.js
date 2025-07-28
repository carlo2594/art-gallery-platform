const Artwork = require('@models/artworkModel');
const Comment = require('@models/commentModel');

// Incrementar commentsCount
exports.incrementCommentCount = async (artworkId) => {
  await Artwork.findByIdAndUpdate(artworkId, { $inc: { commentsCount: 1 } });
};

// Decrementar commentsCount
exports.decrementCommentCount = async (artworkId) => {
  await Artwork.findByIdAndUpdate(artworkId, { $inc: { commentsCount: -1 } });
};

// Recalcular desde cero
exports.recalculateCommentCount = async (artworkId) => {
  const count = await Comment.countDocuments({ artwork: artworkId });
  await Artwork.findByIdAndUpdate(artworkId, { commentsCount: count });
};
