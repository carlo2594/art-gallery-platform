// middlewares/isOwner.js
module.exports = (Model, ownerField = 'createdBy') => {
  return async (req, res, next) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Recurso no encontrado' });
    }

    const ownerId = doc[ownerField]?.toString();
    if (ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'No tienes permiso para esta acción' });
    }

    next();
  };
};
