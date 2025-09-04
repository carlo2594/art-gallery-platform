const catchAsync = require('@utils/catchAsync');
const statsService = require('@services/statsService');

// Página de inicio
exports.getHome = catchAsync(async (req, res) => {
  const [artworks, artists, exhibitions] = await Promise.all([
    statsService.getRecentArtworks(),
    statsService.getTopArtists(),
    statsService.getRecentExhibitions()
  ]);

  res
    .status(200)
    .render('public/home', {
      title: 'Inicio · Galería del Ox',
      artworks,
      artists,
      exhibitions
    });
});

// Vista para reset password
exports.getResetPassword = (req, res) => {
  const { uid, token } = req.query;
  res.render('public/resetPassword', { uid, token, hideNavbar: true });
};

