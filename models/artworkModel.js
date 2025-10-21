const mongoose = require('mongoose');

// Helper de normalización (quita tildes, pasa a minúsculas, recorta)
const norm = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const STATUS = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'trashed'];
const AVAILABILITY = ['for_sale', 'reserved', 'sold', 'not_for_sale', 'on_loan'];
const THIRTY_DAYS = 60 * 60 * 24 * 30; // segundos

const artworkSchema = new mongoose.Schema(
  {
    /* ------ Basics ------ */
    title: { type: String, required: true, trim: true },
    slug: { type: String }, // URL-friendly version of title (índice único definido explícitamente abajo)
    description: { type: String, trim: true },
    completedAt: { type: Date }, // Fecha en que el artista terminó la obra

    /* ------ Relations ------ */
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true // (2) Indexación para búsquedas por artista
    },
    exhibitions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exhibition'
      },
    ],

    /* ------ Media & meta ------ */
    // Campos para imagen en Cloudinary
    imageUrl: { type: String, required: true },      // URL pública
    imagePublicId: { type: String }, // ID de Cloudinary
    imageWidth_px: { type: Number }, // opcional
    imageHeight_px: { type: Number }, // opcional

    // (3) Galería de imágenes adicional
    images: [{ type: String }], // Opcional: URLs adicionales

    type: { type: String },
    size: { type: String }, // texto derivado de width_cm/height_cm
    technique: { type: String },
    // (1) Validaciones adicionales para dimensiones y precio
    width_cm: { type: Number, required: true, min: 1 },
    height_cm: { type: Number, required: true, min: 1 },

    // --- Precio en USD (centavos) ---
    // Guarda siempre en centavos para evitar flotantes (ej. $3499.50 -> 349950)
    price_cents: { type: Number, required: true, min: 0, index: true },

    // --- Disponibilidad y venta ---
    availability: { type: String, enum: AVAILABILITY, default: 'not_for_sale', index: true },
    soldAt: { type: Date },
    reservedUntil: { type: Date },
    sale: {
      price_cents: { type: Number, min: 0 },
      currency: { type: String, default: 'USD' },
      buyerName: { type: String, trim: true },
      buyerEmail: { type: String, trim: true },
      channel: { type: String, enum: ['online', 'gallery', 'fair', 'private'] },
      orderId: { type: String, trim: true },
    },

    // Campos normalizados para búsquedas/indexación
    type_norm: { type: String, index: true },
    technique_norm: { type: String, index: true },

    /* ------ Metrics (inmutables) ------ */
    views: { type: Number, default: 0 },
    favoritesCount: { type: Number, default: 0 },

    // Fecha de creación en inglés (formato largo)
    createdAt_en: { type: String },

    /* ------ Workflow ----- */
    status: { type: String, enum: STATUS, default: 'draft', index: true },

    review: {
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date },
      rejectReason: { type: String },
      comment: { type: String, trim: true },
    },

    /* ------ Soft-delete (papelera) ------ */
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', select: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* (2) Índices adicionales */
// Índice único para slug (para SEO y URLs amigables)
artworkSchema.index({ slug: 1 }, { unique: true, sparse: true });

// Índices básicos existentes
artworkSchema.index({ artist: 1, status: 1 });
artworkSchema.index({ favoritesCount: -1 });
artworkSchema.index({ exhibitions: 1 });
// Index para obras por exposición + visibilidad (acelera detalle y home)
artworkSchema.index({ exhibitions: 1, status: 1, deletedAt: 1, createdAt: -1 });

// Nuevos índices compuestos optimizados para viewsController
// 1. Índice principal para consultas de obras aprobadas (getArtworks, getSearchResults)
artworkSchema.index({ status: 1, deletedAt: 1, createdAt: -1 });

// 2. Índice para filtros combinados en búsquedas
artworkSchema.index({ 
  status: 1, 
  deletedAt: 1, 
  technique_norm: 1, 
  type_norm: 1, 
  price_cents: 1 
});

// 3. Índice crítico para getArtistDetail - consultas por artista
artworkSchema.index({ 
  artist: 1, 
  status: 1, 
  deletedAt: 1, 
  createdAt: -1 
});

// 4. Índice para filtros de dimensiones
artworkSchema.index({ 
  status: 1, 
  deletedAt: 1, 
  width_cm: 1, 
  height_cm: 1 
});

