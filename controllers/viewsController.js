const catchAsync = require('@utils/catchAsync');
const statsService = require('@services/statsService');

exports.getHome = catchAsync(async (req, res) => {
  const [artworks, artists, exhibitions] = await Promise.all([
    statsService.getRecentArtworks(),
    statsService.getTopArtists(),
    statsService.getRecentExhibitions()
  ]);

  res.render('public/home', {
    title: 'Galería del Ox',
    artworks,
    artists,
    exhibitions
  });
});
