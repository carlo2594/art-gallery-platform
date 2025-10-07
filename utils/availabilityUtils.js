/**
 * Utility para obtener información de presentación del estado de disponibilidad
 */

/**
 * Obtiene el badge y texto para mostrar el estado de disponibilidad
 * @param {string} availability - Estado de disponibilidad
 * @param {Date} reservedUntil - Fecha de fin de reserva (opcional)
 * @returns {Object} Objeto con clase CSS, texto y color
 */
function getAvailabilityBadge(availability, reservedUntil = null) {
  const badges = {
    for_sale: {
      class: 'badge-success',
      text: 'Disponible',
      color: 'success',
      icon: 'fas fa-check-circle',
      description: 'Esta obra está disponible para compra'
    },
    reserved: {
      class: 'badge-warning',
      text: 'Reservada',
      color: 'warning', 
      icon: 'fas fa-clock',
      description: reservedUntil ? 
        `Reservada hasta ${new Date(reservedUntil).toLocaleDateString()}` : 
        'Esta obra está temporalmente reservada'
    },
    sold: {
      class: 'badge-danger',
      text: 'Vendida',
      color: 'danger',
      icon: 'fas fa-times-circle',
      description: 'Esta obra ha sido vendida'
    },
    not_for_sale: {
      class: 'badge-secondary',
      text: 'No disponible',
      color: 'secondary',
      icon: 'fas fa-ban',
      description: 'Esta obra no está disponible para venta'
    },
    on_loan: {
      class: 'badge-info',
      text: 'En préstamo',
      color: 'info',
      icon: 'fas fa-handshake',
      description: 'Esta obra está actualmente en préstamo'
    }
  };

  return badges[availability] || badges.for_sale;
}

/**
 * Verifica si una obra está disponible para compra
 * @param {string} availability - Estado de disponibilidad
 * @returns {boolean} True si está disponible para compra
 */
function isAvailableForPurchase(availability) {
  return ['for_sale', 'reserved'].includes(availability);
}

/**
 * Obtiene el precio de venta efectivo (precio de venta o precio original)
 * @param {Object} artwork - Objeto de obra con price_cents y sale
 * @returns {number} Precio en centavos
 */
function getEffectivePrice(artwork) {
  if (artwork.availability === 'sold' && artwork.sale && artwork.sale.price_cents) {
    return artwork.sale.price_cents;
  }
  return artwork.price_cents;
}

/**
 * Formatea información de venta para mostrar
 * @param {Object} sale - Objeto de venta
 * @returns {Object} Información formateada de venta
 */
function formatSaleInfo(sale) {
  if (!sale) return null;

  const channels = {
    online: 'Venta Online',
    gallery: 'Galería',
    fair: 'Feria de Arte',
    private: 'Venta Privada'
  };

  return {
    price: sale.price_cents ? (sale.price_cents / 100).toFixed(2) : null,
    currency: sale.currency || 'USD',
    channel: channels[sale.channel] || sale.channel,
    buyerName: sale.buyerName,
    orderId: sale.orderId
  };
}

/**
 * Verifica si una reserva ha expirado
 * @param {Date} reservedUntil - Fecha de fin de reserva
 * @returns {boolean} True si la reserva ha expirado
 */
function isReservationExpired(reservedUntil) {
  if (!reservedUntil) return false;
  return new Date() > new Date(reservedUntil);
}

module.exports = {
  getAvailabilityBadge,
  isAvailableForPurchase,
  getEffectivePrice,
  formatSaleInfo,
  isReservationExpired
};