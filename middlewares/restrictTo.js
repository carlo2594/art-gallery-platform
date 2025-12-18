// middlewares/restrictTo.js
const { hasRole } = require('@utils/roleUtils');

module.exports = (...roles) => {
  return (req, res, next) => {
    try {
      const allow = roles.some((role) => hasRole(req.user, role));
      if (allow) return next();

      const isApi = (req.originalUrl || '').startsWith('/api/');
      const wantsHtml = typeof req.accepts === 'function' && req.accepts('html') && !isApi;
      const message = 'No tienes permiso para esta acción';

      if (wantsHtml) {
        return res.status(403).render('public/unauthorized', { title: 'Acceso no autorizado', message });
      }
      return res.status(403).json({ message });
    } catch (e) {
      return res.status(403).json({ message: 'No autorizado' });
    }
  };
};

