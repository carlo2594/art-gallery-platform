// --- Chips rápidos de exposiciones: siempre envía el parámetro type ---
'use strict';
try { console.log('[App] main.js loaded; readyState=', document.readyState); } catch(_) {}

// Ejecuta el init incluso si DOMContentLoaded ya ocurrió (script al final del body)
const __onReady = (cb) => {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cb);
  else cb();
};

__onReady(function () {
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

  const ensureHorizontalImage = (file) => {
    return new Promise((resolve, reject) => {
      try { console.debug('[AccountPhoto] ensureHorizontalImage: type=%s size=%s name=%s', file && file.type, file && file.size, file && file.name); } catch(_) {}
      if (!file) {
        return reject(new Error('Selecciona una imagen.'));
      }
      const type = (file.type || '').toLowerCase();
      if (type && !type.startsWith('image/')) {
        return reject(new Error('Selecciona un archivo de imagen valido.'));
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        try { console.debug('[AccountPhoto] ensureHorizontalImage: dimensions=%sx%s', width, height); } catch(_) {}
        if (width > height) {
          resolve();
        } else {
          reject(new Error('La foto debe ser horizontal (mas ancha que alta).'));
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo leer la imagen seleccionada.'));
      };
    });
  };

  window.ensureHorizontalImage = ensureHorizontalImage;

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

  (function handleAccountPage() {
    const alerts = document.getElementById('accountAlerts');
    const profileForm = document.getElementById('accountProfileForm');
    const photoForm = document.getElementById('accountPhotoForm');
    const photoDeleteForm = document.getElementById('accountPhotoDeleteForm');
    const passwordForm = document.getElementById('accountPasswordForm');
    if (!alerts && !profileForm && !photoForm && !photoDeleteForm && !passwordForm) return;

    const showAccountAlert = (type, message) => {
      if (alerts) {
        const wrapper = document.createElement('div');
        wrapper.className = `alert alert-${type} alert-dismissible fade show`;
        wrapper.setAttribute('role', 'alert');
        wrapper.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-close';
        closeBtn.setAttribute('data-bs-dismiss', 'alert');
        closeBtn.setAttribute('aria-label', 'Cerrar');
        wrapper.appendChild(closeBtn);

        alerts.innerHTML = '';
        alerts.appendChild(wrapper);
      } else if (message) {
        if (typeof window.alert === 'function') window.alert(message);
        else console.log(message);
      }
    };

    const PROFILE_FIELD_LIMITS = [
      { key: 'firstName', label: 'Nombre', max: 60 },
      { key: 'lastName', label: 'Apellidos', max: 60 },
      { key: 'name', label: 'Nombre público', max: 120 },
      { key: 'headline', label: 'Titular', max: 80 },
      { key: 'bio', label: 'Biografía', max: 1200 },
      { key: 'website', label: 'Sitio web', max: 200 },
      { key: 'social[facebook]', label: 'Facebook', max: 80 },
      { key: 'social[instagram]', label: 'Instagram', max: 80 },
      { key: 'social[linkedin]', label: 'LinkedIn', max: 80 },
      { key: 'social[tiktok]', label: 'TikTok', max: 80 },
      { key: 'social[x]', label: 'X', max: 80 },
      { key: 'social[youtube]', label: 'YouTube', max: 80 }
    ];

    const validateProfileLengths = (formData) => {
      for (const { key, label, max } of PROFILE_FIELD_LIMITS) {
        const raw = formData.get(key);
        if (raw == null) continue;
        const value = String(raw).trim();
        if (value.length > max) {
          showAccountAlert('warning', `${label} no puede exceder ${max} caracteres.`);
          return false;
        }
      }
      return true;
    };

    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = profileForm.querySelector('button[type=submit]');
        const formData = new FormData(profileForm);
        if (!validateProfileLengths(formData)) {
          setBtnState(btn, false, 'Guardar cambios');
          return;
        }

        setBtnState(btn, true, 'Guardando...');
        try {
          const body = new URLSearchParams();
          for (const [key, value] of formData.entries()) body.append(key, value);

          const res = await fetch(profileForm.action, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.message || 'No se pudieron guardar los cambios');
          showAccountAlert('success', data.message || 'Perfil actualizado correctamente');
          setTimeout(() => location.reload(), 600);
        } catch (err) {
          console.error(err);
          showAccountAlert('danger', err.message || 'Ocurrió un error');
        } finally {
          setBtnState(btn, false, 'Guardar cambios');
        }
      });
    }

    if (false && photoForm) {
      try { console.log('[AccountPhoto] Hooked photoForm submit handler'); } catch(_) {}
      photoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = photoForm.querySelector('button[type=submit]');
        const progWrap = photoForm.querySelector('[data-progress-wrap]');
        const progBar = photoForm.querySelector('[data-progress-bar]');
        const useAxios = typeof window.axios !== 'undefined' && typeof window.axios.post === 'function';
        try { console.log('[AccountPhoto] Submit: using axios=%s', useAxios); } catch(_) {}
        try { console.log('[AccountPhoto] Submit: start for action %s', photoForm && photoForm.action); } catch(_) {}
        setBtnState(btn, true, 'Validando...');

        const showProgress = (show) => {
          if (!progWrap) return;
          progWrap.style.display = show ? '' : 'none';
        };
        const updateProgress = (pct) => {
          if (!progBar) return;
          const val = Math.max(0, Math.min(100, Math.round(pct)));
          progBar.style.width = val + '%';
          progBar.setAttribute('aria-valuenow', String(val));
          progBar.textContent = val + '%';
        };
        try {
          const fileInput = photoForm.querySelector('input[name="profileImage"][type="file"]');
          const file = fileInput && fileInput.files && fileInput.files[0];
          try { console.log('[AccountPhoto] Submit: file selected=%s type=%s size=%s', !!file, file && file.type, file && file.size); } catch(_) {}
          if (!file) {
            showAccountAlert('warning', 'Selecciona una imagen antes de actualizar la foto.');
            return;
          }

          await ensureHorizontalImage(file);
          setBtnState(btn, true, 'Subiendo...');
          // Importante: construir FormData ANTES de deshabilitar el input file
          const formData = new FormData(photoForm);
          try { console.log('[AccountPhoto] Submit: formData keys=%o', Array.from(formData.keys())); } catch(_) {}
          if (fileInput) fileInput.disabled = true;
          showProgress(true);
          updateProgress(0);
          let data;
          if (useAxios) {
            try {
              const res = await axios.post(photoForm.action, formData, {
                headers: { Accept: 'application/json' },
                withCredentials: true,
                onUploadProgress: (evt) => {
                  if (evt && evt.total) {
                    const pct = (evt.loaded / evt.total) * 100;
                    updateProgress(pct);
                    try { console.debug('[AccountPhoto] Upload progress: %d/%d (%.2f%)', evt.loaded, evt.total, pct); } catch(_) {}
                  }
                }
              });
              data = res && res.data ? res.data : {};
              try { console.log('[AccountPhoto] Upload response (axios): %o', data); } catch(_) {}
            } catch (err) {
              try { console.error('[AccountPhoto] Upload error (axios):', err); } catch(_) {}
              const msg = (err && err.response && err.response.data && err.response.data.message) || err.message || 'No se pudo actualizar la foto';
              throw new Error(msg);
            }
          } else {
            const res = await fetch(photoForm.action, {
              method: 'POST',
              headers: { Accept: 'application/json' },
              body: formData,
              credentials: 'same-origin'
            });
            data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'No se pudo actualizar la foto');
            try { console.log('[AccountPhoto] Upload response (fetch): %o', data); } catch(_) {}
          }

          showAccountAlert('success', (data && data.message) || 'Foto actualizada');

          if (data && data.data && data.data.profileImage) {
            const container = document.querySelector('.account-photo-preview-group');
            if (container) {
              let img = container.querySelector('img.account-photo-preview');
              if (!img) {
                // Reemplaza placeholder por imagen
                container.innerHTML = '';
                img = document.createElement('img');
                img.className = 'img-fluid rounded account-photo-preview';
                img.style.maxWidth = '220px';
                img.style.width = '100%';
                img.style.height = 'auto';
                img.style.objectFit = 'contain';
                img.alt = 'Foto de perfil';
                container.appendChild(img);
              }
              img.src = data.data.profileImage;
            } else {
              const img = document.querySelector('#tab-foto img');
              if (img) img.src = data.data.profileImage;
            }
          }
        } catch (err) {
          try { console.error('[AccountPhoto] Submit error:', err); } catch(_) {}
          showAccountAlert('danger', err.message || 'Ocurrió un error');
        } finally {
          try { console.debug('[AccountPhoto] Submit finally: resetting UI'); } catch(_) {}
          setBtnState(btn, false, 'Actualizar foto');
          photoForm.reset();
          if (progBar) updateProgress(0);
          showProgress(false);
          const fileInput = photoForm.querySelector('input[name="profileImage"][type="file"]');
          if (fileInput) fileInput.disabled = false;
        }
      });
    }

    if (false && photoDeleteForm) {
      try { console.log('[AccountPhoto] Hooked photoDeleteForm submit handler'); } catch(_) {}
      photoDeleteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = photoDeleteForm.querySelector('button[type=submit]');
        const useAxios = typeof window.axios !== 'undefined' && typeof window.axios.post === 'function';
        const prevHtml = btn ? btn.innerHTML : '';
        const prevDisabled = btn ? btn.disabled : false;
        const showSpinner = () => { if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Eliminando...'; } };
        const restoreBtn = () => { if (btn) { btn.disabled = prevDisabled; btn.innerHTML = prevHtml || 'Eliminar foto'; } };
        showSpinner();
        try {
          try { console.log('[AccountPhoto] Delete submit: using axios=%s', useAxios); } catch(_) {}
          const body = new URLSearchParams();
          body.set('profileImage', '');

          let data;
          if (useAxios) {
            try {
              const res = await axios.post(photoDeleteForm.action, body, {
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                },
                withCredentials: true
              });
              data = (res && res.data) || {};
              try { console.log('[AccountPhoto] Delete response (axios): %o', data); } catch(_) {}
            } catch (err) {
              try { console.error('[AccountPhoto] Delete error (axios):', err); } catch(_) {}
              const msg = (err && err.response && err.response.data && err.response.data.message) || err.message || 'No se pudo eliminar la foto';
              throw new Error(msg);
            }
          } else {
            const res = await fetch(photoDeleteForm.action, {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
              },
              body,
              credentials: 'same-origin'
            });
            data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'No se pudo eliminar la foto');
            try { console.log('[AccountPhoto] Delete response (fetch): %o', data); } catch(_) {}
          }

          showAccountAlert('success', data.message || 'Foto eliminada');
          // Actualiza el preview a placeholder
          const container = document.querySelector('.account-photo-preview-group');
          if (container) {
            container.innerHTML = '';
            const placeholder = document.createElement('div');
            placeholder.className = 'd-inline-flex align-items-center justify-content-center bg-light rounded account-photo-placeholder';
            placeholder.style.width = '220px';
            placeholder.style.height = '220px';
            const icon = document.createElement('i');
            icon.className = 'fas fa-user fa-3x text-muted account-photo-placeholder-icon';
            placeholder.appendChild(icon);
            container.appendChild(placeholder);
          } else {
            const img = document.querySelector('#tab-foto img');
            if (img && img.parentNode) {
              img.parentNode.removeChild(img);
            }
          }
        } catch (err) {
          try { console.error('[AccountPhoto] Delete submit error:', err); } catch(_) {}
          showAccountAlert('danger', err.message || 'Ocurrió un error');
        } finally {
          restoreBtn();
        }
      });
    }

    if (passwordForm) {
      passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = passwordForm.querySelector('button[type=submit]');
        setBtnState(btn, true, 'Actualizando...');

        try {
          const fd = new FormData(passwordForm);
          const currentPassword = fd.get('currentPassword');
          const newPassword = fd.get('newPassword');
          if (!currentPassword || !newPassword) {
            throw new Error('Completa ambos campos de contraseña');
          }

          const res = await fetch(passwordForm.action, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ currentPassword, newPassword })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.message || 'No se pudo actualizar la contraseña');

          showAccountAlert('success', data.message || 'Contraseña actualizada correctamente');
          passwordForm.reset();
        } catch (err) {
          console.error(err);
          showAccountAlert('danger', err.message || 'Ocurrió un error');
        } finally {
          setBtnState(btn, false, 'Cambiar contraseña');
        }
      });
    }
  })();

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

  // Back buttons: go to previous page if possible
  (function setupBackButtons(){
    const backLinks = document.querySelectorAll('a.ox-back-btn');
    if (!backLinks.length) return;
    const canGoBack = () => {
      // Prefer native history when available; fallback to referrer
      if (window.history && history.length > 1) return true;
      return !!document.referrer;
    };
    const goBackOrFallback = (a) => {
      if (window.history && history.length > 1) {
        history.back();
        return;
      }
      if (document.referrer) {
        // Navigate to referrer (may be external)
        location.href = document.referrer;
        return;
      }
      if (a && a.href) {
        location.href = a.href;
      }
    };
    backLinks.forEach(a => {
      // Do NOT override admin sidebar back button; it should always use its href
      if (a.closest('.admin-sidebar')) return;
      a.addEventListener('click', (ev) => {
        if (!canGoBack()) return; // default navigation to href
        ev.preventDefault();
        goBackOrFallback(a);
      }, { capture: true });
    });
  })();

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
    btn.classList.toggle('btn-dark', !!fav);
    btn.classList.toggle('btn-outline-dark', !fav);
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

