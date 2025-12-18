// middleware/attachUserToViews.js
const jwt = require('jsonwebtoken');
const User = require('@models/userModel');
const { ensureRolesArray, hasRole, AVAILABLE_ROLES } = require('@utils/roleUtils');

module.exports = async (req, res, next) => {
  // Ruta actual disponible en Pug (para returnTo)
  try { res.locals.currentPath = req.originalUrl || req.url || '/'; } catch (_) {}
  res.locals.hasRole = hasRole;
  res.locals.availableRoles = AVAILABLE_ROLES;
  res.locals.currentUserHasRole = (role) => hasRole(res.locals.currentUser, role);
  try {
    const token = req.cookies?.jwt;
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id)
      .select('name firstName lastName headline bio website country social profileImage coverImage +roles');
    if (user) {
      const roles = ensureRolesArray(user);
      const currentUser = {
        id: user.id,
        name: user.name,
        roles,
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
      res.locals.currentUser = currentUser;
      res.locals.currentUserHasRole = (role) => hasRole(currentUser, role);
    }
  } catch (e) {
    // token inválido/expirado: continuar sin usuario
  }
  res.locals.hasRole = hasRole;
  next();
};
