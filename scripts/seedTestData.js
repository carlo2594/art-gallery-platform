// Script para poblar la base de datos: elimina toda la base y crea datos de prueba variados
require('module-alias/register');
require('dotenv').config();
const mongoose = require('mongoose');

const Artwork = require('../models/artworkModel');
const User = require('../models/userModel');
const Exhibition = require('../models/exhibitionModel');
const Favorite = require('../models/favoriteModel');
const ArtworkView = require('../models/artworkViewModel'); // <-- AGREGA ESTA LÃNEA
const Comment = require('../models/commentModel');
const PasswordResetToken = require('../models/passwordResetTokenModel');
const Newsletter = require('../models/newsletterModel');

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
 * Devuelve un nÃºmero entero aleatorio entre min y max (ambos incluidos).
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * FunciÃ³n para generar slug Ãºnico
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
    .replace(/-+/g, '-') // mÃºltiples guiones a uno
    .replace(/^-|-$/g, ''); // remover guiones al inicio y final
}

/**
 * Helper de normalizaciÃ³n (quita tildes, pasa a minÃºsculas, recorta)
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
const AVAILABILITY_STATUSES = ['for_sale', 'reserved', 'sold', 'not_for_sale', 'on_loan'];

/**
 * FunciÃ³n principal que conecta a la base de datos, elimina toda la base y agrega datos de prueba variados.
 */
