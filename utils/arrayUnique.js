// Devuelve un nuevo array con solo valores únicos (primitivos o referencias iguales)
function arrayUnique(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr)];
}

module.exports = arrayUnique;
