// server.js
require('module-alias/register');
const fs = require('fs');
const path = require('path');

const ENV = (process.env.NODE_ENV || 'development').toLowerCase();
const envPath = path.join(__dirname, `.env.${ENV}`);

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const mongoose = require('mongoose');
const app = require('./app');

const databaseTemplate = process.env.DATABASE || process.env.MONGODB_URI;

if (!databaseTemplate) {
  throw new Error('Missing DATABASE env variable. Create a .env file and set DATABASE.');
}

const DB = databaseTemplate.includes('<db_password>')
  ? (() => {
      if (!process.env.DATABASE_PASSWORD) {
        throw new Error(
          'DATABASE template expects <db_password> placeholder but DATABASE_PASSWORD is not set.'
        );
      }
      return databaseTemplate.replace('<db_password>', process.env.DATABASE_PASSWORD);
    })()
  : databaseTemplate;
const PORT = process.env.PORT || 3000;

// Opciones de conexión (reduce los tiempos de espera)
const mongooseOpts = {
  serverSelectionTimeoutMS: 8000, // 8 s para encontrar un nodo
  socketTimeoutMS: 45000, // 45 s para operaciones largas
  maxPoolSize: 20, // pool de conexiones
  dbName: process.env.DB_NAME, // seleccionar BD por entorno (dev/prod)
};

// Función recursiva de conexión con reintentos
const connectWithRetry = () => {
  mongoose
    .connect(DB, mongooseOpts)
    .then(() => {
      console.log('✅ MongoDB conectada');

      // Arrancamos Express solo una vez
      if (!app.listening) {
        app.listen(PORT, () => {
          app.listening = true; // marca para no iniciar dos veces

          const deploymentUrl =
            process.env.RENDER_EXTERNAL_URL ||
            (process.env.RENDER_EXTERNAL_HOSTNAME
              ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
              : `http://localhost:${PORT}`);

          console.log(`🚀 Servidor en ${deploymentUrl}`);
        });
      }
    })
    .catch((err) => {
      console.error('⚠️ No se pudo conectar a MongoDB:', err.message);
      console.log('⏳ Reintento en 5 segundos...');
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

// Reintenta si la conexión existente se cae luego
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Conexión a MongoDB perdida. Reintentando...');
  if (!mongoose.connection.readyState) connectWithRetry();
});

