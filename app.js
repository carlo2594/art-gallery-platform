// app.js
const express       = require('express');
const path          = require('path');
const helmet        = require('helmet');
const cookieParser  = require('cookie-parser');
const xss           = require('xss-clean');
const morgan        = require('morgan');

const sanitize            = require('@middlewares/sanitize');
const ensureDbReady       = require('@middlewares/ensureDbReady'); // ⬅️ nuevo middleware
const globalErrorHandler  = require('@controllers/errorController');

require('dotenv').config();

const app = express();

/* --------------------- Middlewares globales --------------------- */

// Logging en desarrollo
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Seguridad HTTP
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(cookieParser());
app.use(xss());
app.use(sanitize);

// ⛔️ Bloquear peticiones hasta que la BD esté conectada
app.use(ensureDbReady);

// Vistas
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.locals.basedir = path.join(__dirname, 'views'); // ← añadimos esto


// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Parsers
app.use(express.json({ limit: '10kb' }));
// app.use(express.urlencoded({ extended: true, limit: '10kb' })); // si vas a procesar formularios

/* ----------------------- Rutas principales ---------------------- */
require('./routes')(app);

/* -------------------- Manejo global de errores ------------------ */
app.use(globalErrorHandler);

module.exports = app;
