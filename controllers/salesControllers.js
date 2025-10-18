/* ------------------------------------------------------------------ */
/*  Controladores de Gestión de Ventas para viewsController.js       */
/* ------------------------------------------------------------------ */

// Vista de gestión de ventas (admin)
exports.getSalesManagement = catchAsync(async (req, res) => {
  const q = req.query;
  const page = Math.max(1, parseInt(q.page || '1', 10));
  const perPage = 20;
  const skip = (page - 1) * perPage;
  
  // Filtro base para obras vendidas
  const filter = {
    availability: { $in: ['sold', 'reserved'] },
    status: 'approved',
    deletedAt: null
  };

  // Filtros adicionales
  if (q.availability) {
    filter.availability = q.availability;
  }
  
  if (q.artist) {
    filter.artist = q.artist;
  }

  if (q.startDate || q.endDate) {
    filter.soldAt = {};
    if (q.startDate) filter.soldAt.$gte = new Date(q.startDate);
    if (q.endDate) filter.soldAt.$lte = new Date(q.endDate);
  }

  // Consultas paralelas
  const [totalSales, sales, artists] = await Promise.all([
    Artwork.countDocuments(filter),
    Artwork.find(filter)
      .populate({ path: 'artist', select: 'name email' })
      .sort({ soldAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(perPage),
    // Lista de artistas para filtros
    User.find({ role: 'artist' }).select('name').sort({ name: 1 })
  ]);

  // Estadísticas generales
  const stats = await Artwork.aggregate([
    { $match: { availability: 'sold', status: 'approved', deletedAt: null } },
    {
      $group: {
        _id: null,
        totalSold: { $sum: 1 },
        totalRevenue: { $sum: '$sale.price_cents' },
        avgPrice: { $avg: '$sale.price_cents' }
      }
    }
  ]);

  const salesStats = stats[0] || { totalSold: 0, totalRevenue: 0, avgPrice: 0 };

  const totalPages = Math.max(1, Math.ceil(totalSales / perPage));

  res.status(200).render('admin/sales/index', {
    title: 'Gestión de Ventas · Admin',
    sales,
    artists,
    salesStats: {
      totalSold: salesStats.totalSold,
      totalRevenue: (salesStats.totalRevenue / 100).toFixed(2),
      avgPrice: (salesStats.avgPrice / 100).toFixed(2)
    },
    page,
    perPage,
    totalPages,
    totalSales,
    q
  });
});

// Vista de detalle de venta específica (admin)
exports.getSaleDetail = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  if (!isValidObjectId(id)) {
    return next(new AppError('ID de obra inválido', 400));
  }

  const artwork = await Artwork.findOne({
    _id: id,
    status: 'approved',
    deletedAt: null
  }).populate({ path: 'artist', select: 'name email location social website' });

  if (!artwork) {
    return next(new AppError('Obra no encontrada', 404));
  }

  const { getAvailabilityBadge, formatSaleInfo } = require('@utils/availabilityUtils');
  
  const badge = getAvailabilityBadge(artwork.availability, artwork.reservedUntil);
  const saleInfo = formatSaleInfo(artwork.sale);

  res.status(200).render('admin/sales/detail', {
    title: `Venta: ${artwork.title} · Admin`,
    artwork,
    badge,
    saleInfo
  });
});
