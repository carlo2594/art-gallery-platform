module.exports = (res, token) => {
  // 1 h – ajusta si usas refresh tokens
  const time = 60 * 60 * 1000 * 24 * 7; // 7 días

  res.cookie('jwt', token, {
    httpOnly: true,                     // JS del navegador no puede leerla
    secure: process.env.NODE_ENV === 'production', // solo HTTPS en prod
    sameSite: 'strict',                 // mitiga CSRF
    maxAge: time
  });
};
