// routes/index.js

const artworkRoutes = require('./artworkRoutes');
const galleryRoutes = require('./galleryRoutes');
const collectionRoutes = require('./collectionRoutes');
const commentRoutes = require('./commentRoutes');
const userRoutes = require('./userRoutes');
const authRoutes = require('./authRoutes');
const viewRoutes = require('./viewRoutes'); // 👈 nuevo

module.exports = app => {
  // Rutas de vistas
  app.use('/', viewRoutes);

  // Rutas de API
  app.use('/api/v1/artworks', artworkRoutes);
  app.use('/api/v1/galleries', galleryRoutes);
  app.use('/api/v1/collections', collectionRoutes);
  app.use('/api/v1/comments', commentRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/auth', authRoutes);
};
