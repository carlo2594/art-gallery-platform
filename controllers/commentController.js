const Comment = require('@models/commentModel');
const factory = require('@utils/handlerFactory');
const catchAsync = require('@utils/catchAsync');
const AppError = require('@utils/appError');
const sendResponse = require('@utils/sendResponse');
const artworkService = require('@services/artwork.service');

// Obtener todos los comentarios
exports.getAllComments = factory.getAll(Comment);

// Obtener un solo comentario (con artwork y user populado)
exports.getComment = factory.getOne(Comment, { path: 'artwork user' });

// Crear comentario y aumentar contador
exports.createComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.create({
    ...req.body,
    user: req.user._id
  });

  await artworkService.incrementCommentCount(comment.artwork);

  sendResponse(res, comment, 'Comment created', 201);
});

// Actualizar comentario (no afecta contador)
exports.updateComment = factory.updateOne(Comment);

// Eliminar comentario y reducir contador
exports.deleteComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return next(new AppError('Comment not found', 404));
  }

  const artworkId = comment.artwork;

  await comment.deleteOne();

  await artworkService.decrementCommentCount(artworkId);

  sendResponse(res, null, 'Comment deleted', 204);
});
