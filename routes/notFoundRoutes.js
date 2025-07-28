// routes/notFoundRoutes.js

const notFound = require('@middlewares/notFound');

module.exports = app => {
  // Middleware 404 para API
  app.use('/api', notFound);

  // Middleware 404 para vistas
  app.use((req, res, next) => {
    res.status(404).render('error', {
      title: 'Página no encontrada',
      msg: 'Esta ruta no existe en Galería del Ox.',
    });
  });
};
