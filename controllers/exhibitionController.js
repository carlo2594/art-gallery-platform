const Exhibition = require('@models/exhibitionModel');
const Artwork = require('@models/artworkModel');
const factory = require('@utils/handlerFactory');
const arrayUnique = require('@utils/arrayUnique');
const isValidObjectId = require('@utils/isValidObjectId');
const catchAsync = require('@utils/catchAsync');
const AppError = require('@utils/appError');

// Sincroniza participants (role: 'artista') segun artistas de las obras actuales
async function syncParticipantsFromArtworks(exhibitionDoc) {
  try {
    const artIds = Array.from(new Set((exhibitionDoc.artworks || []).map(id => String(id))));
    let artistIds = [];
    if (artIds.length) {
      // Solo artistas de obras aprobadas y no eliminadas (catálogo pAblico)
      artistIds = await Artwork.find({ _id: { $in: artIds }, status: 'approved', deletedAt: null }).distinct('artist');
    }
    const artistSet = new Set((artistIds || []).filter(Boolean).map(id => String(id)));

    const existing = Array.isArray(exhibitionDoc.participants) ? exhibitionDoc.participants : [];
    const keepNonArtist = existing.filter(p => String((p && p.role) || '').toLowerCase() !== 'artista');
    const newArtistParticipants = Array.from(artistSet).map(uid => ({ user: uid, role: 'artista' }));
    exhibitionDoc.participants = [...keepNonArtist, ...newArtistParticipants];
    await exhibitionDoc.save({ validateModifiedOnly: true });
  } catch (err) {
    console.error('syncParticipantsFromArtworks error:', err);
  }
}

exports.getAllExhibitions = factory.getAll(Exhibition);
exports.getExhibition = factory.getOne(Exhibition, { path: 'createdBy participants' });
exports.createExhibition = (req, res, next) => {
  if (req.user && req.user._id) {
    req.body.createdBy = req.user._id;
  }
  return factory.createOne(Exhibition)(req, res, next);
};
// Update exhibition with soft-delete awareness: if status != 'trashed', clear deletedAt/deletedBy
exports.updateExhibition = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return next(new AppError('ID inválido.', 400));

  const updates = { ...(req.body || {}) };

  // Normalizar status y gestionar papelera
  if (typeof updates.status === 'string') {
    const st = String(updates.status).trim();
    if (st !== 'trashed') {
      updates.deletedAt = null;
      updates.deletedBy = undefined; // limpiar referencia
    } else {
      // Si explícitamente ponen 'trashed', muevelo a papelera
      updates.deletedAt = new Date();
      if (req.user && req.user._id) updates.deletedBy = req.user._id;
    }
  }

  // Reconstruir location si vino en campos planos (compat con forms)
  if (updates.location_type || updates.location_value) {
    const t = updates.location_type;
    const v = updates.location_value;
    delete updates.location_type; delete updates.location_value;
    if (t === 'physical') updates.location = { type: 'physical', address: v || '' };
    else if (t === 'virtual') updates.location = { type: 'virtual', url: v || '' };
    else updates.location = {};
  }

  const doc = await Exhibition.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!doc) return next(new AppError('Exposición no encontrada.', 404));
  return res.status(200).json({ status: 'success', message: 'Exposición actualizada', data: doc });
});
// Soft-delete: marca deletedAt/deletedBy en lugar de borrar definitivamente
exports.deleteExhibition = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  if (!isValidObjectId(id)) return next(new AppError('ID inválido.', 400));
  const exh = await Exhibition.findById(id);
  if (!exh) return next(new AppError('Exposición no encontrada.', 404));
  if (exh.deletedAt) {
    return res.status(200).json({ status: 'success', message: 'Ya estaba eliminada.', data: null });
  }
  exh.deletedAt = new Date();
  // Actualiza estado a 'trashed' para reflejar papelera
  try { exh.status = 'trashed'; } catch (_){ }
  try { if (req.user && req.user._id) exh.deletedBy = req.user._id; } catch(_) {}
  await exh.save({ validateModifiedOnly: true });
  return res.status(200).json({ status: 'success', message: 'Exposición eliminada correctamente.', data: null });
});

