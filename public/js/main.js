// --- Chips rápidos de exposiciones: siempre envía el parámetro type ---
'use strict';

document.addEventListener('DOMContentLoaded', function () {
  // Exhibitions-only: enable vertical scroll snap (Lenis will handle smoothness)
  (function enableExhibitionsScrollSnap() {
    const sections = document.querySelectorAll('section.exhibition-section');
    if (!sections || sections.length < 2) return; // only apply on listing with 2+ sections
    document.body.classList.add('exhibitions-scroll-snap');
  })();

  // Eliminada la lógica de mostrar/ocultar el paginador dinámicamente
  // Mostrar el paginador solo cuando el grid de obras esté completamente cargado o si el usuario hace scroll y el grid es visible
  var grid = document.getElementById('grid');
  var pager = document.getElementById('pager-obras');
  var pagerShown = false;
  function showPager() {
    if (pager && !pagerShown) {
      // Oculta completamente antes de mostrar
      pager.style.display = 'none';
      pager.classList.add('pager-hidden');
      // Forzar reflow antes de mostrar (previene glitches de layout)
      void pager.offsetHeight;
      pager.style.display = '';
      pager.classList.remove('pager-hidden');
      pagerShown = true;
    }
  }
  if (grid && pager && grid.children.length > 0) {
    var images = grid.querySelectorAll('img');
    var loaded = 0;
    if (images.length === 0) {
      showPager();
    } else {
      images.forEach(function(img) {
        if (img.complete) {
          loaded++;
          if (loaded === images.length) showPager();
        } else {
          img.addEventListener('load', function() {
            loaded++;
            if (loaded === images.length) showPager();
          });
          img.addEventListener('error', function() {
            loaded++;
            if (loaded === images.length) showPager();
          });
        }
      });
    }
    // Mostrar el paginador si el usuario hace scroll y el grid es visible
    function onScrollShowPager() {
      if (pagerShown) return;
      var rect = grid.getBoundingClientRect();
      var windowHeight = (window.innerHeight || document.documentElement.clientHeight);
      // Si el grid está parcialmente visible en la ventana
      if (rect.top < windowHeight && rect.bottom > 0) {
        showPager();
        window.removeEventListener('scroll', onScrollShowPager);
      }
    }
    window.addEventListener('scroll', onScrollShowPager);
  }

  // Limpia inputs vacíos en formularios de filtros antes de enviar
  document.querySelectorAll('form.offcanvas-body, form#quickChips, form#availChips').forEach(form => {
    form.addEventListener('submit', function(e) {
      // Elimina inputs y selects con value vacío
      Array.from(form.elements).forEach(el => {
        if (!el.name) return;
        // Para checkboxes y radios, solo si no están checked
        if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
        // Para inputs/selects/botones con valor vacío, no enviarlos
        const tag = el.tagName;
        if ((tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON') && el.value === '') {
          el.name = '';
        }
      });
    });
  });

  // Utilidades pequeñas reutilizables
  const setBtnState = (btn, disabled, text) => {
    if (!btn) return;
    btn.disabled = !!disabled;
    if (text != null) btn.textContent = text;
  };

  const parseQS = () => Object.fromEntries(new URLSearchParams(location.search).entries());

  // Marca el tab activo basado en ?tab=
  const tabs = document.querySelectorAll('[data-ox-tab]');
  const qs = parseQS();
  const activeTab = qs.tab || (tabs[0] && tabs[0].dataset.oxTab);
  tabs.forEach(tabBtn => {
    const isActive = tabBtn.dataset.oxTab === activeTab;
    tabBtn.classList.toggle('active', isActive);
    const target = document.querySelector(tabBtn.getAttribute('data-bs-target'));
    if (target) {
      target.classList.toggle('show', isActive);
      target.classList.toggle('active', isActive);
    }
  });

  // Artist filters: show immediate pressed/active state on chip click
  (function setupArtistChips() {
    const form = document.getElementById('artistChips');
    if (!form) return;
    const chipButtons = form.querySelectorAll('button.chip[name="sort"]');
    chipButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Visual feedback before navigation
        chipButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        // Allow form submit to proceed normally
      });
    });
  })();

  // Al hacer click en un tab, NO recargamos la página: actualizamos la URL y mantenemos la paginación existente
  tabs.forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      const url = new URL(location.href);
      url.searchParams.set('tab', tabBtn.dataset.oxTab);
      // No forzamos page=1 ni reiniciamos artistPage/exhibitionPage
      history.replaceState(null, '', url.toString());
      if (tabBtn.dataset.oxTab === 'obras' && typeof window.__oxRelayoutGrid === 'function') {
        setTimeout(() => window.__oxRelayoutGrid(), 60);
      }
    });
  });

  // Si en algún flujo Bootstrap maneja tabs sin navegación (p.ej. historial o cache),
  // forzamos relayout de Masonry cuando el tab de Obras se hace visible
  document.querySelectorAll('a[data-bs-toggle="tab"]').forEach(el => {
    el.addEventListener('shown.bs.tab', (ev) => {
      const targetSel = ev.target.getAttribute('data-bs-target');
      if (!targetSel) return;
      const isObras = targetSel === '#tab-obras';
      if (isObras && typeof window.__oxRelayoutGrid === 'function') {
        // Pequeño delay para que el layout y las imágenes estén presentes
        setTimeout(() => window.__oxRelayoutGrid(), 60);
      }
    });
  });

  // Paginación SSR: los enlaces ya vienen con href correcto desde la vista (searchResults.pug)
  // Solo manejamos accesibilidad/UX mínima (scroll al inicio del listado al navegar, si el navegador mantiene pos)
  const obrasList = document.querySelector('#tab-obras');
  if (obrasList) {
    const pager = obrasList.querySelector('#pager-obras');
    if (pager) {
      pager.addEventListener('click', (e) => {
        const a = e.target.closest('a.page-link');
        if (!a) return;
        // Dejar que el navegador navegue normalmente; solo mejoramos UX
        // Nota: si quieres comportamiento SPA, quita esto (pero el usuario pidió SSR)
        // window.scrollTo({ top: obrasList.offsetTop - 24, behavior: 'smooth' });
      });
    }
  }

  // --------- Resto de la UI general (no relacionado al AJAX de /search) ---------

  // Copiar al portapapeles
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetSel = btn.getAttribute('data-copy');
      const node = document.querySelector(targetSel);
      if (!node) return;
      try {
        await navigator.clipboard.writeText(node.innerText.trim());
        const prev = btn.textContent;
        setBtnState(btn, true, '¡Copiado!');
        setTimeout(() => setBtnState(btn, false, prev), 1000);
      } catch (err) {
        console.error('No se pudo copiar', err);
      }
    });
  });

  // Mostrar/ocultar contraseña
  document.querySelectorAll('[data-toggle-password]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.querySelector(btn.getAttribute('data-toggle-password'));
      if (!target) return;
      const isPwd = target.type === 'password';
      target.type = isPwd ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(isPwd));
    });
  });

  // Muestra el nombre de archivo seleccionado en inputs file
  document.querySelectorAll('input[type=file]').forEach(input => {
    input.addEventListener('change', () => {
      const nameEl = input.closest('.form-group, .mb-3, .input-group')?.querySelector('[data-file-name]');
      if (nameEl) nameEl.textContent = input.files?.[0]?.name || '';
    });
  });

  // Desplegables con auto-submit (chips rápidos)
  document.querySelectorAll('[data-autosubmit]').forEach(select => {
    select.addEventListener('change', () => {
      const form = select.closest('form');
      if (form) form.submit();
    });
  });

  // Evita submit doble
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', () => {
      const btn = form.querySelector('button[type=submit], input[type=submit]');
      setBtnState(btn, true);
      setTimeout(() => setBtnState(btn, false), 1500);
    });
  });

  // Offcanvas: al cerrar, resetea inputs con data-reset-on-close
  document.querySelectorAll('.offcanvas').forEach(oc => {
    oc.addEventListener('hidden.bs.offcanvas', () => {
      oc.querySelectorAll('[data-reset-on-close]')?.forEach(el => {
        if (el.matches('input[type=checkbox], input[type=radio]')) el.checked = false;
        else if (el.matches('input, select, textarea')) el.value = '';
      });
    });
  });

  // Tooltips de Bootstrap
  if (window.bootstrap) {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }

  // Evita que inputs numéricos tengan valores no válidos
  document.querySelectorAll('input[type=number][min], input[type=number][max]').forEach(inp => {
    inp.addEventListener('input', () => {
      const min = inp.min !== '' ? Number(inp.min) : null;
      const max = inp.max !== '' ? Number(inp.max) : null;
      let v = Number(inp.value);
      if (!Number.isFinite(v)) return;
      if (min != null && v < min) inp.value = String(min);
      if (max != null && v > max) inp.value = String(max);
    });
  });

  // Enlaces que requieren confirmación
  document.querySelectorAll('[data-confirm]').forEach(a => {
    a.addEventListener('click', (e) => {
      const msg = a.getAttribute('data-confirm') || '¿Seguro?';
      if (!confirm(msg)) {
        e.preventDefault();
      }
    });
  });

  // ------- (Opcional) Scroll al hash preservando offset por header fijo
  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

});

