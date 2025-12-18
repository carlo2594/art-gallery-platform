const Follow = require('@models/followModel');
const User = require('@models/userModel');
const catchAsync = require('@utils/catchAsync');
const AppError = require('@utils/appError');
const sendResponse = require('@utils/sendResponse');
const isValidObjectId = require('@utils/isValidObjectId');
const { hasRole } = require('@utils/roleUtils');

// Seguir a un artista
exports.followArtist = catchAsync(async (req, res, next) => {
  const artistId = req.body.artistId || req.body.artist;
  const followerId = req.user._id;

  if (!artistId) return next(new AppError('Debes enviar el ID del artista', 400));
  if (!isValidObjectId(artistId)) return next(new AppError('ID inválido', 400));
  if (String(artistId) === String(followerId)) return next(new AppError('No puedes seguirte a ti mismo', 400));

  const artist = await User.findById(artistId).select('+roles');
  if (!artist) return next(new AppError('Artista no encontrado', 404));
  if (!hasRole(artist, 'artist')) return next(new AppError('Solo puedes seguir artistas', 400));

  try {
    await Follow.create({ follower: followerId, artist: artistId });
  } catch (err) {
    if (err && err.code === 11000) {
      // Ya seguía: idempotente
      return sendResponse(res, { following: true }, 'Ya sigues a este artista', 200);
    }
    throw err;
  }

  await User.recalculateFollowersCount(artistId);
  return sendResponse(res, { following: true }, 'Ahora sigues al artista', 201);
});

// Dejar de seguir a un artista
exports.unfollowArtist = catchAsync(async (req, res, next) => {
  const { artistId } = req.params;
  const followerId = req.user._id;

  if (!isValidObjectId(artistId)) return next(new AppError('ID inválido', 400));

  const removed = await Follow.findOneAndDelete({ follower: followerId, artist: artistId });
  if (!removed) return next(new AppError('Relación de seguimiento no encontrada', 404));

  await User.recalculateFollowersCount(artistId);
  return sendResponse(res, null, 'Has dejado de seguir al artista', 204);
});

// Obtener seguidores de un artista (público)
exports.getArtistFollowers = catchAsync(async (req, res, next) => {
  const { artistId } = req.params;
  if (!isValidObjectId(artistId)) return next(new AppError('ID inválido', 400));

  const countPromise = Follow.countDocuments({ artist: artistId });

  // Paginación opcional si se solicitan registros
  const limit = Math.min(parseInt(req.query.limit, 10) || 0, 50);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const skip = (page - 1) * (limit || 0);

  let followers = [];
  if (limit) {
    followers = await Follow.find({ artist: artistId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'follower', select: 'name slug profileImage' })
      .lean();
  }

  const count = await countPromise;
  return sendResponse(res, { followers, count }, 'Seguidores del artista', 200, {
    results: followers.length,
    total: count,
    page,
    limit
  });
});

// Listar artistas seguidos por el usuario actual
exports.getMyFollowing = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const list = await Follow.find({ follower: userId })
    .sort({ createdAt: -1 })
    .populate({ path: 'artist', select: 'name slug profileImage followersCount' })
    .lean();

  return sendResponse(res, { following: list }, 'Artistas seguidos', 200, { results: list.length });
});

