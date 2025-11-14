// Recalcula y actualiza el contador `views` en Artwork
// - Deduplica por usuario (1 por usuario/obra en todo el periodo analizado)
// - Opcionalmente permite usar IP para anónimos o limitar por últimos N días
// - Usa agregación eficiente en MongoDB y actualiza por lotes

require('module-alias/register');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Carga de entorno como en otros scripts (seed/clean)
const ENV = (process.env.NODE_ENV || 'development').toLowerCase();
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, `.env.${ENV}`);
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const ArtworkView = require('@models/artworkViewModel');
const Artwork = require('@models/artworkModel');

// ---- CLI args mínimos (sin dependencias) ----
function parseArgs(argv) {
  const args = {
    days: null,             // número de días hacia atrás (null = todo)
    since: null,            // fecha ISO explícita (prioridad sobre days)
    mode: 'user',           // 'user' | 'user_or_ip' | 'ip'
    artwork: [],            // uno o varios ids/strings separados por coma
    dry: false,             // no escribe en BD
    batch: 500,             // tamaño de lote para bulkWrite
    resetMissing: false,    // setea a 0 las obras no devueltas por la agregación
    allowDiskUse: true      // permite uso de disco en agregación
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--days' && next && !next.startsWith('--')) { args.days = Number(next); i++; continue; }
    if (a === '--since' && next && !next.startsWith('--')) { args.since = new Date(next); i++; continue; }
    if (a === '--mode' && next && !next.startsWith('--')) { args.mode = String(next); i++; continue; }
    if ((a === '--artwork' || a === '--artworks') && next && !next.startsWith('--')) {
      args.artwork = String(next).split(',').map(s => s.trim()).filter(Boolean);
      i++; continue;
    }
    if (a === '--dry' || a === '--dry-run') { args.dry = true; continue; }
    if (a === '--reset-missing') { args.resetMissing = true; continue; }
    if (a === '--batch' && next && !next.startsWith('--')) { args.batch = Math.max(1, Number(next)); i++; continue; }
    if (a === '--no-disk') { args.allowDiskUse = false; continue; }
  }
  return args;
}

