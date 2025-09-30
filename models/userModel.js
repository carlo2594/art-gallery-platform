// models/userModel.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const validator = require('validator'); 

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email: {
  type: String,
  required: true,
  unique: true,
  lowercase: true,
  validate: [validator.isEmail, 'Correo inválido'],
  select: false // <-- proteger email
},

  password: { type: String, required: true, select: false },   // hash no se envía
  role: {
    type: String,
    enum: ['artist', 'admin', 'collector'],
    default: 'collector',
    select: false
  },
  profileImage: { type: String, trim: true },
  profileImagePublicId: { type: String, trim: true },
  bio: { type: String, trim: true },
  active: { type: Boolean, default: true, select: false },
  lastLoginAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
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

module.exports = mongoose.model('User', userSchema);