// ---- Admin Users: create + edit handlers moved from Pug ----
document.addEventListener('DOMContentLoaded', function(){
  // Create User (adminCreateUserForm)
  (function setupAdminCreateUser(){
    var form = document.querySelector('.admin-users-create-form');
    if (!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var nameEl = document.getElementById('newUserName');
      var emailEl = document.getElementById('newUserEmail');
      var roleEl = document.getElementById('newUserRole');
      var email = (emailEl && emailEl.value || '').trim();
      var name = (nameEl && nameEl.value || '').trim();
      var role = roleEl && roleEl.value;
      if (!email) { if (window.showAdminToast) showAdminToast('Correo requerido','danger'); return; }
      var btn = form && form.querySelector('.admin-users-create-submit');
      var old = btn && btn.textContent;
      if (btn) { btn.disabled=true; btn.classList.add('disabled'); btn.textContent='Creando...'; }
      var done = function(){ if(btn){ btn.disabled=false; btn.classList.remove('disabled'); btn.textContent=old; } };
      var payload = { email: email };
      if (name) payload.name = name;
      if (role) payload.role = role;
      var success = function(){
        if (window.showAdminToast) showAdminToast('Usuario creado y correo enviado','success');
        var modalEl = (form && form.closest('.admin-users-create-modal'));
        if (modalEl && window.bootstrap && bootstrap.Modal) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        form.reset();
      };
      var failure = function(msg){ if (window.showAdminToast) showAdminToast(msg || 'No se pudo crear el usuario','danger'); };
      var client = (window.api || window.axios);
      if (client && typeof client.post === 'function') {
        client.post('/api/v1/users', payload).then(function(){ success(); }).catch(function(err){ console.error(err); var m=(err && err.response && err.response.data && err.response.data.message)||null; failure(m); }).finally(done);
      } else {
        fetch('/api/v1/users', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
          .then(function(res){ if(!res.ok) return res.json().then(function(d){ throw new Error(d && d.message || 'Failed') }); success(); })
          .catch(function(err){ console.error(err); failure(err && err.message); })
          .finally(done);
      }
    });
  })();

  // Edit User modals
  (function setupAdminEditUsers(){
    function setAvatarPreview(modalEl, url){
      try {
        var img = modalEl.querySelector('.admin-users-avatar-preview');
        if (!img) return;
        if (url) {
          img.src = url;
          img.style.display = '';
        } else {
          img.removeAttribute('src');
          img.style.display = 'none';
        }
      } catch(_){}
    }
    function setCoverPreview(modalEl, url){
      try {
        var img = modalEl.querySelector('.admin-users-cover-preview');
        if (!img) return;
        if (url) { img.src = url; img.style.display = ''; }
        else { img.removeAttribute('src'); img.style.display = 'none'; }
      } catch(_){}
    }
    function fillFormFromData(form, data){
      if (!form || !data) return;
      var q = function(s){ return form.querySelector(s); };
      var setVal = function(sel, val){ var el = q(sel); if (el && val != null) el.value = val; };
      setVal('[name="name"]', data.name || '');
      if (data.email) setVal('[name="email"]', data.email);
      setVal('[name="bio"]', data.bio || '');
      setVal('[name="location"]', data.location || '');
      setVal('[name="website"]', data.website || '');
      var social = data.social || {};
      setVal('[name="social.instagram"]', social.instagram || '');
      setVal('[name="social.x"]', social.x || '');
      setVal('[name="social.facebook"]', social.facebook || '');
    }

    var modals = document.querySelectorAll('.admin-users-edit-modal, .admin-edit-user-modal');
    if (!modals.length) return;

    modals.forEach(function(modalEl){
      modalEl.addEventListener('show.bs.modal', function(ev){
        var id = modalEl.getAttribute('data-user-id');
        var form = modalEl.querySelector('.admin-users-edit-form, .admin-edit-user-form');
        if (!id || !form) return;
        try {
          var trigger = ev.relatedTarget;
          if (trigger) {
            var name = trigger.getAttribute('data-user-name');
            var email = trigger.getAttribute('data-user-email');
            fillFormFromData(form, { name: name, email: email });
          }
        } catch(_){}
        var url = '/api/v1/users/' + encodeURIComponent(id);
        var handle = function(payload){
          try {
            var data = (payload && payload.data) || payload;
            var user = data && (data.data || data.user || data);
            if (user) { fillFormFromData(form, user); setAvatarPreview(modalEl, user.profileImage || ''); setCoverPreview(modalEl, user.coverImage || ''); try { var link=modalEl && modalEl.querySelector('.admin-users-public-link'); if (link) link.href = '/artists/' + (user.slug || user._id || user.id); } catch(_){} }
          } catch (e) { console.warn('No se pudo parsear detalle de usuario', e); }
        };
        var client2 = (window.api || window.axios);
        if (client2 && typeof client2.get === 'function') {
          client2.get(url).then(function(resp){ handle(resp); }).catch(function(err){ console.error(err); });
        } else {
          fetch(url).then(function(res){ return res.json(); }).then(handle).catch(function(err){ console.error(err); });
        }
      });
    });

    // Subir imagen de perfil (delegado)
    document.addEventListener('click', async function(e){
      var btn = e.target.closest && e.target.closest('.admin-users-avatar-upload-btn');
      if (!btn) return;
      var modalEl = btn.closest('.admin-users-edit-modal, .admin-edit-user-modal');
      if (!modalEl) return;
      var id = modalEl.getAttribute('data-user-id');
      var fileInput = modalEl.querySelector('.admin-users-avatar-input');
      if (!id || !fileInput || !fileInput.files || !fileInput.files[0]) { if (window.showAdminToast) showAdminToast('Selecciona una imagen','warning'); return; }
      var file = fileInput.files[0];
      try {
        await ensureHorizontalImage(file);
      } catch (err) {
        var msgValidate = (err && err.message) || 'La foto debe ser horizontal (mas ancha que alta).';
        if (window.showAdminToast) {
          showAdminToast(msgValidate, 'warning');
        } else {
          alert(msgValidate);
        }
        return;
      }
      var old = btn.textContent; btn.disabled = true; btn.classList.add('disabled'); btn.textContent = 'Subiendo...';
      var done = function(){ btn.disabled = false; btn.classList.remove('disabled'); btn.textContent = old; };
      var url = '/api/v1/users/' + encodeURIComponent(id) + '/profile-image';
      var formData = new FormData();
      formData.append('profileImage', file);
      var onSuccess = function(resp){
        try {
          var data = (resp && resp.data) || resp; var user = data && (data.data || data.user || data);
          var newUrl = user && user.profileImage; setAvatarPreview(modalEl, newUrl || '');
          fileInput.value = '';
        } catch(_){ }
        if (window.showAdminToast) showAdminToast('Imagen actualizada','success');
      };
      var onError = function(err){
        console.error(err);
        var msg = (err && err.response && err.response.data && (err.response.data.message || err.response.data.error || err.response.data.err)) || err && err.message || 'No se pudo subir la imagen';
        if (window.showAdminToast) showAdminToast(msg,'danger');
      };
      if (window.axios) {
        // No establezcas Content-Type manualmente; el navegador agrega el boundary correcto
        axios.patch(url, formData)
          .then(function(resp){ onSuccess(resp); }).catch(onError).finally(done);
      } else {
        fetch(url, { method: 'PATCH', body: formData })
          .then(function(res){ if(!res.ok) return res.json().then(function(d){ throw new Error((d && d.message) || 'Failed'); }); return res.json(); })
          .then(onSuccess).catch(onError).finally(done);
      }
    });

    // Subir imagen de portada (delegado)
    document.addEventListener('click', async function(e){
      var btn = e.target.closest && e.target.closest('.admin-users-cover-upload-btn');
      if (!btn) return;
      var modalEl = btn.closest('.admin-users-edit-modal, .admin-edit-user-modal');
      if (!modalEl) return;
      var id = modalEl.getAttribute('data-user-id');
      var fileInput = modalEl.querySelector('.admin-users-cover-input');
      if (!id || !fileInput || !fileInput.files || !fileInput.files[0]) { if (window.showAdminToast) showAdminToast('Selecciona una imagen','warning'); return; }
      var file = fileInput.files[0];
      try { await ensureHorizontalImage(file); } catch (err) { var msgV=(err && err.message)||'La imagen debe ser horizontal.'; if(window.showAdminToast) showAdminToast(msgV,'warning'); else alert(msgV); return; }
      var old = btn.textContent; btn.disabled=true; btn.classList.add('disabled'); btn.textContent='Subiendo...';
      var done = function(){ btn.disabled=false; btn.classList.remove('disabled'); btn.textContent=old; };
      var url = '/api/v1/users/' + encodeURIComponent(id) + '/cover-image';
      var fd = new FormData(); fd.append('coverImage', file);
      var onSuccess = function(resp){ try { var data=(resp&&resp.data)||resp; var user=data&&(data.data||data.user||data); var newUrl=user&&user.coverImage; setCoverPreview(modalEl, newUrl||''); fileInput.value=''; } catch(_){ } if(window.showAdminToast) showAdminToast('Portada actualizada','success'); };
      var onError = function(err){ console.error(err); var msg=(err&&err.response&&err.response.data&&(err.response.data.message||err.response.data.error||err.response.data.err))||err&&err.message||'No se pudo subir la portada'; if(window.showAdminToast) showAdminToast(msg,'danger'); };
      if (window.axios) axios.patch(url, fd).then(onSuccess).catch(onError).finally(done);
      else fetch(url, { method:'PATCH', body: fd }).then(function(res){ if(!res.ok) return res.json().then(function(d){ throw new Error((d&&d.message)||'Failed');}); return res.json(); }).then(onSuccess).catch(onError).finally(done);
    });

    // Quitar imagen de portada (delegado)
    document.addEventListener('click', function(e){
      var btn = e.target.closest && e.target.closest('.admin-users-cover-remove-btn');
      if (!btn) return;
      var modalEl = btn.closest('.admin-users-edit-modal, .admin-edit-user-modal');
      if (!modalEl) return;
      var id = modalEl.getAttribute('data-user-id');
      if (!id) return;
      if (!confirm('¿Quitar imagen de portada?')) return;
      var old = btn.textContent; btn.disabled=true; btn.classList.add('disabled'); btn.textContent='Quitando...';
      var done = function(){ btn.disabled=false; btn.classList.remove('disabled'); btn.textContent=old; };
      var url = '/api/v1/users/' + encodeURIComponent(id) + '/cover-image';
      var onSuccess = function(resp){ setCoverPreview(modalEl, ''); if (window.showAdminToast) showAdminToast('Portada eliminada','success'); };
      var onError = function(err){ console.error(err); var msg=(err&&err.response&&err.response.data&&(err.response.data.message||err.response.data.error||err.response.data.err))||err&&err.message||'No se pudo eliminar la portada'; if(window.showAdminToast) showAdminToast(msg,'danger'); };
      if (window.axios) axios.patch(url, { coverImage: '' }).then(onSuccess).catch(onError).finally(done);
      else fetch(url, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ coverImage: '' })}).then(function(res){ if(!res.ok) return res.json().then(function(d){ throw new Error((d&&d.message)||'Failed');}); return res.json(); }).then(onSuccess).catch(onError).finally(done);
    });

    // Quitar imagen de perfil (delegado)
    document.addEventListener('click', function(e){
      var btn = e.target.closest && e.target.closest('.admin-users-avatar-remove-btn');
      if (!btn) return;
      var modalEl = btn.closest('.admin-users-edit-modal, .admin-edit-user-modal');
      if (!modalEl) return;
      var id = modalEl.getAttribute('data-user-id');
      if (!id) return;
      if (!confirm('¿Quitar imagen de perfil?')) return;
      var old = btn.textContent; btn.disabled = true; btn.classList.add('disabled'); btn.textContent = 'Quitando...';
      var done = function(){ btn.disabled = false; btn.classList.remove('disabled'); btn.textContent = old; };
      var url = '/api/v1/users/' + encodeURIComponent(id) + '/profile-image';
      var onSuccess = function(resp){ setAvatarPreview(modalEl, ''); if (window.showAdminToast) showAdminToast('Imagen eliminada','success'); };
      var onError = function(err){
        console.error(err);
        var msg = (err && err.response && err.response.data && (err.response.data.message || err.response.data.error || err.response.data.err)) || err && err.message || 'No se pudo eliminar la imagen';
        if (window.showAdminToast) showAdminToast(msg,'danger');
      };
      if (window.axios) {
        axios.patch(url, { profileImage: '' })
          .then(function(resp){ onSuccess(resp); }).catch(onError).finally(done);
      } else {
        fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileImage: '' }) })
          .then(function(res){ if(!res.ok) return res.json().then(function(d){ throw new Error((d && d.message) || 'Failed'); }); return res.json(); })
          .then(onSuccess).catch(onError).finally(done);
      }
    });

    document.addEventListener('submit', function(e){
      var form = e.target.closest && e.target.closest('.admin-users-edit-form, .admin-edit-user-form');
      if (!form) return;
      e.preventDefault();
      var modalEl = form.closest && form.closest('.admin-users-edit-modal, .admin-edit-user-modal');
      var id = form.getAttribute('data-user-id') || (modalEl && modalEl.getAttribute('data-user-id'));
      if (!id) return;
      var read = function(name){ var el = form.querySelector('[name="'+name+'"]'); return el ? el.value.trim() : ''; };
      var payload = {
        name: read('name') || undefined,
        email: read('email') || undefined,
        bio: read('bio') || undefined,
        location: read('location') || undefined,
        website: read('website') || undefined,
        social: {
          instagram: read('social.instagram') || undefined,
          x: read('social.x') || undefined,
          facebook: read('social.facebook') || undefined
        }
      };
      Object.keys(payload).forEach(function(k){ if (payload[k] === undefined) delete payload[k]; });
      if (payload.social) {
        Object.keys(payload.social).forEach(function(k){ if (payload.social[k] === undefined || payload.social[k] === '') delete payload.social[k]; });
        if (Object.keys(payload.social).length === 0) delete payload.social;
      }
      var lengthChecks = [
        { value: payload.name, label: 'Nombre', max: 120 },
        { value: payload.bio, label: 'Biografía', max: 1200 },
        { value: payload.location, label: 'Ubicación', max: 100 },
        { value: payload.website, label: 'Sitio web', max: 200 }
      ];
      if (payload.social) {
        lengthChecks.push(
          { value: payload.social.instagram, label: 'Instagram', max: 80 },
          { value: payload.social.x, label: 'X', max: 80 },
          { value: payload.social.facebook, label: 'Facebook', max: 80 }
        );
      }
      for (var i = 0; i < lengthChecks.length; i++) {
        var check = lengthChecks[i];
        if (check.value && String(check.value).trim().length > check.max) {
          var msg = check.label + ' no puede exceder ' + check.max + ' caracteres.';
          if (window.showAdminToast) showAdminToast(msg, 'warning'); else alert(msg);
          return;
        }
      }
      var submitBtn = modalEl && modalEl.querySelector('.admin-users-edit-submit, .admin-edit-user-submit');
      var oldText = submitBtn && submitBtn.textContent;
      if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('disabled'); submitBtn.textContent = 'Guardando...'; }
      var done = function(){ if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('disabled'); submitBtn.textContent = oldText; } };
      var url = '/api/v1/users/' + encodeURIComponent(id);
      var success = function(updated){
        if (window.showAdminToast) showAdminToast('Usuario actualizado','success');
        if (modalEl && window.bootstrap && bootstrap.Modal) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        try {
          var row = modalEl.closest('tr');
          if (row) {
            var newName = payload.name || (updated && updated.data && updated.data.name);
            var newEmail = payload.email || (updated && updated.data && (updated.data.email || (updated.data._doc && updated.data._doc.email)));
            if (newName) { var nameCell = row.querySelector('td:nth-child(1)'); if (nameCell) nameCell.textContent = newName; }
            if (newEmail) { var emailCell = row.querySelector('td:nth-child(2)'); if (emailCell) emailCell.textContent = newEmail; }
          }
        } catch(_){ }
        // Actualiza link p�blico con el slug m�s reciente (si existe)
        try {
          var user = updated && updated.data;
          var slug = user && user.slug;
          var id2 = user && (user._id || user.id);
          var publicLink = modalEl && modalEl.querySelector('.admin-users-public-link');
          if (publicLink && (slug || id2)) publicLink.href = '/artists/' + (slug || id2);
        } catch(_){ }
      };
      var failure = function(errMsg){ if (window.showAdminToast) showAdminToast(errMsg || 'No se pudo actualizar','danger'); };
      if (window.axios) {
        axios.patch(url, payload)
          .then(function(resp){ success(resp && resp.data); })
          .catch(function(err){ console.error(err); var m=(err && err.response && err.response.data && err.response.data.message)||null; failure(m); })
          .finally(done);
      } else {
        fetch(url, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
          .then(function(res){ if(!res.ok) return res.json().then(function(d){ throw new Error(d && d.message || 'Failed') }); return res.json(); })
          .then(function(data){ success(data); })
          .catch(function(err){ console.error(err); failure(err && err.message); })
          .finally(done);
      }
    });
  })();

  // Artist application: auto-prefix http(s) for link inputs
  (function normalizeArtistApplicationLinks(){
    try {
      var form = document.getElementById('artistAppForm');
      if (!form) return;
      function normalize(el){
        try {
          var v = (el && el.value || '').trim();
          if (!v) return;
          if (/^https?:\/\//i.test(v)) { el.value = v; return; }
          if (/^\/\//.test(v)) { el.value = 'https:' + v; return; }
          el.value = 'https://' + v;
        } catch(_){ }
      }
      form.addEventListener('submit', function(){
        var inputs = form.querySelectorAll('input[name="links"]');
        inputs.forEach(normalize);
      });
      form.addEventListener('blur', function(e){
        var t = e && e.target;
        if (t && t.name === 'links' && t.tagName === 'INPUT') normalize(t);
      }, true);
      form.addEventListener('change', function(e){
        var t = e && e.target;
        if (t && t.name === 'links' && t.tagName === 'INPUT') normalize(t);
      });
    } catch(_){ }
  })();
});
  // Home: letter reveal for home-exhibitions title
  (function homeHeadingReveal(){
    var heading = document.querySelector('.home-exhibitions .section-heading');
    if (!heading) return;
    var txt = (heading.textContent || '').trim();
    if (!txt) return;
    heading.textContent = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < txt.length; i++) {
      var ch = txt[i];
      var span = document.createElement('span');
      if (ch === ' ') {
        span.className = 'ox-letter ox-space';
        span.innerHTML = '\u00A0';
      } else {
        span.className = 'ox-letter';
        span.textContent = ch;
        span.style.transitionDelay = (i * 35) + 'ms';
      }
      frag.appendChild(span);
    }
    heading.appendChild(frag);
    heading.classList.add('ox-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          heading.classList.add('is-visible');
          io.disconnect();
        }
      });
    }, { threshold: 0.4 });
    io.observe(heading);
  })();