function validateMode(mode) {
  return mode === 'user' || mode === 'user_or_ip' || mode === 'ip';
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!validateMode(args.mode)) {
    console.error(`[refreshArtworkViews] Modo inválido: ${args.mode}. Usa 'user' | 'user_or_ip' | 'ip'.`);
    process.exit(1);
  }

  // Conexión a la BD
  const DB = process.env.DATABASE.replace('<db_password>', process.env.DATABASE_PASSWORD);
  const mongooseOpts = {
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
    maxPoolSize: 20,
    dbName: process.env.DB_NAME,
  };
  console.log(`[refreshArtworkViews] Conectando a MongoDB (${ENV})...`);
  await mongoose.connect(DB, mongooseOpts);
  console.log('[refreshArtworkViews] Conectado.');

  // Construye el pipeline de agregación
  const pipeline = [];

  // Filtro temporal
  let sinceDate = null;
  if (args.since instanceof Date && !isNaN(args.since.getTime())) {
    sinceDate = args.since;
  } else if (typeof args.days === 'number' && isFinite(args.days) && args.days > 0) {
    sinceDate = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000);
  }
  if (sinceDate) {
    // Nota: usamos createdAt que está indexado; si hay legados con sólo 'date', no acotamos por fecha para ellos.
    pipeline.push({ $match: { createdAt: { $gte: sinceDate } } });
  }

  // Filtro por obra(s) concreta(s)
  const toObjectId = (v) => {
    try { return new mongoose.Types.ObjectId(String(v)); } catch (_) { return null; }
  };
  const artworkIds = (args.artwork || []).map(toObjectId).filter(Boolean);
  if (artworkIds.length) {
    pipeline.push({ $match: { artwork: { $in: artworkIds } } });
  }

  // Modo de deduplicación
  if (args.mode === 'user') {
    // Sólo usuarios logueados (ignora anónimos). 1 por (artwork, user)
    pipeline.push({ $match: { user: { $exists: true, $ne: null } } });
    pipeline.push({ $group: { _id: { artwork: '$artwork', user: '$user' } } });
  } else if (args.mode === 'ip') {
    // Sólo IP (anónimos). 1 por (artwork, ip)
    pipeline.push({ $match: { ip: { $exists: true, $ne: null, $ne: '' } } });
    pipeline.push({ $group: { _id: { artwork: '$artwork', ip: '$ip' } } });
  } else {
    // user_or_ip: si hay user usa user, si no hay, usa ip. 1 por (artwork, userOrIp)
    pipeline.push({ $addFields: { userOrIp: { $ifNull: ['$user', '$ip'] } } });
    pipeline.push({ $match: { userOrIp: { $ne: null, $ne: '' } } });
    pipeline.push({ $group: { _id: { artwork: '$artwork', k: '$userOrIp' } } });
  }

  // Segundo group: contar únicos por obra
  pipeline.push({ $group: { _id: '$_id.artwork', count: { $sum: 1 } } });

  console.log('[refreshArtworkViews] Ejecutando agregación...', JSON.stringify({
    mode: args.mode,
    since: sinceDate ? sinceDate.toISOString() : null,
    artworkIds: artworkIds.length,
    allowDiskUse: args.allowDiskUse,
  }));

  let results = [];
  try {
    results = await ArtworkView.aggregate(pipeline).allowDiskUse(!!args.allowDiskUse).exec();
  } catch (err) {
    console.error('[refreshArtworkViews] Error en agregación:', err.message);
    throw err;
  }
  console.log(`[refreshArtworkViews] Agregación lista. Obras con conteo: ${results.length}`);

  // Preparar operaciones de actualización por lotes
  const updates = results.map(r => ({
    updateOne: {
      filter: { _id: r._id },
      update: { $set: { views: r.count } }
    }
  }));

  if (!updates.length) {
    console.log('[refreshArtworkViews] No hay actualizaciones que aplicar para el filtro dado.');
  }

  // Opción para resetear a 0 obras que no aparecen en la agregación
  // Úsalo sólo cuando el cálculo sea sobre "todo el histórico" para evitar falsos 0.
  let zeroOp = null;
  if (args.resetMissing && !sinceDate && !artworkIds.length) {
    const seenIds = new Set(results.map(r => String(r._id)));
    zeroOp = { filter: { _id: { $nin: Array.from(seenIds) } }, update: { $set: { views: 0 } } };
  } else if (args.resetMissing) {
    console.warn('[refreshArtworkViews] --reset-missing ignorado porque se está filtrando por fecha y/o artwork.');
  }

  // Dry-run imprime un resumen y termina
  if (args.dry) {
    const sample = results.slice(0, 10);
    console.log('[refreshArtworkViews] DRY-RUN: primeras 10 actualizaciones ejemplo:', sample);
    if (zeroOp) console.log('[refreshArtworkViews] DRY-RUN: reset faltantes ->', zeroOp.filter);
    await mongoose.connection.close();
    console.log('[refreshArtworkViews] Conexión cerrada.');
    return;
  }

  // Ejecutar bulkWrite en lotes
  let updatedCount = 0;
  const batches = chunk(updates, Math.max(1, args.batch));
  for (let i = 0; i < batches.length; i++) {
    const ops = batches[i];
    if (!ops.length) continue;
    try {
      const res = await Artwork.bulkWrite(ops, { ordered: false });
      const n = (res && (res.modifiedCount || res.nModified)) || 0;
      updatedCount += n;
      console.log(`[refreshArtworkViews] Lote ${i + 1}/${batches.length} aplicado. Modificados: ${n}`);
    } catch (err) {
      console.error(`[refreshArtworkViews] Error en bulkWrite (lote ${i + 1}):`, err.message);
    }
  }

  // Reset de faltantes a 0 (si corresponde)
  if (zeroOp) {
    try {
      const res0 = await Artwork.updateMany(zeroOp.filter, zeroOp.update);
      console.log(`[refreshArtworkViews] Reset de faltantes aplicado. Modificados: ${res0.modifiedCount || 0}`);
    } catch (err) {
      console.error('[refreshArtworkViews] Error aplicando reset de faltantes:', err.message);
    }
  }

  console.log(`[refreshArtworkViews] Listo. Obras actualizadas: ${updatedCount}.`);
  await mongoose.connection.close();
  console.log('[refreshArtworkViews] Conexión cerrada.');
}

main().catch(async (err) => {
  try { console.error('[refreshArtworkViews] Error:', err); } catch (_) {}
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});

