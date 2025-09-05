const catchAsync = require('@utils/catchAsync');
const Artwork = require('@models/artworkModel');



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

// Vista para sign in
exports.getSignUp = (req, res) => {
  res.render('public/loginSignUp', {
    title: 'Iniciar sesión · Galería del Ox',
    hideNavbar: true,
    hideFooter: true,
    mode: 'signUp'
  });
};


// Vista para login
exports.getLogin = (req, res) => {
  res.render('public/loginSignUp', {
    title: 'Iniciar sesión · Galería del Ox',
    hideNavbar: true,
    hideFooter: true,
    mode: 'login'
  });
};