
const catchAsync = require('@utils/catchAsync');
const Artwork = require('@models/artworkModel');
const User = require('@models/userModel');
const Exhibition = require('@models/exhibitionModel');

// /search?q=texto y filtros
const { buildArtworkFilter, getArtworkSort } = require('@utils/artworkSearch');
exports.getSearchResults = catchAsync(async (req, res) => {
  // --- INICIO DEBUG ---
  const q = req.query;
  const search = (q.q || '').trim();
  const debugLog = (...args) => { try { console.log(...args); } catch(e){} };
  debugLog('--- [getSearchResults] INICIO ---');
  debugLog('QUERY RECIBIDA:', q);

  // 1. Construcción de filtro y sort
  const artworkFilter = buildArtworkFilter(q);
  const sort = getArtworkSort(q.sort);
  debugLog('Filtro generado para obras:', artworkFilter);
  debugLog('Sort generado para obras:', sort);

  // 2. Consulta a la base de datos
  debugLog('Consultando base de datos...');
  const [
    totalArtworks,
    artworks,
    materialsAgg,
    boundsAgg
  ] = await Promise.all([
    Artwork.countDocuments(artworkFilter),
    Artwork.find(artworkFilter).populate({ path: 'artist', select: 'name' }).sort(sort).limit(20),
    Artwork.aggregate([
      { $match: { status: 'approved', deletedAt: null } },
      { $group: { _id: '$material', material: { $first: '$material' } } },
      { $project: { _id: 0, material: 1 } },
      { $sort: { material: 1 } }
    ]),
    Artwork.aggregate([
      { $match: { status: 'approved', deletedAt: null } },
      { $group: { _id: null, minPriceCents: { $min: '$price_cents' }, maxPriceCents: { $max: '$price_cents' } } },
      { $project: { _id: 0, minPriceCents: 1, maxPriceCents: 1 } }
    ])
  ]);
  debugLog('Total de obras encontradas:', totalArtworks);
  debugLog('Primeras obras devueltas:', artworks && artworks.length ? artworks.map(a => ({ id: a._id, title: a.title, price_cents: a.price_cents, views: a.views, createdAt: a.createdAt })) : artworks);
  debugLog('Materiales únicos:', materialsAgg);
  debugLog('Bounds de precio:', boundsAgg);

  const materials = materialsAgg.map(m => m.material).filter(Boolean);
  const bounds = boundsAgg[0] || { minPriceCents: null, maxPriceCents: null };

  // 3. Calcular rango aplicado
  const toNumber = v => (v == null || v === '') ? null : Number(v);
  let minCents = toNumber(q.minPrice) != null ? Math.round(Number(q.minPrice) * 100) : null;
  let maxCents = toNumber(q.maxPrice) != null ? Math.round(Number(q.maxPrice) * 100) : null;
  if (minCents === null && bounds.minPriceCents != null) minCents = bounds.minPriceCents;
  if (maxCents === null && bounds.maxPriceCents != null) maxCents = bounds.maxPriceCents;
  if (minCents != null && maxCents != null && minCents > maxCents) [minCents, maxCents] = [maxCents, minCents];
  const priceBounds = {
    minUSD: bounds.minPriceCents != null ? bounds.minPriceCents / 100 : null,
    maxUSD: bounds.maxPriceCents != null ? bounds.maxPriceCents / 100 : null,
    minCents: bounds.minPriceCents,
    maxCents: bounds.maxPriceCents
  };
  const appliedPrice = {
    minUSD: minCents != null ? minCents / 100 : null,
    maxUSD: maxCents != null ? maxCents / 100 : null
  };
  debugLog('Rango de precio aplicado:', appliedPrice);

  // 4. Buscar artistas cuyo nombre coincida
  const artistFilter = search ? { name: { $regex: search, $options: 'i' } } : {};
  debugLog('Filtro para artistas:', artistFilter);
  const matchingArtists = search ? await User.find(artistFilter) : [];
  debugLog('Artistas encontrados:', matchingArtists && matchingArtists.length ? matchingArtists.map(a => a.name) : matchingArtists);

  // 5. Buscar exposiciones cuyo título coincida
  const exhibitionFilter = search ? { title: { $regex: search, $options: 'i' } } : {};
  debugLog('Filtro para exposiciones:', exhibitionFilter);
  const exhibitions = search ? await Exhibition.find(exhibitionFilter) : [];
  debugLog('Exposiciones encontradas:', exhibitions && exhibitions.length ? exhibitions.map(e => e.title) : exhibitions);

  // 6. Renderizar vista
  debugLog('Renderizando vista searchResults con', {
    artworks: artworks && artworks.length,
    artists: matchingArtists && matchingArtists.length,
    exhibitions: exhibitions && exhibitions.length,
    totalArtworks,
    search,
    q,
    priceBounds,
    appliedPrice,
    materials: materials && materials.length
  });
  debugLog('--- [getSearchResults] FIN ---');

  res.status(200).render('public/searchResults', {
    title: search ? `Buscar: ${search}` : 'Buscar',
    artworks,
    artists: matchingArtists,
    exhibitions,
    totalArtworks,
    search,
    q,
    priceBounds,
    appliedPrice,
    materials
  });
});

// Página de inicio
exports.getHome = catchAsync(async (req, res) => {
  const artworks = await Artwork
    .find({ deletedAt: null })
    .sort({ views: -1 })
    .limit(20)
    .populate({ path: 'artist', select: 'name' });

  res.status(200).render('public/home', {
    title: 'Inicio · Galería del Ox',
    artworks
  });
});



