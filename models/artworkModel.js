// models/artworkModel.js
const mongoose = require('mongoose');

/* ---------- Allowed states ---------- */
const STATUS = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'trashed'];
const THIRTY_DAYS = 60 * 60 * 24 * 30; // segundos

const artworkSchema = new mongoose.Schema(
  {
    /* ------ Basics ------ */
    title:       { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    /* ------ Relations ------ */
    artist: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true
    },
    exhibitions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Exhibition'
    }],

    /* ------ Media & meta ------ */
    imageUrl: { type: String, required: true },
    type:     { type: String },
    size:     { type: String },
    material: { type: String },

    /* ------ Metrics (inmutables) ------ */
    views: { type: Number, default: 0, immutable: true },
    ratings: {
      average: { type: Number, default: 0, immutable: true },
      count:   { type: Number, default: 0, immutable: true }
    },
    commentsCount: { type: Number, default: 0, immutable: true },

    /* ------ Workflow ------ */
    status: { type: String, enum: STATUS, default: 'draft', index: true },
    review: {
      reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt:   { type: Date },
      rejectReason: { type: String },
      comment:      {
        type: String,
        trim: true
      }
    },

    /* ------ Soft-delete (papelera) ------ */
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', select: false }
  },
  { timestamps: true }
);

/* TTL: purge after 30 days in trash */
artworkSchema.index({ deletedAt: 1 }, { expireAfterSeconds: THIRTY_DAYS });

/* ====== Workflow helpers ====== */

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

/* ====== Trash helpers ====== */

// move to trash (soft delete)
artworkSchema.methods.moveToTrash = function (userId) {
  if (this.status === 'trashed') return this; // No hacer nada si ya está en trash
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.status = 'trashed'; 
  return this.save();
};

// restore from trash
artworkSchema.methods.restore = function () {
  if (!this.deletedAt) return this;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  this.status = 'draft'; // Or restore to previous status if you store it
  return this.save();
};

// Permitir volver a draft desde cualquier estado excepto 'trashed'
artworkSchema.methods.setDraft = function () {
  if (this.status === 'trashed') return this;
  this.status = 'draft';
  return this.save();
};

/* Public catalogue = only approved and not trashed */
artworkSchema.statics.findApproved = function (filter = {}) {
  return this.find({ status: 'approved', deletedAt: null, ...filter });
};

module.exports = mongoose.model('Artwork', artworkSchema);
