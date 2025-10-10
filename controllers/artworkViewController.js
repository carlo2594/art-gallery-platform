const ArtworkView = require('@models/artworkViewModel');

const { getClientIp } = require('@utils/request');

// Create a new artwork view
exports.createView = async (req, res) => {
  try {
    const { artwork } = req.body;
    const ip = getClientIp(req);
    const viewDoc = { artwork, ip };
    // Adjuntar usuario si está autenticado
    if (req.user && (req.user._id || req.user.id)) {
      viewDoc.user = req.user._id || req.user.id;
    }
    const view = new ArtworkView(viewDoc);
    await view.save();
    res.status(201).json(view);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all views for an artwork
exports.getViewsByArtwork = async (req, res) => {
  try {
    const { artworkId } = req.params;
    const views = await ArtworkView.find({ artwork: artworkId });
    res.json(views);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