// ==========================
// Overlay de carga global
// (migrado desde layouts/public.pug)
// ==========================
(function overlayHandler(){
  var overlayBound = false;
  function getOverlay(){ return document.getElementById('page-loading-overlay'); }
  function clearOverlay(){
    try {
      var ov = getOverlay();
      try { document.body.classList.remove('loading'); } catch(_) {}
      if (!ov) return;
      if (!ov.classList.contains('hidden')) ov.classList.add('hidden');
      setTimeout(function(){ if (ov && ov.parentNode) try{ ov.remove(); }catch(_){} }, 400);
    } catch(_) {}
  }
  function waitForImportantImages(){
    // Espera a grillas de obras si existen
    var grids = document.querySelectorAll('.artwork-grid');
    var pending = 0;
    function done(){ if (--pending <= 0) clearOverlay(); }
    if (grids && grids.length && typeof window.imagesLoaded === 'function') {
      pending = grids.length;
      for (var i=0;i<grids.length;i++) {
        try { window.imagesLoaded(grids[i], done); } catch(_) { done(); }
      }
    } else if (grids && grids.length) {
      var imgs = document.querySelectorAll('.artwork-grid img');
      if (!imgs.length) return clearOverlay();
      pending = imgs.length;
      imgs.forEach(function(img){
        if (img.complete) done();
        else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
      });
    } else {
      setTimeout(clearOverlay, 600);
    }
    setTimeout(clearOverlay, 3000);
    window.addEventListener('load', clearOverlay, { once: true });
  }
  function bindMasonryReady(){
    var grids = document.querySelectorAll('.artwork-grid');
    if (!grids || !grids.length) { setTimeout(clearOverlay, 400); return; }
    var left = grids.length;
    function done(){ if (--left <= 0) clearOverlay(); }
    for (var i=0;i<grids.length;i++) {
      var g = grids[i];
      if (g.classList && g.classList.contains('is-ready')) { done(); continue; }
      try { g.addEventListener('ox:masonry:ready', done, { once: true }); } catch(_) { setTimeout(done, 600); }
    }
    setTimeout(clearOverlay, 2200);
  }
  function init(){
    if (overlayBound) return; overlayBound = true;
    var ov = getOverlay();
    var bodyLoading = document.body && document.body.classList.contains('loading');
    if (!ov && !bodyLoading) return; // overlay desactivado
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForImportantImages);
    else waitForImportantImages();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindMasonryReady);
    else bindMasonryReady();
  }
  try { init(); } catch(_) {}
})();

