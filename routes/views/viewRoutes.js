
// routes/viewRoutes.js

const express = require('express');
const router = express.Router();
const viewsController = require('@controllers/viewsController');
// Middleware para vistas: redirige a login si no hay usuario
const ensureLoggedInView = (req, res, next) => {
  if (res.locals && res.locals.currentUser) return next();
  const returnTo = encodeURIComponent(req.originalUrl || '/my-account');
  return res.redirect(`/login?returnTo=${returnTo}`);
};
const Exhibition = require('@models/exhibitionModel');

// =================== PÁGINA DE INICIO ===================
router.get('/', viewsController.getHome);

// =================== AUTENTICACIÓN =====================
router.get('/login', viewsController.getLogin);
router.get('/signup', viewsController.getSignUp);   // alias consistente
router.get('/signUp', viewsController.getSignUp);   // (opcional) mantener compat
router.get('/reset-password', viewsController.getResetPassword);
router.get('/reset-link-invalid', viewsController.getResetLinkInvalid);
router.get('/forgot-password', viewsController.getForgotPassword);
router.get('/welcome', viewsController.getWelcome);

// =================== MI CUENTA =========================
router.get('/my-account', ensureLoggedInView, viewsController.getMyAccount);
// Alias antiguo en español
router.get('/mi-cuenta', (req, res) => res.redirect(301, '/my-account'));


// =================== QUIÉNES SOMOS =====================
router.get('/about', viewsController.getAbout);

// =================== CONTACT (ENGLISH) =================
router.get('/contact', viewsController.getContact);

// =================== ARTISTAS ==========================
router.get('/artists', viewsController.getArtistsView);
router.get('/artists/:id', viewsController.getArtistDetail);
// Alias canónico: redirige de singular a plural (previene 404 por enlaces viejos)
router.get('/artist/:id', (req, res) => {
  res.redirect(301, `/artists/${req.params.id}`);
});

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
