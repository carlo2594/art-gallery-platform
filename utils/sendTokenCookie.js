module.exports = (res, token) => {
  // 1 h – ajusta si usas refresh tokens
  const oneHour = 60 * 60 * 1000;

  res.cookie('jwt', token, {
    httpOnly: true,                     // JS del navegador no puede leerla
    secure: process.env.NODE_ENV === 'production', // solo HTTPS en prod
    sameSite: 'strict',                 // mitiga CSRF
    maxAge: oneHour
  });
};
