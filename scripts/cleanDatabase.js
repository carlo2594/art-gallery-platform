// Script para limpiar completamente la base de datos y recrear índices
require('module-alias/register');
require('dotenv').config();
const mongoose = require('mongoose');

const DB = process.env.DATABASE.replace('<db_password>', process.env.DATABASE_PASSWORD);

async function cleanDatabase() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(DB);
    console.log('✅ Conectado a MongoDB');

    const db = mongoose.connection.db;
    
    // Obtener todas las colecciones
    const collections = await db.listCollections().toArray();
    console.log(`📋 Encontradas ${collections.length} colecciones`);

    // Eliminar todas las colecciones (esto también elimina todos los índices)
    for (const collection of collections) {
      const collectionName = collection.name;
      console.log(`🗑️  Eliminando colección: ${collectionName}`);
      await db.collection(collectionName).drop();
    }

    console.log('✅ Todas las colecciones eliminadas');
    console.log('✅ Todos los índices eliminados');
    
    // Cerrar conexión
    await mongoose.connection.close();
    console.log('✅ Base de datos limpiada completamente');
    console.log('💡 Ahora puedes ejecutar el seedTestData.js para recrear todo');
    
  } catch (error) {
    console.error('❌ Error limpiando la base de datos:', error.message);
    process.exit(1);
  }
}

cleanDatabase();