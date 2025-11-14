// app.js
const express       = require('express');
const path          = require('path');
const helmet        = require('helmet');
const compression   = require('compression');
const cookieParser  = require('cookie-parser');
const attachUserToViews = require('./middlewares/attachUserToViews');
const xss           = require('xss-clean');
const morgan        = require('morgan');

const sanitize            = require('@middlewares/sanitize');
const ensureDbReady       = require('@middlewares/ensureDbReady'); // ⬅️ nuevo middleware
const globalErrorHandler  = require('@controllers/errorController');

require('dotenv').config();

const app = express();

/* --------------------- Middlewares globales --------------------- */

// Habilitar cache de vistas en producción
if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
  try { app.set('view cache', true); } catch (_) {}
}

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
// Compresión HTTP para respuestas más ligeras
app.use(compression());
app.use(cookieParser());
app.use(attachUserToViews);
app.use(xss());
app.use(sanitize);

// Meta/URL helpers disponibles en todas las vistas
app.use((req, res, next) => {
  try {
    const envUrl = process.env.FRONTEND_URL;
    const hostUrl = `${req.protocol}://${req.get('host')}`;
    res.locals.siteUrlPrefix = (envUrl && /^https?:\/\//i.test(envUrl)) ? envUrl : hostUrl;
  } catch (_) {
    // noop
  }
  next();
});

// ⛔️ Bloquear peticiones hasta que la BD esté conectada
app.use(ensureDbReady);

// Vistas
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.locals.basedir = path.join(__dirname, 'views'); // ← añadimos esto


// Archivos estáticos (forzar charset UTF-8 en JS/CSS)
const setUtf8Headers = (res, filePath) => {
  try {
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    else if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    // Cache estático razonable para activos comunes
    if (/\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 días
    }
  } catch (_) {}
};
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: setUtf8Headers, maxAge: '7d' }));
// Servir Bootstrap desde node_modules para CSS/JS locales
app.use('/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist'), { setHeaders: setUtf8Headers, maxAge: '7d' }));

// admin.js estático concatenado en /public/js/admin.js

// Parsers
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // necesario para procesar formularios HTML

/* ----------------------- Rutas principales ---------------------- */
require('./routes')(app);

/* -------------------- Manejo global de errores ------------------ */
app.use(globalErrorHandler);

module.exports = app;
