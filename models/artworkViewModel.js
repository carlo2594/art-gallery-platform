const mongoose = require('mongoose');

const viewSchema = new mongoose.Schema({
  artwork: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artwork',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  ip: String // opcional: podés usarlo para limitar vistas repetidas
});

module.exports = mongoose.model('View', viewSchema);
