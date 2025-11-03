// utils/authUtils.js

function parseRememberMe(remember) {
  return (
    remember === true ||
    remember === 'true' ||
    remember === 'on' ||
    remember === 1 ||
    remember === '1' ||
    remember === 'remember-me'
  );
}

function getJwtCookieOptions({ rememberMe, daysIfRemember = 30, daysIfNotRemember = 7 } = {}) {
  const days = rememberMe ? daysIfRemember : daysIfNotRemember;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: days * 24 * 60 * 60 * 1000
  };
}

module.exports = { parseRememberMe, getJwtCookieOptions };
