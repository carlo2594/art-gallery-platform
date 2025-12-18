// middlewares/isOwner.js
const mongoose = require('mongoose');
const { hasRole } = require('@utils/roleUtils');
module.exports = (Model, ownerField = 'createdBy') => {
  return async (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }
    const doc = await Model.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Recurso no encontrado' });
    }

    const ownerId = doc[ownerField]?.toString();
    if (ownerId !== req.user.id && !hasRole(req.user, 'admin')) {
      return res.status(403).json({ message: 'No tienes permiso para esta acción' });
    }

    next();
  };
};
