// utils/media.js

const fs = require('fs');

const cloudinary = require('@services/cloudinary');



function signedOriginalUrl(publicId) {

  const url = cloudinary.url(publicId, {

    type: 'private',

    secure: true,

    sign_url: true

  });

  return url;

}



function signedWatermarkedUrl(publicId, width, opts = {}) {

  const deliveryType = opts.type || 'upload';

  const base = [{ fetch_format: 'auto', quality: 'auto' }];
  const wm = [
    { overlay: 'Logos:GOX_LOGO_09', flags: 'relative', width: 0.2, opacity: 60 },
    { flags: 'layer_apply', gravity: 'south_east', x: 12, y: 12 }
  ];
  const size = [{ crop: 'fill', width: width }];
  const transformation = (deliveryType === 'fetch') ? [...base, ...size] : [...base, ...wm, ...size];

  // Firmar solo cuando el tipo de entrega lo requiere (private/authenticated)

  const shouldSign = (deliveryType === 'private' || deliveryType === 'authenticated');

  const url = cloudinary.url(publicId, {

    type: deliveryType,

    secure: true,

    sign_url: shouldSign,

    transformation

  });

  return url;

}



async function uploadOriginal(filePath) {

  const result = await cloudinary.uploader.upload(filePath, {

    type: 'private',

    folder: 'gallery',

    resource_type: 'image'

  });

  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}

  return { id: result.public_id, width: result.width, height: result.height };

}



function buildPublicSrcSet(publicId, opts = {}) {

  const widths = Array.isArray(opts.widths) && opts.widths.length ? opts.widths : [400, 800, 1200];

  const sizes = opts.sizes || '(max-width: 800px) 100vw, 800px';

  const srcWidth = widths.includes(800) ? 800 : widths[Math.floor(widths.length / 2)];

  const src = signedWatermarkedUrl(publicId, srcWidth, { type: opts.type || 'upload' });

  const srcset = widths

    .map((w) => `${signedWatermarkedUrl(publicId, w, { type: opts.type || 'upload' })} ${w}w`)

    .join(', ');

  const width = opts.widthAttr || (widths.includes(800) ? 800 : undefined);

  const height = opts.heightAttr; // opcional

  return { src, srcset, sizes, width, height };

}



function buildImgTag(publicId, opts = {}) {

  const { src, srcset, sizes, width, height } = buildPublicSrcSet(publicId, opts);

  const attrs = [

    `src="${src}"`,

    `srcset="${srcset}"`,

    `sizes="${sizes}"`,

    width ? `width="${width}"` : null,

    height ? `height="${height}"` : null,

    'loading="lazy"',

    'decoding="async"'

  ].filter(Boolean).join(' ');

  return `<img ${attrs} />`;

}



module.exports = {

  uploadOriginal,

  signedOriginalUrl,

  signedWatermarkedUrl,

  buildPublicSrcSet,

  buildImgTag

};