// Vista para reset password
exports.getResetPassword = (req, res) => {
  const { uid, token, type } = req.query;
  res.render('public/resetPassword', {
    uid,
    token,
    isNewPassword: type === 'new'
  });
};

// Vista para sign in

exports.getSignUp = (req, res) => {
  res.render('public/loginSignUp', {
    title: 'Registrarse · Galería del Ox',
    hideNavbar: true,
    hideFooter: true,
    mode: 'signUp'
  });
};


// Vista para login
exports.getLogin = (req, res) => {
  res.render('public/loginSignUp', {
    title: 'Iniciar sesión · Galería del Ox',
    hideNavbar: true,
    hideFooter: true,
    mode: 'login'
  });
};


// Vista de bienvenida (primera vez)
exports.getWelcome = (req, res) => {
  res.status(200).render('public/welcome', {
    title: 'Bienvenido · Galería del Ox',
  });
};




// controllers/viewsController.js
exports.getArtworks = catchAsync(async (req, res) => {
  const { normArr } = require('@utils/normalizer');
  const { readMinCentsFromQuery, readMaxCentsFromQuery } = require('@utils/priceQuery');
  const { canonicalizeQuery } = require('@utils/queryCanonicalizer');
  const { inArr } = require('@utils/arrayUtils');
  const { toNumber } = require('@utils/numberUtils');
  const { getSort } = require('@utils/sortUtils');
  const { swapIfGreater } = require('@utils/boundsUtils');

  const q = req.query;
  const filter = {};

  // Facetas básicas (normalizadas)
  const typesN = normArr(q.type);
  const matsN  = normArr(q.material);
  if (typesN.length) filter.type_norm     = { $in: typesN };
  if (matsN.length)  filter.material_norm = { $in: matsN };

  // Rango de tamaño (cm)
  const minw = toNumber(q.minw), maxw = toNumber(q.maxw), minh = toNumber(q.minh), maxh = toNumber(q.maxh);
  if (minw || maxw) filter.width_cm  = { ...(minw?{$gte:minw}:{}), ...(maxw?{$lte:maxw}:{}) };
  if (minh || maxh) filter.height_cm = { ...(minh?{$gte:minh}:{}), ...(maxh?{$lte:maxh}:{}) };

  // Orientación
  const orientations = inArr(q.orientation);
  if (orientations.length) {
    const ors = [];
    if (orientations.includes('horizontal')) ors.push({ $expr: { $gt: ['$width_cm', '$height_cm'] } });
    if (orientations.includes('vertical'))   ors.push({ $expr: { $gt: ['$height_cm', '$width_cm'] } });
    if (orientations.includes('cuadrado'))   ors.push({ $expr: { $eq: ['$width_cm', '$height_cm'] } });
    if (ors.length) filter.$or = ors;
  }

  // Base: aprobadas y no borradas
  const baseMatch = { status: 'approved', deletedAt: null, ...filter };

  // 1) Bounds (min/max) desde BD sin rango aplicado
  const boundsAgg = await Artwork.aggregate([
    { $match: baseMatch },
    { $group: { _id: null, minPriceCents: { $min: '$price_cents' }, maxPriceCents: { $max: '$price_cents' } } },
    { $project: { _id: 0, minPriceCents: 1, maxPriceCents: 1 } }
  ]);
  const bounds = boundsAgg[0] || { minPriceCents: null, maxPriceCents: null };

  // 2) Obtener materiales únicos desde la base de datos (solo aprobados y no borrados)
  const materialsAgg = await Artwork.aggregate([
    { $match: { status: 'approved', deletedAt: null } },
    { $group: { _id: '$material', material: { $first: '$material' } } },
    { $project: { _id: 0, material: 1 } },
    { $sort: { material: 1 } }
  ]);
  const materials = materialsAgg.map(m => m.material).filter(Boolean);

  let minCents = readMinCentsFromQuery(q);
  let maxCents = readMaxCentsFromQuery(q);

  if (minCents === null && bounds.minPriceCents != null) minCents = bounds.minPriceCents;
  if (maxCents === null && bounds.maxPriceCents != null) maxCents = bounds.maxPriceCents;

  [minCents, maxCents] = swapIfGreater(minCents, maxCents);

  if (minCents != null || maxCents != null) {
    const pf = {};
    if (minCents != null) pf.$gte = minCents;
    if (maxCents != null) pf.$lte = maxCents;
    filter.price_cents = pf;
  }

  // 3) Ordenación
  const sort = getSort(q.sort);

  // 4) Consulta final
  const artworks = await Artwork
    .findApproved(filter)
    .sort(sort)
    .populate({ path: 'artist', select: 'name' });

  // Para la vista
  const priceBounds = {
    minUSD: bounds.minPriceCents != null ? bounds.minPriceCents / 100 : null,
    maxUSD: bounds.maxPriceCents != null ? bounds.maxPriceCents / 100 : null,
    minCents: bounds.minPriceCents,
    maxCents: bounds.maxPriceCents
  };
  const appliedPrice = {
    minUSD: minCents != null ? minCents / 100 : null,
    maxUSD: maxCents != null ? maxCents / 100 : null
  };

  // ⬇️ Canonicalización de la query (opcional pero recomendado)
  // Construye una query sin vacíos ni defaults y redirige si difiere de la original.
  const redirectUrl = canonicalizeQuery(req, appliedPrice, priceBounds);
  if (redirectUrl) {
    return res.redirect(302, redirectUrl);
  }

  // Render si ya es canónica
  res.status(200).render('public/artworks', {
    title: 'Obras',
    artworks,
    q,
    priceBounds,   // rango total desde BD
    appliedPrice,  // rango aplicado (query o defaults)
    materials      // materiales únicos para filtros
  });
});

