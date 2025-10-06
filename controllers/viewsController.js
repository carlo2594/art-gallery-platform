
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
    .select('+role') // Incluir role ya que tiene select: false
    .sort(artistSort)
    .skip(skip)
    .limit(perPage);
  
  // Filtrar solo artistas después de la consulta (por seguridad adicional)
  const filteredArtists = artists.filter(artist => artist.role === 'artist');
  
  const totalPages = Math.max(1, Math.ceil(totalArtists / perPage));
  res.status(200).render('public/artists', {
    title: 'Artistas',
    artists: filteredArtists,
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
    .select('+role') // Incluir role ya que tiene select: false
    .sort(artistSort)
    .skip(artistSkip)
    .limit(artistPerPage);
  
  // Filtrar solo artistas después de la consulta
  const filteredMatchingArtists = matchingArtists.filter(artist => artist.role === 'artist');
  const artistTotalPages = Math.max(1, Math.ceil(totalArtists / artistPerPage));

  // --- Filtros y orden para exposiciones ---
  const { buildExhibitionFilter, getExhibitionSort, getExhibitionDateBounds } = require('@utils/exhibitionSearch');
  const exhibitionFilter = buildExhibitionFilter(q, search);
  const exhibitionSort = getExhibitionSort(q.sort);
  
  // Paginación para exposiciones
  const { page: exhibitionPage, perPage: exhibitionPerPage, skip: exhibitionSkip } = getPaginationParams({
    page: q.exhibitionPage || q.page,
    perPage: q.exhibitionPerPage || 10
  }, 10, 50);

  // Bounds de fechas disponibles (basado en filtros base, sin rango aplicado)
  const baseExhFilterForBounds = buildExhibitionFilter({ type: q.type }, search);
  const exhibitionDateBounds = await getExhibitionDateBounds(Exhibition, baseExhFilterForBounds);

  const totalExhibitions = await Exhibition.countDocuments(exhibitionFilter);
  const exhibitions = await Exhibition.find(exhibitionFilter)
    .sort(exhibitionSort)
    .skip(exhibitionSkip)
    .limit(exhibitionPerPage);
  const exhibitionTotalPages = Math.max(1, Math.ceil(totalExhibitions / exhibitionPerPage));

  res.status(200).render('public/searchResults', {
    title: search ? `Buscar: ${search}` : 'Buscar',
    artworks,
    artists: filteredMatchingArtists,
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
    skip,
    exhibitionDateBounds
  });
});

