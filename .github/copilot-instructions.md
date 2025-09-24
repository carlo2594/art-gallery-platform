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
- **Soft Deletes:** Many models use a `deletedAt` field for soft-deletion (not hard delete)
- **Status Workflow:** Artworks and other resources use status fields (e.g., `draft`, `approved`, `trashed`)
- **Normalization:** Search/filter fields are normalized (e.g., `type_norm`) for accent-insensitive queries

## Developer Workflows
- **Start (dev):** `npm run dev` (auto-reloads on changes)
- **Start (prod):** `npm start`
- **Environment:** Requires `.env` with MongoDB credentials (see `server.js`)
- **No built-in test scripts** (add tests as needed)
- **Seed Data:** See `scripts/seedTestData.js`

## Project-Specific Conventions
- **Module Aliases:** Use `@models`, `@controllers`, etc. (see `_moduleAliases` in `package.json`)
- **Error Handling:** Use `catchAsync` and `AppError` for async/HTTP errors
- **Response Pattern:** Use `sendResponse` utility for consistent API responses
- **Authorization:** Use `requireUser`, `isOwner`, and `restrictTo` middleware for access control
- **Image Uploads:** Handled via Cloudinary (see `utils/cloudinaryImage.js`)
- **Pagination:** Public artwork search uses paginated endpoints (see `artworkController.js`)

## Integration Points
- **Cloudinary:** For image storage (see `services/cloudinary.js`)
- **Nodemailer:** For email (see `services/mailer.js`)
- **MongoDB:** Mongoose models, connection logic in `server.js`

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
