const Exhibition = require('@models/exhibitionModel');
const factory = require('@utils/handlerFactory');

exports.getAllExhibitions = factory.getAll(Exhibition);
exports.getExhibition = factory.getOne(Exhibition, { path: 'createdBy participants' });
exports.createExhibition = factory.createOne(Exhibition);
exports.updateExhibition = factory.updateOne(Exhibition);
exports.deleteExhibition = factory.deleteOne(Exhibition);
