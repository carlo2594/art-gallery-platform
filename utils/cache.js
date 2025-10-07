// utils/cache.js
class SimpleCache {
  constructor(defaultTTL = 15 * 60 * 1000) { // 15 minutos por defecto
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  async getOrCompute(key, computeFn, ttl = this.defaultTTL) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    
    const data = await computeFn();
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  invalidate(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  // Limpieza automática de elementos expirados
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.defaultTTL) {
        this.cache.delete(key);
      }
    }
  }

  // Stats para debugging
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Instancia global para views
const viewsCache = new SimpleCache();

// Limpiar cache cada 30 minutos
setInterval(() => viewsCache.cleanup(), 30 * 60 * 1000);

module.exports = { SimpleCache, viewsCache };