async function seed() {
  await mongoose.connect(DB);
  
  console.log('ðŸ”„ Sincronizando Ã­ndices...');
  
  // Sincronizar Ã­ndices para evitar warnings de duplicados
  try {
    await User.syncIndexes();
    await Artwork.syncIndexes(); 
    await Exhibition.syncIndexes();
    await Favorite.syncIndexes();
    await ArtworkView.syncIndexes();
    await Comment.syncIndexes();
    await PasswordResetToken.syncIndexes();
    await Newsletter.syncIndexes();
    console.log('âœ… Ãndices sincronizados');
  } catch (error) {
    console.log('âš ï¸  Warning sincronizando Ã­ndices:', error.message);
  }

  console.log('ðŸ—‘ï¸  Limpiando datos existentes...');
  // Elimina todos los documentos de cada colecciÃ³n (incluyendo artwork views)
  await Promise.all([
    User.deleteMany({}),
    Artwork.deleteMany({}),
    Exhibition.deleteMany({}),
    Favorite.deleteMany({}),
    ArtworkView.deleteMany({}), // <-- AGREGA ESTA LÃNEA
    Comment.deleteMany({}),
    PasswordResetToken.deleteMany({}),
    Newsletter.deleteMany({})
  ]);
  console.log('âœ… Datos eliminados');


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
    bio: 'Artista contemporÃ¡neo especializado en pintura abstracta y escultura moderna. Con mÃ¡s de 15 aÃ±os de experiencia, ha expuesto en galerÃ­as de todo el mundo.',
    location: 'Barcelona, EspaÃ±a',
    website: 'https://leonardo-martinez-art.com',
    social: {
      instagram: 'leonardo_martinez_art',
      x: 'leo_martinez_art',
      facebook: 'leonardo.martinez.artist'
    },
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
  // Usar create secuencial para disparar hooks (hash de password y slug Ãºnico)
  const users = [];
  for (const data of userData) {
    // Si falta name, el hook lo igualarÃ¡ al email
    const created = await User.create(data);
    users.push(created);
  }

  // TamaÃ±os reales de canvas (en cm)
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
  const slugsUsed = new Set(); // Para asegurar slugs Ãºnicos
  
  // Encontrar a Leonardo Martinez (serÃ¡ el Ã­ndice 2 despuÃ©s de Admin y UsuarioExtra)
  const leonardoUser = users[2]; // Leonardo Martinez
  
  // Crear 20 obras especÃ­ficamente para Leonardo Martinez
  const leonardoArtworks = [
    'SinfonÃ­a Urbana', 'Reflejos del Alma', 'Danza CÃ³smica', 'Laberinto Interior',
    'Susurros de Color', 'GeometrÃ­a Emocional', 'Ritmos de la Naturaleza', 'Fragmentos de Luz',
    'Metamorfosis Azul', 'Arquitectura de SueÃ±os', 'ExplosiÃ³n Silenciosa', 'Equilibrio DinÃ¡mico',
    'Textura del Tiempo', 'Vibraciones Doradas', 'Mosaico de Sentimientos', 'Ondas Cerebrales',
    'ConstrucciÃ³n EtÃ©rea', 'Paisaje Mental', 'Forma y VacÃ­o', 'EnergÃ­a Pura'
  ];
  
  for (let i = 0; i < 20; i++) {
    const canvas = randomFromArray(canvasSizes);
    const scaleOptions = [0.8, 1, 1.2, 1.5];
    const scale = randomFromArray(scaleOptions);
    const title = leonardoArtworks[i];
    
    // Generar slug Ãºnico
    let baseSlug = generateSlug(title);
    let slug = baseSlug;
    let counter = 1;
    while (slugsUsed.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    slugsUsed.add(slug);
    
    // Genera una fecha aleatoria entre 2015 y 2024 para Leonardo (mÃ¡s reciente)
    const year = randomInt(2015, 2024);
    const month = randomInt(0, 11);
    const day = randomInt(1, 28);
    const completedAt = new Date(year, month, day);
    
    const types = ['pintura', 'escultura', 'tÃ©cnica mixta'];
    const techniques = ['Ã³leo sobre lienzo', 'acrÃ­lico sobre papel', 'bronce', 'hierro forjado', 'tÃ©cnica mixta'];
    const type = randomFromArray(types);
    const technique = randomFromArray(techniques);
    
    artworkData.push({
      title,
      slug,
      description: `Una obra magistral que explora ${title.toLowerCase()}. TÃ©cnica refinada que combina elementos abstractos con una profunda exploraciÃ³n emocional.`,
      imageUrl: randomFromArray(randomImages),
      type,
      technique,
      type_norm: norm(type),
      technique_norm: norm(technique),
      createdBy: leonardoUser._id,
      artist: leonardoUser._id,
      status: "approved",
      availability: "for_sale", // Agregar disponibilidad por defecto
      views: randomInt(50, 800), // MÃ¡s vistas para Leonardo
      completedAt,
      width_cm: Math.round(canvas.width * scale),
      height_cm: Math.round(canvas.height * scale),
      price_cents: randomInt(1500, 8000) * 100, // Precios mÃ¡s altos para Leonardo
      size: `${Math.round(canvas.width * scale)} x ${Math.round(canvas.height * scale)} cm`
    });
  }
  
  // Nombres Ãºnicos para las obras de otros artistas
  // Descriptores Ãºnicos para las obras
  const artworkDescriptors = [
    'Aurora', 'Ecos', 'Reflejo', 'Caminos', 'Fragmentos',
    'Horizonte', 'RaÃ­ces', 'Alas', 'Susurros', 'CÃ­rculo',
    'Misterio', 'Ritmo', 'JardÃ­n', 'Sombras', 'RÃ­o',
    'ConstelaciÃ³n', 'Laberinto', 'Cumbre', 'Espejismo', 'TravesÃ­a',
    'Niebla', 'Cascada', 'Paz', 'Fuego', 'Oasis',
    'Cosecha', 'Amanecer', 'Atardecer', 'Noche', 'Mar',
    'Bosque', 'Danza', 'Caminante', 'RaÃ­z', 'Puente',
    'Nevada', 'Invierno', 'Verano', 'OtoÃ±o', 'Primavera',
    'Caverna', 'Escondida', 'Lava', 'MontaÃ±a', 'Valle',
    'Isla', 'Desierto', 'Lago', 'Cueva', 'Pradera',
    'Sendero', 'Mirador', 'Colina', 'Lejana', 'Plata',
    'Dorada', 'Niebla', 'Cielo', 'Nubes', 'Estrella',
    'Luna', 'Sol', 'Viento', 'Brisa', 'Azul',
    'Escondido', 'Sombras', 'Sagrada', 'Luz', 'Rojo',
    'Esmeralda', 'SueÃ±os', 'Dorada', 'Perdido', 'Alba',
    'Verde', 'Cristal', 'Dorado', 'Plateada', 'Azul',
    'Fuego', 'Estrellas', 'Polar', 'Aurora', 'Medianoche',
    'Sur', 'OtoÃ±o', 'Niebla', 'Jade', 'Azul',
    'Luz', 'Escondida', 'Cristal', 'Dorado', 'Plata',
    'Azul', 'Luz', 'Estrellas', 'Oro', 'Plata'
  ];
  
  // Crear obras para el resto de artistas (100 obras adicionales)
  for (let i = 1; i <= 100; i++) {
    // Excluir a Leonardo Martinez (Ã­ndice 2) para que las obras se distribuyan entre otros artistas
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
    
    // Generar slug Ãºnico
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
    
    const type = ['pintura', 'escultura', 'dibujo', 'fotografÃ­a'][i % 4];
    const technique = ['Ã³leo', 'acrÃ­lico', 'metal', 'madera', 'carboncillo'][i % 5];
    
    artworkData.push({
      title,
      slug,
      description: `DescripciÃ³n de la obra \"${title}\"`,
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

  // Verificar que Leonardo tiene exactamente 20 obras
  const leonardoArtworkCount = artworks.filter(artwork => 
    artwork.artist.toString() === leonardoUser._id.toString()
  ).length;
  
  console.log(`\nðŸŽ¨ ARTISTA ESPECIAL CREADO:`);
  console.log(`ðŸ“ Nombre: ${leonardoUser.name}`);
  console.log(`ðŸ“§ Email: ${leonardoUser.email}`);
  console.log(`ðŸ–¼ï¸  Obras creadas: ${leonardoArtworkCount}`);
  console.log(`ðŸ”— Slug: leonardo-martinez`);
  console.log(`ðŸ“ UbicaciÃ³n: ${leonardoUser.location || 'Barcelona, EspaÃ±a'}`);
  console.log(`ðŸŒ Sitio web: ${leonardoUser.website || 'https://leonardo-martinez-art.com'}`);
  console.log(`ðŸ“ Bio: ${leonardoUser.bio}`);
  console.log(`\nâœ… Puedes encontrar a este artista en: /artists/leonardo-martinez\n`);

  // EstadÃ­sticas de disponibilidad
  const availabilityStats = {};
  AVAILABILITY_STATUSES.forEach(status => {
    availabilityStats[status] = artworks.filter(artwork => artwork.availability === status).length;
  });
  
  const soldArtworks = artworks.filter(artwork => artwork.availability === 'sold');
  const totalRevenue = soldArtworks.reduce((sum, artwork) => {
    return sum + (artwork.sale?.price_cents || artwork.price_cents);
  }, 0);
  
  console.log(`ðŸ“Š ESTADÃSTICAS DE DISPONIBILIDAD:`);
  console.log(`ðŸª Disponibles para venta: ${availabilityStats.for_sale}`);
  console.log(`â° Reservadas: ${availabilityStats.reserved}`);
  console.log(`ðŸ’° Vendidas: ${availabilityStats.sold}`);
  console.log(`ðŸš« No disponibles: ${availabilityStats.not_for_sale}`);
  console.log(`ðŸ¤ En prÃ©stamo: ${availabilityStats.on_loan}`);
  console.log(`ðŸ’µ Ingresos totales por ventas: $${(totalRevenue / 100).toFixed(2)} USD`);
  console.log(`\nðŸ’¡ TIP: Usa las rutas de API para gestionar disponibilidad:`);
  console.log(`   PATCH /api/v1/artworks/:id/mark-sold`);
  console.log(`   PATCH /api/v1/artworks/:id/reserve`);
  console.log(`   PATCH /api/v1/artworks/:id/unreserve\n`);

  // Crea 10 exposiciones de prueba (mitad fÃ­sicas y mitad virtuales, con status y participantes con rol)
  const exhibitionData = [];
  const participantRoles = ['artista', 'curador', 'coordinador', 'invitado'];
  for (let i = 1; i <= 10; i++) {
    // Hasta 10 artworks y 10 participantes por exposiciÃ³n
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

    // Alternar entre fÃ­sica y virtual
    let location;
    if (i % 2 === 1) {
      // FÃ­sica
      location = {
        type: 'physical',
        address: `DirecciÃ³n Ficticia ${i} Centro, Ciudad`,
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

    // Genera imÃ¡genes para la exposiciÃ³n
    const coverImage = randomFromArray(randomImages);
    // 3-6 imÃ¡genes adicionales, sin repetir coverImage
    const shuffled = randomImages.filter(img => img !== coverImage).sort(() => 0.5 - Math.random());
    const images = shuffled.slice(0, randomInt(3, 6));

    // Status alternando entre 'published', 'draft', 'archived'
    const statusOptions = ['published', 'draft', 'archived'];
    const status = statusOptions[i % statusOptions.length];

    exhibitionData.push({
      title: `ExposiciÃ³n ${i}`,
      description: `DescripciÃ³n de la exposiciÃ³n ${i}`,
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
  // Agregar slug a cada exposiciÃ³n (insertMany no dispara pre-save hooks)
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

  // Backfill: agregar referencia de exposiciÃ³n en cada obra
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

  // Crea favoritos de prueba para cada obra (entre 0-15 favoritos por obra)
  const favoriteData = [];
  const favoriteCountMap = new Map(); // Para llevar el conteo por artwork
  
  for (const artwork of artworks) {
    // Cada obra tendrÃ¡ entre 0-15 favoritos
    const numFavorites = randomInt(0, 15);
    const usersWhoFavorited = new Set();
    
    // Seleccionar usuarios Ãºnicos para esta obra
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

  // Showcase: crea un artista, una obra y una exposiciÃ³n realistas
  console.log('\n[SHOWCASE] Creando datos realistas para simular PROD...');
  const showcaseArtist = await User.create({
    name: 'MarÃ­a FernÃ¡ndez',
    email: 'maria.fernandez@example.com',
    password: '123456',
    role: 'artist',
    profileImage: randomFromArray(randomImages),
    bio: `Artista contemporÃ¡nea argentina. Su prÃ¡ctica se centra en la pintura y el dibujo expandido,
    con un fuerte Ã©nfasis en la relaciÃ³n entre color, luz y materia. Explora series de procesos largos en
    las que alterna capas de veladuras con zonas de alto empaste, permitiendo que la huella del gesto y
    el tiempo de secado de los Ã³leos dialoguen con la geometrÃ­a de la composiciÃ³n.

    EstudiÃ³ Artes Visuales en la UNA (Buenos Aires) y realizÃ³ clÃ­nicas de obra con referentes locales e
    internacionales. ParticipÃ³ en residencias en Madrid y Ciudad de MÃ©xico, y fue seleccionada en salones
    y premios de pintura. Su obra integra colecciones privadas en Argentina, EspaÃ±a y MÃ©xico.

    En los Ãºltimos aÃ±os ha desarrollado la serie â€œLuz y Materiaâ€, en la que indaga la vibraciÃ³n entre planos
    cromÃ¡ticos y el espesor del material, buscando un equilibrio entre paisaje, abstracciÃ³n y memoria.`,
    website: 'https://maria-fernandez.art',
    location: 'Buenos Aires, Argentina',
    social: { instagram: 'maria_fernandez_art' }
  });

  const awTitle = 'Horizonte en Ocre';
  const awSlug = generateSlug(awTitle);
  const awType = 'pintura';
  const awTechnique = 'Ã“leo sobre lienzo';
  const showcaseArtwork = await Artwork.create({
    title: awTitle,
    slug: awSlug,
    description: `Ã“leo sobre lienzo de trazo gestual y paleta cÃ¡lida. La superficie alterna zonas de
    veladura con sectores de alto empaste para construir un horizonte vibrante que parece avanzar y
    retroceder con la luz. La pieza forma parte de la serie â€œLuz y Materiaâ€, en la que la artista trabaja
    sobre la transiciÃ³n entre planos cromÃ¡ticos y la percepciÃ³n del relieve.

    Obra original firmada al dorso. Incluye certificado de autenticidad. Se recomienda luz indirecta y
    limpieza en seco con paÃ±o suave.`,
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
    description: `SelecciÃ³n de obras recientes que indagan en el cruce entre luz, textura y color.
    La muestra propone un recorrido en tres nÃºcleos: Materia, Horizonte y VibraciÃ³n. Cada secciÃ³n articula
    obras que dialogan por capas, donde el espesor del Ã³leo y las transparencias construyen atmÃ³sferas
    que invitan a detenerse en el detalle. La curadurÃ­a de Estudio Ox pone el foco en el proceso y en
    la relaciÃ³n entre obra y espectador, proponiendo una lectura sensible y a la vez rigurosa.

    Actividades: visita guiada con la artista, conversaciÃ³n abierta con curadurÃ­a y ediciÃ³n de un pequeÃ±o
    folleto-catÃ¡logo digital descargable mediante QR.`,
    startDate: new Date(new Date().getFullYear(), 9, 1), // 1 Oct del aÃ±o actual
    endDate: new Date(new Date().getFullYear(), 9, 15), // 15 Oct del aÃ±o actual
    artworks: [showcaseArtwork._id],
    createdBy: showcaseArtist._id,
    participants: [{ user: showcaseArtist._id, role: 'artista' }],
    coverImage,
    images,
    location: { type: 'physical', address: 'Av. Callao 1234, Recoleta, CABA' },
    status: 'published'
  });

  // Vincular exposiciÃ³n en la obra
  await Artwork.updateOne({ _id: showcaseArtwork._id }, { $addToSet: { exhibitions: showcaseExhibition._id } });
  console.log('[SHOWCASE] Artista:', showcaseArtist.name, '\n          Slug:', showcaseArtist.slug || '(sin slug)');
  console.log('[SHOWCASE] Obra:', showcaseArtwork.title, '\n          Slug:', showcaseArtwork.slug);
  console.log('[SHOWCASE] ExposiciÃ³n:', showcaseExhibition.title, '\n          Slug:', showcaseExhibition.slug);
  console.log(`\nRutas Ãºtiles:
  /artists/${showcaseArtist.slug || showcaseArtist._id}
  /artworks/${showcaseArtwork.slug || showcaseArtwork._id}
  /exhibitions/${showcaseExhibition.slug || showcaseExhibition._id}\n`);

  // Crear suscripciones de prueba al newsletter
  console.log('ðŸ“§ Creando suscripciones de newsletter...');
  const newsletterData = [
    { email: 'artlover@test.com', source: 'homepage' },
    { email: 'collector@test.com', source: 'artwork_page', preferences: { salesAlerts: true } },
    { email: 'gallery@test.com', source: 'exhibition_page' },
    { email: 'curator@test.com', source: 'homepage', preferences: { artistSpotlight: true, exhibitions: true } },
    { email: 'student@test.com', source: 'homepage', preferences: { newArtworks: true, artistSpotlight: false } }
  ];

  await Newsletter.insertMany(newsletterData);
  console.log(`âœ… ${newsletterData.length} suscripciones de newsletter creadas`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
