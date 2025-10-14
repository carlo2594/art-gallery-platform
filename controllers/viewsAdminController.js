// controllers/viewsAdminController.js
const catchAsync   = require('@utils/catchAsync');
const AppError     = require('@utils/appError');
const statsService = require('@services/statsService');
const Exhibition   = require('@models/exhibitionModel');
const Artwork      = require('@models/artworkModel');
const User         = require('@models/userModel');
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

/* Exhibiciones */
exports.getExhibitions = catchAsync(async (req, res) => {
  const { page, perPage, skip } = getPaginationParams(req.query, 15, 50);
  const [total, exhibitions] = await Promise.all([
    Exhibition.countDocuments({}),
    Exhibition.find({}).sort({ createdAt: -1 }).skip(skip).limit(perPage).populate('createdBy').lean()
  ]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  res.status(200).render('admin/exhibitionAdmin', {
    title: 'Exhibiciones',
    exhibitions,
    page,
    totalPages,
    qsPrefix: buildQsPrefix(req.query)
  });
});
exports.getExhibition = catchAsync(async (req, res, next) => {
  const exhibition = await Exhibition.findById(req.params.id)
    .populate('createdBy participants')
    .lean();
  if (!exhibition) return next(new AppError('Exhibición no encontrada', 404));
  res.status(200).render('admin/exhibitions/detail', {
    title: exhibition.name,
    exhibition
  });
});

/* Obras */
exports.getArtworks = catchAsync(async (req, res) => {
  const { page, perPage, skip } = getPaginationParams(req.query, 15, 50);
  const [total, artworks] = await Promise.all([
    Artwork.countDocuments({}),
    Artwork.find({}).sort({ createdAt: -1 }).skip(skip).limit(perPage).populate('artist').lean()
  ]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  res.status(200).render('admin/artworkAdmin', {
    title: 'Obras de arte',
    artworks,
    page,
    totalPages,
    qsPrefix: buildQsPrefix(req.query)
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
  res.status(200).render('admin/users/userList', {
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
  res.status(200).render('admin/users/userList', {
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
