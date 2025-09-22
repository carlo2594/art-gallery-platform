/* public/js/masonry-init.js */
(function () {
  // Espera a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    var grid = document.getElementById('grid');
    if (!grid) return; // Esta página no tiene grid

    // Si algo falla, al menos muéstralos (evita que queden ocultos)
    var revealFallback = function () {
      grid.querySelectorAll('li').forEach(function (li) {
        li.classList.add('shown');
      });
    };

    // Si faltan librerías base, muestra sin animación
    if (typeof window.imagesLoaded !== 'function' || typeof window.Masonry !== 'function') {
      console.warn('[masonry-init] Falta imagesLoaded o Masonry. Revelando sin animación.');
      revealFallback();
      return;
    }

    // Espera a que carguen las imágenes antes de inicializar el layout
    window.imagesLoaded(grid, function () {
      try {
        new window.Masonry(grid, {
          itemSelector: 'li',
          columnWidth: 'li',
          percentPosition: true,
          transitionDuration: '0.2s'
        });
      } catch (e) {
        console.warn('[masonry-init] Error iniciando Masonry:', e);
      }

      // Efecto Codrops si está disponible
      if (typeof window.AnimOnScroll === 'function') {
        new window.AnimOnScroll(grid, {
          minDuration: 0.4,
          maxDuration: 0.7,
          viewportFactor: 0.2
        });
      } else {
        // Si no existe AnimOnScroll, revela sin animación
        revealFallback();
      }
    });
  }
})();
