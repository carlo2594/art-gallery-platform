const mongoose = require('mongoose');

const artworkSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  galleries: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gallery'
  }],
  imageUrl: { type: String, required: true },
  type: { type: String }, // painting, digital, sculpture, etc.
  size: String, // e.g. "100cm x 70cm"
  material: String, // e.g. "Acrylic on canvas"
  views: { type: Number, default: 0 },
  ratings: {
    averlage: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  commentsCount: { type: Number, default: 0 }, 
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Artwork', artworkSchema);
