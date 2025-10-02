// utils/priceInput.js
const AppError = require('@utils/appError');

function toCentsOrThrow(value, fieldName = 'amount') {
  if (value === undefined || value === null || value === '') {
    throw new AppError(`El campo "${fieldName}" es obligatorio.`, 400);
  }
  const cleaned = String(value).replace(/[$,\s]/g, '');
  const num = Number(cleaned);
  if (!isFinite(num)) throw new AppError(`"${fieldName}" no es un número válido.`, 400);
  const cents = Math.round(num * 100);
  if (cents < 0) throw new AppError(`"${fieldName}" no puede ser negativo.`, 400);
  return cents;
}

module.exports = { toCentsOrThrow };
