// models/artworkViewModel.js
const mongoose = require('mongoose');

const artworkViewSchema = new mongoose.Schema(
  {
    artwork: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artwork',
      required: true
    },
    // Mantener 'date' por compatibilidad con datos existentes
    date: {
      type: Date,
      default: Date.now
    },
    ip: String, // opcional
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // opcional
  },
  { timestamps: true }
);

// Índices recomendados para consultas por ventana de tiempo y unicidad por IP/usuario
artworkViewSchema.index({ artwork: 1, createdAt: 1 });
artworkViewSchema.index({ artwork: 1, ip: 1, createdAt: 1 });
artworkViewSchema.index({ artwork: 1, user: 1, createdAt: 1 });

module.exports = mongoose.model('ArtworkView', artworkViewSchema);
