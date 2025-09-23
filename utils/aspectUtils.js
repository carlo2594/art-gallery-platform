/**
 * Utilidades para trabajar con proporciones y aspectos de imágenes o elementos.
 * Incluye funciones para simplificar proporciones y calcular el máximo común divisor.
 */
// utils/aspectUtils.js

/**
 * Calcula el máximo común divisor entre dos números.
 */
function gcd(a, b) {
  if (!b) return a;
  return gcd(b, a % b);
}

/**
 * Simplifica una proporción (w:h) a sus valores mínimos enteros.
 */
function simplifyRatio(w, h) {
  if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return [w, h];
  const d = gcd(Math.round(w), Math.round(h));
  return [Math.round(w/d), Math.round(h/d)];
}

/**
 * Devuelve la proporción simplificada en formato texto a partir de píxeles.
 */
function ratioTextFromPx(w, h) {
  const [rw, rh] = simplifyRatio(w, h);
  return `${rw}:${rh}`;
}

/**
 * Devuelve la proporción simplificada en formato texto a partir de centímetros.
 */
function ratioTextFromCm(w, h) {
  const [rw, rh] = simplifyRatio(w, h);
  return `${rw}:${rh}`;
}

/**
 * Redondea un valor al múltiplo más cercano de step.
 */
function roundTo(value, step = 0.1) {
  return Math.round(value / step) * step;
}

/**
 * Verifica si la relación de aspecto entre las medidas en cm y la imagen en px está dentro de la tolerancia.
 */
function verifyAspect({ widthCm, heightCm, imgW, imgH, tolerance = 0.03 }) {
  const cmRatio = widthCm / heightCm;
  const imgRatio = imgW / imgH;
  const delta = Math.abs(imgRatio - cmRatio) / cmRatio;
  return { ok: delta <= tolerance, delta, cmRatio, imgRatio };
}

/**
 * Construye una URL transformada de Cloudinary según la política de aspecto (pad/fill).
 */
function buildTransformedUrl(secureUrl, { policy, widthCm, heightCm, bg }) {
  const ar = `${widthCm}:${heightCm}`;
  const marker = '/upload/';
  const i = secureUrl.indexOf(marker);
  if (i === -1) return secureUrl;
  const head = secureUrl.slice(0, i + marker.length);
  const tail = secureUrl.slice(i + marker.length);
  if (policy === 'pad')  return `${head}ar_${ar},c_pad,b_${bg||'white'},q_auto,f_auto/${tail}`;
  if (policy === 'fill') return `${head}ar_${ar},c_fill,g_auto,q_auto,f_auto/${tail}`;
  return secureUrl;
}

/**
 * Obtiene la política de aspecto desde la variable de entorno ASPECT_POLICY.
 */
function getAspectPolicy() {
  return process.env.ASPECT_POLICY || 'strict';
}

/**
 * Construye el payload JSON de error cuando la relación de aspecto no coincide.
 */
function buildAspectErrorPayload({ widthCm, heightCm, imgW, imgH, secureUrl, tolerance = 0.03, padBg = 'white' }) {
  const cmRatio = widthCm / heightCm;
  const imgRatio = imgW / imgH;
  const delta = Math.abs(imgRatio - cmRatio) / cmRatio;
  const delta_percent = roundTo(delta * 100, 0.01);
  const declaredRatioText = ratioTextFromCm(widthCm, heightCm);
  const imageRatioText = ratioTextFromPx(imgW, imgH);
  const change_height = roundTo(widthCm / imgRatio, 0.1);
  const change_width = roundTo(heightCm * imgRatio, 0.1);
  const target_height_px = Math.round(imgW / cmRatio);
  return {
    code: 'ASPECT_MISMATCH',
    message: 'La imagen no coincide con las dimensiones declaradas.',
    hints: [
      `Relación imagen: ${imgW}×${imgH} px ≈ ${imgRatio.toFixed(4)} (${imageRatioText})`,
      `Relación declarada: ${widthCm}×${heightCm} cm ≈ ${cmRatio.toFixed(4)} (${declaredRatioText})`
    ],
    details: {
      declared_cm: {
        width_cm: widthCm,
        height_cm: heightCm,
        ratio: cmRatio,
        ratio_text: declaredRatioText
      },
      image_px: {
        width_px: imgW,
        height_px: imgH,
        ratio: imgRatio,
        ratio_text: imageRatioText
      },
      delta_percent,
      suggestions: {
        change_height_keep_width: {
          height_cm: change_height,
          explanation: `Ajusta ALTURA a ${change_height} cm para mantener ${widthCm} cm de ANCHO con relación ${imageRatioText}`
        },
        change_width_keep_height: {
          width_cm: change_width,
          explanation: `Ajusta ANCHO a ${change_width} cm para mantener ${heightCm} cm de ALTO con relación ${imageRatioText}`
        },
        image_targets_px: {
          keep_image_width: imgW,
          target_height_px,
          explanation: `Recorta/acolcha la imagen a ${imgW}×${target_height_px} px (${declaredRatioText}) para calzar ${widthCm}×${heightCm} cm`
        }
      },
      cloudinary_examples: {
        pad_url: buildTransformedUrl(secureUrl, { policy: 'pad', widthCm, heightCm, bg: padBg }),
        fill_url: buildTransformedUrl(secureUrl, { policy: 'fill', widthCm, heightCm })
      }
    }
  };
}

module.exports = {
  gcd,
  simplifyRatio,
  ratioTextFromPx,
  ratioTextFromCm,
  roundTo,
  verifyAspect,
  buildTransformedUrl,
  getAspectPolicy,
  buildAspectErrorPayload
};
