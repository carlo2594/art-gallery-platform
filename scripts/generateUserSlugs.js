// Script para generar slugs para usuarios existentes
const fs = require('fs');
const path = require('path');
const ENV = (process.env.NODE_ENV || 'development').toLowerCase();
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, `.env.${ENV}`);
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}
const mongoose = require('mongoose');
const User = require('../models/userModel');

const DB = process.env.DATABASE.replace('<db_password>', process.env.DATABASE_PASSWORD);

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

async function generateUserSlugs() {
  try {
    await mongoose.connect(DB);
    console.log('Conectado a la base de datos');

    // Buscar usuarios sin slug
    const usersWithoutSlug = await User.find({ slug: { $exists: false } }).select('+role name');
    
    console.log(`Encontrados ${usersWithoutSlug.length} usuarios sin slug`);

    for (const user of usersWithoutSlug) {
      const baseSlug = generateSlug(user.name);
      let slug = baseSlug;
      let counter = 1;

      // Verificar si el slug ya existe y generar uno único
      while (await User.findOne({ slug, _id: { $ne: user._id } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Actualizar el usuario con el slug
      await User.findByIdAndUpdate(user._id, { slug });
      console.log(`✓ Usuario "${user.name}" → slug: "${slug}"`);
    }

    console.log('✅ Slugs generados exitosamente');
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error generando slugs:', error);
    process.exit(1);
  }
}

generateUserSlugs();