// ------ Código que existía antes y es independiente de /search (login, etc.) ------

// Mostrar/ocultar password y validación simple de formularios (si aplica en tu app)
(function() {
  const forms = document.querySelectorAll('.needs-validation');
  Array.prototype.slice.call(forms).forEach(function(form) {
    form.addEventListener('submit', function (event) {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      form.classList.add('was-validated');
    }, false);
  });
})();

// Ajuste responsivo de imágenes en el login (ejemplo genérico)
const loginSideImg = document.querySelector('[data-login-side-img]');
function checkLoginSideImgWidth() {
  if (!loginSideImg) return;
  const vw = window.innerWidth;
  if (loginSideImg.offsetWidth > vw * 0.5) {
    loginSideImg.style.display = 'none';
  } else {
    loginSideImg.style.display = '';
  }
}
if (loginSideImg) {
  window.addEventListener('resize', checkLoginSideImgWidth);
  window.addEventListener('DOMContentLoaded', checkLoginSideImgWidth);
  checkLoginSideImgWidth();
}

// ------ Artwork Detail Functions ------

// Función para centrar estadísticas respecto al botón
function centerStatsToButton() {
  const actionSection = document.querySelector('.artwork-action-section');
  const button = actionSection?.querySelector('.btn');
  const stats = actionSection?.querySelector('.artwork-stats');
  
  if (!button || !stats) return;
  
  // Obtener dimensiones y posición del botón
  const buttonRect = button.getBoundingClientRect();
  const sectionRect = actionSection.getBoundingClientRect();
  
  // Calcular posición relativa del botón respecto a la sección
  const buttonLeft = buttonRect.left - sectionRect.left;
  const buttonWidth = buttonRect.width;
  
  // Establecer custom properties CSS
  stats.style.setProperty('--button-width', `${buttonWidth}px`);
  stats.style.setProperty('--button-left', `${buttonLeft}px`);
  
  // Agregar clase para activar el posicionamiento
  stats.classList.add('centered-to-button');
}

