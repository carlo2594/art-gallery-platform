# Copilot Instructions for Galeria-del-Ox-Node

## Project Overview
- **Type:** Node.js backend for an art gallery platform
- **Stack:** Express, Mongoose (MongoDB), Pug (views), Cloudinary (media), Nodemailer (email)
- **Entry Point:** `server.js` (connects to MongoDB, starts Express)
- **App Setup:** `app.js` (middleware, view engine, static files, routes)

## Key Architectural Patterns
- **Modular Structure:**
  - `controllers/` — Business logic for each resource (e.g., `artworkController.js`)
  - `models/` — Mongoose schemas (e.g., `artworkModel.js`)
  - `routes/` — API and view routes, grouped by resource and type
  - `middlewares/` — Custom Express middleware (auth, sanitization, etc.)
  - `services/` — Integrations (Cloudinary, mail, stats)
  - `utils/` — Helpers (error handling, normalization, JWT, etc.)
  - `views/` — Pug templates for public and admin UIs
- **API Versioning:** All REST endpoints are under `/api/v1/`
- **Dual Route System:** Both API routes (`/api/v1/`) and view routes (`/`, `/admin`) in separate files
- **Database Resilience:** `server.js` includes retry logic for MongoDB connections with automatic reconnection
- **DB Ready Middleware:** `ensureDbReady` blocks requests until MongoDB is connected (prevents 503 errors)
- **Soft Deletes:** Many models use a `deletedAt` field for soft-deletion (not hard delete)
- **Status Workflow:** Artworks flow through states: `draft` → `submitted` → `under_review` → `approved`/`rejected`
- **Normalization:** Search/filter fields are normalized (e.g., `type_norm`) for accent-insensitive queries using NFD normalization

## Developer Workflows
- **Start (dev):** `npm run dev` (uses Node's `--watch` flag for auto-reloads)
- **Start (prod):** `npm start`
- **Environment:** Requires `.env` with MongoDB credentials, Cloudinary config, and email settings
- **No built-in test scripts** (add tests as needed)
- **Seed Data:** `node scripts/seedTestData.js` (drops DB and creates test data)
- **Status Updates:** Artworks have dedicated endpoints for status transitions (e.g., `/start-review`, `/approve`)

## Project-Specific Conventions
- **Module Aliases:** Use `@models`, `@controllers`, etc. (see `_moduleAliases` in `package.json`)
- **Error Handling:** Use `catchAsync` and `AppError` for async/HTTP errors
- **Response Pattern:** Use `sendResponse` utility for consistent API responses
- **Authorization:** Use `requireUser`, `isOwner`, and `restrictTo` middleware for access control
- **Image Uploads:** Handled via Cloudinary (see `utils/cloudinaryImage.js`)
- **Pagination:** Public artwork search uses paginated endpoints (see `artworkController.js`)
- **Field Normalization:** Use `norm()` helper in models for accent-insensitive search (NFD normalization)
- **Status Constants:** Define allowed statuses as arrays (e.g., `ALLOWED_STATUS` in controllers)
- **Temporary File Cleanup:** Image upload utilities automatically delete temp files after Cloudinary upload

## Integration Points
- **Cloudinary:** For image storage (see `services/cloudinary.js`)
- **Nodemailer:** For email (see `services/mailer.js`)
- **MongoDB:** Mongoose models, connection logic in `server.js`
- **Connection Resilience:** Auto-retry connection logic with `connectWithRetry()` function
- **Request Blocking:** `ensureDbReady` middleware prevents 503 errors during DB startup

## Examples
- **Add a new API route:**
  - Create controller in `controllers/`
  - Add route in `routes/api/`
  - Register in `routes/index.js`
- **Add a new view:**
  - Add Pug template in `views/`
  - Add route in `routes/views/`

## References
- **Key files:** `server.js`, `app.js`, `routes/index.js`, `controllers/`, `models/`
- **For patterns:** See `artworkController.js` for search, status, and error conventions

---
For questions about conventions or unclear patterns, check the relevant controller/model or ask for clarification.
