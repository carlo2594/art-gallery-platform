const ArtworkView = require('@models/artworkViewModel');

// Create a new artwork view
exports.createView = async (req, res) => {
  try {
    const { artwork } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const view = new ArtworkView({ artwork, ip });
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