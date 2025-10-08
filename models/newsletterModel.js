const mongoose = require('mongoose');
const validator = require('validator');

const newsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email es requerido'],
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Email inválido']
    // unique se define con índice explícito abajo
  },
  status: {
    type: String,
    enum: ['active', 'unsubscribed', 'bounced'],
    default: 'active',
    index: true
  },
  source: {
    type: String,
    enum: ['homepage', 'artwork_page', 'exhibition_page', 'admin'],
    default: 'homepage'
  },
  preferences: {
    newArtworks: { type: Boolean, default: true },
    exhibitions: { type: Boolean, default: true },
    artistSpotlight: { type: Boolean, default: true },
    salesAlerts: { type: Boolean, default: false }
  },
  // Metadata útil
  subscribedAt: { type: Date, default: Date.now },
  unsubscribedAt: { type: Date },
  lastEmailSent: { type: Date },
  emailCount: { type: Number, default: 0 },
  
  // Para compliance (GDPR/CAN-SPAM)
  ipAddress: { type: String },
  userAgent: { type: String },
  
  // Token para unsubscribe seguro
  unsubscribeToken: {
    type: String
    // unique y sparse se definen con índice explícito abajo
  }
}, {
  timestamps: true
});

// Índices para performance
newsletterSchema.index({ email: 1 }, { unique: true });
newsletterSchema.index({ status: 1, subscribedAt: -1 });
newsletterSchema.index({ unsubscribeToken: 1 }, { unique: true, sparse: true });

// Generar token de unsubscribe antes de guardar
newsletterSchema.pre('save', function(next) {
  if (this.isNew && !this.unsubscribeToken) {
    this.unsubscribeToken = require('crypto').randomBytes(32).toString('hex');
  }
  next();
});

// Métodos útiles
newsletterSchema.methods.unsubscribe = function() {
  this.status = 'unsubscribed';
  this.unsubscribedAt = new Date();
  return this.save();
};

newsletterSchema.statics.getActiveSubscribers = function(preferences = {}) {
  const query = { status: 'active' };
  
  // Filtrar por preferencias si se especifican
  if (preferences.newArtworks) query['preferences.newArtworks'] = true;
  if (preferences.exhibitions) query['preferences.exhibitions'] = true;
  if (preferences.artistSpotlight) query['preferences.artistSpotlight'] = true;
  if (preferences.salesAlerts) query['preferences.salesAlerts'] = true;
  
  return this.find(query).select('email preferences unsubscribeToken');
};

module.exports = mongoose.model('Newsletter', newsletterSchema);