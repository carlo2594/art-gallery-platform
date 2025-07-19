// app.js

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const xss = require('xss-clean');
const morgan = require('morgan');

require('dotenv').config();
const app = express();

// Middlewares personalizados
const sanitize = require('@middlewares/security/sanitize');
const globalErrorHandler = require('@middlewares/errors/errorController');
const notFound = require('@middlewares/errors/notFound');

// Logger en desarrollo
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Seguridad HTTP
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
// app.use(express.urlencoded({ extended: true, limit: '10kb' })); // si necesitás formularios

// Ruta principal
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Galería del Ox',
  });
});

// 📌 Montar rutas API desde routes/index.js
require('./routes')(app);

// Middleware 404 para API
app.use('/api', notFound);

// Middleware 404 para vistas
app.use((req, res, next) => {
  res.status(404).render('error', {
    title: 'Página no encontrada',
    msg: 'Esta ruta no existe en Galería del Ox.',
  });
});

// Manejo global de errores
app.use(globalErrorHandler);

module.exports = app;
