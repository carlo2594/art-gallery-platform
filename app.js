// app.js

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const xss = require('xss-clean');
const sanitize = require('./middlewares/sanitize');




require('dotenv').config();

const app = express();

// Seguridad básica
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cookieParser());

app.use(xss());

app.use(sanitize);

// Vistas
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Parsers
app.use(express.json({ limit: '10kb' }));
//app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Ruta principal
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Galería del Ox',
  });
});

// Error 404
app.use((req, res, next) => {
  res.status(404).render('error', {
    title: 'Página no encontrada',
    msg: 'Esta ruta no existe en Galería del Ox.',
  });
});

// Manejo global de errores (si querés uno propio)
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).render('error', {
    title: 'Error interno',
    msg: 'Ocurrió un problema inesperado.',
  });
});

module.exports = app;
