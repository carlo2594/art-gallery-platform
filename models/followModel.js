const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Un usuario no puede seguir al mismo artista más de una vez
followSchema.index({ follower: 1, artist: 1 }, { unique: true });

// Índices para listados
followSchema.index({ artist: 1, createdAt: -1 });
followSchema.index({ follower: 1, createdAt: -1 });

module.exports = mongoose.model('Follow', followSchema);

