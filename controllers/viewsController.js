// Vista de contacto (inglés)
exports.getContact = (req, res) => {
  res.status(200).render('public/static/contact', {
    title: 'Contact · Galería del Ox'
  });
};

const catchAsync = require('@utils/catchAsync');
const crypto = require('crypto');
const PasswordResetToken = require('@models/passwordResetTokenModel');
const Artwork = require('@models/artworkModel');
const User = require('@models/userModel');
const Exhibition = require('@models/exhibitionModel');
const Favorite = require('@models/favoriteModel');
const ArtistApplication = require('@models/artistApplicationModel');

// Utilities optimizadas
const { viewsCache } = require('@utils/cache');
const { getAllTechniques, getGlobalPriceBounds, getArtistTechniques, getArtistPriceBounds } = require('@utils/aggregationHelpers');
const { findArtistByIdOrSlug, getRelatedArtworks, buildArtistStats } = require('@utils/artistHelpers');
const { findArtworkByIdOrSlug, getPopularArtworks } = require('@utils/artworkHelpers');

// Vista de todos los artistas
exports.getArtistsView = catchAsync(async (req, res) => {
  const q = req.query;
  const search = (q.q || '').trim();
  const { getSort } = require('@utils/sortUtils');
  const { getArtistsWithArtworksAndCount } = require('@utils/artistsWithArtworks');
  
  // Normaliza el sort para artistas
  let artistSortParam = q.sort;
  if (!artistSortParam || (artistSortParam !== 'name_asc' && artistSortParam !== 'name_desc' && artistSortParam !== 'recent' && artistSortParam !== 'oldest')) {
    artistSortParam = 'name_asc';
  }
  const artistSort = getSort(artistSortParam, 'artist');
  
  // Paginación: usa artistPage para SSR paginator
  const artistPage = Number(req.query.artistPage) || 1;
  const perPage = 15;
  const skip = (artistPage - 1) * perPage;

  // Usar utility para obtener artistas con obras aprobadas
  const { artists, total: totalArtists } = await getArtistsWithArtworksAndCount(
    User, 
    search, 
    artistSort, 
    skip, 
    perPage
  );
  
  const totalPages = Math.max(1, Math.ceil(totalArtists / perPage));
  
  res.status(200).render('public/artists/index', {
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
    artworksRaw,
    techniquesAgg,
    boundsAgg
  ] = await Promise.all([
    Artwork.countDocuments(artworkFilter),
    Artwork.find(artworkFilter)
      .select('title slug imageUrl imagePublicId imageWidth_px imageHeight_px technique width_cm height_cm artist price_cents')
      .populate({ path: 'artist', select: 'name' })
      .sort(sort)
      .skip(skip)
      .limit(perPage)
      .lean(),
    Artwork.aggregate([
      { $match: { status: 'approved', deletedAt: null, availability: { $in: ['for_sale', 'reserved'] } } },
      { $group: { _id: '$technique', technique: { $first: '$technique' } } },
      { $project: { _id: 0, technique: 1 } },
      { $sort: { technique: 1 } }
    ]).hint({ status: 1, deletedAt: 1, technique: 1 }),
    Artwork.aggregate([
      { $match: { status: 'approved', deletedAt: null, availability: { $in: ['for_sale', 'reserved'] } } },
      { $group: { _id: null, minPriceCents: { $min: '$price_cents' }, maxPriceCents: { $max: '$price_cents' } } },
      { $project: { _id: 0, minPriceCents: 1, maxPriceCents: 1 } }
    ]).hint({ status: 1, deletedAt: 1, createdAt: -1 })
  ]);

  // Construir media para artworks en resultados de búsqueda
  const { buildPublicSrcSet } = require('@utils/media');
  const artworks = artworksRaw.map(a => {
    try {
      if (a.imagePublicId) {
        a._media = buildPublicSrcSet(a.imagePublicId, {
          widths: [400,800,1200],
          sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw',
          type: 'upload'
        });
      } else if (a.imageUrl) {
        a._media = buildPublicSrcSet(a.imageUrl, {
          widths: [400,800,1200],
          sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw',
          type: 'fetch'
        });
      }
    } catch (_) {}
    return a;
  });

  const totalPages = Math.max(1, Math.ceil(totalArtworks / perPage));
  const techniques = techniquesAgg.map(m => m.technique).filter(Boolean);
  const bounds = boundsAgg[0] || { minPriceCents: null, maxPriceCents: null };
  const { appliedPrice, priceBounds } = getPriceRanges(q, bounds);

  // --- ARTISTAS: Filtros, paginación y orden ---
  const { getSort } = require('@utils/sortUtils');
  const { getArtistsWithArtworksAndCount } = require('@utils/artistsWithArtworks');
  
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

  // Usar utility para obtener artistas con obras aprobadas
  const { artists: matchingArtists, total: totalArtists } = await getArtistsWithArtworksAndCount(
    User, 
    search, 
    artistSort, 
    artistSkip, 
    artistPerPage
  );

  const artistTotalPages = Math.max(1, Math.ceil(totalArtists / artistPerPage));

  // --- Filtros y orden para exposiciones ---
  const { buildExhibitionFilter, getExhibitionSort, getExhibitionDateBounds } = require('@utils/exhibitionSearch');
  const exhibitionFilter = buildExhibitionFilter(q, search);
  // Solo exposiciones publicadas y no eliminadas en resultados de búsqueda
  exhibitionFilter.status = 'published';
  exhibitionFilter.deletedAt = null;
  const exhibitionSort = getExhibitionSort(q.sort);
  
  // Paginación para exposiciones
  const { page: exhibitionPage, perPage: exhibitionPerPage, skip: exhibitionSkip } = getPaginationParams({
    page: q.exhibitionPage || q.page,
    perPage: q.exhibitionPerPage || 10
  }, 10, 50);

  // Bounds de fechas disponibles (basado en filtros base, sin rango aplicado)
  const baseExhFilterForBounds = buildExhibitionFilter({ ex_type: q.ex_type || q.type }, search);
  baseExhFilterForBounds.status = 'published';
  baseExhFilterForBounds.deletedAt = null;
  const exhibitionDateBounds = await getExhibitionDateBounds(Exhibition, baseExhFilterForBounds);

  const totalExhibitions = await Exhibition.countDocuments(exhibitionFilter);
  const exhibitions = await Exhibition.find(exhibitionFilter)
    .sort(exhibitionSort)
    .skip(exhibitionSkip)
    .limit(exhibitionPerPage);
  const exhibitionTotalPages = Math.max(1, Math.ceil(totalExhibitions / exhibitionPerPage));

  res.status(200).render('public/search/index', {
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
    techniques,
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

  // Filtro y orden (solo publicadas)
  const exhibitionFilter = buildExhibitionFilter(q, search);
  exhibitionFilter.status = 'published';
  exhibitionFilter.deletedAt = null;
  const exhibitionSort = getExhibitionSort(q.sort);

  // Paginación (usa exhibitionPage para coherencia con parciales)
  const { page: exhibitionPage, perPage: exhibitionPerPage, skip: exhibitionSkip } = getPaginationParams({
    page: q.exhibitionPage || q.page,
    perPage: q.exhibitionPerPage || 10
  }, 10, 50);

  // Bounds de fechas disponibles (basado en filtros base, sin rango aplicado)
  const baseExhFilterForBounds = buildExhibitionFilter({ type: q.type }, search);
  baseExhFilterForBounds.status = 'published';
  baseExhFilterForBounds.deletedAt = null;
  const exhibitionDateBounds = await getExhibitionDateBounds(Exhibition, baseExhFilterForBounds);

  // Consulta principal
  const totalExhibitions = await Exhibition.countDocuments(exhibitionFilter);
  const exhibitions = await Exhibition.find(exhibitionFilter)
    .sort(exhibitionSort)
    .skip(exhibitionSkip)
    .limit(exhibitionPerPage);
  const exhibitionTotalPages = Math.max(1, Math.ceil(totalExhibitions / exhibitionPerPage));

  res.status(200).render('public/exhibitions/index', {
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
  // Intentar mostrar obras de la exposición más reciente publicada
  // y listar las 3 exposiciones más recientes en la home
  let artworks = [];
  let latestExhibition = null;
  let latestExhibitions = [];

  try {
    latestExhibition = await viewsCache.getOrCompute('home-latest-exhibition', async () => {
      return Exhibition.findOne({ status: 'published', deletedAt: null })
        .sort({ startDate: -1, endDate: -1, createdAt: -1 })
        .select('title slug startDate endDate coverImage')
        .lean();
    }, 60 * 1000);

    if (latestExhibition) {
      artworks = await Artwork.find({
        exhibitions: latestExhibition._id,
        status: 'approved',
        deletedAt: null
      })
        .select('title slug imageUrl imagePublicId imageWidth_px imageHeight_px technique width_cm height_cm artist price_cents')
        .sort({ createdAt: -1 })
        .limit(18)
        .populate({ path: 'artist', select: 'name' })
        .lean();
      const { buildPublicSrcSet } = require('@utils/media');
      artworks = artworks.map(a => {
        try {
          if (a.imagePublicId) {
            a._media = buildPublicSrcSet(a.imagePublicId, { widths: [400,800,1200], sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw', type: 'upload' });
          } else if (a.imageUrl) {
            a._media = buildPublicSrcSet(a.imageUrl, { widths: [400,800,1200], sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw', type: 'fetch' });
          }
        } catch(_) {}
        return a;
      });
    }
    // También: obtener las 3 exposiciones más recientes publicadas
    latestExhibitions = await viewsCache.getOrCompute('home-latest-exhibitions-3', async () => {
      return Exhibition.find({ status: 'published', deletedAt: null })
        .sort({ startDate: -1, endDate: -1, createdAt: -1 })
        .limit(3)
        .select('title slug description location startDate endDate coverImage')
        .lean();
    }, 60 * 1000);
  } catch (e) {
    // fallback silencioso a recientes
  }

  if (!artworks || artworks.length === 0) {
    const { getRecentArtworks } = require('@utils/artworkHelpers');
    artworks = await getRecentArtworks(Artwork, 18);
  }

  res.status(200).render('public/home/index', {
    title: 'Inicio · Galería del Ox',
    artworks,
    latestExhibition,
    latestExhibitions
  });
});



// Vista: Editar cuenta (perfil del usuario)
exports.getMyAccount = (req, res) => {
  return res.status(200).render('public/account/index', {
    title: 'Editar cuenta'
  });
};

// -------------------- Home Personalizada --------------------
exports.getPersonalHome = catchAsync(async (req, res) => {
  const now = new Date();

  // Cargar datasets en paralelo
  let [recentWorks, popularWorks, upcomingExhibitions, featuredArtists] = await Promise.all([
    (async () => {
      const { getRecentArtworks } = require('@utils/artworkHelpers');
      const list = await getRecentArtworks(Artwork, 12);
      return list || [];
    })(),
    (async () => {
      const { getPopularArtworks } = require('@utils/artworkHelpers');
      const list = await getPopularArtworks(Artwork, 12);
      return list || [];
    })(),
    (async () => {
      try {
        return await Exhibition.find({ status: 'published', deletedAt: null, startDate: { $gte: now } })
          .select('title slug description startDate endDate coverImage location participants')
          .populate({ path: 'participants.user', select: 'name slug' })
          .sort({ startDate: 1 })
          .limit(6)
          .lean();
      } catch (_) {
        return [];
      }
    })(),
    (async () => {
      try {
        return await User.find({ role: 'artist', active: { $ne: false } })
          .select('name slug profileImage followersCount')
          .sort({ followersCount: -1, createdAt: -1 })
          .limit(8)
          .lean();
      } catch (_) {
        return [];
      }
    })()
  ]);

  // Fallback: si no hay próximas exposiciones, mostrar las más recientes publicadas
  try {
    if (!upcomingExhibitions || upcomingExhibitions.length === 0) {
      upcomingExhibitions = await Exhibition.find({ status: 'published', deletedAt: null })
        .select('title slug description startDate endDate coverImage location participants')
        .populate({ path: 'participants.user', select: 'name slug' })
        .sort({ startDate: -1 })
        .limit(3)
        .lean();
    }
  } catch (_) {}

  res.status(200).render('personal/home', {
    title: 'Tu inicio · Galería del Ox',
    recentWorks,
    popularWorks,
    upcomingExhibitions,
    featuredArtists
  });
});

// Vista para reset password (prevalida el enlace)
exports.getResetPassword = catchAsync(async (req, res) => {
  const { uid, token, type } = req.query;

  // Si faltan datos mínimos, muestra la página con error genérico
  if (!uid || !token) {
    return res.render('public/auth/resetPassword', {
      uid,
      token,
      isNewPassword: type === 'new',
      error: 'El enlace no es válido o ya venció. Solicita uno nuevo.',
      hideNavbar: true,
      hideFooter: true
    });
  }

  // Validar token (no usado y no expirado)
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const resetToken = await PasswordResetToken.findOne({
    userId: uid,
    tokenHash,
    expiresAt: { $gt: Date.now() },
    used: false
  });

  if (!resetToken) {
    // Redirige a página dedicada para enlace inválido/expirado/ya usado
    return res.redirect(303, '/reset-link-invalid');
  }

  return res.render('public/auth/resetPassword', {
    uid,
    token,
    isNewPassword: type === 'new',
    hideNavbar: true,
    hideFooter: true
  });
});

// Página dedicada: enlace de restablecimiento inválido/expirado/ya usado
exports.getResetLinkInvalid = (req, res) => {
  res.status(410).render('public/auth/resetLinkInvalid', {
    title: 'Enlace no válido · Galería del Ox'
  });
};

// Vista para sign in

exports.getSignUp = (req, res) => {
  res.render('public/auth/loginSignUp', {
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
  res.render('public/auth/loginSignUp', {
    title: 'Iniciar sesión · Galería del Ox',
    hideNavbar: true,
    hideFooter: true,
    mode: 'login',
    error: req.query.error,
    success: req.query.success
  });
};

// Vista para "Olvidé mi contraseña"
exports.getForgotPassword = (req, res) => {
  res.render('public/auth/forgotPassword', {
    title: 'Recuperar contraseña · Galería del Ox',
    hideNavbar: true,
    hideFooter: true,
    error: req.query.error,
    success: req.query.success
  });
};


// Vista de bienvenida (primera vez)
exports.getWelcome = (req, res) => {
  res.status(200).render('public/auth/welcome', {
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
  const perPage = Math.max(1, Math.min(MAX_PER_PAGE, parseInt(req.query.perPage || DEFAULT_PER_PAGE, 10)));
  const skip = (page - 1) * perPage;

  const q = req.query;
  const filter = {};

  // Availability filter (no default: show all unless user selects)
  (function applyAvailability() {
    const raw = (q.avail ?? '').toString().toLowerCase();
    let mode = '';
    if (raw.includes('unavailable')) mode = 'unavailable';
    else if (raw.includes('available')) mode = 'available';
    if (mode === 'unavailable') {
      // No en venta: incluye reservadas, vendidas, en préstamo o no a la venta
      filter.availability = { $in: ['reserved', 'sold', 'not_for_sale', 'on_loan'] };
    } else if (mode === 'available') {
      // En venta (no incluye reservadas)
      filter.availability = { $in: ['for_sale'] };
    }
  })();

  // Facetas básicas (normalizadas)
  const typesN = normArr(q.type);
  const techsN  = normArr(q.technique);
  if (typesN.length) filter.type_norm      = { $in: typesN };
  if (techsN.length) filter.technique_norm = { $in: techsN };

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

  // Base: aprobadas y no borradas (sin imponer disponibilidad por defecto)
  const baseMatch = { 
    status: 'approved', 
    deletedAt: null, 
    ...filter 
  };

  // 1) Bounds (min/max) desde BD sin rango aplicado
  const boundsAgg = await Artwork.aggregate([
    { $match: baseMatch },
    { $group: { _id: null, minPriceCents: { $min: '$price_cents' }, maxPriceCents: { $max: '$price_cents' } } },
    { $project: { _id: 0, minPriceCents: 1, maxPriceCents: 1 } }
  ]).hint({ status: 1, deletedAt: 1, createdAt: -1 }); // Forzar uso del índice principal

  const bounds = boundsAgg[0] || { minPriceCents: null, maxPriceCents: null };

  // 2) Obtener técnicas únicas desde la base de datos (solo aprobados y no borrados)
  const techniques = await getAllTechniques(Artwork);

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
  const [totalArtworks, artworksRaw] = await Promise.all([
    Artwork.countDocuments({ status: 'approved', deletedAt: null, ...filter }),
    Artwork.findApproved(filter)
      .select('title slug imageUrl imagePublicId imageWidth_px imageHeight_px technique width_cm height_cm artist price_cents')
      .sort(sort)
      .skip(skip)
      .limit(perPage)
      .populate({ path: 'artist', select: 'name' })
      .lean()
  ]);
  const { buildPublicSrcSet } = require('@utils/media');
  const artworks = artworksRaw.map(a => {
    try {
      if (a.imagePublicId) {
        a._media = buildPublicSrcSet(a.imagePublicId, {
          widths: [400,800,1200],
          sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw',
          type: 'upload'
        });
      } else if (a.imageUrl) {
        a._media = buildPublicSrcSet(a.imageUrl, {
          widths: [400,800,1200],
          sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw',
          type: 'fetch'
        });
      }
    } catch (_) {}
    return a;
  });

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

  // �‡ï¸ Canonicalización de la query (opcional pero recomendado)
  // Construye una query sin vacíos ni defaults y redirige si difiere de la original.
  const redirectUrl = canonicalizeQuery(req, appliedPrice, priceBounds);
  if (redirectUrl) {
    return res.redirect(302, redirectUrl);
  }

  // Render si ya es canónica
  res.status(200).render('public/artworks/index', {
    title: 'Obras',
    artworks,
    q,
    priceBounds,   // rango total desde BD
    appliedPrice,  // rango aplicado (query o defaults)
    techniques,    // técnicas únicas para filtros
    page,
    perPage,
    totalPages,
    skip,
    totalArtworks
  });
});

// Vista ¿Quiénes somos?
exports.getAbout = (req, res) => {
  res.status(200).render('public/static/about', {
    title: '¿Quiénes somos? · Galería del Ox'
  });
};

// Vista de detalle de obra individual
exports.getArtworkDetail = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  // Usar utility para buscar artwork
  const { artwork, shouldRedirect, redirectUrl } = await findArtworkByIdOrSlug(Artwork, id);
  
  if (shouldRedirect) {
    // Usa 302 para evitar cache permanente del navegador al cambiar slug
    return res.redirect(302, redirectUrl);
  }

  // Contador de vistas se actualiza solo vía script diario

  // Buscar obras relacionadas del mismo artista
  let relatedArtworks = await getRelatedArtworks(Artwork, artwork.artist._id, artwork._id, 6);
  try {
    const { buildPublicSrcSet } = require('@utils/media');
    relatedArtworks = relatedArtworks.map(a => {
      const obj = a.toObject ? a.toObject() : a;
      try {
        if (obj.imagePublicId) {
          obj._media = buildPublicSrcSet(obj.imagePublicId, { widths: [400,800,1200], sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw', type: 'upload' });
        } else if (obj.imageUrl) {
          obj._media = buildPublicSrcSet(obj.imageUrl, { widths: [400,800,1200], sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw', type: 'fetch' });
        }
      } catch(_) {}
      return obj;
    });
  } catch(_) {}

  // Construir media con marca de agua para la imagen principal (solo artworks)
  try {
    const { buildPublicSrcSet, signedWatermarkedUrl } = require('@utils/media');
    if (artwork && artwork.imagePublicId) {
      artwork._media = buildPublicSrcSet(artwork.imagePublicId, {
        widths: [800, 1200, 1600],
        sizes: '(max-width: 992px) 100vw, 800px',
        widthAttr: artwork.imageWidth_px,
        heightAttr: artwork.imageHeight_px,
        type: 'upload'
      });
      artwork._mediaFull = signedWatermarkedUrl(artwork.imagePublicId, 1600, { type: 'upload' });
    }
  } catch (_) {}

  res.status(200).render('public/artworks/detail', {
    title: `${artwork.title} · Galería del Ox`,
    artwork,
    relatedArtworks
  });
});

// Vista de detalle de artista individual
exports.getArtistDetail = catchAsync(async (req, res, next) => {
  const { buildArtistArtworkFilter, getArtworkSort } = require('@utils/artworkSearch');
  const { getPaginationParams } = require('@utils/pagination');
  const { getPriceRanges } = require('@utils/priceUtils');
  const Follow = require('@models/followModel');
  
  const artistId = req.params.id;
  const q = req.query;
  
  // Usar utility para buscar artista
  const { artist, shouldRedirect, redirectUrl } = await findArtistByIdOrSlug(User, artistId);
  
  if (shouldRedirect) {
    // Usar 302 para evitar cache permanente del navegador al cambiar slug
    return res.redirect(302, redirectUrl);
  }

  // --- FILTROS Y PAGINACIÓN PARA OBRAS DEL ARTISTA ---
  
  // Filtro base: obras del artista aprobadas y no borradas
  const baseFilter = {
    artist: artist._id,
    status: 'approved',
    deletedAt: null
  };

  // Aplicar filtros adicionales (técnica, precio, etc.) sin filtro de availability
  const artworkFilter = buildArtistArtworkFilter(q);
  const combinedFilter = { ...baseFilter, ...artworkFilter };
  
  // Paginación (máximo 9 obras por página)
  const { page, perPage, skip } = getPaginationParams(req.query, 9, 9);
  
  // Ordenamiento
  const sort = getArtworkSort(q.sort) || { createdAt: -1 };

  // Consultas paralelas usando utilities optimizadas
  const [
    totalArtworks,
    artworksRaw,
    allArtworks, // Para estadísticas generales
    techniques,
    bounds
  ] = await Promise.all([
    // Total con filtros aplicados
    Artwork.countDocuments(combinedFilter),
    // Obras paginadas con filtros
    Artwork.find(combinedFilter)
      .select('title slug imageUrl imagePublicId imageWidth_px imageHeight_px technique width_cm height_cm artist price_cents createdAt')
      .populate({ path: 'artist', select: 'name' })
      .sort(sort)
      .skip(skip)
      .limit(perPage)
      .lean(),
    // Todas las obras del artista para estadísticas (sin filtros adicionales)
    Artwork.find(baseFilter).populate({ path: 'artist', select: 'name' }),
    // Técnicas disponibles del artista (usando utility con cache)
    getArtistTechniques(Artwork, artist._id),
    // Rangos de precio del artista (usando utility con cache)
    getArtistPriceBounds(Artwork, artist._id)
  ]);

  const totalPages = Math.max(1, Math.ceil(totalArtworks / perPage));
  const { buildPublicSrcSet } = require('@utils/media');
  const artworksMapped = artworksRaw.map(a => {
    try {
      if (a.imagePublicId) {
        a._media = buildPublicSrcSet(a.imagePublicId, { widths: [400,800,1200], sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw', type: 'upload' });
      } else if (a.imageUrl) {
        a._media = buildPublicSrcSet(a.imageUrl, { widths: [400,800,1200], sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw', type: 'fetch' });
      }
    } catch(_) {}
    return a;
  });
  const { appliedPrice, priceBounds } = getPriceRanges(q, bounds);

  // Estado de seguimiento del usuario actual (si hay sesión)
  let isFollowing = false;
  try {
    const currentUser = res.locals && res.locals.currentUser;
    if (currentUser && currentUser.id) {
      isFollowing = !!(await Follow.exists({ follower: currentUser.id, artist: artist._id }));
    }
  } catch (_) {}

  // Usar utility para construir estadísticas
  const stats = buildArtistStats(allArtworks);

  res.status(200).render('public/artists/detail', {
    title: `${artist.name} · Galería del Ox`,
    artist,
    artworks: artworksMapped, // Obras paginadas y filtradas
    stats, // Solo técnicas y total de obras
    techniques, // Para filtros
    priceBounds, // Para filtros de precio
    appliedPrice, // Precios aplicados
    page,
    perPage,
    totalPages,
    totalArtworks, // Total filtrado
    q, // Query params para filtros
    actionUrl: `/artists/${artist.slug || artist._id}`, // Para formularios de filtro
    isFollowing
  });
});

// Vista de detalle de exposición individual
exports.getExhibitionDetail = catchAsync(async (req, res, next) => {
  const Exhibition = require('@models/exhibitionModel');
  const Artwork = require('@models/artworkModel');
  const idOrSlug = req.params.id;

  // Intentar por ObjectId primero, luego por slug
  let exhibition = null;
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(String(idOrSlug));
  if (isObjectId) {
    exhibition = await Exhibition.findOne({ _id: idOrSlug, status: 'published', deletedAt: null })
      .populate({ path: 'createdBy', select: 'name slug' })
      .populate({ path: 'participants.user', select: 'name slug' })
      .lean();
  }
  if (!exhibition) {
    exhibition = await Exhibition.findOne({ slug: idOrSlug, status: 'published', deletedAt: null })
      .populate({ path: 'createdBy', select: 'name slug' })
      .populate({ path: 'participants.user', select: 'name slug' })
      .lean();
  }

  if (!exhibition) {
    return res.status(404).render('public/error/index', {
      title: 'Exposición no encontrada',
      msg: 'No pudimos encontrar esta exposición.'
    });
  }

  // Redirección canónica a slug si llegó por ObjectId y la exposición tiene slug
  if (isObjectId && exhibition.slug) {
    return res.redirect(301, `/exhibitions/${exhibition.slug}`);
  }

  // Cargar obras asociadas, mostrando solo aprobadas y no eliminadas (paginadas)
  const { getPaginationParams } = require('@utils/pagination');
  const { page, perPage, skip } = getPaginationParams(req.query, 18, 60);
  let artworks = [];
  let totalArtworks = 0;
  if (Array.isArray(exhibition.artworks) && exhibition.artworks.length) {
    const baseFilter = {
      _id: { $in: exhibition.artworks },
      status: 'approved',
      deletedAt: null
    };
    [totalArtworks, artworks] = await Promise.all([
      Artwork.countDocuments(baseFilter),
      Artwork.find(baseFilter)
        .select('title slug imageUrl imagePublicId imageWidth_px imageHeight_px technique width_cm height_cm artist price_cents')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage)
        .populate({ path: 'artist', select: 'name' })
        .lean()
    ]);
    const { buildPublicSrcSet } = require('@utils/media');
    artworks = artworks.map(a => {
      try {
        if (a.imagePublicId) {
          a._media = buildPublicSrcSet(a.imagePublicId, { widths: [400,800,1200], sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw', type: 'upload' });
        } else if (a.imageUrl) {
          a._media = buildPublicSrcSet(a.imageUrl, { widths: [400,800,1200], sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw', type: 'fetch' });
        }
      } catch(_) {}
      return a;
    });
  }
  const totalPages = Math.max(1, Math.ceil(totalArtworks / perPage));

  return res.status(200).render('public/exhibitions/detail', {
    title: `${exhibition.title} · Galería del Ox`,
    exhibition,
    artworks,
    totalArtworks,
    totalPages,
    page,
    perPage
  });
});

// Panel de artista: muestra el propio perfil del artista autenticado
exports.getMyArtistPanel = catchAsync(async (req, res, next) => {
  const { buildArtistArtworkFilter, getArtworkSort } = require('@utils/artworkSearch');
  const { getPaginationParams } = require('@utils/pagination');
  const { getPriceRanges } = require('@utils/priceUtils');
  const Follow = require('@models/followModel');

  const currentUser = (res.locals && res.locals.currentUser) || null;
  if (!currentUser) {
    const returnTo = encodeURIComponent(req.originalUrl || '/artists/panel');
    return res.redirect(`/login?returnTo=${returnTo}`);
  }
  if (currentUser.role !== 'artist') {
    return res.status(403).render('public/auth/unauthorized', {
      title: 'Acceso no autorizado · Galería del Ox',
      message: 'Debes ser artista para acceder a tu panel.'
    });
  }

  const q = req.query || {};

  // Buscar el artista por ID del usuario autenticado (sin lanzar 404 si no hay slug)
  let artistDoc = await User.findById(currentUser.id)
    .select('name bio profileImage coverImage createdAt slug email location website social followersCount +role')
    .lean();
  if (!artistDoc) {
    // Fallback a los datos mínimos del usuario en sesión para no romper el panel
    artistDoc = {
      _id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
      profileImage: currentUser.profileImage,
      coverImage: currentUser.coverImage,
      bio: currentUser.bio,
      website: currentUser.website,
      location: currentUser.country,
      social: currentUser.social,
      createdAt: new Date()
    };
  }
  const artist = artistDoc;

  // Filtro base: obras del artista aprobadas y no borradas
  const baseFilter = {
    artist: artist._id,
    status: 'approved',
    deletedAt: null
  };

  // Aplicar filtros adicionales (técnica, precio, etc.)
  const artworkFilter = buildArtistArtworkFilter(q);
  const combinedFilter = { ...baseFilter, ...artworkFilter };

  // Paginación (máximo 9 obras por página)
  const { page, perPage, skip } = getPaginationParams(req.query, 9, 9);

  // Ordenamiento
  const sort = getArtworkSort(q.sort) || { createdAt: -1 };

  // Consultas paralelas
  const [
    totalArtworks,
    artworksRaw,
    allArtworks, // Para estadísticas generales
    techniques,
    bounds
  ] = await Promise.all([
    Artwork.countDocuments(combinedFilter),
    Artwork.find(combinedFilter)
      .select('title slug imageUrl imagePublicId imageWidth_px imageHeight_px technique width_cm height_cm artist price_cents createdAt')
      .populate({ path: 'artist', select: 'name' })
      .sort(sort)
      .skip(skip)
      .limit(perPage)
      .lean(),
    Artwork.find(baseFilter).populate({ path: 'artist', select: 'name' }),
    getArtistTechniques(Artwork, artist._id),
    getArtistPriceBounds(Artwork, artist._id)
  ]);

  const totalPages = Math.max(1, Math.ceil(totalArtworks / perPage));
  const { buildPublicSrcSet } = require('@utils/media');
  const artworksMapped = artworksRaw.map(a => {
    try {
      if (a.imagePublicId) {
        a._media = buildPublicSrcSet(a.imagePublicId, { widths: [400,800,1200], sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw', type: 'upload' });
      } else if (a.imageUrl) {
        a._media = buildPublicSrcSet(a.imageUrl, { widths: [400,800,1200], sizes: '(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 33vw', type: 'fetch' });
      }
    } catch(_) {}
    return a;
  });
  const { appliedPrice, priceBounds } = getPriceRanges(q, bounds);

  // Estado de seguimiento del usuario actual: en panel siempre es propio, pero mantenemos consistencia
  let isFollowing = false;
  try {
    if (currentUser && currentUser.id) {
      isFollowing = !!(await Follow.exists({ follower: currentUser.id, artist: artist._id }));
    }
  } catch (_) {}

  const stats = buildArtistStats(allArtworks);

  return res.status(200).render('public/artists/panel', {
    title: `${artist.name} · Galería del Ox`,
    artist,
    artworks: artworksMapped,
    stats,
    techniques,
    priceBounds,
    appliedPrice,
    page,
    perPage,
    totalPages,
    totalArtworks,
    q,
    // En el panel, las acciones de filtro y paginación deben permanecer en esta ruta
    actionUrl: `/artists/panel`,
    isFollowing,
    isMyPanel: true,
    maxDrafts: parseInt(process.env.MAX_DRAFTS_PER_ARTIST || '10', 10)
  });
});


// Vista: exposicion privada o no publicada
exports.getExhibitionUnpublished = (req, res) => {
  return res.status(403).render('public/exhibitions/unpublished', {
    title: 'Exposición privada · Galería del Ox'
  });
};




// Sobrescribe getContact en español y añade flags de feedback
exports.getContact = (req, res) => {
  const success = !!req.query.success;
  const error = req.query.error;
  let formData = { name: '', email: '', message: '' };
  try {
    if (req.cookies && req.cookies.contact_form) {
      const parsed = JSON.parse(req.cookies.contact_form);
      if (parsed && typeof parsed === 'object') {
        formData.name = String(parsed.name || '');
        formData.email = String(parsed.email || '');
        formData.message = String(parsed.message || '');
      }
      try { res.clearCookie('contact_form', { path: '/' }); } catch (_) {}
    }
  } catch (_) {}

  res.status(200).render('public/static/contact', {
    title: 'Contacto · Galería del Ox',
    success,
    error,
    formData
  });
};

// Página informativa: Convertirse en artista / Vender mi arte
exports.getBecomeArtist = catchAsync(async (req, res) => {
  const currentUser = res.locals && res.locals.currentUser;
  const success = !!req.query.success;
  const error = req.query.error;

  let application = null;
  try {
    if (currentUser && currentUser.role !== 'artist') {
      const uid = currentUser.id || currentUser._id;
      // Preferir solicitudes abiertas; si no hay, mostrar la más reciente
      application = await ArtistApplication.findOne({
        user: uid,
        status: { $in: ['pending', 'under_review'] }
      }).sort({ createdAt: -1 }).lean();
      if (!application) {
        application = await ArtistApplication.findOne({ user: uid }).sort({ createdAt: -1 }).lean();
      }
    }
  } catch (_) {}

  return res.status(200).render('public/static/become-artist', {
    title: 'Vender mi arte · Galería del Ox',
    currentUser,
    success,
    error,
    application
  });
});