// Toggle de favoritos con Axios/Fetch
async function toggleFavorite(artworkId, desiredState) {
  try {
    // Preferir axios si está disponible globalmente
    const hasAxios = typeof window !== 'undefined' && typeof window.axios !== 'undefined';

    if (desiredState === true) {
      if (hasAxios) {
        try {
          await axios.post('/api/v1/favorites', { artworkId });
        } catch (err) {
          if (err?.response?.status !== 400) throw err; // 400 = ya existía
        }
      } else {
        const res = await fetch('/api/v1/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ artworkId })
        });
        if (!res.ok && res.status !== 400) throw new Error('POST /favorites failed');
      }
      return { ok: true, favorited: true };
    } else if (desiredState === false) {
      if (hasAxios) {
        try {
          await axios.delete(`/api/v1/favorites/${artworkId}`);
        } catch (err) {
          const s = err?.response?.status;
          if (s && s !== 404 && s !== 204) throw err; // 404 = no existía
        }
      } else {
        const res = await fetch(`/api/v1/favorites/${artworkId}`, {
          method: 'DELETE',
          credentials: 'same-origin'
        });
        if (!res.ok && res.status !== 404 && res.status !== 204) throw new Error('DELETE /favorites failed');
      }
      return { ok: true, favorited: false };
    } else {
      // Si no se especifica desiredState, intentar agregar primero (UX simple)
      if (hasAxios) {
        await axios.post('/api/v1/favorites', { artworkId }).catch(async (err) => {
          if (err?.response?.status === 400) {
            // Ya estaba: intentar remover
            await axios.delete(`/api/v1/favorites/${artworkId}`);
          } else if (err?.response?.status === 401) {
            throw err; // manejar más abajo
          } else {
            throw err;
          }
        });
      } else {
        const res = await fetch('/api/v1/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ artworkId })
        });
        if (!res.ok) {
          if (res.status === 400) {
            await fetch(`/api/v1/favorites/${artworkId}`, { method: 'DELETE', credentials: 'same-origin' });
          } else if (res.status === 401) {
            const e = new Error('Unauthorized'); e.status = 401; throw e;
          } else {
            throw new Error('Favorites toggle failed');
          }
        }
      }
    }
    // Si llegamos aquí, el modo auto alternó: asumir que quedó como agregado
    return { ok: true, favorited: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// Vincular botón de favorito en detalle de obra
function setupArtworkFavoriteButton() {
  const btn = document.querySelector('.artwork-fav-btn');
  if (!btn) return;

  // Si el botón abre modal (usuario no autenticado), no interceptar
  if (btn.hasAttribute('data-bs-toggle')) return;

  const icon = btn.querySelector('i');
  const artworkId = btn.getAttribute('data-artwork-id');
  if (!artworkId) return;

  const getState = () => (btn.getAttribute('data-favorited') === 'true');
  const setState = (fav, opts) => {
    opts = opts || {};
    btn.setAttribute('data-favorited', fav ? 'true' : 'false');
    btn.setAttribute('aria-pressed', fav ? 'true' : 'false');
    btn.classList.toggle('favorited', !!fav);
    // Alterna estilos Bootstrap para feedback visual
    btn.classList.toggle('btn-danger', !!fav);
    btn.classList.toggle('btn-outline-danger', !fav);
    if (icon) {
      icon.classList.toggle('far', !fav);
      icon.classList.toggle('fas', fav);
      // Pequeña animación de "pop"
      icon.classList.add('pop');
      icon.addEventListener('animationend', () => icon.classList.remove('pop'), { once: true });
    }
    if (!opts.silent) {
      // Actualiza contador si existe
      const el = document.querySelector('.artwork-favorites-text');
      if (el) {
        const m = el.textContent.match(/(\d+[\d.,]*)/);
        if (m) {
          const num = Number(m[1].replace(/[.,]/g, (c) => (c === '.' ? '' : '')));
          const next = Math.max(0, (fav ? num + 1 : num - 1));
          el.textContent = `${next.toLocaleString()} favoritos`;
        }
      }
    }
    // Feedback accesible
    try {
      const live = document.getElementById('sr-live');
      if (live) live.textContent = fav ? 'Agregada a favoritos' : 'Quitada de favoritos';
    } catch (e) {}
  };

  // Inicializar estado desde API si el usuario está autenticado
  (async function initFavoriteState(){
    try {
      // Si ya está marcado en el markup, respetarlo
      if (getState()) return;
      const hasAxios = typeof window !== 'undefined' && typeof window.axios !== 'undefined';
      if (hasAxios) {
        const res = await axios.get('/api/v1/favorites');
        const list = res?.data?.data?.favorites || res?.data?.favorites || [];
        if (Array.isArray(list) && list.some(f => (f.artwork && (f.artwork._id === artworkId || f.artwork === artworkId)))) {
          setState(true, { silent: true });
        }
      } else {
        const res = await fetch('/api/v1/favorites', { credentials: 'same-origin' });
        if (res.ok) {
          const data = await res.json();
          const list = data?.data?.favorites || data?.favorites || [];
          if (Array.isArray(list) && list.some(f => (f.artwork && (f.artwork._id === artworkId || f.artwork === artworkId)))) {
            setState(true, { silent: true });
          }
        }
      }
    } catch (e) {
      // 401/403: usuario no logueado o sin acceso; ignorar
    }
  })();

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    const current = getState();
    btn.disabled = true;
    btn.classList.add('disabled');
    const res = await toggleFavorite(artworkId, !current);
    btn.disabled = false;
    btn.classList.remove('disabled');

    if (res.ok) {
      const finalState = typeof res.favorited === 'boolean' ? res.favorited : !current;
      setState(finalState);
    } else {
      const status = res.error?.response?.status || res.error?.status;
      if (status === 401 || status === 403) {
        // Intentar abrir el modal si existe
        const modalEl = document.getElementById('favAuthModal');
        if (modalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
          const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
          modal.show();
          return;
        }
        // Fallback: redirigir a login con returnTo
        const returnTo = window.location.pathname + window.location.search;
        window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      } else {
        console.error('No se pudo actualizar favoritos', res.error);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', setupArtworkFavoriteButton);

// Make toggleFavorite available global (legacy handlers)
window.toggleFavorite = toggleFavorite;

// ------ Lightbox Functions ------

// Lightbox functionality for artwork detail page
function initLightbox() {
  const body = document.body;
  const thumb = document.getElementById('artwork-thumb');
  const lb = document.getElementById('lightbox');
  
  if (!thumb || !lb) return; // Solo ejecutar si estamos en la página de detalle de obra
  
  const lbImg = document.getElementById('lightboxImg');
  const btnClose = lb.querySelector('.lightbox__close');

  function openLightbox(src, alt) {
    lbImg.src = src;
    lbImg.alt = alt || '';
    lb.classList.add('open');
    body.classList.add('noscroll');
    // Enfocar el botón para accesibilidad
    setTimeout(() => btnClose.focus(), 10);
  }

  function closeLightbox() {
    lb.classList.remove('open');
    body.classList.remove('noscroll');
    // Limpiar para liberar memoria en móviles
    lbImg.removeAttribute('src');
    thumb.focus?.();
  }

  // Abrir al hacer click en la miniatura
  thumb.addEventListener('click', (e) => {
    const img = e.currentTarget.querySelector('img');
    if (!img) return;
    const src = img.getAttribute('data-full') || img.src;
    openLightbox(src, img.alt);
  });

  // Cerrar con botón
  btnClose.addEventListener('click', closeLightbox);

  // Cerrar con ESC
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lb.classList.contains('open')) {
      closeLightbox();
    }
  });

  // Cerrar al hacer click fuera de la imagen (en el fondo)
  lb.addEventListener('click', (e) => {
    const clickedBackdrop = e.target === lb;
    if (clickedBackdrop) closeLightbox();
  });

  // Opcional: doble click dentro del lightbox para ajustar a 100% / contain
  let toggled = false;
  lbImg.addEventListener('dblclick', () => {
    toggled = !toggled;
    lbImg.style.objectFit = toggled ? 'none' : 'contain';
    lbImg.style.cursor = toggled ? 'zoom-out' : 'default';
  });
}

// Initialize lightbox when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  initLightbox();
  
  // Centrar estadísticas al cargar la página
  if (document.querySelector('.artwork-action-section')) {
    centerStatsToButton();
    
    // Recentrar en resize de ventana
    window.addEventListener('resize', centerStatsToButton);
  }

  // Inicializar Masonry para grids relacionados
  initRelatedGrid();

  // Revelar botón "Volver a obras" cuando el layout esté listo
  initBackButtonReveal();

  // Configurar botón Volver para regresar al origen si es posible
  initSmartBackLink();

  // Configurar back en login/signup para respetar returnTo o referrer
  initLoginBackLink();

  // Añadir returnTo a los links de Login/Signup del navbar
  initNavbarAuthReturnTo();
});