// ==========================
// Compartir / Copiar enlace
// (migrado desde layouts/public y vistas)
// ==========================
(function shareHandler(){
  function copyTextFallback(text){
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'absolute'; ta.style.left = '-9999px';
      document.body.appendChild(ta);
      var selected = (document.getSelection().rangeCount > 0) && document.getSelection().getRangeAt(0);
      ta.select();
      try { document.execCommand('copy'); } catch(_) {}
      document.body.removeChild(ta);
      if (selected) {
        document.getSelection().removeAllRanges();
        document.getSelection().addRange(selected);
      }
      return true;
    } catch(_) { return false; }
  }
  function copyToClipboard(text){
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function(){ return true; }).catch(function(){ return copyTextFallback(text); });
    }
    return Promise.resolve(copyTextFallback(text));
  }
  function announce(msg){
    try { var live = document.getElementById('sr-live'); if (live) live.textContent = msg; } catch(_) {}
  }
  function showToast(msg){
    try {
      var container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'position-fixed bottom-0 start-50 translate-middle-x p-3';
        container.style.zIndex = 1080;
        document.body.appendChild(container);
      }
      var toast = document.createElement('div');
      toast.className = 'toast align-items-center text-bg-dark border-0';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.setAttribute('aria-atomic', 'true');
      toast.innerHTML = "<div class='d-flex'><div class='toast-body'></div><button type='button' class='btn-close btn-close-white me-2 m-auto' data-bs-dismiss='toast' aria-label='Cerrar'></button></div>";
      toast.querySelector('.toast-body').textContent = msg;
      container.appendChild(toast);
      var useBs = typeof window.bootstrap !== 'undefined' && window.bootstrap.Toast;
      if (useBs) {
        var t = new window.bootstrap.Toast(toast, { autohide: true, delay: 1600 });
        t.show();
        toast.addEventListener('hidden.bs.toast', function(){ toast.remove(); });
      } else {
        toast.classList.add('show');
        setTimeout(function(){ toast.classList.remove('show'); toast.remove(); }, 1600);
      }
    } catch(_) {}
  }
  function ripple(btn, ev){
    try {
      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height);
      var x = (ev.clientX - rect.left) - size / 2;
      var y = (ev.clientY - rect.top) - size / 2;
      var r = document.createElement('span');
      r.className = 'btn-ripple';
      r.style.width = size + 'px'; r.style.height = size + 'px'; r.style.left = x + 'px'; r.style.top = y + 'px';
      btn.appendChild(r); r.addEventListener('animationend', function(){ r.remove(); });
      btn.classList.add('btn-pop');
      btn.addEventListener('animationend', function handler(){ btn.classList.remove('btn-pop'); btn.removeEventListener('animationend', handler); });
    } catch(_) {}
  }
  function findSharePath(){
    try {
      var art = document.querySelector('#artwork-thumb[data-artwork-id]');
      if (art && art.dataset && art.dataset.artworkId) return '/artworks/' + art.dataset.artworkId;
      var exhibitionBtn = document.querySelector('[data-exhibition-id]');
      if (exhibitionBtn && exhibitionBtn.getAttribute) return '/exhibitions/' + exhibitionBtn.getAttribute('data-exhibition-id');
      var artistBtn = document.querySelector('[data-artist-id]');
      if (artistBtn && artistBtn.getAttribute) return '/artists/' + artistBtn.getAttribute('data-artist-id');
    } catch(_) {}
    try { return window.location.pathname || '/'; } catch(_) { return '/'; }
  }
  document.addEventListener('click', function(e){
    var oxBtn = e.target && e.target.closest && e.target.closest('.ox-share-btn');
    if (oxBtn) {
      try { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } catch(_) {}
      var path = findSharePath();
      var url = (window.location && window.location.origin ? window.location.origin : '') + path;
      var title = document.title || 'Galería del Ox';
      var sharePromise = navigator.share ? navigator.share({ title: title, url: url }).catch(function(){}) : Promise.resolve();
      Promise.resolve(sharePromise).then(function(){ return copyToClipboard(url); }).then(function(){ showToast('Enlace copiado al portapapeles'); }).catch(function(){ showToast('Listo para compartir'); });
      return;
    }
    var artistBtn = e.target && e.target.closest && e.target.closest('.artist-share-btn, .artist-share-btn-mobile');
    var artworkBtn = e.target && e.target.closest && e.target.closest('.artwork-share-btn');
    var shareBtn = artistBtn || artworkBtn;
    if (shareBtn) {
      ripple(shareBtn, e);
      var url = window.location && window.location.href || '';
      var title2 = document.title || 'Galería del Ox';
      var p = navigator.share ? navigator.share({ title: title2, url: url }).catch(function(){}) : Promise.resolve();
      Promise.resolve(p).then(function(){ return copyToClipboard(url); }).then(function(copied){ showToast(copied ? 'Enlace copiado al portapapeles' : 'Listo para compartir'); announce(copied ? 'Enlace copiado al portapapeles' : 'Listo para compartir'); }).catch(function(){ showToast('No se pudo copiar el enlace'); announce('No se pudo copiar el enlace'); });
    }
  }, true);
})();

