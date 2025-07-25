// controllers/viewsController.js

const catchAsync = require('@utils/catchAsync');

const statsService = require('@services/statsService');

exports.getHome = catchAsync(async (req, res) => {
  const [artworks, artists, galleries] = await Promise.all([
    statsService.getTopArtworks(),
    statsService.getTopArtists(),
    statsService.getTopGalleries()
  ]);

  res.render('public/home', {
    title: 'Galería del Ox',
    artworks,
    artists,
    galleries
  });
});
