// Script para generar slugs para todas las obras existentes
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
require('module-alias/register');

const mongoose = require('mongoose');
const Artwork = require('@models/artworkModel');

const DB = process.env.DATABASE.replace('<db_password>', process.env.DATABASE_PASSWORD);

// Función para generar slug (igual que en el modelo)
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

async function generateSlugsForExistingArtworks() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(DB);
    console.log('✅ Conectado a MongoDB');

    // Obtener todas las obras que no tienen slug
    const artworksWithoutSlug = await Artwork.find({ 
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: '' }
      ]
    });

    console.log(`📊 Encontradas ${artworksWithoutSlug.length} obras sin slug`);

    if (artworksWithoutSlug.length === 0) {
      console.log('✅ Todas las obras ya tienen slug');
      process.exit(0);
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const artwork of artworksWithoutSlug) {
      try {
        let baseSlug = generateSlug(artwork.title);
        let slug = baseSlug;
        let counter = 1;
        
        // Verificar unicidad del slug
        while (await Artwork.findOne({ slug, _id: { $ne: artwork._id } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
        
        // Actualizar la obra con el nuevo slug
        await Artwork.updateOne(
          { _id: artwork._id },
          { $set: { slug } }
        );
        
        console.log(`✅ ${processedCount + 1}/${artworksWithoutSlug.length}: "${artwork.title}" → "${slug}"`);
        processedCount++;
        
      } catch (error) {
        console.error(`❌ Error procesando "${artwork.title}":`, error.message);
        errorCount++;
      }
    }

    console.log('\n📈 Resumen:');
    console.log(`✅ Procesadas exitosamente: ${processedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📊 Total: ${artworksWithoutSlug.length}`);

    if (errorCount === 0) {
      console.log('\n🎉 ¡Migración completada exitosamente!');
    } else {
      console.log('\n⚠️  Migración completada con algunos errores');
    }

  } catch (error) {
    console.error('💥 Error durante la migración:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

// Ejecutar el script
if (require.main === module) {
  generateSlugsForExistingArtworks();
}

module.exports = generateSlugsForExistingArtworks;
