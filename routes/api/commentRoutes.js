const express = require('express');
const commentController = require('@controllers/commentController');
const requireUser = require('@middlewares/auth/requireUser');
const isOwner = require('@middlewares/isOwner');
const Comment = require('@models/commentModel');

const router = express.Router();

router.get('/', commentController.getAllComments);
router.get('/:id', commentController.getComment);

router.post('/', requireUser, commentController.createComment);
router.patch('/:id', requireUser, isOwner(Comment, 'user'), commentController.updateComment);
router.delete('/:id', requireUser, isOwner(Comment, 'user'), commentController.deleteComment);

module.exports = router;
