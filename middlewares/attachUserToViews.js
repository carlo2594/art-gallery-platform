// middleware/attachUserToViews.js
const jwt = require('jsonwebtoken');
const User = require('@models/userModel');

module.exports = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt;
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('name email');
    if (user) res.locals.currentUser = { id: user.id, name: user.name };
  } catch (e) {
    // token inválido/expirado: continuar sin usuario
  }
  next();
};
