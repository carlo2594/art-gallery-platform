const Collection = require('@models/collectionModel');
const factory = require('@utils/handlerFactory');


exports.getAllCollections = factory.getAll(Collection);
exports.getCollection = factory.getOne(Collection, { path: 'artworks createdBy' });
exports.createCollection = factory.createOne(Collection);
exports.updateCollection = factory.updateOne(Collection);
exports.deleteCollection = factory.deleteOne(Collection);
