// utils/passwordPolicy.js
const crypto = require('crypto');

const MODERATE_PASSWORD_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres e incluir una letra mayúscula, una letra minúscula y un número.';

const MODERATE_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function isModeratePassword(password = '') {
  if (typeof password !== 'string') return false;
  return MODERATE_PASSWORD_REGEX.test(password);
}

function getRandomChar(charset) {
  const index = crypto.randomInt(0, charset.length);
  return charset[index];
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function generatePolicyCompliantPassword(length = 12) {
  const minLength = Math.max(length, 8);
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const pool = upper + lower + numbers;

  const chars = [
    getRandomChar(upper),
    getRandomChar(lower),
    getRandomChar(numbers)
  ];

  while (chars.length < minLength) {
    chars.push(getRandomChar(pool));
  }

  return shuffle(chars).join('');
}

module.exports = {
  MODERATE_PASSWORD_MESSAGE,
  isModeratePassword,
  generatePolicyCompliantPassword
};
