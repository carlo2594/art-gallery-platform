# Copilot Instructions for Galeria-del-Ox-Node

## Overview
This is a Node.js backend for an art gallery, using Express, Mongoose (MongoDB), Pug for server-rendered views, Cloudinary for media, and Nodemailer for email. The codebase is structured for both API and HTML view delivery, with clear separation of concerns and robust error handling.

## Architecture
- **Entry point:** `server.js` connects to MongoDB (with retry logic), then starts Express via `app.js`.
- **API prefix:** All JSON APIs are under `/api/v1/`. HTML views are served at `/` and `/admin`.
- **Key folders:**
	- `controllers/` (business logic)
	- `models/` (Mongoose schemas)
	- `routes/` (API and view routers)
	- `middlewares/` (Express middleware)
	- `services/` (external integrations)
	- `utils/` (helpers, error handling, normalization)
	- `views/` (Pug templates)
	- `public/` (static assets)
- **Module aliases:** Use `@models`, `@controllers`, etc. (see `_moduleAliases` in `package.json`).

## Developer Workflows
- **Start (dev):** `npm run dev` (uses nodemon)
- **Start (prod):** `npm start`
- **Database scripts:** See `scripts/` for seeding, cleaning, and slug generation.
- **No built-in test suite** (as of this writing).

## Conventions & Patterns
- **Async controllers:** Always wrap with `utils/catchAsync`.
- **Error handling:** Throw with `utils/appError`. Use `utils/sendResponse` for all JSON responses: `{ status, message, data }`.
- **Auth:** Cookie-based JWT only. Use `middlewares/requireUser` for protected routes. Check `req.cookies.jwt`.
- **HTML vs JSON:** Use `utils/http.wantsHTML(req)` to branch between redirect and JSON response.
- **Soft delete:** Models use `deletedAt` for trash/restore. See helpers like `moveToTrash`.
- **Normalization:** Query on normalized fields (e.g., `type_norm`) for accent-insensitive search.
- **Pricing:** Store as `price_cents` (int). Accept either `amount` (USD string) or `price_cents` in requests; convert with `utils/priceInput.toCentsOrThrow`.
- **Image upload:** Use `utils/cloudinaryImage.upload`. Aspect ratio checks via `utils/aspectUtils.verifyAspect`. Behavior controlled by `getAspectPolicy()` and env vars (`ASPECT_TOLERANCE`, `CLOUDINARY_PAD`).

## Auth Flow
- **Signup:** Creates user with temp password, emails create-password link (`/reset-password?uid=...&token=...&type=new`).
- **Login:** Sets `jwt` cookie. Remember-me via `utils/authUtils.parseRememberMe` and `getJwtCookieOptions`.
- **Password reset:** Token (15 min for reset, 24h for first password). `POST /api/v1/auth/password/reset` expects `{ uid, token, newPassword, remember? }`.
- **Rate limiting:** On `/signup` and `/login` via `middlewares/rateLimiter`.

## Artworks Domain
- **Status workflow:** `draft → submitted → under_review → approved/rejected`. Admin transitions via `/start-review`, `/approve`, `/reject` (see `controllers/artworkController.js`).
- **Email notifications:** Use `services/emailTemplates` and `services/mailer`.

## Views & Forms
- **Login/Signup:** `views/public/loginSignUp.pug` posts to `/api/v1/auth/signup` or `/api/v1/auth/login`. Remember-me checkbox: `remember`.
- **Reset password:** `views/public/resetPassword.pug` posts to `/api/v1/auth/password/reset` with hidden `uid` and `token`.

## Integrations & Env
- **Cloudinary:** `services/cloudinary.js`, helpers in `utils/cloudinaryImage.js`.
- **Email:** `services/mailer.js`.
- **Env vars:** `DATABASE`, `DATABASE_PASSWORD`, `JWT_SECRET`, `FRONTEND_URL`, Cloudinary and mailer creds. Uses `dotenv`.

## Adding Features
- **New API:** Create controller in `controllers/` (wrap with `catchAsync`, use `sendResponse`), add route in `routes/api/*.js`, mount in `routes/index.js` under `/api/v1/...`.
- **New view:** Add Pug file in `views/`, add route in `routes/views/*`, mount in `routes/index.js` under `/` or `/admin`.

If you spot divergences (e.g., pagination, normalization), update this guide.
