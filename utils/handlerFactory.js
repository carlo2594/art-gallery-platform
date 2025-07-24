const catchAsync = require('@utils/catchAsync');
const AppError = require('@utils/appError');
const sendResponse = require('@utils/sendResponse');


exports.deleteOne = Model =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    sendResponse(res, null, 'Deleted successfully', 204);
  });

exports.updateOne = Model =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    sendResponse(res, doc, 'Updated successfully');
  });

exports.createOne = Model =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.create(req.body);

    sendResponse(res, doc, 'Created successfully', 201);
  });

exports.getOne = (Model, popOptions) =>
  catchAsync(async (req, res, next) => {
    let query = Model.findById(req.params.id);
    if (popOptions) query = query.populate(popOptions);
    const doc = await query;

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    sendResponse(res, doc, 'Document found');
  });

exports.getAll = Model =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.find();

    sendResponse(res, doc, 'Documents retrieved', 200, { results: doc.length });
  });
