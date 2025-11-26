// controllers/viewsAdminController.js
const catchAsync   = require('@utils/catchAsync');
const AppError     = require('@utils/appError');
const statsService = require('@services/statsService');
const Exhibition   = require('@models/exhibitionModel');
const Artwork      = require('@models/artworkModel');
const User         = require('@models/userModel');
const ArtistApplication = require('@models/artistApplicationModel');
const cloudinary = require('@services/cloudinary');
const https = require('https');
const http = require('http');
const { getPaginationParams } = require('@utils/pagination');
const { buildUserAdminFilter, getUserAdminSort } = require('@utils/userAdminSearch');

/* Dashboard */
exports.getDashboard = catchAsync(async (req, res) => {
  const [totals, recentExhibitions, recentArtworks] = await Promise.all([
    statsService.getAdminTotals(),
    statsService.getRecentExhibitions(5),
    statsService.getRecentArtworks(5)
  ]);
  res.status(200).render('admin/dashboard', {
    title: 'Dashboard',
    totals,
    recentExhibitions,
    recentArtworks
  });
});

/* Helpers de paginación (admin) */
function buildQsPrefix(q) {
  const params = new URLSearchParams();
  Object.keys(q || {}).forEach(k => {
    if (k === 'page') return;
    const v = q[k];
    if (v !== undefined && v !== '') params.append(k, v);
  });
  const s = params.toString();
  return s ? `&${s}` : '';
}

// Regex inteligente: ignora acentos/diacríticos y mayúsculas/minúsculas
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function buildDiacriticRegex(input) {
  const map = {
    a: 'aáàä���ā',
    e: 'eéèëêē',
    i: 'iíìïîī',
    o: 'oóòöôõō',
    u: 'uúùüûū',
    c: 'cç',
    n: 'nñ',
    y: 'yýÿ'
  };
  const pattern = String(input)
    .split('')
    .map(ch => {
      const lower = ch.toLowerCase();
      if (map[lower]) return `[${escapeRegex(map[lower])}]`;
      if (/[a-z]/i.test(ch)) return `[${escapeRegex(lower)}]`;
      return escapeRegex(ch);
    })
    .join('');
  return new RegExp(pattern, 'i');
}

