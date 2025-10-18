// routes/notFoundRoutes.js
const notFound = require('@middlewares/notFound');

module.exports = app => {
  // 404 para API → JSON
  app.use('/api', notFound);

  // 404 para vistas → página amigable
  app.use((req, res, next) => {
    res.status(404).render('public/error/index', {         
      title: 'Página no encontrada',
      msg:   'Esta ruta no existe en Galería del Ox.'
    });
  });
};