// 5. Índice para ordenamiento por popularidad (getHome)
artworkSchema.index({ 
  deletedAt: 1, 
  views: -1 
});

// 6. Índice para agregaciones de técnicas y precios
artworkSchema.index({ 
  status: 1, 
  deletedAt: 1, 
  technique: 1 
});

// 7. Índices para disponibilidad y ventas
artworkSchema.index({ availability: 1, status: 1, deletedAt: 1, createdAt: -1 });
artworkSchema.index({ availability: 1, price_cents: 1 });
// Index para búsqueda por título normalizado (admin)
artworkSchema.index({ title_norm: 1 });

/* Índices existentes */
artworkSchema.index({ deletedAt: 1 }, { expireAfterSeconds: THIRTY_DAYS }); // TTL: purga 30 días después de ir a la papelera
artworkSchema.index({ type_norm: 1, technique_norm: 1 });

/* ====== Virtuals ====== */
// Lectura conveniente del precio en dólares (USD)
artworkSchema.virtual('price').get(function () {
  if (typeof this.price_cents !== 'number') return null;
  return this.price_cents / 100;
});

// (6) Virtual para aspect ratio
artworkSchema.virtual('aspectRatio').get(function () {
  if (typeof this.width_cm === 'number' && typeof this.height_cm === 'number' && this.height_cm !== 0) {
    return this.width_cm / this.height_cm;
  }
  return null;
});

/* (6) Virtual para nombre del artista si está populado */
artworkSchema.virtual('artistName').get(function () {
  if (this.populated('artist') && this.artist && this.artist.name) {
    return this.artist.name;
  }
  return undefined;
});

/* ====== Métodos de Workflow ====== */

// artist: draft â†’ submitted
artworkSchema.methods.submit = function () {
  // Permitir transicion a 'submitted' desde cualquier estado
  this.status = 'submitted';
  return this.save();
};

// admin: submitted â†’ under_review
artworkSchema.methods.startReview = function (adminId) {
  if (this.status !== 'submitted') return this;
  this.status = 'under_review';
  this.review = { reviewedBy: adminId };
  return this.save();
};

// admin: under_review â†’ approved
artworkSchema.methods.approve = function (adminId) {
  if (this.status !== 'under_review') return this;
  this.status = 'approved';
  this.review = { reviewedBy: adminId, reviewedAt: new Date() };
  return this.save();
};

// admin: under_review â†’ rejected
artworkSchema.methods.reject = function (adminId, reason = '') {
  if (this.status !== 'under_review') return this;
  this.status = 'rejected';
  this.review = { reviewedBy: adminId, reviewedAt: new Date(), rejectReason: reason };
  return this.save();
};

/* ====== Métodos de Trash ====== */

// mover a papelera (soft delete)
artworkSchema.methods.moveToTrash = function (userId) {
  if (this.status === 'trashed') return this;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.status = 'trashed';
  return this.save();
};

// restaurar desde papelera
artworkSchema.methods.restore = function () {
  if (!this.deletedAt) return this;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  this.status = 'draft'; // o el estado previo si lo guardas aparte
  return this.save();
};

// forzar draft (excepto si está en papelera)
artworkSchema.methods.setDraft = function () {
  if (this.status === 'trashed') return this;
  this.status = 'draft';
  return this.save();
};

/* ====== Métodos de Disponibilidad ====== */

artworkSchema.methods.markSold = function (opts = {}) {
  this.availability = 'sold';
  this.soldAt = new Date();
  this.sale = {
    price_cents: typeof opts.price_cents === 'number' ? Math.max(0, Math.round(opts.price_cents)) : this.price_cents,
    currency: opts.currency || 'USD',
    buyerName: opts.buyerName,
    buyerEmail: opts.buyerEmail,
    channel: opts.channel,
    orderId: opts.orderId,
  };
  return this.save();
};

artworkSchema.methods.reserve = function (untilDate) {
  this.availability = 'reserved';
  this.reservedUntil = untilDate instanceof Date ? untilDate : new Date(untilDate);
  return this.save();
};

artworkSchema.methods.unreserve = function () {
  this.availability = 'for_sale';
  this.reservedUntil = undefined;
  return this.save();
};

artworkSchema.methods.setNotForSale = function () {
  this.availability = 'not_for_sale';
  return this.save();
};

