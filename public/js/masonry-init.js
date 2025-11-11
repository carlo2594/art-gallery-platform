/* public/js/masonry-init.js */
(function () {
  // Espera a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Soporta múltiples grids en la misma página
    var grids = document.querySelectorAll('.artwork-grid');
    if (!grids || grids.length === 0) return;

    // Si faltan librerías base, revela todos sin animación
    if (typeof window.imagesLoaded !== 'function' || typeof window.Masonry !== 'function') {
      try { console.warn('[masonry-init] Falta imagesLoaded o Masonry. Revelando sin animación.'); } catch(_) {}
      grids.forEach(function (grid) {
        try {
          grid.querySelectorAll('li').forEach(function (li) { li.classList.add('shown'); });
          grid.style.opacity = '1';
        } catch (_) {}
      });
      return;
    }

    var instances = [];

    // Helper global para relayout de todos los grids
    window.__oxRelayoutGrid = function () {
      try { instances.forEach(function (msn) { if (msn && typeof msn.layout === 'function') msn.layout(); }); } catch(_) {}
    };

    grids.forEach(function (grid) {
      try {
        if (!grid.style.transition) grid.style.transition = 'opacity 120ms ease';
        grid.style.opacity = '0';
      } catch (_) {}

      // Espera a que carguen las imágenes antes de inicializar el layout
      window.imagesLoaded(grid, function () {
        try {
          var msnry = new window.Masonry(grid, {
            itemSelector: 'li',
            columnWidth: 'li',
            percentPosition: true,
            transitionDuration: '0.2s'
          });
          instances.push(msnry);
          grid.__oxMasonry = msnry;
        } catch (e) {
          try { console.warn('[masonry-init] Error iniciando Masonry en grid:', e); } catch(_) {}
        }

        // Efecto Codrops si está disponible
        if (typeof window.AnimOnScroll === 'function') {
          try { new window.AnimOnScroll(grid, { minDuration: 0.4, maxDuration: 0.7, viewportFactor: 0.2 }); } catch (_) {}
        } else {
          try { grid.querySelectorAll('li').forEach(function (li) { li.classList.add('shown'); }); } catch (_) {}
        }

        // Muestra el grid tras aplicar layout
        requestAnimationFrame(function () {
          try { grid.style.opacity = '1'; } catch (_) {}
          try { grid.classList.add('is-ready'); } catch (_) {}
          try { grid.dispatchEvent(new CustomEvent('ox:masonry:ready')); } catch (_) {}
          if (window.__oxRelayoutGrid) setTimeout(window.__oxRelayoutGrid, 50);
        });
        // Relayout cuando cambie el tamaño del contenedor (e.g., fuentes/carrusel/tabs)
        try {
          if ('ResizeObserver' in window) {
            var ro = new ResizeObserver(function(){ try { msnry.layout(); } catch(_) {} });
            ro.observe(grid);
            grid.__oxMasonryRO = ro;
          } else {
            var relayoutOnResize = function(){ try { msnry.layout(); } catch(_) {} };
            window.addEventListener('resize', relayoutOnResize);
            grid.__oxRelayoutOnResize = relayoutOnResize;
          }
        } catch(_) {}
      });
    });
  }
})();
