// Script para poblar la base de datos: elimina toda la base y crea datos de prueba variados
require('dotenv').config();
const mongoose = require('mongoose');

const Artwork = require('../models/artworkModel');
const User = require('../models/userModel');
const Exhibition = require('../models/exhibitionModel');
const Favorite = require('../models/favoriteModel');
const ArtworkView = require('../models/artworkViewModel'); // <-- AGREGA ESTA LÍNEA

const DB = process.env.DATABASE.replace('<db_password>', process.env.DATABASE_PASSWORD);

const randomImages = [
  'https://picsum.photos/seed/gdo-1/1200/800',
  'https://picsum.photos/seed/gdo-2/1024/683',
  'https://picsum.photos/seed/gdo-3/900/1200',
  'https://picsum.photos/seed/gdo-4/800/800',
  'https://picsum.photos/seed/gdo-5/1400/700',
  'https://picsum.photos/seed/gdo-6/700/1400',
  'https://picsum.photos/seed/gdo-7/1280/720',
  'https://picsum.photos/seed/gdo-8/720/1280',
  'https://picsum.photos/seed/gdo-9/1000/1000',
  'https://picsum.photos/seed/gdo-10/2048/1365',
  'https://picsum.photos/seed/gdo-11/1365/2048',
  'https://picsum.photos/seed/gdo-12/1920/1080',
  'https://picsum.photos/seed/gdo-13/1080/1920',
  'https://picsum.photos/seed/gdo-14/1600/900',
  'https://picsum.photos/seed/gdo-15/900/1600',
  'https://picsum.photos/seed/gdo-16/1200/1200'
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
 * Función para generar slug único
 */
function generateSlug(title) {
  return title
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remover acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '') // remover caracteres especiales
    .replace(/\s+/g, '-') // espacios a guiones
    .replace(/-+/g, '-') // múltiples guiones a uno
    .replace(/^-|-$/g, ''); // remover guiones al inicio y final
}

/**
 * Helper de normalización (quita tildes, pasa a minúsculas, recorta)
 */
