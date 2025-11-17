'use strict';

(function initArtistPanel(){
  let currentEditId = null;
  function qs(sel, ctx){ return (ctx||document).querySelector(sel); }
  function qsa(sel, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(sel)); }
  function alertToast(type, msg){
    try { console.log('[ArtistPanel]', type, msg); } catch(_){}
    const container = qs('#artistPanelAlerts') || qs('#accountAlerts');
    if (!container) return;
    const level = type || 'info';
    container.innerHTML = '';
    if (level === 'success') {
      const el = document.createElement('div');
      el.className = 'artist-soft-toast artist-soft-toast-success';
      el.textContent = msg || '';
      container.appendChild(el);
      setTimeout(() => {
        if (el.parentNode === container) {
          container.removeChild(el);
        }
      }, 2500);
      return;
    }
    const el = document.createElement('div');
    el.className = 'alert alert-' + level + ' alert-dismissible fade show';
    el.setAttribute('role','alert');
    el.textContent = msg || '';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn-close';
    btn.setAttribute('data-bs-dismiss','alert'); btn.setAttribute('aria-label','Cerrar');
    el.appendChild(btn);
    container.appendChild(el);
  }

  function renderList(listEl, items, status){
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0){
      const li = document.createElement('li');
      li.className = 'list-group-item text-muted small';
      li.textContent = (status === 'draft') ? 'No hay borradores.' : (status === 'submitted') ? 'No hay obras enviadas.' : 'No hay obras rechazadas recientes.';
      listEl.appendChild(li);
      return;
    }
    items.forEach(a => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex align-items-center justify-content-between gap-2';
      const left = document.createElement('div');
      left.className = 'd-flex align-items-center gap-2';
      if (a.imageUrl){
        const img = document.createElement('img');
        img.src = a.imageUrl; img.alt = a.title || 'obra';
        img.style.width='48px'; img.style.height='48px'; img.style.objectFit='cover'; img.className='rounded';
        left.appendChild(img);
      }
      const title = document.createElement('div');
      title.innerHTML = '<strong>' + (a.title || '(Sin título)') + '</strong>' + (a.technique ? ' · ' + a.technique : '');
      left.appendChild(title);
      const right = document.createElement('div');
      right.className = 'd-flex align-items-center gap-2';
      if (status === 'draft'){
        const btnSubmit = document.createElement('button');
        btnSubmit.className = 'btn btn-sm btn-primary';
        btnSubmit.textContent = 'Solicitar aprobación';
        btnSubmit.addEventListener('click', () => submitArtwork(a._id, li));
        right.appendChild(btnSubmit);
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-sm btn-outline-secondary';
        btnEdit.textContent = 'Editar';
        btnEdit.addEventListener('click', () => {
          try {
            if (window.sessionStorage) {
              const payload = {
                _id: a._id,
                title: a.title,
                description: a.description,
                width_cm: a.width_cm,
                height_cm: a.height_cm,
                type: a.type,
                technique: a.technique,
                price_cents: a.price_cents,
                completedAt: a.completedAt,
                imageUrl: a.imageUrl
              };
              window.sessionStorage.setItem('artistDraftToEdit', JSON.stringify(payload));
            }
          } catch(_) {}
          window.location.href = '/artists/panel/artworks/new?artworkId=' + encodeURIComponent(a._id);
        });
        right.appendChild(btnEdit);
        const btnTrash = document.createElement('button');
        btnTrash.className = 'btn btn-sm btn-outline-danger';
        btnTrash.textContent = 'Eliminar';
        btnTrash.addEventListener('click', () => trashArtwork(a._id, li));
        right.appendChild(btnTrash);
      } else if (status === 'submitted') {
        const badge = document.createElement('span');
        badge.className = 'badge bg-warning text-dark';
        badge.textContent = 'En revisión';
        right.appendChild(badge);
      } else if (status === 'rejected') {
        const badge = document.createElement('span');
        badge.className = 'badge bg-danger';
        badge.textContent = 'Rechazada';
        right.appendChild(badge);
        if (a.review && a.review.rejectReason) {
          const reason = document.createElement('div');
          reason.className = 'small text-danger mt-1';
          reason.textContent = 'Motivo: ' + a.review.rejectReason;
          // Muestra el motivo debajo del título, conservando la miniatura
          title.appendChild(reason);
        }
      }
      li.appendChild(left); li.appendChild(right);
      listEl.appendChild(li);
    });
    try {
      if (status === 'draft') {
        const badge = qs('#countDrafts'); if (badge) badge.textContent = String(items.length);
      } else if (status === 'submitted') {
        const badge = qs('#countSubmitted'); if (badge) badge.textContent = String(items.length);
      } else if (status === 'rejected') {
        const badge = qs('#countRejected'); if (badge) badge.textContent = String(items.length);
        const col = document.getElementById('rejectedColumn');
        if (col) col.style.display = items.length ? '' : 'none';
      }
    } catch(_){}
  }

  function fetchList(status){
    const url = '/api/v1/artworks/status/' + encodeURIComponent(status);
    if (window.api) {
      return window.api
        .get(url, { headers: { Accept: 'application/json' }, withCredentials: true })
        .then(res => {
          const data = (res && res.data && res.data.data) || [];
          return Array.isArray(data) ? data : [];
        })
        .catch(err => { console.error('[ArtistPanel] fetchList error (axios)', err); return []; });
    }
    return fetch(url, { credentials: 'same-origin' })
      .then(r => r.json())
      .then(res => {
        const data = (res && res.data) || [];
        return Array.isArray(data) ? data : [];
      })
      .catch(err => { console.error('[ArtistPanel] fetchList error (fetch)', err); return []; });
  }

  // Determina campos faltantes mínimos antes de enviar a revisión
  function getMissingFieldsForSubmit(art){
    const missing = [];
    try {
      if (!art || typeof art !== 'object') return ['title','image','width_cm','height_cm','price_cents'];
      if (!art.imageUrl) missing.push('image');
      if (!(typeof art.width_cm === 'number' && isFinite(art.width_cm) && art.width_cm > 0)) missing.push('width_cm');
      if (!(typeof art.height_cm === 'number' && isFinite(art.height_cm) && art.height_cm > 0)) missing.push('height_cm');
      if (!(typeof art.price_cents === 'number' && isFinite(art.price_cents) && art.price_cents > 0)) missing.push('price_cents');
      if (!art.title || String(art.title).trim() === '') missing.push('title');
    } catch(_) {}
    return missing;
  }

  function highlightMissingInForm(missing, art){
    try {
      const form = qs('#artistCreateArtworkForm');
      if (!form || !Array.isArray(missing) || missing.length === 0) return;
      // Limpiar estados previos
      ['title','amount','type','technique','width_cm','height_cm','image'].forEach(n=>{
        const el = qs(`input[name="${n}"]`, form) || qs(`textarea[name="${n}"]`, form);
        if (el) el.classList.remove('is-invalid');
      });
      // Mapear claves a inputs
      const map = {
        title: 'input[name="title"]',
        price_cents: 'input[name="amount"]',
        width_cm: 'input[name="width_cm"]',
        height_cm: 'input[name="height_cm"]',
        image: 'input[name="image"]'
      };
      let firstInvalid = null;
      missing.forEach(k => {
        const sel = map[k];
        const el = sel && qs(sel, form);
        if (el) {
          el.classList.add('is-invalid');
          if (!firstInvalid) firstInvalid = el;
          // remover invalid al cambiar
          const ev = el.type === 'file' ? 'change' : 'input';
          el.addEventListener(ev, function onchg(){ el.classList.remove('is-invalid'); el.removeEventListener(ev, onchg); }, { once: true });
        }
      });
      if (firstInvalid) {
        try { firstInvalid.scrollIntoView({ behavior:'smooth', block:'center' }); } catch(_){ }
      }
      // Mensaje amigable
      const names = missing.map(k => ({
        title: 'título', price_cents: 'precio', width_cm: 'ancho (cm)', height_cm: 'alto (cm)', image: 'imagen'
      })[k] || k);
      alertToast('warning', 'Completa: ' + names.join(', '));
    } catch(_){ }
  }

  function submitArtwork(id, rowEl){
    // 1) Obtener la obra privada para validar campos
    const getUrl = '/api/v1/artworks/private/' + encodeURIComponent(id);
    const getReq = window.api
      ? window.api.get(getUrl, { headers: { Accept: 'application/json' }, withCredentials: true }).then(r => r && r.data)
      : fetch(getUrl, { credentials: 'same-origin' }).then(r => r.json());
    getReq.then(res => {
      const art = (res && res.data) || null;
      const missing = getMissingFieldsForSubmit(art);
      if (missing.length > 0) {
        // Abrir modal de edición, precargar datos y resaltar faltantes
        openEditModal(id, missing);
        return;
      }
      // 2) Si todo ok, enviar a revisión
      const url = '/api/v1/artworks/' + encodeURIComponent(id) + '/submit';
      const req = window.api ? window.api.patch(url) : fetch(url, { method: 'PATCH', credentials: 'same-origin' }).then(r=>r.json());
      return req.then(() => {
        alertToast('success', 'Obra enviada a revisión.');
        loadLists();
      });
    }).catch(err => {
      const msg = (err && err.response && err.response.data && err.response.data.message) || err.message || 'No se pudo enviar';
      alertToast('danger', msg);
    });
  }

  function trashArtwork(id, rowEl){
    if (!confirm('¿Seguro que quieres eliminar esta obra?')) return;
    const url = '/api/v1/artworks/' + id + '/trash';
    const req = window.api ? window.api.patch(url) : fetch(url, { method: 'PATCH', credentials: 'same-origin' }).then(r=>r.json());
    req.then(() => {
      alertToast('success', 'Obra enviada a la papelera.');
      if (rowEl && rowEl.parentNode) rowEl.parentNode.removeChild(rowEl);
    }).catch(err => {
      const msg = (err && err.response && err.response.data && err.response.data.message) || err.message || 'No se pudo eliminar';
      alertToast('danger', msg);
    });
  }

  function loadLists(){
    const listDrafts = qs('#artistDraftsList');
    const listSubmitted = qs('#artistSubmittedList');
    const listRejected = qs('#artistRejectedList');
    Promise.all([fetchList('draft'), fetchList('submitted'), fetchList('rejected')]).then(([drafts, submitted, rejectedAll]) => {
      renderList(listDrafts, drafts, 'draft');
      renderList(listSubmitted, submitted, 'submitted');
      // Filtrar solo rechazadas de los últimos 30 días
      const THIRTY = 30 * 24 * 60 * 60 * 1000; const now = Date.now();
      const recentRejected = (rejectedAll || []).filter(a => {
        const dt = (a.review && a.review.reviewedAt) || a.updatedAt || a.createdAt;
        const t = dt ? new Date(dt).getTime() : 0;
        return t && (now - t) <= THIRTY;
      });
      renderList(listRejected, recentRejected, 'rejected');
      try {
        console.log('[ArtistPanel] counts:', { drafts: drafts.length, submitted: submitted.length, rejected: recentRejected.length });
        // Mantener botón habilitado; hookAddArtworkLimit intercepta y muestra aviso si alcanzó el límite
      } catch(_){}
    });
  }

  function fillFormWith(art){
    const form = qs('#artistCreateArtworkForm');
    if (!form || !art) return;
    const setVal = (sel, val) => { const el = qs(sel, form); if (el) el.value = val != null ? val : ''; };
    setVal('input[name="title"]', art.title || '');
    setVal('textarea[name="description"]', art.description || '');
    setVal('input[name="type"]', art.type || '');
    setVal('input[name="technique"]', art.technique || '');
    setVal('input[name="width_cm"]', art.width_cm != null ? art.width_cm : '');
    setVal('input[name="height_cm"]', art.height_cm != null ? art.height_cm : '');
    // completedAt como YYYY-MM-DD
    try {
      if (art.completedAt) {
        const d = new Date(art.completedAt);
        if (!isNaN(d.getTime())) {
          const iso = d.toISOString().slice(0,10);
          setVal('input[name="completedAt"]', iso);
        } else {
          setVal('input[name="completedAt"]', '');
        }
      } else {
        setVal('input[name="completedAt"]', '');
      }
    } catch(_) {
      setVal('input[name="completedAt"]', '');
    }
    // amount a partir de price_cents
    if (art.price_cents != null) {
      const amount = (art.price_cents / 100).toFixed(2);
      setVal('input[name="amount"]', amount);
    } else {
      setVal('input[name="amount"]', '');
    }
    // Mostrar preview si ya hay imagen cargada
    try {
      const imgPrev = qs('.artist-artworks-image-preview', form);
      if (imgPrev) {
        if (art.imageUrl) {
          imgPrev.src = art.imageUrl;
          imgPrev.hidden = false;
          imgPrev.dataset.savedSrc = art.imageUrl;
        } else {
          imgPrev.hidden = true;
          imgPrev.removeAttribute('src');
          delete imgPrev.dataset.savedSrc;
        }
      }
    } catch(_) {}
  }

  function openEditModal(id, missingFields){
    const url = '/api/v1/artworks/private/' + encodeURIComponent(id);
    const req = window.api
      ? window.api.get(url, { headers: { Accept: 'application/json' }, withCredentials: true }).then(r => r && r.data)
      : fetch(url, { credentials: 'same-origin' }).then(r => r.json());
    req.then(res => {
      const art = (res && res.data) || null;
      if (!art) throw new Error('No se pudo cargar la obra');
      currentEditId = art._id;
      fillFormWith(art);
      // Cambiar título del modal a Editar obra
      const label = qs('#artistAddArtworkModalLabel');
      if (label) label.textContent = 'Editar obra';
      const modalEl = qs('#artistAddArtworkModal');
      if (modalEl && window.bootstrap) {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
      }
      // Al editar, si ya hay imagen en DB, no exigir nueva imagen
      try {
        const form = qs('#artistCreateArtworkForm');
        const fileInput = qs('input[name="image"]', form);
        if (fileInput) fileInput.required = false;
      } catch(_) {}
      if (Array.isArray(missingFields) && missingFields.length) {
        // Aplicar resaltado tras un tick para asegurar DOM visible
        setTimeout(() => highlightMissingInForm(missingFields, art), 50);
      }
    }).catch(err => {
      const msg = (err && err.response && err.response.data && err.response.data.message) || err.message || 'No se pudo cargar la obra';
      alertToast('danger', msg);
    });
  }

  function resetCreateFormState(){
    const form = qs('#artistCreateArtworkForm');
    if (!form) return;
    currentEditId = null;
    try { form.reset(); } catch(_) {}
    const label = qs('#artistAddArtworkModalLabel');
    if (label) label.textContent = 'Agregar obra';
    // Reset preview
    try {
      const imgPrev = qs('.artist-artworks-image-preview', form);
      if (imgPrev) { imgPrev.hidden = true; imgPrev.removeAttribute('src'); delete imgPrev.dataset.savedSrc; }
      const fileInput = qs('input[name="image"]', form);
      if (fileInput) fileInput.required = true;
    } catch(_) {}
  }

  function hookReloadButtons(){
    const btnD = qs('#reloadDrafts');
    const btnS = qs('#reloadSubmitted');
    const btnR = qs('#reloadRejected');
    if (btnD) btnD.addEventListener('click', loadLists);
    if (btnS) btnS.addEventListener('click', loadLists);
    if (btnR) btnR.addEventListener('click', loadLists);
  }

  // Intercepta click en "Agregar obra" para mostrar aviso si alcanzó límite de borradores
  (function hookAddArtworkLimit(){
    try {
      const btn = document.getElementById('btnOpenAddArtwork');
      if (!btn) return;
      btn.addEventListener('click', function(e){
        e.preventDefault();
        const maxDrafts = parseInt(btn.getAttribute('data-max-drafts') || '10', 10);
        const badge = document.getElementById('countDrafts');
        const count = parseInt((badge && badge.textContent) || '0', 10) || 0;
        const over = Number.isFinite(maxDrafts) && count >= maxDrafts;
        const targetId = over ? 'artistDraftLimitModal' : 'artistAddArtworkModal';
        const modalEl = document.getElementById(targetId);
        if (modalEl && window.bootstrap) {
          window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
        } else {
          if (over) alertToast('warning', 'Has alcanzado el límite de borradores. Envía a aprobación o elimina algunos.');
        }
      }, true);
    } catch(_) {}
  })();

  function hookCreateForm(){
    const form = qs('#artistCreateArtworkForm');
    if (!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      const submitter = e.submitter || document.activeElement;
      const mode = submitter && submitter.getAttribute('data-mode');
      // Título siempre requerido (incluso en borrador)
      const titleEl = qs('input[name="title"]', form);
      const titleVal = titleEl && String(titleEl.value || '').trim();
      if (!titleVal) {
        if (titleEl) {
          titleEl.classList.add('is-invalid');
          titleEl.addEventListener('input', function onin(){ titleEl.classList.remove('is-invalid'); titleEl.removeEventListener('input', onin); }, { once: true });
          try { titleEl.focus(); } catch(_){}
        }
        alertToast('warning', 'El título es obligatorio.');
        return;
      }
      // Imagen requerida solo si está solicitando aprobación y no hay previa almacenada
      if (mode === 'send') {
        const fileInput = qs('input[name="image"]', form);
        const imgPrev = qs('.artist-artworks-image-preview', form);
        const hasNewFile = !!(fileInput && fileInput.files && fileInput.files[0]);
        const hasSaved = !!(imgPrev && imgPrev.dataset && imgPrev.dataset.savedSrc);
        if (!hasNewFile && !hasSaved) {
          if (fileInput) {
            fileInput.classList.add('is-invalid');
            fileInput.addEventListener('change', function onch(){ fileInput.classList.remove('is-invalid'); fileInput.removeEventListener('change', onch); }, { once: true });
          }
          alertToast('warning', 'Debes agregar una imagen de la obra.');
          return;
        }
      }
      const fd = new FormData(form);
      // Marcar draftOnly si corresponde y evitar validación del servidor
      if (mode === 'draft') {
        fd.set('_draftOnly', '1');
      } else {
        fd.delete('_draftOnly');
      }
      const createUrl = '/api/v1/artworks';
      const updateUrl = currentEditId ? ('/api/v1/artworks/' + encodeURIComponent(currentEditId)) : null;
      const doRequest = () => {
        if (currentEditId) {
          return window.axios
            ? axios.patch(updateUrl, fd, { headers: { Accept: 'application/json' }, withCredentials: true }).then(r => r && r.data)
            : fetch(updateUrl, { method: 'PATCH', body: fd, credentials: 'same-origin' }).then(r=>r.json());
        }
        return window.axios
          ? axios.post(createUrl, fd, { headers: { Accept: 'application/json' }, withCredentials: true }).then(r => r && r.data)
          : fetch(createUrl, { method: 'POST', body: fd, credentials: 'same-origin' }).then(r=>r.json());
      };
      doRequest().then((res) => {
        const data = (res && res.data) || {};
        const artId = data && data._id ? data._id : (currentEditId || null);
        if (mode === 'send' && artId) {
          // Enviar a revisión inmediatamente
          const submitUrl = '/api/v1/artworks/' + artId + '/submit';
          const req2 = window.axios ? axios.patch(submitUrl, null, { withCredentials: true }) : fetch(submitUrl, { method: 'PATCH', credentials: 'same-origin' }).then(r=>r.json());
          return req2.then(() => ({ created: data, submitted: true }));
        }
        return { created: data, submitted: false };
      }).then((out) => {
        if (mode === 'draft') {
          alertToast('success', 'Borrador guardado.');
        } else {
          alertToast('success', 'Obra enviada a revisión.');
        }
        try {
          const modalEl = qs('#artistAddArtworkModal');
          if (modalEl && window.bootstrap) {
            const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modal.hide();
          }
        } catch(_){}
        resetCreateFormState();
        loadLists();
      }).catch(err => {
        const msg = (err && err.response && err.response.data && err.response.data.message) || err.message || 'No se pudo crear la obra';
        alertToast('danger', msg);
      });
    });
    // Preview al seleccionar archivo en el formulario
    try {
      const fileInput = qs('input[name="image"]', form);
      const imgPrev = qs('.artist-artworks-image-preview', form);
      if (fileInput && imgPrev) {
        fileInput.addEventListener('change', function(){
          const f = this.files && this.files[0];
          if (f) {
            const url = URL.createObjectURL(f);
            imgPrev.src = url;
            imgPrev.hidden = false;
            const revoke = () => { try { URL.revokeObjectURL(url); } catch(_){} }
            this.addEventListener('change', revoke, { once: true });
          } else {
            if (imgPrev.dataset.savedSrc) {
              imgPrev.src = imgPrev.dataset.savedSrc;
              imgPrev.hidden = false;
            } else {
              imgPrev.hidden = true; imgPrev.removeAttribute('src');
            }
          }
        });
      }
    } catch(_) {}
  }

  // Resetear estado de formulario al cerrar modal
  (function hookModalReset(){
    const modalEl = qs('#artistAddArtworkModal');
    if (!modalEl) return;
    modalEl.addEventListener('hidden.bs.modal', function(){ resetCreateFormState(); });
  })();

  function hookCoverForm(){
    const form = qs('#artistPanelCoverForm');
    if (!form) return;
    const fileInput = qs('#artistCoverInput', form) || qs('input[type="file"][name="coverImage"]', form);
    const submitBtn = document.querySelector("button[form='artistPanelCoverForm'][type='submit']");
    const errorEl = qs('#artistCoverError');
    const progressWrap = qs('#artistCoverProgressWrap');
    const progressBar = qs('#artistCoverProgressBar');
    let isHorizontal = false;
    let lastObjectUrl = null;

    function setError(msg){
      if (!errorEl) return;
      errorEl.textContent = msg || '';
      errorEl.classList.toggle('d-none', !msg);
    }
    function setSubmitEnabled(enabled){
      if (submitBtn) submitBtn.disabled = !enabled;
    }
    function resetProgress(){
      if (progressWrap) progressWrap.style.display = 'none';
      if (progressBar){ progressBar.style.width = '0%'; progressBar.setAttribute('aria-valuenow', '0'); }
    }
    function showProgress(percent){
      if (!progressWrap || !progressBar) return;
      progressWrap.style.display = '';
      const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
      progressBar.style.width = pct + '%';
      progressBar.setAttribute('aria-valuenow', String(pct));
    }

    // Validate orientation on file change
    if (fileInput){
      fileInput.addEventListener('change', function(){
        setError('');
        isHorizontal = false;
        resetProgress();
        try { if (lastObjectUrl) { URL.revokeObjectURL(lastObjectUrl); lastObjectUrl = null; } } catch(_){}
        const f = fileInput.files && fileInput.files[0];
        if (!f){ setSubmitEnabled(true); return; }
        const url = URL.createObjectURL(f); lastObjectUrl = url;
        const img = new Image();
        img.onload = function(){
          isHorizontal = img.width > img.height;
          if (!isHorizontal){
            setError('La imagen debe ser horizontal (más ancha que alta).');
            setSubmitEnabled(false);
          } else {
            setError('');
            setSubmitEnabled(true);
          }
          try { URL.revokeObjectURL(url); } catch(_){}
        };
        img.onerror = function(){
          setError('No se pudo leer la imagen seleccionada.');
          setSubmitEnabled(false);
          try { URL.revokeObjectURL(url); } catch(_){}
        };
        img.src = url;
      });
    }

    // Reset state when modal closes
    try {
      const modalEl = qs('#artistCoverModal');
      if (modalEl) modalEl.addEventListener('hidden.bs.modal', function(){
        setError('');
        resetProgress();
        setSubmitEnabled(true);
        if (form) form.reset();
      });
    } catch(_){}

    form.addEventListener('submit', function(e){
      e.preventDefault();
      const f = fileInput && fileInput.files && fileInput.files[0];
      if (!f){ setError('Selecciona una imagen.'); return; }
      if (!isHorizontal){ setError('La imagen debe ser horizontal (más ancha que alta).'); return; }

      const fd = new FormData(form);
      const url = form.action || '/api/v1/users/me/cover-image';
      const http = (window.api || window.axios);

      setSubmitEnabled(false);
      showProgress(0);

      const req = http && http.post ?
        http.post(url, fd, {
          headers: { Accept: 'application/json' },
          withCredentials: true,
          onUploadProgress: function(evt){
            if (evt && evt.total) {
              const pct = Math.round((evt.loaded / evt.total) * 100);
              showProgress(pct);
            }
          }
        })
        : fetch(url, { method: 'POST', body: fd, credentials: 'same-origin' }).then(r=>r.json());

      Promise.resolve(req).then((res) => {
        const successMsg = (res && res.data && res.data.message) || (res && res.message) || 'Portada actualizada';
        alertToast('success', successMsg);
        try {
          const modalEl = qs('#artistCoverModal');
          if (modalEl && window.bootstrap) {
            const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modal.hide();
          }
        } catch(_){}
        try { resetProgress(); } catch(_){}
        if (form) form.reset();
        setTimeout(() => { window.location.reload(); }, 400);
      }).catch(err => {
        resetProgress();
        setSubmitEnabled(true);
        const msg = (err && err.response && err.response.data && err.response.data.message) || (err && err.normalized && err.normalized.message) || err.message || 'No se pudo actualizar la portada';
        alertToast('danger', msg);
        // If server rejected due to orientation, reflect it inline too
        if (msg && msg.toLowerCase().indexOf('horizontal') !== -1) {
          setError('La imagen debe ser horizontal (más ancha que alta).');
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ hookCreateForm(); hookCoverForm(); hookReloadButtons(); loadLists(); });
  } else {
    hookCreateForm(); hookCoverForm(); hookReloadButtons(); loadLists();
  }
})();