artworkSchema.methods.setOnLoan = function () {
  this.availability = 'on_loan';
  return this.save();
};

/* ====== Estáticos ====== */

// Catálogo público: aprobados y no en papelera
artworkSchema.statics.findApproved = function (filter = {}) {
  return this.find({ status: 'approved', deletedAt: null, ...filter });
};

// Buscar por rango de precio en USD (min/max en dólares)
artworkSchema.statics.findByPriceRange = function ({ min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const centsMin = Math.round(min * 100);
  const centsMax = Math.round(max * 100);
  return this.find({ price_cents: { $gte: centsMin, $lte: centsMax } });
};

// Recalcula el contador de favoritos para una obra
artworkSchema.statics.recalculateFavoritesCount = async function (artworkId) {
  const Favorite = require('@models/favoriteModel');
  const count = await Favorite.countDocuments({ artwork: artworkId });
  await this.findByIdAndUpdate(artworkId, { favoritesCount: count });
  return count;
};

/* ====== Hooks ====== */

// Función para generar slug único
function generateSlug(title) {
  return title
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remover acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '') // remover caracteres especiales
    .replace(/\s+/g, '-') // espacios a guiones
    .replace(/-+/g, '-') // múltiples guiones a uno
    .replace(/^-|-$/g, ''); // remover guiones al inicio y final
}

artworkSchema.pre('save', async function (next) {
  // Generar slug si es nuevo documento o cambió el título
  if (this.isNew || this.isModified('title')) {
    let baseSlug = generateSlug(this.title);
    let slug = baseSlug;
    let counter = 1;
    
    // Verificar unicidad del slug
    while (await this.constructor.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    this.slug = slug;
  }

  // Derivar size si hay medidas
  if (typeof this.width_cm === 'number' && typeof this.height_cm === 'number') {
    this.size = `${this.width_cm} x ${this.height_cm} cm`;
  }
  // Normalizar facetas\n  this.title_norm = norm(this.title);\n  this.type_norm = norm(this.type);
  this.technique_norm = norm(this.technique);

  // Asegurar entero y no-negativo para el precio
  if (typeof this.price_cents === 'number') {
    this.price_cents = Math.max(0, Math.round(this.price_cents));
  }

  // Calcular fecha de creación en inglés (ej: September 25, 2025)
  if (this.createdAt) {
    const date = new Date(this.createdAt);
    this.createdAt_en = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  next();
});

/* ====== Hooks to resync exhibition participants ====== */
// Mark if we should resync participants when status or deletedAt changes
artworkSchema.pre('save', function(next) {
  try {
    this._shouldResyncExhibitions = !!(this.isModified('status') || this.isModified('deletedAt'));
  } catch (_) {
    this._shouldResyncExhibitions = false;
  }
  next();
});

artworkSchema.post('save', async function(doc, next) {
  // If status/deletedAt changed, recompute participants for linked exhibitions
  try {
    if (!this._shouldResyncExhibitions) return next();
    const Exhibition = require('@models/exhibitionModel');
    const ArtworkModel = this.constructor;
    const exIds = Array.from(new Set((doc.exhibitions || []).map((id) => String(id))));
    if (!exIds.length) return next();

    const exhibitions = await Exhibition.find({ _id: { $in: exIds } });
    for (const ex of exhibitions) {
      const artIds = Array.from(new Set((ex.artworks || []).map((id) => String(id))));
      let artistIds = [];
      if (artIds.length) {
        // Only artists from visible artworks (approved and not trashed)
        artistIds = await ArtworkModel.find({ _id: { $in: artIds }, status: 'approved', deletedAt: null }).distinct('artist');
      }
      const artistSet = new Set((artistIds || []).filter(Boolean).map((x) => String(x)));
      const existing = Array.isArray(ex.participants) ? ex.participants : [];
      const keepNonArtist = existing.filter((p) => String((p && p.role) || '').toLowerCase() !== 'artista');
      const newArtistParticipants = Array.from(artistSet).map((uid) => ({ user: uid, role: 'artista' }));
      ex.participants = [...keepNonArtist, ...newArtistParticipants];
      await ex.save({ validateModifiedOnly: true });
    }
    return next();
  } catch (err) {
    try { console.error('artwork post-save resync participants error:', err); } catch (_) {}
    return next();
  }
});

module.exports = mongoose.model('Artwork', artworkSchema);


