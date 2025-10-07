# Copilot Instructions for Galeria-del-Ox-Node

## What this is
- Node.js backend for an art gallery. Stack: Express, Mongoose (MongoDB), Pug views, Cloudinary (media), Nodemailer (email).
- Entry: `server.js` connects to MongoDB with retry, then boots Express (`app.js`). Dev: `npm run dev`; Prod: `npm start`.
- API prefix: `/api/v1/`. Dual routing: HTML views (`/`, `/admin`) and JSON API (see `routes/index.js`).

## Architecture and routing
- Folders: `controllers/`, `models/`, `routes/`, `middlewares/`, `services/`, `utils/`, `views/`, `public/`.
- Module aliases: `@models`, `@controllers`, `@routes`, `@utils`, `@middlewares`, `@services` (see `_moduleAliases` in `package.json`).
- `app.js` middleware: helmet, cookie-parser, `attachUserToViews`, `xss-clean`, custom `sanitize`, and `ensureDbReady` (blocks requests until Mongo is connected). Static files in `public/`; Pug views in `views/`.
- `server.js` uses `connectWithRetry()` and reconnects on `disconnected`.

## Conventions to follow
- Wrap async controllers with `utils/catchAsync`; throw `utils/appError` for HTTP errors.
- Send JSON via `utils/sendResponse(res, data, message?, statusCode?, extra?)` → standardized `{ status, message, data }`.
- Auth uses cookie-based JWT only. Protect endpoints with `middlewares/requireUser` (reads `req.cookies.jwt`).
- HTML vs JSON: use `utils/http.wantsHTML(req)` to decide redirect vs JSON body.

## Auth flow (controllers/authController.js)
- Signup: creates user with temp password and emails a create-password link to `/reset-password?uid=...&token=...&type=new`.
- Login: sets `jwt` cookie; supports remember-me via `utils/authUtils.parseRememberMe` + `getJwtCookieOptions`.
- Forgot/reset: issues token (15 min for reset, 24h for first password). `POST /api/v1/auth/password/reset` expects `{ uid, token, newPassword, remember? }` and logs the user in.
- Rate limiting on `/signup` and `/login` via `middlewares/rateLimiter`.

## Artworks domain (controllers/artworkController.js)
- Status workflow: `draft → submitted → under_review → approved/rejected`; admin transitions via `/start-review`, `/approve`, `/reject`. Email via `services/emailTemplates` + `services/mailer`.
- Soft delete: models use `deletedAt`; lifecycle helpers like `moveToTrash` and `restoreArtwork`.
- Pricing: persist as `price_cents`. Accept request `amount` (USD string) or `price_cents` (int); convert with `utils/priceInput.toCentsOrThrow`.
- Images: upload using `utils/cloudinaryImage.upload`; aspect check via `utils/aspectUtils.verifyAspect`. Behavior controlled by `getAspectPolicy()`; may pad/fill via Cloudinary. Env: `ASPECT_TOLERANCE`, `CLOUDINARY_PAD`.
- Normalized filters: controllers query on normalized fields (e.g., `type_norm`, `technique_norm`) for accent-insensitive search.

## Views and forms
- Login/Signup page: `views/public/loginSignUp.pug` posts to `/api/v1/auth/signup` or `/api/v1/auth/login`. Remember-me checkbox name: `remember`.
- Reset password page: `views/public/resetPassword.pug` posts to `/api/v1/auth/password/reset` with hidden `uid` and `token`.

## Integrations and env
- Cloudinary: `services/cloudinary.js`, helpers in `utils/cloudinaryImage.js`. Email: `services/mailer.js`.
- Required env (non-exhaustive): `DATABASE`, `DATABASE_PASSWORD`, `JWT_SECRET`, `FRONTEND_URL`, Cloudinary creds, mailer creds. Uses `dotenv`.

## Add something new
- New API: create controller in `controllers/` (use `catchAsync`, `sendResponse`), add route in `routes/api/*.js`, mount in `routes/index.js` under `/api/v1/...`.
- New view: add Pug in `views/`, add route in `routes/views/*`, mount in `routes/index.js` under `/` or `/admin`.

If you spot divergences (pagination behavior, normalization helpers, etc.), call them out so we can update this guide.
