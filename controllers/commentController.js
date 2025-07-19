const Comment = require('@models/commentModel');
const factory = require('@utils/handlerFactory');


exports.getAllComments = factory.getAll(Comment);
exports.getComment = factory.getOne(Comment, { path: 'artwork user' });
exports.createComment = factory.createOne(Comment);
exports.updateComment = factory.updateOne(Comment);
exports.deleteComment = factory.deleteOne(Comment);
