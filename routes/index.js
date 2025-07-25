// routes/index.js

const artworkRoutes = require('@routes/api/artworkRoutes');
const galleryRoutes = require('@routes/api/galleryRoutes');
const collectionRoutes = require('@routes/api/collectionRoutes');
const commentRoutes = require('@routes/api/commentRoutes');
const userRoutes = require('@routes/api/userRoutes');
const authRoutes = require('@routes/api/authRoutes');

const viewRoutes = require('@routes/views/viewRoutes');
const notFoundRoutes = require('@routes/notFoundRoutes');

module.exports = app => {
  // Rutas de vistas (Pug)
  app.use('/', viewRoutes);

  // Rutas de API REST
  app.use('/api/v1/artworks', artworkRoutes);
  app.use('/api/v1/galleries', galleryRoutes);
  app.use('/api/v1/collections', collectionRoutes);
  app.use('/api/v1/comments', commentRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/auth', authRoutes);

  // Manejo de rutas no encontradas (404)
  notFoundRoutes(app);
};
