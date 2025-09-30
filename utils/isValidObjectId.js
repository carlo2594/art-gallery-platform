const mongoose = require('mongoose');

// Valida si un string es un ObjectId de MongoDB válido
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

module.exports = isValidObjectId;
