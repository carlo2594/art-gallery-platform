const Newsletter = require('@models/newsletterModel');
const catchAsync = require('@utils/catchAsync');
const AppError = require('@utils/appError');
const sendResponse = require('@utils/sendResponse');
const { wantsHTML } = require('@utils/http');

exports.subscribe = catchAsync(async (req, res) => {
  const { email, source = 'homepage', preferences = {} } = req.body;
  
  if (!email) {
    throw new AppError('Email es requerido', 400);
  }

  // Verificar si ya existe
  const existing = await Newsletter.findOne({ email: email.toLowerCase() });
  
  if (existing) {
    if (existing.status === 'active') {
      if (wantsHTML(req)) {
        return res.redirect('/?message=Ya estás suscrito a nuestro newsletter&type=info');
      }
      return sendResponse(res, null, 'Ya estás suscrito a nuestro newsletter', 200);
    }
    
    // Reactivar si estaba unsubscribed
    if (existing.status === 'unsubscribed') {
      existing.status = 'active';
      existing.subscribedAt = new Date();
      existing.unsubscribedAt = undefined;
      await existing.save();
      
      if (wantsHTML(req)) {
        return res.redirect('/?message=¡Bienvenido de vuelta! Te has suscrito nuevamente&type=success');
      }
      return sendResponse(res, null, '¡Bienvenido de vuelta! Te has suscrito nuevamente', 200);
    }
  }

  // Crear nueva suscripción
  const subscription = await Newsletter.create({
    email: email.toLowerCase(),
    source,
    preferences: {
      newArtworks: preferences.newArtworks !== false,
      exhibitions: preferences.exhibitions !== false,
      artistSpotlight: preferences.artistSpotlight !== false,
      salesAlerts: preferences.salesAlerts === true
    },
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  // TODO: Enviar email de bienvenida
  // await sendWelcomeEmail(subscription.email);

  if (wantsHTML(req)) {
    return res.redirect('/?message=¡Gracias por suscribirte! Revisa tu email&type=success');
  }
  
  sendResponse(res, { email: subscription.email }, '¡Gracias por suscribirte!', 201);
});

exports.unsubscribe = catchAsync(async (req, res) => {
  const { token } = req.params;
  
  const subscription = await Newsletter.findOne({ unsubscribeToken: token });
  
  if (!subscription) {
    throw new AppError('Token de unsubscribe inválido', 400);
  }

  await subscription.unsubscribe();
  
  if (wantsHTML(req)) {
    return res.render('public/newsletter/unsubscribed', {
      title: 'Te has dado de baja',
      message: 'Has sido removido exitosamente de nuestro newsletter'
    });
  }
  
  sendResponse(res, null, 'Te has dado de baja exitosamente', 200);
});

// Admin: obtener estadísticas
exports.getStats = catchAsync(async (req, res) => {
  const stats = await Newsletter.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const sourceStats = await Newsletter.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 }
      }
    }
  ]);

  const recentSubscriptions = await Newsletter.find({ status: 'active' })
    .sort({ subscribedAt: -1 })
    .limit(10)
    .select('email subscribedAt source');

  sendResponse(res, { 
    stats, 
    sourceStats, 
    recentSubscriptions,
    total: await Newsletter.countDocuments({ status: 'active' })
  }, 'Estadísticas del newsletter');
});

// Admin: obtener todos los suscriptores activos
exports.getSubscribers = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  const subscribers = await Newsletter.find({ status: 'active' })
    .sort({ subscribedAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('email subscribedAt source preferences emailCount lastEmailSent');

  const total = await Newsletter.countDocuments({ status: 'active' });
  const totalPages = Math.ceil(total / limit);

  sendResponse(res, {
    subscribers,
    pagination: {
      currentPage: page,
      totalPages,
      total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  }, 'Suscriptores del newsletter');
});
