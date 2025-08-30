// Script para poblar la base de datos con muchos datos de prueba variados
require('dotenv').config();
const mongoose = require('mongoose');

const Artwork = require('../models/artworkModel');
const User = require('../models/userModel');
const Exhibition = require('../models/exhibitionModel');
const Comment = require('../models/commentModel');
const Favorite = require('../models/favoriteModel');
const Rating = require('../models/ratingViewModel'); // Usa el modelo correcto

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

/**
 * Función principal que conecta a la base de datos, limpia las colecciones y agrega datos de prueba variados.
 */
async function seed() {
  await mongoose.connect(DB);

  // Limpia todas las colecciones antes de insertar datos nuevos
  await Promise.all([
    User.deleteMany({}),
    Artwork.deleteMany({}),
    Exhibition.deleteMany({}),
    Comment.deleteMany({}),
    Favorite.deleteMany({}),
    Rating.deleteMany({})
  ]);

  // Crea usuarios de prueba (admin, artistas y usuarios normales)
  const userData = [
    { name: 'Admin', email: 'admin@test.com', password: '123456', role: 'admin' },
    { name: 'Artista Uno', email: 'artista1@test.com', password: '123456', role: 'artist' },
    { name: 'Artista Dos', email: 'artista2@test.com', password: '123456', role: 'artist' },
    { name: 'Visitante', email: 'visitante@test.com', password: '123456', role: 'artist' }
  ];
  // Agrega más usuarios con datos variados
  for (let i = 1; i <= 10; i++) {
    userData.push({
      name: `Usuario${i}`,
      email: `usuario${i}@test.com`,
      password: '123456',
      role: i % 2 === 0 ? 'artist' : 'admin',
      bio: `Bio de usuario ${i}`,
      profileImage: randomFromArray(randomImages)
    });
  }
  const users = await User.insertMany(userData);

  // Crea obras de arte de prueba con distintos tipos y materiales
  const artworkData = [];
  for (let i = 1; i <= 20; i++) {
    const user = randomFromArray(users);
    artworkData.push({
      title: `Obra ${i}`,
      description: `Descripción de la obra ${i}`,
      imageUrl: randomFromArray(randomImages),
      type: ['pintura', 'escultura', 'dibujo', 'fotografía'][i % 4],
      size: `${randomInt(20, 120)}x${randomInt(20, 120)} cm`,
      material: ['óleo', 'acrílico', 'metal', 'madera', 'carboncillo'][i % 5],
      createdBy: user._id,
      artist: user._id // <-- ObjectId requerido
    });
  }
  const artworks = await Artwork.insertMany(artworkData);

  // Crea exposiciones de prueba con obras aleatorias
  const exhibitionData = [];
  for (let i = 1; i <= 5; i++) {
    exhibitionData.push({
      name: `Exposición ${i}`, // <-- Campo requerido por tu modelo
      description: `Descripción de la exposición ${i}`,
      startDate: new Date(2025, i, 1),
      endDate: new Date(2025, i, 15),
      artworks: [
        artworks[randomInt(0, artworks.length - 1)]._id,
        artworks[randomInt(0, artworks.length - 1)]._id
      ],
      createdBy: randomFromArray(users)._id
    });
  }
  const exhibitions = await Exhibition.insertMany(exhibitionData);

  // Crea comentarios de prueba en distintas obras y por distintos usuarios
  const commentData = [];
  for (let i = 1; i <= 30; i++) {
    const user = randomFromArray(users);
    commentData.push({
      artwork: randomFromArray(artworks)._id,
      text: `Comentario ${i} sobre la obra.`,
      user: user._id // <-- Campo requerido por tu modelo
    });
  }
  await Comment.insertMany(commentData);

  // Crea ratings de prueba para distintas obras y usuarios
  const ratingData = [];
  for (let i = 1; i <= 30; i++) {
    const user = randomFromArray(users);
    ratingData.push({
      artwork: randomFromArray(artworks)._id,
      rating: randomInt(1, 5), // <-- Campo requerido por tu modelo
      user: user._id           // <-- Campo requerido por tu modelo
    });
  }
  await Rating.insertMany(ratingData);

  // Crea favoritos de prueba para distintos usuarios y obras
  const favoriteData = [];
  for (let i = 1; i <= 30; i++) {
    favoriteData.push({
      artwork: randomFromArray(artworks)._id,
      user: randomFromArray(users)._id
    });
  }
  await Favorite.insertMany(favoriteData);

  console.log('Muchos datos de prueba insertados correctamente.');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});