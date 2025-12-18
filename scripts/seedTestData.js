// Script para poblar la base de datos: elimina toda la base y crea datos de prueba variados
require('module-alias/register');
const fs = require('fs');
const path = require('path');
const ENV = (process.env.NODE_ENV || 'development').toLowerCase();
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, `.env.${ENV}`);
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  const fallbackEnvPath = path.join(rootDir, '.env');
  require('dotenv').config({ path: fallbackEnvPath });
}
// Safety guard: never seed in production
if (ENV === 'production') {
  console.error('[GUARD] seedTestData.js bloqueado en NODE_ENV=production. Aborta.');
  process.exit(1);
}
const mongoose = require('mongoose');

const Artwork = require('../models/artworkModel');
const User = require('../models/userModel');
const Exhibition = require('../models/exhibitionModel');
const Favorite = require('../models/favoriteModel');
const Follow = require('../models/followModel');
const ArtworkView = require('../models/artworkViewModel'); // <-- AGREGA ESTA LÍNEA
const Comment = require('../models/commentModel');
const PasswordResetToken = require('../models/passwordResetTokenModel');
const Newsletter = require('../models/newsletterModel');
const ArtistApplication = require('../models/artistApplicationModel');

if (!process.env.DATABASE) {
  console.error('[SEED] Variable DATABASE no está definida en el archivo .env');
  process.exit(1);
}

const DB = process.env.DATABASE.replace('<db_password>', process.env.DATABASE_PASSWORD || '');
const DB_NAME = process.env.DB_NAME || 'galeria_dev';

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
const ARTWORK_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'trashed'];
const AVAILABILITY_STATUSES = ['for_sale', 'reserved', 'sold', 'not_for_sale', 'on_loan'];

/**
 * Función principal que conecta a la base de datos, elimina toda la base y agrega datos de prueba variados.
 */
