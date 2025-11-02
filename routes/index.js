const artworkRoutes     = require('@routes/api/artworkRoutes');
const exhibitionRoutes  = require('@routes/api/exhibitionRoutes');
const userRoutes        = require('@routes/api/userRoutes');
const authRoutes        = require('@routes/api/authRoutes');
const favoriteRoutes    = require('@routes/api/favoriteRoutes');
const followRoutes      = require('@routes/api/followRoutes');
const artworkViewRoutes = require('@routes/api/artworkViewRoutes');
const mediaRoutes       = require('@routes/media');


const viewRoutes   = require('@routes/views/viewRoutes');
const adminRoutes  = require('@routes/views/adminRoutes');
const notFoundRoutes = require('@routes/notFoundRoutes');

module.exports = app => {
  /* ---------- Vistas Pug ---------- */
  app.use('/',      viewRoutes);
  app.use('/admin', adminRoutes);

  /* ---------- API REST ---------- */
  app.use('/api/v1/auth',        authRoutes);        
  app.use('/api/v1/users',       userRoutes);
  app.use('/api/v1/favorites',   favoriteRoutes);
  app.use('/api/v1/follows',     followRoutes);
  app.use('/api/v1/artworks',    artworkRoutes);
  app.use('/api/v1/exhibitions', exhibitionRoutes);
  app.use('/api/v1/artwork-views', artworkViewRoutes);
  app.use('/api/v1/newsletter',  require('@routes/api/newsletterRoutes')); 
  app.use('/api/v1/contact',     require('@routes/api/contactRoutes'));
  // Media endpoints (upload/public/original)
  app.use('/', mediaRoutes);


  /* ---------- 404 ---------- */
  notFoundRoutes(app);
};
