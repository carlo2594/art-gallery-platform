// Script para borrar todos los datos de la base de datos MongoDB
require('dotenv').config();
const mongoose = require('mongoose');

const Artwork = require('./models/artworkModel');
const User = require('./models/userModel');
const Exhibition = require('./models/exhibitionModel');
const Comment = require('./models/commentModel');
const Favorite = require('./models/favoriteModel');
const Rating = require('./models/ratingViewModel'); // Usa el modelo correcto

// Usa la misma lógica de conexión que server.js
const DB = process.env.DATABASE.replace('<db_password>', process.env.DATABASE_PASSWORD);

async function deleteAll() {
  try {
    await mongoose.connect(DB);
    console.log('Conectado a MongoDB');

    await Promise.all([
      Artwork.deleteMany({}),
      User.deleteMany({}),
      Exhibition.deleteMany({}),
      Comment.deleteMany({}),
      Favorite.deleteMany({}),
      Rating.deleteMany({})
    ]);

    console.log('¡Todos los datos han sido eliminados!');
    process.exit(0);
  } catch (err) {
    console.error('Error eliminando datos:', err);
    process.exit(1);
  }
}

deleteAll();