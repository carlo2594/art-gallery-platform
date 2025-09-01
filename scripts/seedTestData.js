// Script para poblar la base de datos: elimina toda la base y crea datos de prueba variados
require('dotenv').config();
const mongoose = require('mongoose');

const Artwork = require('../models/artworkModel');
const User = require('../models/userModel');
const Exhibition = require('../models/exhibitionModel');
const Comment = require('../models/commentModel');
const Favorite = require('../models/favoriteModel');
const Rating = require('../models/ratingViewModel');
const ArtworkView = require('../models/artworkViewModel'); // <-- AGREGA ESTA LÍNEA

const DB = process.env.DATABASE.replace('<db_password>', process.env.DATABASE_PASSWORD);

const randomImages = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
  'https://images.unsplash.com/photo-1465101046530-73398c7f28ca',
  'https://images.unsplash.com/photo-1519125323398-675f0ddb6308',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e',
  'https://images.unsplash.com/photo-1519985176271-adb1088fa94c',
  'https://images.unsplash.com/photo-1465101178521-c1a9136a3b99',
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429',
  'https://images.unsplash.com/photo-1465101046530-73398c7f28ca',
  'https://images.unsplash.com/photo-1519125323398-675f0ddb6308',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e'
];

/**
 * Devuelve un elemento aleatorio de un arreglo.
 */
function randomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Devuelve un número entero aleatorio entre min y max (ambos incluidos).
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Agrega el arreglo de statuses permitidos
const ARTWORK_STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'trashed'];

/**
 * Función principal que conecta a la base de datos, elimina toda la base y agrega datos de prueba variados.
 */
async function seed() {
  await mongoose.connect(DB);

  // Elimina todos los documentos de cada colección (incluyendo artwork views)
  await Promise.all([
    User.deleteMany({}),
    Artwork.deleteMany({}),
    Exhibition.deleteMany({}),
    Comment.deleteMany({}),
    Favorite.deleteMany({}),
    Rating.deleteMany({}),
    ArtworkView.deleteMany({}) // <-- AGREGA ESTA LÍNEA
  ]);

  // Crea usuarios de prueba (máximo 10)
  const userData = [
    { name: 'Admin', email: 'admin@test.com', password: '123456', role: 'admin' },
    { name: 'Artista Uno', email: 'artista1@test.com', password: '123456', role: 'artist' },
    { name: 'Artista Dos', email: 'artista2@test.com', password: '123456', role: 'artist' },
    { name: 'Visitante', email: 'visitante@test.com', password: '123456', role: 'artist' }
  ];
  for (let i = 1; i <= 6; i++) { // 4 + 6 = 10
    userData.push({
      name: `Usuario${i}`,
      email: `usuario${i}@test.com`,
      password: '123456',
      role: i % 2 === 0 ? 'artist' : 'admin',
      bio: `Bio de usuario ${i}`,
      profileImage: randomFromArray(randomImages)
    });
  }
  const users = await User.insertMany(userData.slice(0, 10));

  // Crea obras de arte de prueba (máximo 10)
  const artworkData = [];
  for (let i = 1; i <= 10; i++) {
    const user = randomFromArray(users);
    artworkData.push({
      title: `Obra ${i}`,
      description: `Descripción de la obra ${i}`,
      imageUrl: randomFromArray(randomImages),
      type: ['pintura', 'escultura', 'dibujo', 'fotografía'][i % 4],
      size: `${randomInt(20, 120)}x${randomInt(20, 120)} cm`,
      material: ['óleo', 'acrílico', 'metal', 'madera', 'carboncillo'][i % 5],
      createdBy: user._id,
      artist: user._id,
      status: randomFromArray(ARTWORK_STATUSES),
      ratings: { count: 0, average: 0 },
      commentsCount: 0
    });
  }
  const artworks = await Artwork.insertMany(artworkData);

  // Crea exposiciones de prueba (máximo 10)
  const exhibitionData = [];
  for (let i = 1; i <= 10; i++) {
    // Máximo 10 artworks y 10 participantes por exposición
    const artworksSet = new Set();
    while (artworksSet.size < 10) {
      artworksSet.add(artworks[randomInt(0, artworks.length - 1)]._id);
      if (artworksSet.size === artworks.length) break;
    }
    const artworksArray = Array.from(artworksSet);

    const participantsSet = new Set();
    while (participantsSet.size < 10) {
      participantsSet.add(randomFromArray(users)._id);
      if (participantsSet.size === users.length) break;
    }
    const participantsArray = Array.from(participantsSet);

    exhibitionData.push({
      title: `Exposición ${i}`,
      description: `Descripción de la exposición ${i}`,
      startDate: new Date(2025, i, 1),
      endDate: new Date(2025, i, 15),
      artworks: artworksArray,
      createdBy: randomFromArray(users)._id,
      participants: participantsArray
    });
  }
  const exhibitions = await Exhibition.insertMany(exhibitionData);

  // Crea comentarios de prueba (máximo 10)
  const commentData = [];
  for (let i = 1; i <= 10; i++) {
    const user = randomFromArray(users);
    const artwork = randomFromArray(artworks);
    commentData.push({
      artwork: artwork._id,
      text: `Comentario ${i} sobre la obra.`,
      user: user._id
    });
    artwork.commentsCount = (artwork.commentsCount || 0) + 1;
  }
  await Comment.insertMany(commentData);
  for (const artwork of artworks) {
    await artwork.save();
  }

  // Crea ratings de prueba (máximo 10)
  const ratingData = [];
  for (let i = 1; i <= 10; i++) {
    const user = randomFromArray(users);
    const artwork = randomFromArray(artworks);
    ratingData.push({
      artwork: artwork._id,
      rating: randomInt(1, 5),
      user: user._id
    });
  }
  await Rating.insertMany(ratingData);

  // Crea favoritos de prueba (máximo 10)
  const favoriteData = [];
  for (let i = 1; i <= 10; i++) {
    favoriteData.push({
      artwork: randomFromArray(artworks)._id,
      user: randomFromArray(users)._id
    });
  }
  await Favorite.insertMany(favoriteData);

  console.log('Base de datos eliminada y datos de prueba insertados correctamente.');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});