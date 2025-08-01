// models/artworkViewModel.js
const mongoose = require('mongoose');

const artworkViewSchema = new mongoose.Schema({
  artwork: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artwork',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  ip: String // opcional
});

module.exports = mongoose.model('ArtworkView', artworkViewSchema);
