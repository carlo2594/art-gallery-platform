const mongoose = require('mongoose');


const exhibitionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  coverImage: String,
  images: [String], // Imágenes adicionales

  location: {
    type: {
      type: String,
      enum: ['physical', 'virtual'],
      required: false
    },
    address: { type: String }, // solo si es physical
    url: { type: String }      // solo si es virtual
  },

  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String } // Ej: 'curador', 'artista', etc.
  }],
  artworks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artwork'
  }],
  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Exhibition', exhibitionSchema);
