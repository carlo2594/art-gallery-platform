// server.js
require('module-alias/register');
require('dotenv').config();

const mongoose = require('mongoose');
const app      = require('./app');

const DB   = process.env.DATABASE.replace('<db_password>', process.env.DATABASE_PASSWORD);
const PORT = process.env.PORT || 3000;

/* ⚙️  Opciones de conexión (reduce los tiempos de espera) */
const mongooseOpts = {
  serverSelectionTimeoutMS: 8000, // 8 s para encontrar un nodo
  socketTimeoutMS: 45000,         // 45 s para operaciones largas
};

/* 🔄 Función recursiva de conexión con reintentos */
const connectWithRetry = () => {
  mongoose
    .connect(DB, mongooseOpts)
    .then(() => {
  // ...existing code...
      /* Arrancamos Express solo una vez */
      if (!app.listening) {
        app.listen(PORT, () => {
          app.listening = true; // marca para no iniciar dos veces
          // ...existing code...
        });
      }
    })
    .catch(err => {
      console.error('⚠️  No se pudo conectar a MongoDB:', err.message);
  // ...existing code...
      setTimeout(connectWithRetry, 5000);
    });
};

connectWithRetry();

/* Reintenta si la conexión existente se cae luego */
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  Conexión a MongoDB perdida. Reintentando…');
  if (!mongoose.connection.readyState) connectWithRetry();
});
