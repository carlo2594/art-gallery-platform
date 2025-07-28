const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  artwork: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artwork',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Asegura que un usuario no pueda marcar el mismo artwork como favorito más de una vez
favoriteSchema.index({ user: 1, artwork: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
