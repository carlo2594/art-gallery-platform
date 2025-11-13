const validator = require('validator');
const catchAsync = require('@utils/catchAsync');
const isValidObjectId = require('@utils/isValidObjectId');
const Artwork = require('@models/artworkModel');
const User = require('@models/userModel');
const { sendMail } = require('@services/mailer');
const { purchaseInquirySubject, purchaseInquiryTextHtml, purchaseInquiryTextPlain } = require('@services/emailTemplates');

function wantsJson(req) {
  const accept = (req.headers.accept || '').toLowerCase();
  return accept.includes('application/json') || accept.includes('json') || (req.xhr === true);
}

exports.submit = catchAsync(async (req, res) => {
  const { artworkId, message = '' } = req.body || {};

  if (!artworkId || !isValidObjectId(artworkId)) {
    const msg = 'ID de obra inválido.';
    if (wantsJson(req)) return res.status(400).json({ ok: false, message: msg });
    return res.status(400).send(msg);
  }

  const art = await Artwork
    .findOne({ _id: artworkId, deletedAt: null })
    .populate({ path: 'artist', select: 'name +email' });

  if (!art) {
    const msg = 'Obra no encontrada.';
    if (wantsJson(req)) return res.status(404).json({ ok: false, message: msg });
    return res.status(404).send(msg);
  }

  const artist = art.artist;
  const artistEmail = artist && artist.email;

  if (!artistEmail || !validator.isEmail(String(artistEmail))) {
    const msg = 'No se pudo contactar al artista (email faltante).';
    if (wantsJson(req)) return res.status(422).json({ ok: false, message: msg });
    return res.status(422).send(msg);
  }

  // Asegurar email del comprador (req.user.email no está seleccionado por defecto)
  const me = await User.findById(req.user.id).select('name +email');
  if (!me || !me.email) {
    const msg = 'No se pudo obtener tu email.';
    if (wantsJson(req)) return res.status(422).json({ ok: false, message: msg });
    return res.status(422).send(msg);
  }

  const safeMsg = String(message || '').trim().slice(0, 800);
  const artworkUrl = `${req.protocol}://${req.get('host')}/artworks/${art.slug || art._id}`;

  const subject = purchaseInquirySubject({ artworkTitle: art.title });
  const html = purchaseInquiryTextHtml({
    artworkTitle: art.title,
    artistName: artist && artist.name,
    buyerName: me.name,
    buyerEmail: me.email,
    message: safeMsg,
    artworkUrl
  });
  const text = purchaseInquiryTextPlain({
    artworkTitle: art.title,
    artistName: artist && artist.name,
    buyerName: me.name,
    buyerEmail: me.email,
    message: safeMsg,
    artworkUrl
  });

  await sendMail({
    to: artistEmail,
    cc: me.email,
    subject,
    text,
    html,
    replyTo: me.email
  });

  if (wantsJson(req)) return res.json({ ok: true });
  return res.status(200).send('ok');
});

