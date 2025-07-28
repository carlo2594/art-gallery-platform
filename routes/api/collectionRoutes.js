const express = require('express');
const collectionController = require('@controllers/collectionController');
const requireUser = require('@middlewares/requireUser');
const isOwner = require('@middlewares/isOwner');
const Collection = require('@models/collectionModel');

const router = express.Router();

router.get('/', collectionController.getAllCollections);
router.get('/:id', collectionController.getCollection);

router.post('/', requireUser, collectionController.createCollection);
router.patch('/:id', requireUser, isOwner(Collection), collectionController.updateCollection);
router.delete('/:id', requireUser, isOwner(Collection), collectionController.deleteCollection);

module.exports = router;
