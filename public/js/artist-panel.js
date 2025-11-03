'use strict';

(function initArtistPanel(){
  let currentEditId = null;
  function qs(sel, ctx){ return (ctx||document).querySelector(sel); }
  function qsa(sel, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(sel)); }
  function alertToast(type, msg){
    try { console.log('[ArtistPanel]', type, msg); } catch(_){}
    const container = qs('#artistPanelAlerts') || qs('#accountAlerts');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'alert alert-' + (type||'info') + ' alert-dismissible fade show';
    el.setAttribute('role','alert');
    el.textContent = msg || '';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn-close';
    btn.setAttribute('data-bs-dismiss','alert'); btn.setAttribute('aria-label','Cerrar');
    el.appendChild(btn);
    container.innerHTML = '';
    container.appendChild(el);
  }

  function renderList(listEl, items, status){
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0){
      const li = document.createElement('li');
      li.className = 'list-group-item text-muted small';
      li.textContent = status === 'draft' ? 'No hay borradores.' : 'No hay obras enviadas.';
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
        btnSubmit.textContent = 'Enviar a revisión';
        btnSubmit.addEventListener('click', () => submitArtwork(a._id, li));
        right.appendChild(btnSubmit);
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-sm btn-outline-secondary';
        btnEdit.textContent = 'Editar';
        btnEdit.addEventListener('click', () => openEditModal(a._id));
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
      }
      li.appendChild(left); li.appendChild(right);
      listEl.appendChild(li);
    });
    try {
      if (status === 'draft') {
        const badge = qs('#countDrafts'); if (badge) badge.textContent = String(items.length);
      } else if (status === 'submitted') {
        const badge = qs('#countSubmitted'); if (badge) badge.textContent = String(items.length);
      }
    } catch(_){}
  }

  function fetchList(status){
    const url = '/api/v1/artworks/status/' + encodeURIComponent(status);
    if (window.axios) {
      return axios
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

  function submitArtwork(id, rowEl){
    const url = '/api/v1/artworks/' + id + '/submit';
    const req = window.axios ? axios.patch(url, null, { withCredentials: true }) : fetch(url, { method: 'PATCH', credentials: 'same-origin' }).then(r=>r.json());
    req.then(() => {
      alertToast('success', 'Obra enviada a revisión.');
      loadLists();
    }).catch(err => {
      const msg = (err && err.response && err.response.data && err.response.data.message) || err.message || 'No se pudo enviar';
      alertToast('danger', msg);
    });
  }

  function trashArtwork(id, rowEl){
    if (!confirm('¿Seguro que quieres eliminar esta obra?')) return;
    const url = '/api/v1/artworks/' + id + '/trash';
    const req = window.axios ? axios.patch(url, null, { withCredentials: true }) : fetch(url, { method: 'PATCH', credentials: 'same-origin' }).then(r=>r.json());
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
    Promise.all([fetchList('draft'), fetchList('submitted')]).then(([drafts, submitted]) => {
      renderList(listDrafts, drafts, 'draft');
      renderList(listSubmitted, submitted, 'submitted');
      try { console.log('[ArtistPanel] counts:', { drafts: drafts.length, submitted: submitted.length }); } catch(_){}
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
    // amount a partir de price_cents
    if (art.price_cents != null) {
      const amount = (art.price_cents / 100).toFixed(2);
      setVal('input[name="amount"]', amount);
    } else {
      setVal('input[name="amount"]', '');
    }
  }

  function openEditModal(id){
    const url = '/api/v1/artworks/private/' + encodeURIComponent(id);
    const req = window.axios
      ? axios.get(url, { headers: { Accept: 'application/json' }, withCredentials: true }).then(r => r && r.data)
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
  }

  function hookReloadButtons(){
    const btnD = qs('#reloadDrafts');
    const btnS = qs('#reloadSubmitted');
    if (btnD) btnD.addEventListener('click', loadLists);
    if (btnS) btnS.addEventListener('click', loadLists);
  }

  function hookCreateForm(){
    const form = qs('#artistCreateArtworkForm');
    if (!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      const submitter = e.submitter || document.activeElement;
      const mode = submitter && submitter.getAttribute('data-mode');
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
    form.addEventListener('submit', function(e){
      e.preventDefault();
      const fd = new FormData(form);
      const url = form.action || '/api/v1/users/me/cover-image';
      const req = window.axios ? axios.post(url, fd, { headers: { Accept: 'application/json' }, withCredentials: true }) : fetch(url, { method: 'POST', body: fd, credentials: 'same-origin' }).then(r=>r.json());
      req.then((res) => {
        alertToast('success', (res && res.message) || 'Portada actualizada');
        try {
          const modalEl = qs('#artistCoverModal');
          if (modalEl && window.bootstrap) {
            const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modal.hide();
          }
        } catch(_){}
        form.reset();
        // opcional: recargar para ver cambio inmediato en el hero
        setTimeout(() => { window.location.reload(); }, 600);
      }).catch(err => {
        const msg = (err && err.response && err.response.data && err.response.data.message) || err.message || 'No se pudo actualizar la portada';
        alertToast('danger', msg);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ hookCreateForm(); hookCoverForm(); hookReloadButtons(); loadLists(); });
  } else {
    hookCreateForm(); hookCoverForm(); hookReloadButtons(); loadLists();
  }
})();
