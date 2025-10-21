const mongoose = require("mongoose");
const { norm } = require("@utils/normalizer");

const exhibitionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String }, // índice único definido explícitamente abajo
  description: String,
  coverImage: String,

  location: {
    type: {
      type: String,
      enum: ["physical", "virtual"],
      required: false,
    },
    address: { type: String }, // solo si es physical
    url: { type: String }, // solo si es virtual
  },

  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ["draft", "published", "archived", "trashed"],
    default: "draft",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  participants: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: { type: String }, // Ej: 'curador', 'artista', etc.
    },
  ],
  artworks: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artwork",
    },
  ],
  /* ------ Soft-delete (papelera) ------ */
  deletedAt: { type: Date, default: null },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    select: false,
  },
  createdAt: { type: Date, default: Date.now },
});

/* ---------- Índices optimizados para viewsController ---------- */
// 1. Índice principal para consultas de exposiciones (getExhibitionsView, getSearchResults)
exhibitionSchema.index({
  status: 1,
  startDate: -1,
  endDate: -1,
});

// 2. Índice para búsqueda por slug (si se implementa)
exhibitionSchema.index({ slug: 1 }, { unique: true, sparse: true });

// 3. Índice para consultas por tipo de ubicación
exhibitionSchema.index({
  status: 1,
  "location.type": 1,
  startDate: -1,
});

// 4. Índice para búsqueda de texto
exhibitionSchema.index({
  title: "text",
  description: "text",
});

// 5. Índice para consultas por artworks y participantes
exhibitionSchema.index({ artworks: 1 });
exhibitionSchema.index({ "participants.user": 1 });

// 6. TTL: purga 30 días después de moverse a la papelera
exhibitionSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

/* ---------------------- Hooks para slug ---------------------- */
exhibitionSchema.pre("save", function (next) {
  if (!this.isModified("title")) return next();
  const base = String(this.title || "").trim();
  if (!base) return next();
  // slug simple: normaliza, reemplaza espacios y caracteres no alfanuméricos
  const simple = norm(base)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  this.slug = simple || undefined;
  next();
});

/* ---------------------- Hooks para participants ---------------------- */
// Mantiene `participants` (role: 'artista') sincronizado con los artistas de `artworks`
exhibitionSchema.pre('save', async function(next){
  try {
    if (!this.isModified('artworks')) return next();
    const Artwork = require('./artworkModel');
    const ids = Array.from(new Set((this.artworks || []).map((x) => String(x))));
    let artistIds = [];
    if (ids.length) {
      artistIds = await Artwork.find({ _id: { $in: ids } }).distinct('artist');
    }
    const artistSet = new Set((artistIds || []).filter(Boolean).map((x) => String(x)));
    const existing = Array.isArray(this.participants) ? this.participants : [];
    const keepNonArtist = existing.filter((p) => String((p && p.role) || '').toLowerCase() !== 'artista');
    const newArtistParticipants = Array.from(artistSet).map((uid) => ({ user: uid, role: 'artista' }));
    this.participants = [...keepNonArtist, ...newArtistParticipants];
    return next();
  } catch (err) {
    try { console.error('exhibition participants sync error:', err); } catch(_) {}
    return next();
  }
});

module.exports = mongoose.model("Exhibition", exhibitionSchema);
