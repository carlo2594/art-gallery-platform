const catchAsync = require('@utils/catchAsync');
const Artwork = require('@models/artworkModel');
const statsService = require('@services/statsService');


// Página de inicio
exports.getHome = catchAsync(async (req, res) => {
  const artworks = await Artwork.find({ deletedAt: null });

  res
    .status(200)
    .render('public/home', {
      title: 'Inicio · Galería del Ox',
      artworks
    });
});

// Vista para reset password
exports.getResetPassword = (req, res) => {
  const { uid, token } = req.query;
  res.render('public/resetPassword', {
    uid,
    token,
    isNewPassword: true // o false según el caso
  });
};