// Vista de exposiciones públicas (listado con filtros y paginación)
exports.getExhibitionsView = catchAsync(async (req, res) => {
  const q = req.query;
  const search = (q.q || '').trim();

  // Utils específicos de exposiciones
  const { buildExhibitionFilter, getExhibitionSort, getExhibitionDateBounds } = require('@utils/exhibitionSearch');
  const { getPaginationParams } = require('@utils/pagination');

  // Filtro y orden
  const exhibitionFilter = buildExhibitionFilter(q, search);
  const exhibitionSort = getExhibitionSort(q.sort);

  // Paginación (usa exhibitionPage para coherencia con parciales)
  const { page: exhibitionPage, perPage: exhibitionPerPage, skip: exhibitionSkip } = getPaginationParams({
    page: q.exhibitionPage || q.page,
    perPage: q.exhibitionPerPage || 10
  }, 10, 50);

  // Bounds de fechas disponibles (basado en filtros base, sin rango aplicado)
  const baseExhFilterForBounds = buildExhibitionFilter({ type: q.type }, search);
  const exhibitionDateBounds = await getExhibitionDateBounds(Exhibition, baseExhFilterForBounds);

  // Consulta principal
  const totalExhibitions = await Exhibition.countDocuments(exhibitionFilter);
  const exhibitions = await Exhibition.find(exhibitionFilter)
    .sort(exhibitionSort)
    .skip(exhibitionSkip)
    .limit(exhibitionPerPage);
  const exhibitionTotalPages = Math.max(1, Math.ceil(totalExhibitions / exhibitionPerPage));

  res.status(200).render('public/exhibitions', {
    title: 'Exposiciones · Galería del Ox',
    exhibitions,
    totalExhibitions,
    exhibitionPage,
    exhibitionTotalPages,
    q,
    search,
    exhibitionDateBounds
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
    mode: 'signUp',
    error: req.query.error,
    success: req.query.success
  });
};


// Vista para login
exports.getLogin = (req, res) => {
  res.render('public/loginSignUp', {
    title: 'Iniciar sesión · Galería del Ox',
    hideNavbar: true,
    hideFooter: true,
    mode: 'login',
    error: req.query.error,
    success: req.query.success
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

// Vista ¿Quiénes somos?
exports.getAbout = (req, res) => {
  res.status(200).render('public/about', {
    title: '¿Quiénes somos? · Galería del Ox'
  });
};

// Vista de detalle de obra individual
exports.getArtworkDetail = catchAsync(async (req, res, next) => {
  const isValidObjectId = require('@utils/isValidObjectId');
  const AppError = require('@utils/appError');
  
  const { id } = req.params;
  let artwork;

  // Intentar buscar por slug primero, luego por ID si es un ObjectId válido
  if (isValidObjectId(id)) {
    // Si es un ObjectId válido, buscar por ID (para compatibilidad con URLs antiguas)
    artwork = await Artwork.findOne({ 
      _id: id, 
      status: 'approved', 
      deletedAt: null 
    })
    .populate({ 
      path: 'artist', 
      select: 'name email profileImage bio location website social' 
    })
    .populate({ 
      path: 'exhibitions', 
      select: 'title description startDate endDate location status'
    });
    
    // Si se encontró la obra por ID, redirigir a la URL con slug
    if (artwork && artwork.slug) {
      return res.redirect(301, `/artworks/${artwork.slug}`);
    }
  } else {
    // Buscar por slug
    artwork = await Artwork.findOne({ 
      slug: id, 
      status: 'approved', 
      deletedAt: null 
    })
    .populate({ 
      path: 'artist', 
      select: 'name email profileImage bio location website social' 
    })
    .populate({ 
      path: 'exhibitions', 
      select: 'title description startDate endDate location status'
    });
  }

  if (!artwork) {
    return next(new AppError('Obra no encontrada.', 404));
  }

  // Incrementar contador de vistas
  await Artwork.findByIdAndUpdate(artwork._id, { $inc: { views: 1 } });

  // Buscar obras relacionadas del mismo artista (excluyendo la actual)
  const relatedArtworks = await Artwork.find({
    artist: artwork.artist._id,
    _id: { $ne: artwork._id },
    status: 'approved',
    deletedAt: null
  })
  .populate({ path: 'artist', select: 'name' })
  .limit(6)
  .sort({ createdAt: -1 });

  res.status(200).render('public/artworkDetail', {
    title: `${artwork.title} · Galería del Ox`,
    artwork,
    relatedArtworks
  });
});

// Vista de detalle de artista individual
exports.getArtistDetail = catchAsync(async (req, res, next) => {
  const AppError = require('@utils/appError');
  const isValidObjectId = require('@utils/isValidObjectId');
  
  const artistId = req.params.id;
  
  // Buscar artista por ID o slug
  let artist;
  if (isValidObjectId(artistId)) {
    // Buscar por ID y redirigir al slug si existe
    artist = await User.findOne({
      _id: artistId,
      role: 'artist'
    }).select('name bio profileImage createdAt slug email location website social +role');
    
    if (artist && artist.slug) {
      return res.redirect(301, `/artists/${artist.slug}`);
    }
  } else {
    // Buscar por slug
    artist = await User.findOne({
      slug: artistId,
      role: 'artist'
    }).select('name bio profileImage createdAt slug email location website social +role');
  }

  if (!artist) {
    return next(new AppError('Artista no encontrado', 404));
  }

  // Obtener obras del artista (aprobadas y no borradas)
  const artworks = await Artwork.find({
    artist: artist._id,
    status: 'approved',
    deletedAt: null
  })
  .populate({ path: 'artist', select: 'name' })
  .sort({ createdAt: -1 });

  // Estadísticas del artista
  const stats = {
    totalArtworks: artworks.length,
    totalViews: artworks.reduce((sum, artwork) => sum + (artwork.views || 0), 0),
    avgPrice: artworks.length > 0 
      ? artworks.reduce((sum, artwork) => sum + (artwork.price_cents || 0), 0) / artworks.length / 100
      : 0,
    materials: [...new Set(artworks.map(artwork => artwork.material).filter(Boolean))],
    types: [...new Set(artworks.map(artwork => artwork.type).filter(Boolean))]
  };

  // Incrementar vistas del perfil (opcional - si tienes el campo en el modelo)
  // await User.findByIdAndUpdate(artist._id, { $inc: { profileViews: 1 } });

  res.status(200).render('public/artistDetail', {
    title: `${artist.name} · Galería del Ox`,
    artist,
    artworks,
    stats
  });
});

