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

  const transformation = [
    { fetch_format: 'auto', quality: 'auto' },
    { crop: 'fill', width: width }
  ];

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
  const deliveryType = opts.type || 'upload';

  // Para imágenes remotas (fetch), evita pasar por Cloudinary: usa la URL original sin transformaciones
  if (deliveryType === 'fetch') {
    const src = publicId; // ya es una URL remota completa
    const srcset = undefined; // sin variantes generadas
    const width = opts.widthAttr; // si la vista quiere fijar width/height lo hará, si no, se omiten
    const height = opts.heightAttr;
    return { src, srcset, sizes, width, height };
  }

  // Para imágenes subidas a Cloudinary (upload), generar variantes optimizadas
  const srcWidth = widths.includes(800) ? 800 : widths[Math.floor(widths.length / 2)];
  const src = signedWatermarkedUrl(publicId, srcWidth, { type: 'upload' });
  const srcset = widths
    .map((w) => `${signedWatermarkedUrl(publicId, w, { type: 'upload' })} ${w}w`)
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