// ------ Related Artworks Grid (Masonry) ------

// Función para inicializar Masonry en obras relacionadas
function initRelatedGrid() {
  const relatedGrid = document.getElementById('related-grid');
  if (!relatedGrid) return; // No hay obras relacionadas

  // Fallback para mostrar sin animación si faltan librerías
  const revealFallback = function() {
    relatedGrid.querySelectorAll('li').forEach(function(li) {
      li.classList.add('shown');
    });
    relatedGrid.style.opacity = '1';
  };

  // Verificar que las librerías estén disponibles
  if (typeof window.imagesLoaded !== 'function' || typeof window.Masonry !== 'function') {
    revealFallback();
    return;
  }

  // Ocultar temporalmente para evitar salto visual
  relatedGrid.style.transition = 'opacity 120ms ease';
  relatedGrid.style.opacity = '0';

  // Esperar a que carguen las imágenes
  window.imagesLoaded(relatedGrid, function() {
    try {
      const msnry = new window.Masonry(relatedGrid, {
        itemSelector: 'li',
        columnWidth: 'li',
        percentPosition: true,
        transitionDuration: '0.2s'
      });

      // Guardar instancia globalmente para relayout posterior
      window.__oxRelatedMasonry = msnry;

      // Efecto de animación si está disponible
      if (typeof window.AnimOnScroll === 'function') {
        new window.AnimOnScroll(relatedGrid, {
          minDuration: 0.4,
          maxDuration: 0.7,
          viewportFactor: 0.2
        });
      } else {
        revealFallback();
      }

      // Mostrar el grid
      requestAnimationFrame(function() {
        relatedGrid.style.opacity = '1';
        // Relayout final
        setTimeout(function() {
          if (msnry && typeof msnry.layout === 'function') {
            msnry.layout();
          }
        }, 50);
        // Una vez listo el grid, mostramos el botón de regreso
        revealBackButton();
      });

    } catch (e) {
      console.warn('[related-grid] Error iniciando Masonry:', e);
      revealFallback();
    }
  });
}

