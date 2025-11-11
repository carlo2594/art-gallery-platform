
// routes/viewRoutes.js

const express = require('express');
const router = express.Router();
const viewsController = require('@controllers/viewsController');
// Middleware para vistas: redirige a login si no hay usuario
const ACCOUNT_EDIT_PATH = '/edit-profile';

const ensureLoggedInView = (req, res, next) => {
  if (res.locals && res.locals.currentUser) return next();
  const returnTo = encodeURIComponent(req.originalUrl || ACCOUNT_EDIT_PATH);
  return res.redirect(`/login?returnTo=${returnTo}`);
};
const Exhibition = require('@models/exhibitionModel');

// =================== PÁGINA DE INICIO ===================
// Si el usuario está logueado, redirigir a la home personalizada
router.get('/', (req, res, next) => {
  if (res.locals && res.locals.currentUser) {
    return res.redirect(302, '/personal/home');
  }
  return next();
}, viewsController.getHome);

// =================== AUTENTICACIÓN =====================
router.get('/login', viewsController.getLogin);
router.get('/signup', viewsController.getSignUp);   // alias consistente
router.get('/signUp', viewsController.getSignUp);   // (opcional) mantener compat
router.get('/reset-password', viewsController.getResetPassword);
router.get('/reset-link-invalid', viewsController.getResetLinkInvalid);
router.get('/forgot-password', viewsController.getForgotPassword);
router.get('/welcome', viewsController.getWelcome);

// =================== MI CUENTA =========================
router.get(ACCOUNT_EDIT_PATH, ensureLoggedInView, viewsController.getMyAccount);
// Alias antiguos
router.get('/my-account', (req, res) => res.redirect(301, ACCOUNT_EDIT_PATH));
router.get('/mi-cuenta', (req, res) => res.redirect(301, ACCOUNT_EDIT_PATH));


// =================== QUIÉNES SOMOS =====================
router.get('/about', viewsController.getAbout);

// =================== CONTACTO ==========================
router.get('/contact', viewsController.getContact);

// =================== HOME PERSONAL (USUARIO LOGUEADO) =
router.get('/personal/home', ensureLoggedInView, viewsController.getPersonalHome);

// =================== ARTISTAS ==========================
// Guard helper: requiere rol artista
const ensureArtistRoleView = (req, res, next) => {
  const cu = res.locals && res.locals.currentUser;
  if (cu && cu.role === 'artist') return next();
  return res.status(403).render('public/auth/unauthorized', {
    title: 'Acceso no autorizado · Galería del Ox',
    message: 'Debes ser artista para acceder a esta página.'
  });
};

router.get('/artists', viewsController.getArtistsView);
// IMPORTANTE: declarar rutas específicas antes del comodín ':id'
router.get('/artists/panel', ensureLoggedInView, ensureArtistRoleView, viewsController.getMyArtistPanel);
router.get('/artists/:id', viewsController.getArtistDetail);
// Alias canónico: redirige de singular a plural (previene 404 por enlaces viejos)
router.get('/artist/:id', (req, res) => {
  res.redirect(301, `/artists/${req.params.id}`);
});

// =================== APLICAR COMO ARTISTA ==============
// Página informativa y CTA para que usuarios apliquen a vender su arte
router.get('/become-artist', viewsController.getBecomeArtist);
// Alias en español
router.get('/vender-mi-arte', (req, res) => res.redirect(301, '/become-artist'));

// =================== OBRAS =============================
router.get('/artworks', viewsController.getArtworks);
router.get('/artworks/:id', viewsController.getArtworkDetail);

// =================== EXPOSICIONES ======================

router.get('/exhibitions', viewsController.getExhibitionsView);
router.get('/exhibitions/unpublished', viewsController.getExhibitionUnpublished);
// Guard: si existe pero no publicada, redirige a pagina dedicada
router.get('/exhibitions/:id', async (req, res, next) => {
  try {
    const idOrSlug = req.params.id;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(String(idOrSlug));
    const base = isObjectId ? { _id: idOrSlug, deletedAt: null } : { slug: idOrSlug, deletedAt: null };
    const ex = await Exhibition.findOne(base).select('_id status').lean();
    if (ex && ex.status !== 'published') {
      return res.redirect(303, '/exhibitions/unpublished');
    }
  } catch (_) {
    // ignore and continue
  }
  return next();
});
router.get('/exhibitions/:id', viewsController.getExhibitionDetail);

// =================== BÚSQUEDA GLOBAL ===================
router.get('/search', viewsController.getSearchResults);

// =================== GESTIÓN DE VENTAS (Admin) =========
// TODO: Implementar estos controladores en viewsController.js
// router.get('/admin/sales', viewsController.getSalesManagement);
// router.get('/admin/sales/:id', viewsController.getSaleDetail);

module.exports = router;
