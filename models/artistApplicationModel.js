// models/artistApplicationModel.js
const mongoose = require('mongoose');
const validator = require('validator');

const artistApplicationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // Campo legado opcional (mantener por compatibilidad)
  portfolioUrl: {
    type: String,
    trim: true,
    validate: {
      validator: (v) => !v || validator.isURL(String(v), { protocols: ['http','https'], require_protocol: true }),
      message: 'URL de portfolio inválida'
    }
  },
  // Nuevos: enlaces múltiples a web/redes
  links: [{
    type: String,
    trim: true,
    validate: {
      validator: (v) => !!v && validator.isURL(String(v), { protocols: ['http','https'], require_protocol: true }),
      message: 'Enlace inválido'
    }
  }],
  statement: { type: String, trim: true, maxlength: 1500 },
  resumePublicId: { type: String, required: true, trim: true },
  resumeUrl: { type: String, required: true, trim: true },
  status: { type: String, enum: ['pending','under_review','approved','rejected'], default: 'pending', index: true },
  adminNotes: { type: String, trim: true, maxlength: 1500 }
}, { timestamps: true });

// Índice auxiliar para búsquedas por usuario y estado
artistApplicationSchema.index({ user: 1, status: 1, createdAt: -1 });

// Máximo 5 enlaces permitidos
artistApplicationSchema.path('links').validate(function (arr) {
  if (!arr) return true;
  return Array.isArray(arr) && arr.length <= 5;
}, 'Máximo 5 enlaces permitidos');

module.exports = mongoose.model('ArtistApplication', artistApplicationSchema);