// Subir o reemplazar imagen de portada (multipart: field 'coverImage')
exports.uploadCoverImage = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return next(new AppError('ID inválido.', 400));
  const exhibition = await Exhibition.findById(id);
  if (!exhibition) return next(new AppError('Exposición no encontrada.', 404));
  if (!req.file) return next(new AppError('No se recibió archivo de imagen.', 400));

  const { upload, uploadBuffer } = require('@utils/cloudinaryImage');
  let result;
  if (req.file.path) result = await upload(req.file.path);
  else if (req.file.buffer) result = await uploadBuffer(req.file.buffer);
  else return next(new AppError('No se pudo procesar la imagen.', 400));

  exhibition.coverImage = result.secure_url;
  await exhibition.save({ validateModifiedOnly: true });
  res.status(200).json({ status: 'success', message: 'Portada actualizada.', data: { coverImage: exhibition.coverImage } });
});

// Eliminar imagen de portada (solo elimina la referencia)
exports.deleteCoverImage = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return next(new AppError('ID inválido.', 400));
  const exhibition = await Exhibition.findById(id);
  if (!exhibition) return next(new AppError('Exposición no encontrada.', 404));
  exhibition.coverImage = undefined;
  await exhibition.save({ validateModifiedOnly: true });
  res.status(200).json({ status: 'success', message: 'Portada eliminada.' });
});

// PATCH /exhibitions/:id/add-artwork
exports.addArtwork = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { artworkId } = req.body;
  if (!isValidObjectId(id) || !isValidObjectId(artworkId)) {
    return next(new AppError('ID invA�lido.', 400));
  }
  const exhibition = await Exhibition.findById(id);
  if (!exhibition) return next(new AppError('ExposiciA3n no encontrada.', 404));
  const artwork = await Artwork.findById(artworkId);
  if (!artwork) return next(new AppError('Obra no encontrada.', 404));

  // Agrega la obra a la exposiciA3n (sin duplicados)
  exhibition.artworks = arrayUnique([...(exhibition.artworks || []), artworkId]);
  await exhibition.save();
  // Agrega la exposiciA3n a la obra (sin duplicados)
  artwork.exhibitions = arrayUnique([...(artwork.exhibitions || []), id]);
  await artwork.save();

  // Actualiza participantes segun artistas de obras
  try { await syncParticipantsFromArtworks(exhibition); } catch(_){ }

  res.status(200).json({ status: 'success', message: 'Obra agregada a la exposiciA3n.', exhibition });
});// PATCH /exhibitions/:id/remove-artwork
exports.removeArtwork = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { artworkId } = req.body;
  if (!isValidObjectId(id) || !isValidObjectId(artworkId)) {
    return next(new AppError('ID invA�lido.', 400));
  }
  const exhibition = await Exhibition.findById(id);
  if (!exhibition) return next(new AppError('ExposiciA3n no encontrada.', 404));
  const artwork = await Artwork.findById(artworkId);
  if (!artwork) return next(new AppError('Obra no encontrada.', 404));

  // Quita la obra de la exposiciA3n
  exhibition.artworks = (exhibition.artworks || []).filter(a => String(a) !== String(artworkId));
  await exhibition.save();
  // Quita la exposiciA3n de la obra
  artwork.exhibitions = (artwork.exhibitions || []).filter(e => String(e) !== String(id));
  await artwork.save();

  // Actualiza participantes segun artistas de obras
  try { await syncParticipantsFromArtworks(exhibition); } catch(_){ }

  res.status(200).json({ status: 'success', message: 'Obra removida de la exposiciA3n.', exhibition });
});