/* Exhibiciones */
exports.getExhibitions = catchAsync(async (req, res) => {
  const { page, perPage, skip } = getPaginationParams(req.query, 15, 50);

  // Read filters from query
  const q = (req.query.q || '').trim();
  const statusFilter = (req.query.status || '').trim(); // draft | published | archived
  const when = (req.query.when || '').trim(); // current | upcoming | past
  const locType = (req.query.loc || '').trim(); // physical | virtual
  const sortParam = (req.query.sort || 'recent').trim();

  // Build filter (no excluir por status ni papelera por defecto)
  const filter = {};

  if (q) {
    // Search by title/slug or creator name (diacritic tolerant)
    const smart = buildDiacriticRegex(q);
    const creatorIds = await User.find({ name: { $regex: smart } }).distinct('_id');
    filter.$or = [
      { title: { $regex: smart } },
      { slug: { $regex: smart } },
      { createdBy: { $in: creatorIds } }
    ];
  }

  // Filter by status
  const STATUS_ENUM = ['draft', 'published', 'archived'];
  if (STATUS_ENUM.includes(statusFilter)) {
    filter.status = statusFilter;
  }

  // Filter by time window
  const now = new Date();
  if (when === 'current') {
    filter.startDate = { $lte: now };
    filter.endDate = { $gte: now };
  } else if (when === 'upcoming') {
    filter.startDate = { $gt: now };
  } else if (when === 'past') {
    filter.endDate = { $lt: now };
  }

  // Filter by location type
  const LOC_ENUM = ['physical', 'virtual'];
  if (LOC_ENUM.includes(locType)) {
    filter['location.type'] = locType;
  }

  // Sorting
  let sort = { createdAt: -1 };
  switch (sortParam) {
    case 'start_asc':
      sort = { startDate: 1 };
      break;
    case 'start_desc':
      sort = { startDate: -1 };
      break;
    case 'end_asc':
      sort = { endDate: 1 };
      break;
    case 'end_desc':
      sort = { endDate: -1 };
      break;
    case 'title_asc':
      sort = { title: 1 };
      break;
    case 'recent':
    default:
      sort = { createdAt: -1 };
  }

  const [total, exhibitions] = await Promise.all([
    Exhibition.countDocuments(filter),
    Exhibition.find(filter).sort(sort).skip(skip).limit(perPage).populate('createdBy').lean()
  ]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  res.status(200).render('admin/exhibitions/index', {
    title: 'Exhibiciones',
    exhibitions,
    page,
    totalPages,
    qsPrefix: buildQsPrefix(req.query),
    // Form state
    q,
    sort: sortParam,
    statusFilter,
    when,
    locType
  });
});
exports.getExhibition = catchAsync(async (req, res, next) => {
  const exhibition = await Exhibition.findById(req.params.id)
    .populate({ path: 'createdBy', select: 'name slug' })
    .populate({ path: 'participants.user', select: 'name slug' })
    .lean();
  if (!exhibition) return next(new AppError('Exhibición no encontrada', 404));

  // Load only approved artworks linked to this exhibition
  let artworks = [];
  if (Array.isArray(exhibition.artworks) && exhibition.artworks.length) {
    artworks = await Artwork.find({ _id: { $in: exhibition.artworks }, status: 'approved', deletedAt: null })
      .select('title slug imageUrl imageWidth_px imageHeight_px technique width_cm height_cm artist availability price_cents createdAt')
      .sort({ createdAt: -1 })
      .populate({ path: 'artist', select: 'name' })
      .lean();
  }
  const totalArtworks = artworks.length;

  res.status(200).render('admin/exhibitions/detail', {
    title: exhibition.title || exhibition.name,
    exhibition,
    artworks,
    totalArtworks
  });
});

/* Obras */
exports.getArtworks = catchAsync(async (req, res) => {
  const { page, perPage, skip } = getPaginationParams(req.query, 15, 50);

  // Lectura de filtros básicos desde query
  const q = (req.query.q || '').trim();
  const avail = (req.query.avail || '').trim();
  const statusFilter = (req.query.status || '').trim();
  const sortParam = (req.query.sort || 'recent').trim();

  // Construcción de filtro
  const filter = {};

  if (q) {
    // Buscar obras por título/slug o por nombre de artista (tolerante a tildes)
    const smart = buildDiacriticRegex(q);
    const artistIds = await User.find({ name: { $regex: smart } }).distinct('_id');
    filter.$or = [
      { title: { $regex: smart } },
      { slug: { $regex: smart } },
      { artist: { $in: artistIds } }
    ];
  }

  // Mapeo de disponibilidad
  const AVAIL_ENUM = ['for_sale', 'reserved', 'sold', 'not_for_sale', 'on_loan'];
  if (AVAIL_ENUM.includes(avail)) {
    filter.availability = avail;
  } else if (avail === 'available') {
    filter.availability = { $in: ['for_sale', 'reserved'] };
  } else if (avail === 'unavailable') {
    filter.availability = { $in: ['sold', 'not_for_sale', 'on_loan'] };
  }

  // Filtro por estado (status)
  const STATUS_ENUM = ['draft', 'submitted', 'approved', 'rejected', 'trashed'];
  if (STATUS_ENUM.includes(statusFilter)) {
    filter.status = statusFilter;
  }

  // Ordenamiento
  let sort = { createdAt: -1 };
  switch (sortParam) {
    case 'popular':
      sort = { views: -1 };
      break;
    case 'most_favorited':
      sort = { favoritesCount: -1 };
      break;
    case 'price_asc':
      sort = { price_cents: 1 };
      break;
    case 'price_desc':
      sort = { price_cents: -1 };
      break;
    case 'recent':
    default:
      sort = { createdAt: -1 };
  }

  const [total, artworks] = await Promise.all([
    Artwork.countDocuments(filter),
    Artwork.find(filter).sort(sort).skip(skip).limit(perPage).populate('artist').lean()
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  res.status(200).render('admin/artworks/index', {
    title: 'Obras de arte',
    artworks,
    page,
    totalPages,
    qsPrefix: buildQsPrefix(req.query),
    // para mantener estado del formulario
    q,
    avail,
    sort: sortParam,
    statusFilter
  });
});
exports.getArtwork = catchAsync(async (req, res, next) => {
  const artwork = await Artwork.findById(req.params.id)
    .populate('artist exhibitions')
    .lean();
  if (!artwork) return next(new AppError('Obra no encontrada', 404));
  res.status(200).render('admin/artworks/detail', {
    title: artwork.title,
    artwork
  });
});

/* Usuarios */
exports.getUsers = catchAsync(async (req, res) => {
  const role = (req.query.role || 'artist').trim();
  const filter = buildUserAdminFilter(req.query, role ? { role } : {});
  const sortParam = (req.query.sort || 'recent').trim();
  const sort = getUserAdminSort(sortParam);
  const { page, perPage, skip } = getPaginationParams(req.query, 15, 50);
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort(sort).skip(skip).limit(perPage).select('name slug createdAt active lastLoginAt +role +email profileImage').lean()
  ]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  res.status(200).render('admin/users/index', {
    title: 'Artistas',
    users,
    page,
    totalPages,
    qsPrefix: buildQsPrefix(req.query),
    q: (req.query.q || '').trim(),
    role,
    sort: sortParam,
    active: (req.query.active || '').trim(),
    img: (req.query.img || '').trim()
  });
});

exports.getCollectors = catchAsync(async (req, res) => {
  const filter = buildUserAdminFilter(req.query, { role: 'collector' });
  const sortParam = (req.query.sort || 'recent').trim();
  const sort = getUserAdminSort(sortParam);
  const { page, perPage, skip } = getPaginationParams(req.query, 15, 50);
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort(sort).skip(skip).limit(perPage).select('name slug createdAt active lastLoginAt +role +email profileImage').lean()
  ]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  res.status(200).render('admin/users/index', {
    title: 'Coleccionistas',
    users,
    page,
    totalPages,
    qsPrefix: buildQsPrefix(req.query),
    q: (req.query.q || '').trim(),
    role: 'collector',
    sort: sortParam,
    active: (req.query.active || '').trim(),
    img: (req.query.img || '').trim()
  });
});
exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .populate('artworks exhibitions')
    .lean();
  if (!user) return next(new AppError('Usuario no encontrado', 404));
  res.status(200).render('admin/users/detail', {
    title: user.name,
    user
  });
});

