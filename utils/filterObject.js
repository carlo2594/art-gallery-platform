/**
 * Utilidad para filtrar objetos por campos permitidos.
 * Retorna un nuevo objeto solo con las propiedades especificadas.
 */
// utils/filterObject.js
module.exports = (obj, ...allowedFields) => {
  const filtered = {};
  Object.keys(obj).forEach(key => {
    if (allowedFields.includes(key)) {
      filtered[key] = obj[key];
    }
  });
  return filtered;
};
