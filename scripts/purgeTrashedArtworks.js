// Elimina obras con estado 'trashed' cuyo deletedAt tenga al menos N días
require('module-alias/register');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Artwork = require('@models/artworkModel');

const ENV = (process.env.NODE_ENV || 'development').toLowerCase();
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, `.env.${ENV}`);
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

function parseArgs(argv) {
  const args = {
    days: 7,
    dry: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if ((a === '--days' || a === '-d') && next && !next.startsWith('--')) {
      args.days = Math.max(1, Number(next));
      i++;
      continue;
    }
    if (a === '--dry' || a === '--dry-run') {
      args.dry = true;
      continue;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const days = Number.isFinite(args.days) ? args.days : 7;
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const DB = process.env.DATABASE.replace('<db_password>', process.env.DATABASE_PASSWORD);
  const dbName = process.env.DB_NAME;

  console.log(`[purgeTrashedArtworks] Conectando a MongoDB (${ENV})...`);
  await mongoose.connect(DB, { dbName });
  console.log('[purgeTrashedArtworks] Conectado.');

  const filter = {
    status: 'trashed',
    deletedAt: { $lte: threshold },
  };

  const total = await Artwork.countDocuments(filter);
  console.log(`[purgeTrashedArtworks] Obras a eliminar (estado=trashed, >=${days} días): ${total}`);

  if (args.dry || !total) {
    if (args.dry) console.log('[purgeTrashedArtworks] DRY-RUN -> no se eliminará nada.');
    await mongoose.connection.close();
    console.log('[purgeTrashedArtworks] Conexión cerrada.');
    return;
  }

  const res = await Artwork.deleteMany(filter);
  console.log(`[purgeTrashedArtworks] Obras eliminadas: ${res.deletedCount || 0}`);

  await mongoose.connection.close();
  console.log('[purgeTrashedArtworks] Conexión cerrada.');
}

main().catch(async (err) => {
  try { console.error('[purgeTrashedArtworks] Error:', err); } catch (_) {}
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
