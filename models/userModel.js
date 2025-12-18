// models/userModel.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const validator = require('validator'); 
const {
  isModeratePassword,
  MODERATE_PASSWORD_MESSAGE
} = require('@utils/passwordPolicy');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: 20 },
  firstName: { type: String, trim: true, maxlength: 20 },
  lastName:  { type: String, trim: true, maxlength: 20 },
  email: {
  type: String,
  required: true,
  unique: true,
  lowercase: true,
  validate: [validator.isEmail, 'Correo inválido'],
  select: false // <-- proteger email
},
  slug: {
    type: String,
    trim: true
    // unique se define con índice explícito abajo
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false,
    validate: {
      validator: function (value) {
        if (!this.isModified('password')) return true;
        return isModeratePassword(value);
      },
      message: MODERATE_PASSWORD_MESSAGE
    }
  },   // hash no se envía
  roles: {
    type: [{
      type: String,
      enum: ['artist', 'admin', 'collector']
    }],
    default: ['collector'],
    select: false,
    validate: {
      validator: function (value) {
        return Array.isArray(value) && value.length > 0;
      },
      message: 'El usuario debe tener al menos un rol asignado'
    },
    set: function (value) {
      const incoming = Array.isArray(value) ? value : (value ? [value] : []);
      const deduped = Array.from(new Set(incoming.filter(Boolean)));
      return deduped.length ? deduped : ['collector'];
    }
  },
  profileImage: { type: String, trim: true, maxlength: 500 },
  profileImagePublicId: { type: String, trim: true, maxlength: 200 },
  coverImage: { type: String, trim: true, maxlength: 500 },
  coverImagePublicId: { type: String, trim: true, maxlength: 200 },
  bio: { type: String, trim: true, maxlength: 400 },
  headline: { type: String, trim: true, maxlength: 80 },
  location: { type: String, trim: true, maxlength: 100 },
  website: { type: String, trim: true, maxlength: 200 },
  country: { type: String, trim: true, maxlength: 2 },
  social: {
    instagram: { type: String, trim: true, maxlength: 80 },
    x: { type: String, trim: true, maxlength: 80 },
    facebook: { type: String, trim: true, maxlength: 80 },
    linkedin: { type: String, trim: true, maxlength: 80 },
    youtube: { type: String, trim: true, maxlength: 80 },
    tiktok: { type: String, trim: true, maxlength: 80 }
  },
  // Métrica pública
  followersCount: { type: Number, default: 0 },
  active: { type: Boolean, default: true, select: false },
  lastLoginAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('validate', function (next) {
  if (!Array.isArray(this.roles) || this.roles.length === 0) {
    this.roles = ['collector'];
  }
  next();
});

/* ---------- Índices optimizados para viewsController ---------- */
// 1. Índice único para slug solo (para garantizar unicidad global)
userSchema.index({ slug: 1 }, { unique: true, sparse: true });

// 2. Índice para búsqueda de artistas (getArtistsView, getSearchResults)
userSchema.index({ 
  roles: 1, 
  name: 1, 
  createdAt: -1 
});

// 3. Índice para búsqueda de texto en nombre y bio
userSchema.index({ 
  name: 'text', 
  bio: 'text' 
});

// Nota: El índice para email único ya existe implícitamente por unique: true en la definición del campo

/* ---------- Función para generar slug ---------- */
function generateSlug(name) {
  return name
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

/* ---------- Middleware para generar slug único ---------- */
userSchema.pre('save', async function (next) {
  // Generar slug si es nuevo documento o si cambió el nombre
  if (this.isNew || this.isModified('name')) {
    const baseSlug = generateSlug(this.name);
    let slug = baseSlug;
    let counter = 1;

    // Verificar si el slug ya existe y generar uno único
    while (await this.constructor.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    this.slug = slug;
  }
  
  next();
});

/* ---------- Hash de contraseña ---------- */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12); // 12 salt rounds
  // Si no hay name, lo iguala al email
  if (!this.name && this.email) {
    this.name = this.email;
  }
  next();
});

/* ---------- Comparar contraseña ---------- */
userSchema.methods.correctPassword = function (candidatePassword) {
  if (!this.password) return false;            // evita bcrypt error si el hash no está presente
  return bcrypt.compare(candidatePassword, this.password);
};

// Recalcular contador de seguidores
userSchema.statics.recalculateFollowersCount = async function (userId) {
  const Follow = require('@models/followModel');
  const count = await Follow.countDocuments({ artist: userId });
  await this.findByIdAndUpdate(userId, { followersCount: count });
  return count;
};

module.exports = mongoose.model('User', userSchema);
