// controllers/errorController.js
const AppError = require('@utils/appError');

/* --------------------------------------------------------- *
 *            1.  Transformar errores “conocidos”            *
 * --------------------------------------------------------- */
const transformError = err => {
  // Mongoose: ID mal formado
  if (err.name === 'CastError') {
    return new AppError('ID inválido.', 400);
  }

  // Mongoose: clave duplicada
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return new AppError(`Valor duplicado en el campo «${field}».`, 400);
  }

  // Mongoose: validación
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map(el => el.message)
      .join('. ');
    return new AppError(`Datos inválidos: ${message}`, 400);
  }

  // JWT
  if (err.name === 'JsonWebTokenError') return new AppError('Token inválido.', 401);
  if (err.name === 'TokenExpiredError') return new AppError('Token expirado.', 401);

  // Otros → sin cambio
  return err;
};

/* --------------------------------------------------------- *
 *                 2.  Helpers de respuesta                  *
 * --------------------------------------------------------- */
const sendErrorDev = (err, req, res) => {
  // API → JSON detallado
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status:  err.status,
      message: err.message,
      error:   err,
      stack:   err.stack
    });
  }
  return res.status(err.statusCode).render('public/error', {
    title: 'Algo salió mal',
    msg:   err.message
  });
};

const sendErrorProd = (err, req, res) => {
  // API
  if (req.originalUrl.startsWith('/api')) {
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status:  err.status,
        message: err.message
      });
    }
    // Bug inesperado
    return res.status(500).json({
      status:  'error',
      message: 'Algo salió mal.'
    });
  }

  // Vistas
  if (err.isOperational) {
    return res.status(err.statusCode).render('public/error', {
      title: 'Algo salió mal',
      msg:   err.message
    });
  }
  // Bug inesperado en producción
  return res.status(500).render('public/error', {
    title: 'Algo salió mal',
    msg:   'Por favor inténtalo más tarde.'
  });
};

/* --------------------------------------------------------- *
 *                 3.  Middleware global                     *
 * --------------------------------------------------------- */
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status     = err.status     || 'error';

  // Normaliza errores conocidos a instancias de AppError
  let operationalError = transformError(err);

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(operationalError, req, res);
  } else {
    // Si no es operacional, oculta detalles internos
    if (!operationalError.isOperational) {
      console.error('ERROR 💥', operationalError);
      operationalError = new AppError('Algo salió mal.', 500);
    }
    sendErrorProd(operationalError, req, res);
  }
};