// Vista de previa completa de la exposición (sin filtrar por estado de obra)
exports.getExhibitionPreview = catchAsync(async (req, res, next) => {
  const exhibition = await Exhibition.findById(req.params.id)
    .populate({ path: 'createdBy', select: 'name email' })
    .populate({ path: 'participants.user', select: 'name email' })
    .lean();
  if (!exhibition) return next(new AppError('Exhibición no encontrada', 404));

  let artworks = [];
  if (Array.isArray(exhibition.artworks) && exhibition.artworks.length) {
    artworks = await Artwork.find({
      _id: { $in: exhibition.artworks },
      deletedAt: null
    })
      .populate({ path: 'artist', select: 'name' })
      .lean();
  }
  const totalArtworks = Array.isArray(exhibition.artworks) ? exhibition.artworks.length : artworks.length;

  return res.status(200).render('admin/exhibitions/detail', {
    title: exhibition.title || exhibition.name,
    exhibition,
    artworks,
    totalArtworks
  });
});

/* Solicitudes de Artista */
exports.getArtistApplications = catchAsync(async (req, res) => {
  const { page, perPage, skip } = getPaginationParams(req.query, 15, 50);

  const q = (req.query.q || '').trim();
  const status = (req.query.status || '').trim(); // pending | under_review | approved | rejected
  const sortParam = (req.query.sort || 'recent').trim(); // recent | oldest

  const filter = {};
  const STATUS_ENUM = ['pending', 'under_review', 'approved', 'rejected'];
  if (STATUS_ENUM.includes(status)) filter.status = status;

  if (q) {
    // Buscar por nombre o email del usuario (case-insensitive, tolerante)
    const smart = buildDiacriticRegex(q);
    const userIds = await User.find({
      $or: [
        { name: { $regex: smart } },
        // email está select:false, pero para filtrar sí aplica
        { email: { $regex: smart } }
      ]
    }).select('_id').distinct('_id');
    filter.user = { $in: userIds };
  }

  let sort = { createdAt: -1 };
  if (sortParam === 'oldest') sort = { createdAt: 1 };

  const [total, applications] = await Promise.all([
    ArtistApplication.countDocuments(filter),
    ArtistApplication.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(perPage)
      .populate({ path: 'user', select: 'name +email +role profileImage' })
      .lean()
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return res.status(200).render('admin/artist-applications/index', {
    title: 'Solicitudes de artista',
    applications,
    page,
    totalPages,
    qsPrefix: buildQsPrefix(req.query),
    q,
    status,
    sort: sortParam
  });
});

exports.postArtistApplicationStatus = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const nextStatus = String(req.body.status || '').trim();
  const adminNotes = String(req.body.adminNotes || '').trim();
  const redirectTo = req.body.redirect || '/admin/artist-applications';

  const ALLOWED = ['pending', 'under_review', 'approved', 'rejected'];
  if (!ALLOWED.includes(nextStatus)) return next(new AppError('Estado inválido', 400));

  const appDoc = await ArtistApplication.findById(id);
  if (!appDoc) return next(new AppError('Solicitud no encontrada', 404));

  appDoc.status = nextStatus;
  if (adminNotes) appDoc.adminNotes = adminNotes;
  await appDoc.save();

  // Si se aprueba, promover al usuario a artista (si no lo es ya)
  if (nextStatus === 'approved' && appDoc.user) {
    try {
      await User.findByIdAndUpdate(appDoc.user, { role: 'artist' });
    } catch (_) {}
  }

  // Volver a la lista conservando filtros
  return res.redirect(303, redirectTo);
});

