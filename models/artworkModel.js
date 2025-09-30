const mongoose = require('mongoose');

// Helper de normalización (quita tildes, pasa a minúsculas, recorta)
const norm = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const STATUS = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'trashed'];
const THIRTY_DAYS = 60 * 60 * 24 * 30; // segundos

const artworkSchema = new mongoose.Schema(
  {
    /* ------ Basics ------ */
    title: { type: String, required: true, trim: true },
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
    imagePublicId: { type: String, required: true }, // ID de Cloudinary
    imageWidth_px: { type: Number }, // opcional
    imageHeight_px: { type: Number }, // opcional

    // (3) Galería de imágenes adicional
    images: [{ type: String }], // Opcional: URLs adicionales

    type: { type: String },
    size: { type: String }, // texto derivado de width_cm/height_cm
    material: { type: String },
    // (1) Validaciones adicionales para dimensiones y precio
    width_cm: { type: Number, required: true, min: 1 },
    height_cm: { type: Number, required: true, min: 1 },

    // --- Precio en USD (centavos) ---
    // Guarda siempre en centavos para evitar flotantes (ej. $3499.50 -> 349950)
    price_cents: { type: Number, required: true, min: 0, index: true },

    // Campos normalizados para búsquedas/indexación
    type_norm: { type: String, index: true },
    material_norm: { type: String, index: true },

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
artworkSchema.index({ artist: 1, status: 1 });
artworkSchema.index({ favoritesCount: -1 });
artworkSchema.index({ exhibitions: 1 });

/* Índices existentes */
artworkSchema.index({ deletedAt: 1 }, { expireAfterSeconds: THIRTY_DAYS }); // TTL: purga 30 días después de ir a la papelera
artworkSchema.index({ type_norm: 1, material_norm: 1 });

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

// artist: draft → submitted
artworkSchema.methods.submit = function () {
  if (this.status !== 'draft') return this;
  this.status = 'submitted';
  return this.save();
};

// admin: submitted → under_review
artworkSchema.methods.startReview = function (adminId) {
  if (this.status !== 'submitted') return this;
  this.status = 'under_review';
  this.review = { reviewedBy: adminId };
  return this.save();
};

// admin: under_review → approved
artworkSchema.methods.approve = function (adminId) {
  if (this.status !== 'under_review') return this;
  this.status = 'approved';
  this.review = { reviewedBy: adminId, reviewedAt: new Date() };
  return this.save();
};

// admin: under_review → rejected
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

artworkSchema.pre('save', function (next) {
  // Derivar size si hay medidas
  if (typeof this.width_cm === 'number' && typeof this.height_cm === 'number') {
    this.size = `${this.width_cm} x ${this.height_cm} cm`;
  }
  // Normalizar facetas
  this.type_norm = norm(this.type);
  this.material_norm = norm(this.material);

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

module.exports = mongoose.model('Artwork', artworkSchema);
