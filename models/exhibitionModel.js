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

/* ---------- Índices optimizados para viewsController ---------- */
// 1. Índice principal para consultas de exposiciones (getExhibitionsView, getSearchResults)
exhibitionSchema.index({ 
  status: 1, 
  startDate: -1, 
  endDate: -1 
});

// 2. Índice para búsqueda por slug (si se implementa)
exhibitionSchema.index({ slug: 1 }, { unique: true, sparse: true });

// 3. Índice para consultas por tipo de ubicación
exhibitionSchema.index({ 
  status: 1, 
  'location.type': 1, 
  startDate: -1 
});

// 4. Índice para búsqueda de texto
exhibitionSchema.index({ 
  title: 'text', 
  description: 'text' 
});

// 5. Índice para consultas por artworks y participantes
exhibitionSchema.index({ artworks: 1 });
exhibitionSchema.index({ 'participants.user': 1 });

module.exports = mongoose.model('Exhibition', exhibitionSchema);