function norm(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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
  Favorite.deleteMany({}),
    ArtworkView.deleteMany({}) // <-- AGREGA ESTA LÍNEA
  ]);


  // Crea 20 artistas de prueba y 2 admins
  const userData = [];
  userData.push({ 
    name: 'Admin', 
    email: 'admin@test.com', 
    password: '123456', 
    role: 'admin', 
    profileImage: randomFromArray(randomImages),
    slug: 'admin'
  });
  userData.push({ 
    name: 'UsuarioExtra', 
    email: 'usuarioextra@test.com', 
    password: '123456', 
    role: 'admin', 
    bio: 'Bio de usuario extra', 
    profileImage: randomFromArray(randomImages),
    slug: 'usuario-extra'
  });
  
  // Artista especial con 20 obras
  userData.push({
    name: 'Leonardo Martinez',
    email: 'leonardo.martinez@test.com',
    password: '123456',
    role: 'artist',
    bio: 'Artista contemporáneo especializado en pintura abstracta y escultura moderna. Con más de 15 años de experiencia, ha expuesto en galerías de todo el mundo.',
    location: 'Barcelona, España',
    website: 'https://leonardo-martinez-art.com',
    profileImage: randomFromArray(randomImages),
    slug: 'leonardo-martinez'
  });
  
  for (let i = 1; i <= 20; i++) {
    userData.push({
      name: `Artista ${i}`,
      email: `artista${i}@test.com`,
      password: '123456',
      role: 'artist',
      bio: `Bio de Artista ${i}`,
      profileImage: randomFromArray(randomImages),
      slug: `artista-${i}`
    });
  }
  const users = await User.insertMany(userData);

  // Tamaños reales de canvas (en cm)
  const canvasSizes = [
    { width: 20, height: 30 },
    { width: 30, height: 40 },
    { width: 40, height: 50 },
    { width: 50, height: 70 },
    { width: 60, height: 80 },
    { width: 70, height: 100 },
    { width: 80, height: 120 }
  ];


  // Crea obras de arte de prueba (total 120: 20 para Leonardo + 100 para otros)
  const artworkData = [];
  const slugsUsed = new Set(); // Para asegurar slugs únicos
  
  // Encontrar a Leonardo Martinez (será el índice 2 después de Admin y UsuarioExtra)
  const leonardoUser = users[2]; // Leonardo Martinez
  
  // Crear 20 obras específicamente para Leonardo Martinez
  const leonardoArtworks = [
    'Sinfonía Urbana', 'Reflejos del Alma', 'Danza Cósmica', 'Laberinto Interior',
    'Susurros de Color', 'Geometría Emocional', 'Ritmos de la Naturaleza', 'Fragmentos de Luz',
    'Metamorfosis Azul', 'Arquitectura de Sueños', 'Explosión Silenciosa', 'Equilibrio Dinámico',
    'Textura del Tiempo', 'Vibraciones Doradas', 'Mosaico de Sentimientos', 'Ondas Cerebrales',
    'Construcción Etérea', 'Paisaje Mental', 'Forma y Vacío', 'Energía Pura'
  ];
  
  for (let i = 0; i < 20; i++) {
    const canvas = randomFromArray(canvasSizes);
    const scaleOptions = [0.8, 1, 1.2, 1.5];
    const scale = randomFromArray(scaleOptions);
    const title = leonardoArtworks[i];
    
    // Generar slug único
    let baseSlug = generateSlug(title);
    let slug = baseSlug;
    let counter = 1;
    while (slugsUsed.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    slugsUsed.add(slug);
    
    // Genera una fecha aleatoria entre 2015 y 2024 para Leonardo (más reciente)
    const year = randomInt(2015, 2024);
    const month = randomInt(0, 11);
    const day = randomInt(1, 28);
    const completedAt = new Date(year, month, day);
    
    const types = ['pintura', 'escultura', 'técnica mixta'];
    const materials = ['óleo sobre lienzo', 'acrílico sobre papel', 'bronce', 'hierro forjado', 'técnica mixta'];
    const type = randomFromArray(types);
    const material = randomFromArray(materials);
    
    artworkData.push({
      title,
      slug,
      description: `Una obra magistral que explora ${title.toLowerCase()}. Técnica refinada que combina elementos abstractos con una profunda exploración emocional.`,
      imageUrl: randomFromArray(randomImages),
      imagePublicId: `leonardo-artwork-${i + 1}`,
      type,
      material,
      type_norm: norm(type),
      material_norm: norm(material),
      createdBy: leonardoUser._id,
      artist: leonardoUser._id,
      status: "approved",
      views: randomInt(50, 800), // Más vistas para Leonardo
      completedAt,
      width_cm: Math.round(canvas.width * scale),
      height_cm: Math.round(canvas.height * scale),
      price_cents: randomInt(1500, 8000) * 100, // Precios más altos para Leonardo
      size: `${Math.round(canvas.width * scale)} x ${Math.round(canvas.height * scale)} cm`
    });
  }
  
  // Nombres únicos para las obras de otros artistas
  // Descriptores únicos para las obras
  const artworkDescriptors = [
    'Aurora', 'Ecos', 'Reflejo', 'Caminos', 'Fragmentos',
    'Horizonte', 'Raíces', 'Alas', 'Susurros', 'Círculo',
    'Misterio', 'Ritmo', 'Jardín', 'Sombras', 'Río',
    'Constelación', 'Laberinto', 'Cumbre', 'Espejismo', 'Travesía',
    'Niebla', 'Cascada', 'Paz', 'Fuego', 'Oasis',
    'Cosecha', 'Amanecer', 'Atardecer', 'Noche', 'Mar',
    'Bosque', 'Danza', 'Caminante', 'Raíz', 'Puente',
    'Nevada', 'Invierno', 'Verano', 'Otoño', 'Primavera',
    'Caverna', 'Escondida', 'Lava', 'Montaña', 'Valle',
    'Isla', 'Desierto', 'Lago', 'Cueva', 'Pradera',
    'Sendero', 'Mirador', 'Colina', 'Lejana', 'Plata',
    'Dorada', 'Niebla', 'Cielo', 'Nubes', 'Estrella',
    'Luna', 'Sol', 'Viento', 'Brisa', 'Azul',
    'Escondido', 'Sombras', 'Sagrada', 'Luz', 'Rojo',
    'Esmeralda', 'Sueños', 'Dorada', 'Perdido', 'Alba',
    'Verde', 'Cristal', 'Dorado', 'Plateada', 'Azul',
    'Fuego', 'Estrellas', 'Polar', 'Aurora', 'Medianoche',
    'Sur', 'Otoño', 'Niebla', 'Jade', 'Azul',
    'Luz', 'Escondida', 'Cristal', 'Dorado', 'Plata',
    'Azul', 'Luz', 'Estrellas', 'Oro', 'Plata'
  ];
  
  // Crear obras para el resto de artistas (100 obras adicionales)
  for (let i = 1; i <= 100; i++) {
    // Excluir a Leonardo Martinez (índice 2) para que las obras se distribuyan entre otros artistas
    const availableUsers = users.filter((user, index) => index !== 2);
    const user = randomFromArray(availableUsers);
    const canvas = randomFromArray(canvasSizes);
    const scaleOptions = [0.5, 1, 1.5];
    const scale = randomFromArray(scaleOptions);
    let descriptor = artworkDescriptors[(i - 1) % artworkDescriptors.length];
    if (i > artworkDescriptors.length) {
      descriptor = `${descriptor} ${Math.ceil(i / artworkDescriptors.length)}`;
    }
    const title = `Obra ${descriptor}`;
    
    // Generar slug único
    let baseSlug = generateSlug(title);
    let slug = baseSlug;
    let counter = 1;
    while (slugsUsed.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    slugsUsed.add(slug);
    
    // Genera una fecha aleatoria entre 1990 y 2022 para completedAt
    const year = randomInt(1990, 2022);
    const month = randomInt(0, 11);
    const day = randomInt(1, 28);
    const completedAt = new Date(year, month, day);
    
    const type = ['pintura', 'escultura', 'dibujo', 'fotografía'][i % 4];
    const material = ['óleo', 'acrílico', 'metal', 'madera', 'carboncillo'][i % 5];
    
    artworkData.push({
      title,
      slug,
      description: `Descripción de la obra \"${title}\"`,
      imageUrl: randomFromArray(randomImages),
      imagePublicId: `seeded-image-${i}`,
      type,
      material,
      type_norm: norm(type),
      material_norm: norm(material),
      createdBy: user._id,
      artist: user._id,
      status: "approved",
      views: randomInt(0, 500),
      completedAt,
      width_cm: Math.round(canvas.width * scale),
      height_cm: Math.round(canvas.height * scale),
      price_cents: randomInt(500, 5000) * 100,
      size: `${Math.round(canvas.width * scale)} x ${Math.round(canvas.height * scale)} cm`
    });
  }
  const artworks = await Artwork.insertMany(artworkData);

  // Verificar que Leonardo tiene exactamente 20 obras
  const leonardoArtworkCount = artworks.filter(artwork => 
    artwork.artist.toString() === leonardoUser._id.toString()
  ).length;
  
  console.log(`\n🎨 ARTISTA ESPECIAL CREADO:`);
  console.log(`📝 Nombre: ${leonardoUser.name}`);
  console.log(`📧 Email: ${leonardoUser.email}`);
  console.log(`🖼️  Obras creadas: ${leonardoArtworkCount}`);
  console.log(`🔗 Slug: leonardo-martinez`);
  console.log(`📍 Ubicación: ${leonardoUser.location || 'Barcelona, España'}`);
  console.log(`🌐 Sitio web: ${leonardoUser.website || 'https://leonardo-martinez-art.com'}`);
  console.log(`� Bio: ${leonardoUser.bio}`);
  console.log(`\n✅ Puedes encontrar a este artista en: /artists/leonardo-martinez\n`);

  // Crea 10 exposiciones de prueba (mitad físicas y mitad virtuales, con status y participantes con rol)
  const exhibitionData = [];
  const participantRoles = ['artista', 'curador', 'coordinador', 'invitado'];
  for (let i = 1; i <= 10; i++) {
    // Hasta 10 artworks y 10 participantes por exposición
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
    // Participantes con rol
    const participantsArray = Array.from(participantsSet).map(uid => ({
      user: uid,
      role: randomFromArray(participantRoles)
    }));

    // Alternar entre física y virtual
    let location;
    if (i % 2 === 1) {
      // Física
      location = {
        type: 'physical',
        address: `Dirección Ficticia ${i} Centro, Ciudad`,
        url: undefined
      };
    } else {
      // Virtual
      location = {
        type: 'virtual',
        address: undefined,
        url: `https://exposicion-virtual${i}.test.com`
      };
    }

    // Genera imágenes para la exposición
    const coverImage = randomFromArray(randomImages);
    // 3-6 imágenes adicionales, sin repetir coverImage
    const shuffled = randomImages.filter(img => img !== coverImage).sort(() => 0.5 - Math.random());
    const images = shuffled.slice(0, randomInt(3, 6));

    // Status alternando entre 'published', 'draft', 'archived'
    const statusOptions = ['published', 'draft', 'archived'];
    const status = statusOptions[i % statusOptions.length];

    exhibitionData.push({
      title: `Exposición ${i}`,
      description: `Descripción de la exposición ${i}`,
      startDate: new Date(2025, i, 1),
      endDate: new Date(2025, i, 15),
      artworks: artworksArray,
      createdBy: randomFromArray(users)._id,
      participants: participantsArray,
      coverImage,
      images,
      location,
      status
    });
  }
  const exhibitions = await Exhibition.insertMany(exhibitionData);

  // Comentarios eliminados

  // Ratings eliminados

  // Crea favoritos de prueba para cada obra (entre 0-15 favoritos por obra)
  const favoriteData = [];
  const favoriteCountMap = new Map(); // Para llevar el conteo por artwork
  
  for (const artwork of artworks) {
    // Cada obra tendrá entre 0-15 favoritos
    const numFavorites = randomInt(0, 15);
    const usersWhoFavorited = new Set();
    
    // Seleccionar usuarios únicos para esta obra
    while (usersWhoFavorited.size < numFavorites && usersWhoFavorited.size < users.length) {
      const user = randomFromArray(users);
      if (!usersWhoFavorited.has(user._id.toString())) {
        usersWhoFavorited.add(user._id.toString());
        favoriteData.push({
          artwork: artwork._id,
          user: user._id
        });
      }
    }
    
    // Actualizar el contador en el mapa
    favoriteCountMap.set(artwork._id.toString(), usersWhoFavorited.size);
  }
  
  // Insertar todos los favoritos
  await Favorite.insertMany(favoriteData);
  
  // Actualizar favoritesCount en cada artwork
  for (const artwork of artworks) {
    const count = favoriteCountMap.get(artwork._id.toString()) || 0;
    artwork.favoritesCount = count;
    await artwork.save();
  }

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});