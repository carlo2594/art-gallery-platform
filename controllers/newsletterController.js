const Newsletter = require('@models/newsletterModel');
const catchAsync = require('@utils/catchAsync');
const AppError = require('@utils/appError');

// POST /subscribe
exports.subscribe = catchAsync(async (req, res, next) => {
  const { email, preferences, source } = req.body || {};
  if (!email || typeof email !== 'string') {
    return next(new AppError('Email es requerido.', 400));
  }

  const data = {
    email: String(email).toLowerCase().trim(),
    source: source || 'homepage',
    ipAddress: req.ip,
    userAgent: req.get && req.get('user-agent'),
  };
  if (preferences && typeof preferences === 'object') {
    data.preferences = {
      newArtworks: !!preferences.newArtworks,
      exhibitions: !!preferences.exhibitions,
      artistSpotlight: !!preferences.artistSpotlight,
      salesAlerts: !!preferences.salesAlerts,
    };
  }

  // Upsert sencillo por email
  const existing = await Newsletter.findOne({ email: data.email });
  let doc;
  if (existing) {
    // Si estaba desuscrito, vuelve a activar
    existing.status = 'active';
    if (data.preferences) existing.preferences = data.preferences;
    if (data.source) existing.source = data.source;
    existing.unsubscribedAt = undefined;
    await existing.save({ validateModifiedOnly: true });
    doc = existing;
  } else {
    doc = await Newsletter.create(data);
  }

  return res.status(200).json({ status: 'success', message: 'Suscripción registrada.', data: { email: doc.email } });
});

// GET /unsubscribe/:token
exports.unsubscribe = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  if (!token) return next(new AppError('Token inválido.', 400));
  const doc = await Newsletter.findOne({ unsubscribeToken: token });
  if (!doc) return next(new AppError('El enlace de desuscripción no es válido o ya fue usado.', 400));
  await doc.unsubscribe();
  // Renderizar página pública de confirmación
  return res.status(200).render('public/newsletter/unsubscribed', {
    title: 'Te desuscribiste del newsletter',
    message: 'Has sido removido exitosamente de nuestro newsletter.'
  });
});

// GET /stats (admin)
exports.getStats = catchAsync(async (req, res, next) => {
  const [total, active, unsubscribed, bounced] = await Promise.all([
    Newsletter.countDocuments({}),
    Newsletter.countDocuments({ status: 'active' }),
    Newsletter.countDocuments({ status: 'unsubscribed' }),
    Newsletter.countDocuments({ status: 'bounced' }),
  ]);
  return res.status(200).json({
    status: 'success',
    data: { total, active, unsubscribed, bounced }
  });
});

// GET /subscribers (admin)
exports.getSubscribers = catchAsync(async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const skip = (page - 1) * limit;
  const status = (req.query.status || '').trim();
  const filter = {};
  if (['active', 'unsubscribed', 'bounced'].includes(status)) filter.status = status;
  const [total, items] = await Promise.all([
    Newsletter.countDocuments(filter),
    Newsletter.find(filter).sort({ subscribedAt: -1 }).skip(skip).limit(limit)
      .select('email status source preferences subscribedAt unsubscribedAt')
      .lean()
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return res.status(200).json({ status: 'success', data: { items, page, totalPages, total } });
});

