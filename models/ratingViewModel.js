const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  artwork: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artwork',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String
  },
  date: {
    type: Date,
    default: Date.now
  }
});

// Ensure 1 rating per user per artwork
ratingSchema.index({ artwork: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
