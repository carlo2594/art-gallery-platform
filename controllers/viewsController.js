const catchAsync    = require('@utils/catchAsync');
const statsService  = require('@services/statsService');

exports.getHome = catchAsync(async (req, res) => {
  const [artworks, artists, exhibitions] = await Promise.all([
    statsService.getRecentArtworks(),   
    statsService.getTopArtists(),
    statsService.getRecentExhibitions()
  ]);

  res
    .status(200)
    // .set('Cache-Control', 'public, max-age=60')   // opcional
    .render('public/home', {
      title: 'Inicio · Galería del Ox',
      artworks,
      artists,
      exhibitions
    });
});