// ===== Artist Grid Reveal =====
function initArtistReveal(){
  const cards = Array.from(document.querySelectorAll('.artist-card.reveal-item'));
  if (!cards.length || !('IntersectionObserver' in window)) return;
  let counter = 0;

  const revealWhenReady = (card, img) => {
    const delay = Math.min(counter++ * 120, 1200);
    card.style.transitionDelay = delay + 'ms';
    if (img) img.classList.add('loaded');
    const container = card.querySelector('.artist-image-container');
    if (container) container.classList.remove('img-loading');
    card.classList.add('reveal-in');
  };

  const io = new IntersectionObserver((entries) => {
    entries
      .filter(e => e.isIntersecting)
      .sort((a,b) => cards.indexOf(a.target) - cards.indexOf(b.target))
      .forEach(entry => {
        const card = entry.target;
        const img = card.querySelector('.artist-image');
        const container = card.querySelector('.artist-image-container');
        const proceed = () => { revealWhenReady(card, img); io.unobserve(card); };

        if (img && !(img.complete && img.naturalWidth > 0)) {
          if (container) container.classList.add('img-loading');
          img.addEventListener('load', proceed, { once: true });
          img.addEventListener('error', proceed, { once: true });
        } else {
          proceed();
        }
      });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

  cards.forEach(el => io.observe(el));

  // Kick an initial pass for cards already in view (e.g., cache/instant paint)
  const vh = window.innerHeight || document.documentElement.clientHeight;
  requestAnimationFrame(() => {
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      if (rect.top < vh && rect.bottom > 0 && !card.classList.contains('reveal-in')) {
        const img = card.querySelector('.artist-image');
        const container = card.querySelector('.artist-image-container');
        const proceed = () => { revealWhenReady(card, img); io.unobserve(card); };
        if (img && !(img.complete && img.naturalWidth > 0)) {
          if (container) container.classList.add('img-loading');
          img.addEventListener('load', proceed, { once: true });
          img.addEventListener('error', proceed, { once: true });
        } else {
          proceed();
        }
      }
    });
  });
}

