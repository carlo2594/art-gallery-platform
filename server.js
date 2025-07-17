// server.js

require('module-alias/register');
require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');

// Conexión a MongoDB
const DB = process.env.DATABASE.replace('<db_password>', process.env.DATABASE_PASSWORD);

mongoose
  .connect(DB)
  .then(() => console.log('✅ DB conectado exitosamente'))
  .catch(err => {
    console.error('❌ Error al conectar DB:', err);
    process.exit(1);
  });

// Arrancar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
