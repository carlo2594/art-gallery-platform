const Comment = require('@models/commentModel');
const factory = require('@utils/handlerFactory');
const catchAsync = require('@utils/catchAsync');
const AppError = require('@utils/appError');
const sendResponse = require('@utils/sendResponse');
const { updateArtworkCommentsCount } = require('@services/artwork.service');

// Obtener todos y uno solo
exports.getAllComments = factory.getAll(Comment);
exports.getComment = factory.getOne(Comment, { path: 'artwork user' });

// Crear comentario y actualizar contador
exports.createComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.create({
    ...req.body,
    user: req.user._id
  });

  await updateArtworkCommentsCount(comment.artwork);

  sendResponse(res, comment, 'Comment created', 201);
});

// Actualizar comentario (sin afectar contador)
exports.updateComment = factory.updateOne(Comment);

// Eliminar comentario y actualizar contador
exports.deleteComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return next(new AppError('Comment not found', 404));
  }

  const artworkId = comment.artwork;

  await comment.deleteOne();

  await updateArtworkCommentsCount(artworkId);

  sendResponse(res, null, 'Comment deleted', 204);
});