// Mostrar el botón back tras el layout del grid o inmediatamente si no hay grid
function initBackButtonReveal(){
  const section = document.querySelector('.artwork-back-section');
  if (!section) return;

  const grid = document.getElementById('related-grid');
  const reveal = () => revealBackButton();

  if (grid && typeof window.imagesLoaded === 'function') {
    // Fallback por si algo falla: mostrar después de 1500ms
    const t = setTimeout(reveal, 1500);
    window.imagesLoaded(grid, function(){
      clearTimeout(t);
      reveal();
    });
  } else {
    // Sin grid o sin librería, mostrar de inmediato tras el primer frame
    requestAnimationFrame(reveal);
  }
}

function revealBackButton(){
  const section = document.querySelector('.artwork-back-section');
  if (section) section.classList.add('is-visible');
}

// Enlaza el botón de volver para regresar a la página de origen (same-origin) si existe
function initSmartBackLink(){
  try {
    const link = document.querySelector('.artwork-back-btn');
    if (!link) return;
    const fallback = link.getAttribute('href') || '/artworks';

    // 1) Priorizar returnTo=? en la URL
    const sp = new URLSearchParams(window.location.search);
    const rt = sp.get('returnTo');
    if (rt) {
      try {
        const rtUrl = new URL(rt, window.location.origin);
        if (rtUrl.origin === window.location.origin) {
          link.setAttribute('href', rtUrl.href);
          link.dataset.smartBack = 'returnTo';
          link.addEventListener('click', function(e){
            e.preventDefault();
            window.location.assign(rtUrl.href);
          });
          return;
        }
      } catch(_){}
    }

    // 2) Usar referrer same-origin si existe
    const ref = document.referrer;
    if (ref) {
      const refUrl = new URL(ref, window.location.origin);
      const sameOrigin = refUrl.origin === window.location.origin;
      const samePage = (refUrl.pathname === window.location.pathname) && (refUrl.search === window.location.search);
      if (sameOrigin && !samePage) {
        link.setAttribute('href', refUrl.href);
        link.dataset.smartBack = 'referrer';
        link.addEventListener('click', function(e){
          if (history.length > 1) {
            e.preventDefault();
            history.back();
          }
        });
      }
    }
  } catch (e) {}
}

