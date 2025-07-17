const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
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
  text: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function (value) {
        const wordCount = value.trim().split(/\s+/).length;
        return wordCount <= 200;
      },
      message: 'El comentario no puede tener más de 200 palabras.'
    }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Comment', commentSchema);