// ==========================
// Seguir / dejar de seguir artista
// (migrado desde vistas de artista)
// ==========================
(function followHandler(){
  function toggleFollow(artistId, desired){
    var useAxios = typeof window.axios !== 'undefined';
    if (desired) {
      if (useAxios) return axios.post('/api/v1/follows', { artistId: artistId }).then(function(){ return { ok: true, following: true }; }).catch(function(e){ return { ok: false, error: e }; });
      return fetch('/api/v1/follows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ artistId: artistId }) })
        .then(function(res){ if (!res.ok && res.status !== 200 && res.status !== 201) throw res; return { ok: true, following: true }; })
        .catch(function(e){ return { ok: false, error: e }; });
    } else {
      if (useAxios) return axios.delete('/api/v1/follows/' + artistId).then(function(){ return { ok: true, following: false }; }).catch(function(e){ return { ok: false, error: e }; });
      return fetch('/api/v1/follows/' + artistId, { method: 'DELETE', credentials: 'same-origin' })
        .then(function(res){ if (!res.ok && res.status !== 204 && res.status !== 404) throw res; return { ok: true, following: false }; })
        .catch(function(e){ return { ok: false, error: e }; });
    }
  }
  function setup(){
    var btns = document.querySelectorAll('.artist-follow-btn, .artist-follow-btn-mobile');
    if (!btns || !btns.length) return;
    btns.forEach(function(btn){
      var artistId = btn.getAttribute('data-artist-id');
      if (!artistId) return;
      function getState(){ return btn.getAttribute('aria-pressed') === 'true'; }
      function setState(following){
        btn.setAttribute('aria-pressed', following ? 'true' : 'false');
        btn.classList.toggle('active', !!following);
        var label = following ? 'Siguiendo' : 'Seguir';
        btn.innerHTML = '<i class="fas fa-heart me-2"></i>' + label;
      }
      btn.addEventListener('click', function(e){
        if (btn.disabled) return;
        // efecto visual
        try {
          var rect = btn.getBoundingClientRect();
          var size = Math.max(rect.width, rect.height);
          var x = (e.clientX - rect.left) - size / 2;
          var y = (e.clientY - rect.top) - size / 2;
          var ripple = document.createElement('span');
          ripple.className = 'btn-ripple'; ripple.style.width = size + 'px'; ripple.style.height = size + 'px'; ripple.style.left = x + 'px'; ripple.style.top = y + 'px';
          btn.appendChild(ripple); ripple.addEventListener('animationend', function(){ ripple.remove(); });
          btn.classList.add('btn-pop'); btn.addEventListener('animationend', function handler(){ btn.classList.remove('btn-pop'); btn.removeEventListener('animationend', handler); });
        } catch(_) {}
        var desired = !getState();
        btn.disabled = true; btn.classList.add('disabled');
        Promise.resolve(toggleFollow(artistId, desired)).then(function(res){
          btn.disabled = false; btn.classList.remove('disabled');
          if (res && res.ok) setState(!!res.following);
          else {
            var status = (res && res.error && (res.error.status || (res.error.response && res.error.response.status))) || 0;
            if (status === 401 || status === 403) {
              var returnTo = window.location.pathname + window.location.search;
              window.location.assign('/login?returnTo=' + encodeURIComponent(returnTo));
            } else {
              try { console.error('No se pudo actualizar seguimiento', res && res.error); } catch(_) {}
            }
          }
        });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();

// ==========================
// Auth: Forgot password y Reset password
// ==========================
(function authForms(){
  function setupForgot(){
    var form = document.getElementById('forgotForm');
    if(!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var email = form.email && form.email.value;
      var existingAlert = form.querySelector('.alert');
      if(existingAlert){ existingAlert.parentNode.removeChild(existingAlert); }
      var info = document.createElement('div');
      info.className = 'alert alert-info mb-3';
      info.textContent = 'Enviando…';
      form.insertBefore(info, form.querySelector('.form-floating'));
      fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) })
        .then(function(res){ return res.json().catch(function(){return {};}).then(function(json){return { ok: res.ok, json: json };}); })
        .then(function(result){
          info.className = 'alert ' + (result.ok ? 'alert-success' : 'alert-warning') + ' mb-3';
          info.textContent = (result.json && result.json.message) || 'Si el email existe, te enviaremos un enlace para restablecer tu contraseña.';
        })
        .catch(function(){
          info.className = 'alert alert-danger mb-3';
          info.textContent = 'No se pudo procesar la solicitud. Intenta de nuevo.';
        });
    });
  }
  function setupReset(){
    var form = document.querySelector('form.reset-password-form');
    if(!form) return;
    var newPass = document.getElementById('newPassword');
    var confirm = document.getElementById('confirmPassword');
    var existing = document.querySelector('.reset-password-error');
    var makeAlert = function(msg){
      var el = document.createElement('div');
      el.className = 'alert alert-danger reset-password-error mb-3';
      el.textContent = msg; return el;
    };
    form.addEventListener('submit', function(e){
      if(!newPass || !confirm) return;
      if(newPass.value !== confirm.value){
        e.preventDefault();
        if(existing && existing.parentNode) existing.parentNode.removeChild(existing);
        existing = makeAlert('Las contraseñas no coinciden.');
        form.insertBefore(existing, form.firstChild.nextSibling);
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setupForgot(); setupReset(); });
  else { setupForgot(); setupReset(); }
})();

// ==========================
// Become-artist: lista dinámica de enlaces
// ==========================
(function becomeArtist(){
  function updateStates(list, addBtn, MAX_LINKS){
    if (!list) return;
    var items = list.querySelectorAll('.links-item');
    items.forEach(function(item){
      var btn = item.querySelector('[data-action="remove-link"]');
      if (btn) btn.disabled = (items.length <= 1);
    });
    if (addBtn) {
      var count = items.length;
      addBtn.disabled = (count >= MAX_LINKS);
      addBtn.setAttribute('aria-disabled', addBtn.disabled ? 'true' : 'false');
      addBtn.title = addBtn.disabled ? 'Máximo de enlaces alcanzado' : 'Agregar enlace';
    }
  }
  function addLink(list, MAX_LINKS, value){
    var current = list.querySelectorAll('.links-item').length;
    if (current >= MAX_LINKS) { updateStates(list, document.getElementById('addLinkBtn'), MAX_LINKS); return; }
    var group = document.createElement('div');
    group.className = 'input-group mb-2 links-item';
    group.innerHTML = '<span class="input-group-text"><i class="fas fa-link"></i></span>' +
                      '<input class="form-control" type="url" name="links" placeholder="https://tuweb.com o https://instagram.com/usuario" ' + (value? ('value="'+String(value).replace(/"/g,'&quot;')+'"') : '') + ' required>' +
                      '<button class="btn btn-outline-secondary" type="button" data-action="remove-link" aria-label="Eliminar enlace" title="Eliminar"><i class="fas fa-xmark"></i></button>';
    list.appendChild(group);
    updateStates(list, document.getElementById('addLinkBtn'), MAX_LINKS);
  }
  function setup(){
    var addBtn = document.getElementById('addLinkBtn');
    var list = document.querySelector('.links-list');
    var MAX_LINKS = 5;
    if (!list || !addBtn) return;
    addBtn.addEventListener('click', function(){ addLink(list, MAX_LINKS, ''); });
    list.addEventListener('click', function(e){
      var t = e.target;
      var isBtn = t && (t.getAttribute('data-action')==='remove-link' || (t.closest && t.closest('[data-action="remove-link"]')));
      if (!isBtn) return;
      var btn = t.getAttribute('data-action')==='remove-link' ? t : t.closest('[data-action="remove-link"]');
      var item = btn && btn.closest('.links-item');
      if (item && list.querySelectorAll('.links-item').length > 1){ item.remove(); updateStates(list, addBtn, MAX_LINKS); }
    });
    updateStates(list, addBtn, MAX_LINKS);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