// Back en páginas de login/signup: prioriza ?returnTo= y luego referrer same-origin
function initLoginBackLink(){
  try {
    const link = document.querySelector('.login-signin-back-link');
    if (!link) return;
    const fallback = link.getAttribute('href') || '/';

    const sp = new URLSearchParams(window.location.search);
    const rt = sp.get('returnTo');
    if (rt) {
      try {
        const rtUrl = new URL(rt, window.location.origin);
        if (rtUrl.origin === window.location.origin) {
          link.setAttribute('href', rtUrl.href);
          link.dataset.smartBack = 'returnTo';
          link.addEventListener('click', function(e){ e.preventDefault(); window.location.assign(rtUrl.href); });
          return;
        }
      } catch(_){}
    }

    const ref = document.referrer;
    if (ref) {
      const refUrl = new URL(ref, window.location.origin);
      const sameOrigin = refUrl.origin === window.location.origin;
      const samePage = (refUrl.pathname === window.location.pathname) && (refUrl.search === window.location.search);
      if (sameOrigin && !samePage) {
        link.setAttribute('href', refUrl.href);
        link.dataset.smartBack = 'referrer';
        link.addEventListener('click', function(e){ if (history.length > 1) { e.preventDefault(); history.back(); } });
      }
    }
  } catch (e) {}
}

// Agrega ?returnTo=<current> a los links de Login/Signup del navbar
function initNavbarAuthReturnTo(){
  try {
    const here = window.location.pathname + window.location.search;
    // No reescribir si estamos ya en login/signup
    if (/^\/(login|signup|signUp)\b/i.test(window.location.pathname)) return;

    const addRt = (a) => {
      if (!a) return;
      try {
        const url = new URL(a.getAttribute('href'), window.location.origin);
        // Si ya tiene returnTo, no tocar
        if (url.searchParams.has('returnTo')) return;
        // Solo aplicar a rutas exactas /login o /signup
        if (!/^\/(login|signup|signUp)$/.test(url.pathname)) return;
        url.searchParams.set('returnTo', here);
        a.setAttribute('href', url.pathname + url.search);
      } catch(_){}
    };

    document.querySelectorAll('a.nav-link[href="/login"], a.nav-link[href="/signup"], a.nav-link[href="/signUp"]').forEach(addRt);
  } catch (e) {}
}

