// controllers/viewsController.js

const Artwork = require('@models/artworkModel');
const catchAsync = require('@utils/catchAsync');

exports.getHome = (req, res) => {
  res.render('index', {
    title: 'Galería del Ox',
  });
};

exports.getGallery = catchAsync(async (req, res) => {
  const artworks = await Artwork.find().populate('artist');
  res.render('gallery', {
    title: 'Galería de Arte',
    artworks,
  });
});
