const mongoose = require('mongoose');

const exhibitionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  coverImage: String,
  // Opcional: fechas de inicio / fin si las necesitas
  startDate: Date,
  endDate: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Exhibition', exhibitionSchema);
