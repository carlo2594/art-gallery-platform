const jwt = require('jsonwebtoken');
const User = require('@models/userModel');


const requireUser = async (req, res, next) => {
  // Solo acepta JWT desde cookie HttpOnly
  const token = req.cookies && req.cookies.jwt;
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token (cookie required)' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password +roles +role');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = requireUser;
