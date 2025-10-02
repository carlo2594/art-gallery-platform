
const catchAsync = require('@utils/catchAsync');
const Artwork = require('@models/artworkModel');
const User = require('@models/userModel');
const Exhibition = require('@models/exhibitionModel');

// Vista de todos los artistas
exports.getArtistsView = catchAsync(async (req, res) => {
  const q = req.query;
  const search = (q.q || '').trim();
  const { buildArtistFilter } = require('@utils/artistSearch');
  const { getSort } = require('@utils/sortUtils');
  // Normaliza el sort para artistas
  let artistSortParam = q.sort;
  if (!artistSortParam || (artistSortParam !== 'name_asc' && artistSortParam !== 'name_desc' && artistSortParam !== 'recent' && artistSortParam !== 'oldest')) {
    artistSortParam = 'name_asc';
  }
  const artistSort = getSort(artistSortParam, 'artist');
  const artistFilter = buildArtistFilter(q, search);
  // Paginación: usa artistPage para SSR paginator
  const artistPage = Number(req.query.artistPage) || 1;
  const perPage = 15;
  const skip = (artistPage - 1) * perPage;
  const totalArtists = await User.countDocuments(artistFilter);
  const artists = await User.find(artistFilter)
    .sort(artistSort)
    .skip(skip)
    .limit(perPage);
  const totalPages = Math.max(1, Math.ceil(totalArtists / perPage));
  res.status(200).render('public/artists', {
    title: 'Artistas',
    artists,
    totalArtists,
    page: artistPage,
    perPage,
    totalPages,
    q
  });
});


// /search?q=texto y filtros
const { buildArtworkFilter, getArtworkSort } = require('@utils/artworkSearch');
const { getPaginationParams } = require('@utils/pagination');
const { getPriceRanges } = require('@utils/priceUtils');

exports.getSearchResults = catchAsync(async (req, res) => {
  const q = req.query;
  const search = (q.q || '').trim();

  // 1. Construcción de filtro y sort
  const artworkFilter = buildArtworkFilter(q);
  const sort = getArtworkSort(q.sort);

  // --- PAGINATION LOGIC ---
  const { page, perPage, skip } = getPaginationParams(req.query, 15, 100);

  // Consultas paralelas (sin ratings)
  const [
    totalArtworks,
    artworks,
    materialsAgg,
    boundsAgg
  ] = await Promise.all([
    Artwork.countDocuments(artworkFilter),
    Artwork.find(artworkFilter)
      .populate({ path: 'artist', select: 'name' })
      .sort(sort)
      .skip(skip)
      .limit(perPage),
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

  const totalPages = Math.max(1, Math.ceil(totalArtworks / perPage));
  const materials = materialsAgg.map(m => m.material).filter(Boolean);
  const bounds = boundsAgg[0] || { minPriceCents: null, maxPriceCents: null };
  const { appliedPrice, priceBounds } = getPriceRanges(q, bounds);

  // --- ARTISTAS: Filtros, paginación y orden ---
  const { buildArtistFilter } = require('@utils/artistSearch');
  const { getSort } = require('@utils/sortUtils');
  const artistFilter = buildArtistFilter(q, search);
  // Normaliza el sort para artistas (evita errores por casing o valores vacíos)
  let artistSortParam = q.sort;
  if (!artistSortParam || (artistSortParam !== 'name_asc' && artistSortParam !== 'name_desc' && artistSortParam !== 'recent' && artistSortParam !== 'oldest')) {
    artistSortParam = 'name_asc';
  }
  const artistSort = getSort(artistSortParam, 'artist');

  // Paginación
  const { page: artistPage, perPage: artistPerPage, skip: artistSkip } = getPaginationParams({
    page: q.artistPage || q.page,
    perPage: q.artistPerPage || 15
  }, 15, 100);

  const totalArtists = await User.countDocuments(artistFilter);
  const matchingArtists = await User.find(artistFilter)
    .sort(artistSort)
    .skip(artistSkip)
    .limit(artistPerPage);
  const artistTotalPages = Math.max(1, Math.ceil(totalArtists / artistPerPage));

  // --- Filtros y orden para exposiciones ---
  const exhibitionFilter = {};
  if (search) {
    exhibitionFilter.title = { $regex: search, $options: 'i' };
  }
  if (q.type) {
    // Permitir multi-tipo (array) o string
    const types = Array.isArray(q.type) ? q.type : [q.type];
    exhibitionFilter['location.type'] = { $in: types };
  }
  // Filtro por año de inicio (startDate)
  if (q.minYear || q.maxYear) {
    exhibitionFilter.startDate = {};
    if (q.minYear) exhibitionFilter.startDate.$gte = new Date(Number(q.minYear), 0, 1);
    if (q.maxYear) exhibitionFilter.startDate.$lte = new Date(Number(q.maxYear), 11, 31, 23, 59, 59, 999);
  }
  // Ordenamiento
  let exhibitionSort = {};
  if (q.sort === 'recent') exhibitionSort = { startDate: -1 };
  else if (q.sort === 'oldest') exhibitionSort = { startDate: 1 };
  else exhibitionSort = { _id: -1 };
  
  // Paginación para exposiciones
  const { page: exhibitionPage, perPage: exhibitionPerPage, skip: exhibitionSkip } = getPaginationParams({
    page: q.exhibitionPage || q.page,
    perPage: q.exhibitionPerPage || 10
  }, 10, 50);

  const totalExhibitions = await Exhibition.countDocuments(exhibitionFilter);
  const exhibitions = await Exhibition.find(exhibitionFilter)
    .sort(exhibitionSort)
    .skip(exhibitionSkip)
    .limit(exhibitionPerPage);
  const exhibitionTotalPages = Math.max(1, Math.ceil(totalExhibitions / exhibitionPerPage));

  res.status(200).render('public/searchResults', {
    title: search ? `Buscar: ${search}` : 'Buscar',
    artworks,
    artists: matchingArtists,
    exhibitions,
    totalArtworks,
    totalArtists,
    totalExhibitions,
    artistPage,
    exhibitionPage,
    exhibitionTotalPages,
    artistTotalPages,
    search,
    q,
    priceBounds,
    appliedPrice,
    materials,
    page,
    perPage,
    totalPages,
    skip
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

  // --- PAGINATION LOGIC ---
  const DEFAULT_PER_PAGE = 24;
  const MAX_PER_PAGE = 100;
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = Math.max(1, Math.min(DEFAULT_PER_PAGE, parseInt(req.query.perPage || DEFAULT_PER_PAGE, 10)));
  const skip = (page - 1) * perPage;

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
    if (orientations.includes('cuadrado'))   ors.push({ $eq: ['$width_cm', '$height_cm'] });
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

  // 4) Consulta final: paginada
  const [totalArtworks, artworks] = await Promise.all([
    Artwork.countDocuments({ status: 'approved', deletedAt: null, ...filter }),
    Artwork.findApproved(filter)
      .sort(sort)
      .skip(skip)
      .limit(perPage)
      .populate({ path: 'artist', select: 'name' })
  ]);

  const totalPages = Math.max(1, Math.ceil(totalArtworks / perPage));

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
    materials,     // materiales únicos para filtros
    page,
    perPage,
    totalPages,
    skip,
    totalArtworks
  });
});

