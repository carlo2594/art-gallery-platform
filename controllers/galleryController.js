const Gallery = require('@models/galleryModel');
const factory = require('@utils/handlerFactory');


exports.getAllGalleries = factory.getAll(Gallery);
exports.getGallery = factory.getOne(Gallery, { path: 'createdBy participants' });
exports.createGallery = factory.createOne(Gallery);
exports.updateGallery = factory.updateOne(Gallery);
exports.deleteGallery = factory.deleteOne(Gallery);