// Ensure initialization across different navigation/reload paths
(function ensureArtistRevealInit(){
  let done = false;
  const run = () => { if (done) return; done = true; initArtistReveal(); };
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    run();
  } else {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }
  window.addEventListener('load', run, { once: true });
  window.addEventListener('pageshow', (e) => { if (e.persisted) run(); }); // bfcache
})();

// ===== Exhibitions Reveal (full-screen sections) =====
function initExhibitionsReveal(){
  const cards = Array.from(document.querySelectorAll('.exhibition-hero-container.reveal-item, .exhibition-split.reveal-item'));
  if (!cards.length || !('IntersectionObserver' in window)) return;
  let counter = 0;

  const revealWhenReady = (card, img) => {
    const delay = Math.min(counter++ * 120, 1200);
    card.style.transitionDelay = delay + 'ms';
    if (img) img.classList.add('loaded');
    card.classList.add('reveal-in');
    card.classList.remove('img-loading');
  };

  const io = new IntersectionObserver((entries) => {
    entries
      .filter(e => e.isIntersecting)
      .sort((a,b) => cards.indexOf(a.target) - cards.indexOf(b.target))
      .forEach(entry => {
        const card = entry.target;
        const img = card.querySelector('.exhibition-hero-image');
        const proceed = () => { revealWhenReady(card, img); io.unobserve(card); };
        if (img && !(img.complete && img.naturalWidth > 0)) {
          (card.classList.contains('exhibition-split') ? card.querySelector('.exhibition-media') : card).classList.add('img-loading');
          img.addEventListener('load', proceed, { once: true });
          img.addEventListener('error', proceed, { once: true });
        } else {
          proceed();
        }
      });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

  cards.forEach(el => io.observe(el));

  // Initial pass for already visible cards
  const vh = window.innerHeight || document.documentElement.clientHeight;
  requestAnimationFrame(() => {
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      if (rect.top < vh && rect.bottom > 0 && !card.classList.contains('reveal-in')) {
        const img = card.querySelector('.exhibition-hero-image');
        const proceed = () => { revealWhenReady(card, img); io.unobserve(card); };
        if (img && !(img.complete && img.naturalWidth > 0)) {
          (card.classList.contains('exhibition-split') ? card.querySelector('.exhibition-media') : card).classList.add('img-loading');
          img.addEventListener('load', proceed, { once: true });
          img.addEventListener('error', proceed, { once: true });
        } else {
          proceed();
        }
      }
    });
  });
}

(function ensureExhibitionsRevealInit(){
  let done = false;
  const run = () => { if (done) return; done = true; initExhibitionsReveal(); };
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    run();
  } else {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }
  window.addEventListener('load', run, { once: true });
  window.addEventListener('pageshow', (e) => { if (e.persisted) run(); });
})();

// ===== Artwork View Beacon =====
function initArtworkViewBeacon(){
  try {
    var thumb = document.getElementById('artwork-thumb');
    if (!thumb) return;
    var artworkId = thumb.dataset && thumb.dataset.artworkId;
    if (!artworkId) return;
    var fired = false;
    function send(){
      if (fired) return; fired = true;
      var payload = JSON.stringify({ artwork: artworkId });
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/v1/artwork-views', blob);
      } else {
        try { fetch('/api/v1/artwork-views', { method:'POST', headers:{'Content-Type':'application/json'}, body: payload, keepalive: true }); } catch(e) {}
      }
    }
    function schedule(){ setTimeout(send, 2000); }
    var heroImg = thumb.querySelector('img');
    if (heroImg && !(heroImg.complete && heroImg.naturalWidth > 0)){
      heroImg.addEventListener('load', schedule, { once: true });
      heroImg.addEventListener('error', schedule, { once: true });
    } else {
      schedule();
    }
    document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'hidden') send(); }, { once: true });
    window.addEventListener('pagehide', send, { once: true });
  } catch(e) {}
}

(function ensureArtworkViewBeacon(){
  let done = false;
  const run = () => { if (done) return; done = true; initArtworkViewBeacon(); };
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    run();
  } else {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }
  window.addEventListener('load', run, { once: true });
  window.addEventListener('pageshow', (e) => { if (e.persisted) run(); });
})();
