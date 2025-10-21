// Script para actualizar el campo "views" de cada artwork con vistas únicas por IP en las últimas 24 horas

const fs = require('fs');
const path = require('path');
const ENV = (process.env.NODE_ENV || 'development').toLowerCase();
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, `.env.${ENV}`);
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}
const mongoose = require('mongoose');
const Artwork = require('../models/artworkModel');
const ArtworkView = require('../models/artworkViewModel');

const DB = process.env.DATABASE.replace('<db_password>', process.env.DATABASE_PASSWORD);

async function updateArtworkViews() {
  await mongoose.connect(DB);

  // Fecha límite: últimas 24 horas
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Agregación: cuenta vistas únicas por artwork en base a timestamps (createdAt) y usuario/IP
  const uniqueViews = await ArtworkView.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: { artwork: '$artwork', unique: { $ifNull: ['$user', '$ip'] } } } },
    { $group: { _id: '$_id.artwork', views: { $sum: 1 } } }
  ]);

  // Actualiza el campo views de cada artwork
  for (const view of uniqueViews) {
    await Artwork.findByIdAndUpdate(
      view._id,
      { $inc: { views: view.views } }
    );
  }

  // ...existing code...
  await mongoose.disconnect();
}

updateArtworkViews().catch(err => {
  console.error(err);
  process.exit(1);
});