exports.downloadArtistApplicationResume = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const appDoc = await ArtistApplication.findById(id).populate({ path: 'user', select: 'name +email' });
  if (!appDoc) return next(new AppError('Solicitud no encontrada', 404));
  if (!appDoc.resumePublicId) return next(new AppError('Esta solicitud no tiene CV adjunto', 404));

  // Nombre de archivo preferente: original subido; fallback al nombre del usuario
  let filename = appDoc.resumeOriginalName || ((appDoc.user && appDoc.user.name) || 'cv');
  try { filename = String(filename).replace(/[^a-zA-Z0-9_\-\. ]+/g, '').trim(); } catch(_) {}
  if (!/\.pdf$/i.test(filename)) filename = `${filename}.pdf`;

  // Generar URL firmada para recurso privado RAW (PDF)
  const signedUrl = cloudinary.utils.private_download_url(appDoc.resumePublicId, 'pdf', {
    resource_type: 'raw',
    type: 'private',
    attachment: filename
  });

  // Forzar descarga como PDF con nombre consistente haciendo proxy de la respuesta
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200);

  const fetchAndPipe = (u) => {
    try {
      const urlObj = new URL(u);
      const client = urlObj.protocol === 'https:' ? https : http;
      client.get(u, (up) => {
        if ([301,302,303,307,308].includes(up.statusCode) && up.headers && up.headers.location) {
          const nextUrl = new URL(up.headers.location, u).toString();
          return fetchAndPipe(nextUrl);
        }
        up.on('error', () => { try { res.end(); } catch(_){}; });
        up.pipe(res);
      }).on('error', () => {
        return next(new AppError('No se pudo descargar el CV', 502));
      });
    } catch (e) {
      return next(new AppError('Enlace de descarga inválido', 400));
    }
  };
  return fetchAndPipe(signedUrl);
});

