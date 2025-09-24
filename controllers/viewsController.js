
const catchAsync = require('@utils/catchAsync');
const Artwork = require('@models/artworkModel');
const User = require('@models/userModel');
const Exhibition = require('@models/exhibitionModel');

// /search?q=texto
exports.getSearchResults = catchAsync(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(200).render('public/searchResults', {
      title: 'Buscar',
      artworks: [],
      artists: [],
      exhibitions: [],
      search: q
    });
  }

  // Buscar obras por título (y artista/expo por nombre)
  const artworkFilter = {
    status: 'approved',
    deletedAt: null,
    $or: [
      { title: { $regex: q, $options: 'i' } },
    ]
  };

  // Buscar artistas cuyo nombre coincida
  const artistFilter = { name: { $regex: q, $options: 'i' } };

  // Buscar exposiciones cuyo título coincida
  const exhibitionFilter = { title: { $regex: q, $options: 'i' } };

  // Buscar obras y poblar artista
  let artworks = await Artwork.find(artworkFilter).populate({ path: 'artist', select: 'name' });

  // Si quieres buscar también por nombre de artista:
  const matchingArtists = await User.find(artistFilter);
  if (matchingArtists.length) {
    const artistIds = matchingArtists.map(a => a._id);
    const byArtist = await Artwork.find({ status: 'approved', deletedAt: null, artist: { $in: artistIds } }).populate({ path: 'artist', select: 'name' });
    // Unir sin duplicados
    const ids = new Set(artworks.map(a => a._id.toString()));
    byArtist.forEach(a => { if (!ids.has(a._id.toString())) artworks.push(a); });
  }

  // Buscar exposiciones
  const exhibitions = await Exhibition.find(exhibitionFilter);

  res.status(200).render('public/searchResults', {
    title: `Buscar: ${q}`,
    artworks,
    artists: matchingArtists,
    exhibitions,
    search: q
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

