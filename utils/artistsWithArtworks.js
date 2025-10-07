/**
 * Utility para obtener artistas que tienen al menos una obra aprobada
 * Centraliza la lógica de aggregation para reutilización en múltiples controladores
 */

/**
 * Construye el pipeline base para obtener artistas con obras aprobadas
 * @param {string} search - Término de búsqueda (opcional)
 * @returns {Array} Pipeline de aggregation de MongoDB
 */
function buildArtistsWithArtworksPipeline(search = '') {
  const pipeline = [
    // Match solo usuarios que son artistas
    { $match: { role: 'artist' } }
  ];

  // Aplicar filtros de búsqueda si existen
  if (search && search.trim()) {
    pipeline.push({
      $match: {
        $or: [
          { name: { $regex: search.trim(), $options: 'i' } },
          { bio: { $regex: search.trim(), $options: 'i' } }
        ]
      }
    });
  }

  // Agregar el lookup y filtro de obras aprobadas
  pipeline.push(
    // Lookup para contar obras aprobadas de cada artista
    {
      $lookup: {
        from: 'artworks',
        let: { artistId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$artist', '$$artistId'] },
              status: 'approved',
              deletedAt: null
            }
          },
          { $count: 'approvedCount' }
        ],
        as: 'artworkStats'
      }
    },
    
    // Solo artistas con al menos 1 obra aprobada
    {
      $match: {
        'artworkStats.0.approvedCount': { $gt: 0 }
      }
    },
    
    // Agregar el conteo de obras para uso posterior si es necesario
    {
      $addFields: {
        approvedArtworksCount: { $ifNull: [{ $arrayElemAt: ['$artworkStats.approvedCount', 0] }, 0] }
      }
    },
    
    // Remover el campo temporal
    { $unset: 'artworkStats' }
  );

  return pipeline;
}

/**
 * Obtiene el conteo total de artistas con obras aprobadas
 * @param {Object} UserModel - Modelo de usuario de Mongoose
 * @param {string} search - Término de búsqueda (opcional)
 * @returns {Promise<number>} Número total de artistas
 */
async function countArtistsWithArtworks(UserModel, search = '') {
  const pipeline = buildArtistsWithArtworksPipeline(search);
  pipeline.push({ $count: 'total' });
  
  const result = await UserModel.aggregate(pipeline);
  return result[0]?.total || 0;
}

/**
 * Obtiene artistas con obras aprobadas con paginación y ordenamiento
 * @param {Object} UserModel - Modelo de usuario de Mongoose
 * @param {string} search - Término de búsqueda (opcional)
 * @param {Object} sort - Objeto de ordenamiento de MongoDB
 * @param {number} skip - Número de documentos a saltar
 * @param {number} limit - Número máximo de documentos a devolver
 * @returns {Promise<Array>} Array de artistas
 */
async function getArtistsWithArtworks(UserModel, search = '', sort = { name: 1 }, skip = 0, limit = 15) {
  const pipeline = buildArtistsWithArtworksPipeline(search);
  
  // Agregar sort, skip y limit
  pipeline.push(
    { $sort: sort },
    { $skip: skip },
    { $limit: limit }
  );

  return await UserModel.aggregate(pipeline);
}

/**
 * Función combinada que obtiene tanto el total como los artistas paginados
 * @param {Object} UserModel - Modelo de usuario de Mongoose
 * @param {string} search - Término de búsqueda (opcional)
 * @param {Object} sort - Objeto de ordenamiento de MongoDB
 * @param {number} skip - Número de documentos a saltar
 * @param {number} limit - Número máximo de documentos a devolver
 * @returns {Promise<Object>} Objeto con { artists, total }
 */
async function getArtistsWithArtworksAndCount(UserModel, search = '', sort = { name: 1 }, skip = 0, limit = 15) {
  const [artists, total] = await Promise.all([
    getArtistsWithArtworks(UserModel, search, sort, skip, limit),
    countArtistsWithArtworks(UserModel, search)
  ]);

  return { artists, total };
}

module.exports = {
  buildArtistsWithArtworksPipeline,
  countArtistsWithArtworks,
  getArtistsWithArtworks,
  getArtistsWithArtworksAndCount
};