async function seed() {
  await mongoose.connect(DB, { dbName: DB_NAME });
  
  console.log('[SEED] Sincronizando índices...');
  
  // Sincronizar índices para evitar warnings de duplicados
  try {
    await User.syncIndexes();
    await Artwork.syncIndexes(); 
    await Exhibition.syncIndexes();
    await Favorite.syncIndexes();
    await Follow.syncIndexes();
    await ArtworkView.syncIndexes();
    await Comment.syncIndexes();
    await PasswordResetToken.syncIndexes();
    await Newsletter.syncIndexes();
    await ArtistApplication.syncIndexes();
    console.log('✅ Índices sincronizados');
  } catch (error) {
    console.log('⚠️  Advertencia sincronizando índices:', error.message);
  }

  console.log('[SEED] Limpiando datos existentes...');
  // Elimina todos los documentos de cada colección (incluyendo artwork views)
  await Promise.all([
    User.deleteMany({}),
    Artwork.deleteMany({}),
    Exhibition.deleteMany({}),
    Favorite.deleteMany({}),
    Follow.deleteMany({}),
    ArtworkView.deleteMany({}), // <-- AGREGA ESTA LÍNEA
    Comment.deleteMany({}),
    PasswordResetToken.deleteMany({}),
    Newsletter.deleteMany({}),
    ArtistApplication.deleteMany({})
  ]);
  console.log('✅ Datos eliminados');


  // Crea artistas/usuarios de prueba reducidos (máximo 10 usuarios en total)
  const userData = [];
  userData.push({ 
    name: 'Admin', 
    email: 'admin@test.com', 
    password: 'SeedPass1', 
    roles: ['admin'], 
    profileImage: randomFromArray(randomImages),
    coverImage: randomFromArray(randomImages),
    slug: 'admin'
  });

  // Crear 2 coleccionistas (para solicitudes de artista)
  for (let i = 1; i <= 2; i++) {
    userData.push({
      name: `Collector ${i}`,
      email: `collector${i}@test.com`,
      password: 'SeedPass1',
      roles: ['collector'],
      bio: `Coleccionista de arte ${i}`,
      profileImage: randomFromArray(randomImages),
      coverImage: randomFromArray(randomImages),
      slug: `collector-${i}`
    });
  }
  userData.push({ 
    name: 'UsuarioExtra', 
    email: 'usuarioextra@test.com', 
    password: 'SeedPass1', 
    roles: ['admin'], 
    bio: 'Bio de usuario extra', 
    profileImage: randomFromArray(randomImages),
    coverImage: randomFromArray(randomImages),
    slug: 'usuario-extra'
  });
  
  // Artista especial (tendrá pocas obras en este seed reducido)
  userData.push({
    name: 'Leonardo Martinez',
    email: 'leonardo.martinez@test.com',
    password: 'SeedPass1',
    roles: ['artist'],
    bio: 'Artista contemporáneo especializado en pintura abstracta y escultura moderna. Con más de 15 años de experiencia, ha expuesto en galerías de todo el mundo.',
    location: 'Barcelona, España',
    website: 'https://leonardo-martinez-art.com',
    social: {
      instagram: 'leonardo_martinez_art',
      x: 'leo_martinez_art',
      facebook: 'leonardo.martinez.artist'
    },
    profileImage: randomFromArray(randomImages),
    coverImage: randomFromArray(randomImages),
    slug: 'leonardo-martinez'
  });
  
  // Agregar 3 artistas adicionales
  for (let i = 1; i <= 3; i++) {
    userData.push({
      name: `Artista ${i}`,
      email: `artista${i}@test.com`,
      password: 'SeedPass1',
      roles: ['artist'],
      bio: `Bio de Artista ${i}`,
      profileImage: randomFromArray(randomImages),
      coverImage: randomFromArray(randomImages),
      slug: `artista-${i}`
    });
  }
  // Usar create secuencial para disparar hooks (hash de password y slug único)
  const users = [];
  for (const data of userData) {
    // Si falta name, el hook lo igualará al email
    const created = await User.create(data);
    users.push(created);
  }

  // Crear al menos 5 solicitudes de artista con distintos estados
  const collectors = users.filter(u => Array.isArray(u.roles) && u.roles.includes('collector'));
  const owner = collectors.length ? collectors : users; // fallback si no hubiese collectors
  const pickUser = (idx) => owner[idx % owner.length];
  const appSeed = [
    { status: 'pending', links: ['https://portfolio.example.com/alfa', 'https://instagram.com/alfa'] },
    { status: 'under_review', links: ['https://portfolio.example.com/bravo'] },
    { status: 'approved', links: ['https://site.example.com/charlie'] },
    { status: 'rejected', links: ['https://portfolio.example.com/delta'] },
    { status: 'under_review', links: ['https://behance.net/echo'] }
  ];
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'demo';
  const fakeResumeUrl = (publicId) => `https://res.cloudinary.com/${cloudName}/raw/upload/v1720000000/${publicId}.pdf`;
  const applicationsToInsert = appSeed.map((cfg, i) => {
    const u = pickUser(i);
    const publicId = `artist-applications/resumes/seed-cv-${i+1}`;
    return {
      user: u._id,
      links: cfg.links,
      statement: `Mi statement de prueba ${i+1}. Me interesa formar parte de la galería y aportar obras en pequeño y mediano formato.`,
      resumePublicId: publicId,
      resumeUrl: fakeResumeUrl(publicId),
      resumeOriginalName: `cv-${(u.name || 'user').toString().toLowerCase().replace(/\s+/g,'-')}.pdf`,
      status: cfg.status,
      adminNotes: cfg.status === 'rejected' ? 'Perfil no encaja en esta convocatoria.' : (cfg.status === 'under_review' ? 'Pendiente ampliar info de trayectoria.' : '')
    };
  });
  await ArtistApplication.insertMany(applicationsToInsert);
  console.log(`✅ ${applicationsToInsert.length} solicitudes de artista creadas`);

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
  
  // Encontrar a Leonardo Martinez por slug o email para evitar dependencias del índice
  const leonardoUser = users.find(u => u.slug === 'leonardo-martinez') 
    || users.find(u => (u.email || '').toLowerCase() === 'leonardo.martinez@test.com')
    || users[0];
  
  // Crear 3 obras específicamente para Leonardo Martinez
  const leonardoArtworks = [
    'Sinfonía Urbana', 'Reflejos del Alma', 'Danza Cósmica', 'Laberinto Interior',
    'Susurros de Color', 'Geometría Emocional', 'Ritmos de la Naturaleza', 'Fragmentos de Luz',
    'Metamorfosis Azul', 'Arquitectura de Sueños', 'Explosión Silenciosa', 'Equilibrio Dinámico',
    'Textura del Tiempo', 'Vibraciones Doradas', 'Mosaico de Sentimientos', 'Ondas Cerebrales',
    'Construcción Etérea', 'Paisaje Mental', 'Forma y Vacío', 'Energía Pura'
  ];
  
  for (let i = 0; i < 3; i++) {
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
    const techniques = ['óleo sobre lienzo', 'acrílico sobre papel', 'bronce', 'hierro forjado', 'técnica mixta'];
    const type = randomFromArray(types);
    const technique = randomFromArray(techniques);
    
    artworkData.push({
      title,
      slug,
      description: `Una obra magistral que explora ${title.toLowerCase()}. Técnica refinada que combina elementos abstractos con una profunda exploración emocional.`,
      imageUrl: randomFromArray(randomImages),
      type,
      technique,
      type_norm: norm(type),
      technique_norm: norm(technique),
      createdBy: leonardoUser._id,
      artist: leonardoUser._id,
      status: "approved",
      availability: "for_sale", // Agregar disponibilidad por defecto
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
  
  // Crear obras para el resto de artistas (6 obras adicionales)
  for (let i = 1; i <= 6; i++) {
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
    const technique = ['óleo', 'acrílico', 'metal', 'madera', 'carboncillo'][i % 5];
    
    artworkData.push({
      title,
      slug,
      description: `Descripción de la obra \"${title}\"`,
      imageUrl: randomFromArray(randomImages),
      type,
      technique,
      type_norm: norm(type),
      technique_norm: norm(technique),
      createdBy: user._id,
      artist: user._id,
      status: "approved",
      availability: randomFromArray(AVAILABILITY_STATUSES), // Agregar disponibilidad aleatoria
      views: randomInt(0, 500),
      completedAt,
      width_cm: Math.round(canvas.width * scale),
      height_cm: Math.round(canvas.height * scale),
      price_cents: randomInt(500, 5000) * 100,
      size: `${Math.round(canvas.width * scale)} x ${Math.round(canvas.height * scale)} cm`
    });
  }
  const artworks = await Artwork.insertMany(artworkData);

  // Verificar cuántas obras tiene Leonardo en este seed reducido
  const leonardoArtworkCount = artworks.filter(artwork => 
    artwork.artist.toString() === leonardoUser._id.toString()
  ).length;
  
  console.log('\n[SHOWCASE] Artista especial creado');
  console.log('[SHOWCASE] Nombre:', leonardoUser.name);
  console.log('[SHOWCASE] Email:', leonardoUser.email);
  console.log('[SHOWCASE] Obras creadas (Leonardo):', leonardoArtworkCount);
  console.log('[SHOWCASE] Slug:', 'leonardo-martinez');
  console.log('[SHOWCASE] Ubicación:', leonardoUser.location || 'Barcelona, España');
  console.log('[SHOWCASE] Sitio web:', leonardoUser.website || 'https://leonardo-martinez-art.com');
  console.log('[SHOWCASE] Bio:', leonardoUser.bio);
  console.log(`\n✅ Puedes encontrar a este artista en: /artists/leonardo-martinez\n`);

  // Estadísticas de disponibilidad
  const availabilityStats = {};
  AVAILABILITY_STATUSES.forEach(status => {
    availabilityStats[status] = artworks.filter(artwork => artwork.availability === status).length;
  });
  
  const soldArtworks = artworks.filter(artwork => artwork.availability === 'sold');
  const totalRevenue = soldArtworks.reduce((sum, artwork) => {
    return sum + (artwork.sale?.price_cents || artwork.price_cents);
  }, 0);
  
  console.log('[SEED] ESTADÍSTICAS DE DISPONIBILIDAD:');
  console.log('[SEED] Disponibles para venta:', availabilityStats.for_sale);
  console.log(`⏰ Reservadas: ${availabilityStats.reserved}`);
  console.log('[SEED] Vendidas:', availabilityStats.sold);
  console.log('[SEED] No disponibles:', availabilityStats.not_for_sale);
  console.log('[SEED] En préstamo:', availabilityStats.on_loan);
  console.log('[SEED] Ingresos totales por ventas: $' + (totalRevenue / 100).toFixed(2) + ' USD');
  console.log('\n[SEED] TIP: Usa las rutas de API para gestionar disponibilidad:');
  console.log(`   PATCH /api/v1/artworks/:id/mark-sold`);
  console.log(`   PATCH /api/v1/artworks/:id/reserve`);
  console.log(`   PATCH /api/v1/artworks/:id/unreserve\n`);

  // Crea 9 exposiciones de prueba (mitad físicas y mitad virtuales, con status y participantes con rol)
  const exhibitionData = [];
  const participantRoles = ['artista', 'curador', 'coordinador', 'invitado'];
  for (let i = 1; i <= 9; i++) {
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
  // Agregar slug a cada exposición (insertMany no dispara pre-save hooks)
  const usedExpoSlugs = new Set();
  const exhibitionsWithSlug = exhibitionData.map((ex) => {
    const base = generateSlug(ex.title);
    let slug = base;
    let n = 1;
    while (usedExpoSlugs.has(slug)) {
      slug = `${base}-${n++}`;
    }
    usedExpoSlugs.add(slug);
    return { ...ex, slug };
  });
  const exhibitions = await Exhibition.insertMany(exhibitionsWithSlug);

  // Backfill: agregar referencia de exposición en cada obra
  for (const expo of exhibitions) {
    if (Array.isArray(expo.artworks) && expo.artworks.length) {
      await Artwork.updateMany(
        { _id: { $in: expo.artworks } },
        { $addToSet: { exhibitions: expo._id } }
      );
    }
  }

  // Comentarios eliminados

  // Ratings eliminados

  // Crea favoritos de prueba (máximo 10 favoritos en total)
  let favoriteData = [];
  for (const artwork of artworks) {
    if (favoriteData.length >= 10) break;
    const usersWhoFavorited = new Set();
    const targetForThisArtwork = randomInt(0, 2); // 0-2 favoritos por obra
    while (usersWhoFavorited.size < targetForThisArtwork && favoriteData.length < 10) {
      const user = randomFromArray(users);
      const key = `${artwork._id}:${user._id}`;
      if (!usersWhoFavorited.has(key)) {
        usersWhoFavorited.add(key);
        favoriteData.push({ artwork: artwork._id, user: user._id });
      }
    }
  }
  await Favorite.insertMany(favoriteData);
  // Recalcular favoritos por obra con base en lo insertado
  const favCountByArtwork = favoriteData.reduce((acc, f) => {
    const k = String(f.artwork);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  for (const artwork of artworks) {
    const count = favCountByArtwork[String(artwork._id)] || 0;
    artwork.favoritesCount = count;
    await artwork.save();
  }

  // Crea seguidores de prueba para el nuevo modelo Follow
  const artistUsers = users.filter((u) => Array.isArray(u.roles) && u.roles.includes('artist'));
  const followDocs = [];
  const seenFollowKeys = new Set();
  for (const artistUser of artistUsers) {
    const potentialFollowers = users.filter(
      (user) => String(user._id) !== String(artistUser._id)
    );
    if (!potentialFollowers.length) continue;
    const desiredFollowers = randomInt(
      1,
      Math.min(4, potentialFollowers.length)
    );
    const shuffled = [...potentialFollowers].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, desiredFollowers);
    for (const follower of selected) {
      const key = `${follower._id}:${artistUser._id}`;
      if (seenFollowKeys.has(key)) continue;
      seenFollowKeys.add(key);
      followDocs.push({ follower: follower._id, artist: artistUser._id });
    }
  }
  if (followDocs.length) {
    await Follow.insertMany(followDocs);
    await Promise.all(
      artistUsers.map((artist) => User.recalculateFollowersCount(artist._id))
    );
    console.log(`[SEED] Seguimientos creados: ${followDocs.length}`);
  }

  // Showcase: crea un artista, una obra y una exposición realistas
  console.log('\n[SHOWCASE] Creando datos realistas para simular PROD...');
  const showcaseArtist = await User.create({
    name: 'María Fernández',
    email: 'maria.fernandez@example.com',
    password: 'SeedPass1',
    roles: ['artist'],
    profileImage: randomFromArray(randomImages),
    coverImage: randomFromArray(randomImages),
    bio: 'Artista contemporanea argentina enfocada en pintura y dibujo expandido. Explora el vínculo entre color, luz y materia en series donde alterna veladuras y empaste. Ha expuesto en Buenos Aires, Madrid y Ciudad de México, participando en residencias y clínicas de obra con enfoque experimental.',
    website: 'https://maria-fernandez.art',
    location: 'Buenos Aires, Argentina',
    social: { instagram: 'maria_fernandez_art' }
  });

  const awTitle = 'Horizonte en Ocre';
  const awSlug = generateSlug(awTitle);
  const awType = 'pintura';
  const awTechnique = 'Óleo sobre lienzo';
  const showcaseArtwork = await Artwork.create({
    title: awTitle,
    slug: awSlug,
    description: 'Oleo gestual de paleta calida. Veladuras y empastes construyen un horizonte vibrante que cambia con la luz. Obra original firmada con certificado y guia breve de cuidado.',
    imageUrl: randomFromArray(randomImages),
    type: awType,
    technique: awTechnique,
    type_norm: norm(awType),
    technique_norm: norm(awTechnique),
    createdBy: showcaseArtist._id,
    artist: showcaseArtist._id,
    status: 'approved',
    availability: 'for_sale',
    views: randomInt(80, 450),
    favoritesCount: randomInt(5, 24),
    completedAt: new Date(2024, 6, 15), // 15 Jul 2024
    width_cm: 120,
    height_cm: 90,
    price_cents: 320000, // 3,200 USD
    size: '120 x 90 cm'
  });

  const exTitle = 'Luz y Materia';
  const exSlug = generateSlug(exTitle);
  const coverImage = randomFromArray(randomImages);
  const images = [coverImage, randomFromArray(randomImages), randomFromArray(randomImages)].filter((v, i, a) => a.indexOf(v) === i);
  const showcaseExhibition = await Exhibition.create({
    title: exTitle,
    slug: exSlug,
    description: 'Seleccion enfocada en luz, textura y color con tres nucleos que muestran obras en capas y transparencias. Incluye visita guiada corta y folleto digital QR.',
    startDate: new Date(new Date().getFullYear(), 9, 1), // 1 Oct del año actual
    endDate: new Date(new Date().getFullYear(), 9, 15), // 15 Oct del año actual
    artworks: [showcaseArtwork._id],
    createdBy: showcaseArtist._id,
    participants: [{ user: showcaseArtist._id, role: 'artista' }],
    coverImage,
    images,
    location: { type: 'physical', address: 'Av. Callao 1234, Recoleta, CABA' },
    status: 'published'
  });

  // Vincular exposición en la obra
  await Artwork.updateOne({ _id: showcaseArtwork._id }, { $addToSet: { exhibitions: showcaseExhibition._id } });
  console.log('[SHOWCASE] Artista:', showcaseArtist.name, '\n          Slug:', showcaseArtist.slug || '(sin slug)');
  console.log('[SHOWCASE] Obra:', showcaseArtwork.title, '\n          Slug:', showcaseArtwork.slug);
  console.log('[SHOWCASE] Exposición:', showcaseExhibition.title, '\n          Slug:', showcaseExhibition.slug);
  console.log(`\nRutas útiles:
  /artists/${showcaseArtist.slug || showcaseArtist._id}
  /artworks/${showcaseArtwork.slug || showcaseArtwork._id}
  /exhibitions/${showcaseExhibition.slug || showcaseExhibition._id}\n`);

  // Crear suscripciones de prueba al newsletter
  console.log('[SEED] Creando suscripciones de newsletter...');
  const newsletterData = [
    { email: 'artlover@test.com', source: 'homepage' },
    { email: 'collector@test.com', source: 'artwork_page', preferences: { salesAlerts: true } },
    { email: 'gallery@test.com', source: 'exhibition_page' },
    { email: 'curator@test.com', source: 'homepage', preferences: { artistSpotlight: true, exhibitions: true } },
    { email: 'student@test.com', source: 'homepage', preferences: { newArtworks: true, artistSpotlight: false } }
  ];

  await Newsletter.insertMany(newsletterData);
  console.log(`✅ ${newsletterData.length} suscripciones de newsletter creadas`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
