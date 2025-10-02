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
      // Asegura que el grid quede visible
      grid.style.opacity = '1';
    };

    // Si faltan librerías base, muestra sin animación
    if (typeof window.imagesLoaded !== 'function' || typeof window.Masonry !== 'function') {
      console.warn('[masonry-init] Falta imagesLoaded o Masonry. Revelando sin animación.');
      revealFallback();
      return;
    }

    // Exponer un helper para relayout desde otros scripts (e.g., al cambiar de tab)
    window.__oxRelayoutGrid = function () {
      try {
        if (!grid) return;
        if (typeof window.imagesLoaded === 'function') {
          window.imagesLoaded(grid, function () {
            if (window.__oxMasonry && typeof window.__oxMasonry.layout === 'function') {
              window.__oxMasonry.layout();
            }
          });
        } else if (window.__oxMasonry && typeof window.__oxMasonry.layout === 'function') {
          window.__oxMasonry.layout();
        }
      } catch (_) {}
    };

    // Oculta el grid hasta que apliquemos el layout para evitar el "salto" inicial
    if (!grid.style.transition) {
      grid.style.transition = 'opacity 120ms ease';
    }
    grid.style.opacity = '0';

    // Espera a que carguen las imágenes antes de inicializar el layout
    window.imagesLoaded(grid, function () {
      try {
        var msnry = new window.Masonry(grid, {
          itemSelector: 'li',
          columnWidth: 'li',
          percentPosition: true,
          transitionDuration: '0.2s'
        });
        // Guarda la instancia globalmente para relayout posterior
        window.__oxMasonry = msnry;
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

      // Muestra el grid tras aplicar layout
      requestAnimationFrame(function () {
        grid.style.opacity = '1';
        // Asegura un relayout final por si el grid estaba oculto
        if (window.__oxRelayoutGrid) {
          setTimeout(window.__oxRelayoutGrid, 50);
        }
      });
    });
  }
})();
