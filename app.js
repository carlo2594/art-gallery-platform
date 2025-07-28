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
const sanitize = require('@middlewares/sanitize');
const globalErrorHandler = require('@controllers/errorController');

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

// 📌 Montar TODAS las rutas desde routes/
require('./routes')(app);

// Manejo global de errores
app.use(globalErrorHandler);

module.exports = app;
