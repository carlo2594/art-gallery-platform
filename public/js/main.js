// --- Chips rápidos de exposiciones: siempre envía el parámetro type ---
'use strict';

document.addEventListener('DOMContentLoaded', function () {

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
  document.querySelectorAll('form.offcanvas-body, form#quickChips').forEach(form => {
    form.addEventListener('submit', function(e) {
      // Elimina inputs y selects con value vacío
      Array.from(form.elements).forEach(el => {
        if (!el.name) return;
        // Para checkboxes y radios, solo si no están checked
        if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
        // Para otros, si el valor es vacío
        if ((el.tagName === 'INPUT' || el.tagName === 'SELECT') && el.value === '') {
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
