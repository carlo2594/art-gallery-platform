// controllers/viewsAdminController.js
const catchAsync   = require('@utils/catchAsync');
const AppError     = require('@utils/appError');
const statsService = require('@services/statsService');
const Exhibition   = require('@models/exhibitionModel');
const Artwork      = require('@models/artworkModel');
const User         = require('@models/userModel');

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

/* Exhibiciones */
exports.getExhibitions = catchAsync(async (req, res) => {
  const exhibitions = await Exhibition.find().populate('createdBy').lean();
  res.status(200).render('admin/exhibitions/index', {
    title: 'Exhibiciones',
    exhibitions
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
  const artworks = await Artwork.find().populate('artist').lean();
  res.status(200).render('admin/artworks/index', {
    title: 'Obras de arte',
    artworks
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
  const users = await User.find().lean();
  res.status(200).render('admin/users/index', {
    title: 'Usuarios',
    users
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
