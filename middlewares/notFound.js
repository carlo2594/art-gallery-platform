// middlewares/notFound.js
module.exports = (req, res, next) => {
  res.status(404).json({
    status: 'fail',
    message: `Ruta no encontrada: ${req.originalUrl}`
  });
};
