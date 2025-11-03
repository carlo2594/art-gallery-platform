// middleware/attachUserToViews.js
const jwt = require('jsonwebtoken');
const User = require('@models/userModel');

module.exports = async (req, res, next) => {
  // Ruta actual disponible en Pug (para returnTo)
  try { res.locals.currentPath = req.originalUrl || req.url || '/'; } catch (_) {}
  try {
    const token = req.cookies?.jwt;
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id)
      .select('name firstName lastName headline bio website country social profileImage coverImage +role');
    if (user) {
      res.locals.currentUser = {
        id: user.id,
        name: user.name,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        headline: user.headline,
        bio: user.bio,
        website: user.website,
        country: user.country,
        social: user.social,
        profileImage: user.profileImage,
        coverImage: user.coverImage
      };
    }
  } catch (e) {
    // token inválido/expirado: continuar sin usuario
  }
  next();
};
