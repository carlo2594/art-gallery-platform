const Exhibition = require('@models/exhibitionModel');
const factory = require('@utils/handlerFactory');

exports.getAllExhibitions = factory.getAll(Exhibition);
exports.getExhibition = factory.getOne(Exhibition, { path: 'createdBy participants' });
exports.createExhibition = (req, res, next) => {
  // Si tienes autenticación y req.user existe:
  if (req.user && req.user._id) {
    req.body.createdBy = req.user._id;
  }
  return factory.createOne(Exhibition)(req, res, next);
};
exports.updateExhibition = factory.updateOne(Exhibition);
exports.deleteExhibition = factory.deleteOne(Exhibition);
