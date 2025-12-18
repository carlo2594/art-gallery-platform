
;/* ==== admin-users.js ==== */

'use strict';
function formatUserRolesLabel(user){
  if (!user) return 'rol desconocido';
  var roles = Array.isArray(user.roles) && user.roles.length ? user.roles.slice() : [];
  return roles.length ? roles.join(', ') : 'rol desconocido';
}
const MAX_REJECT_REASON = 100;
function enforceRejectReasonLimit(textarea){
  if (!textarea || typeof textarea.value !== 'string') return;
  var limit = parseInt(textarea.getAttribute('data-reject-limit'), 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = MAX_REJECT_REASON;
  var value = textarea.value || '';
  if (value.length > limit) {
    value = value.slice(0, limit);
    textarea.value = value;
  }
  var counterId = textarea.getAttribute('data-reject-counter');
  if (counterId) {
    var counter = document.getElementById(counterId);
    if (counter) counter.textContent = Math.max(0, limit - value.length);
  }
}
document.addEventListener('input', function(e){
  var target = e.target;
  if (!target || !target.matches || !target.matches('textarea[data-reject-limit]')) return;
  enforceRejectReasonLimit(target);
});
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('textarea[data-reject-limit]').forEach(enforceRejectReasonLimit);
});

document.addEventListener('DOMContentLoaded', function(){
  // --- Create modal email uniqueness ---
  (function(){
    var form = document.querySelector('.admin-users-create-form');
    if (!form) return;
    var emailEl = document.getElementById('newUserEmail');
    var alertEl;
    function ensureAlert(){
      if (!alertEl) {
        alertEl = document.createElement('div');
        alertEl.className = 'alert alert-warning py-1 px-2 mt-1 admin-users-email-alert';
        alertEl.style.display = 'none';
        if (emailEl && emailEl.parentNode) emailEl.parentNode.appendChild(alertEl);
      }
      return alertEl;
    }
    async function lookup(email){
      try {
        var client = (window.api || window.axios);
        if (client && typeof client.get === 'function') {
          var resp = await client.get('/api/v1/users/lookup', { params: { email: email } });
          return resp && resp.data && resp.data.data;
        }
        var res = await fetch('/api/v1/users/lookup?email=' + encodeURIComponent(email));
        var json = await res.json();
        return json && json.data;
      } catch (e) { console.warn('lookup failed', e); return null; }
    }
    async function check(){
      var val = (emailEl && emailEl.value || '').trim();
      var a = ensureAlert();
      if (!val) { a.style.display='none'; toggleSubmit(false); return; }
      var data = await lookup(val);
      if (data && data.exists && data.user){
        a.innerHTML = 'Este correo ya está registrado: <b>' + (data.user.name || 'Usuario') + '</b> (' + formatUserRolesLabel(data.user) + ')';
        a.style.display = '';
        toggleSubmit(true);
      } else {
        a.style.display = 'none';
        toggleSubmit(false);
      }
    }
    function toggleSubmit(disable){
      var btn = form.querySelector('.admin-users-create-submit');
      if (btn) btn.disabled = !!disable;
    }
    if (emailEl){
      emailEl.addEventListener('blur', check);
      emailEl.addEventListener('input', function(){ if (alertEl) alertEl.style.display='none'; toggleSubmit(false); });
    }
    form.addEventListener('submit', async function(e){
      var email = (emailEl && emailEl.value || '').trim();
      if (!email) return;
      var data = await lookup(email);
      if (data && data.exists){ e.preventDefault(); ensureAlert(); alertEl.innerHTML = 'Este correo ya está registrado: <b>' + (data.user && data.user.name || 'Usuario') + '</b> (' + formatUserRolesLabel(data.user) + ')'; alertEl.style.display=''; toggleSubmit(true); }
    });
  })();

  // --- Normalize website on submit (edit forms) ---
  document.addEventListener('submit', function(e){
    var form = e.target && e.target.closest && e.target.closest('.admin-users-edit-form, .admin-edit-user-form');
    if (!form) return;
    var w = form.querySelector('input[name="website"]');
    if (w && w.value) {
      var s = String(w.value).trim();
      if (!/^https?:\/\//i.test(s)) {
        w.value = 'https://' + s;
      }
    }
  }, true);

  // --- Edit modals email uniqueness ---
  (function(){
    function ensureAlert(input){
      var a = input.parentNode && input.parentNode.querySelector('.admin-users-email-alert');
      if (!a){ a = document.createElement('div'); a.className='alert alert-warning py-1 px-2 mt-1 admin-users-email-alert'; a.style.display='none'; input.parentNode.appendChild(a); }
      return a;
    }
    async function lookup(email){
      try {
        var client = (window.api || window.axios);
        if (client && typeof client.get === 'function') {
          var resp = await client.get('/api/v1/users/lookup', { params: { email: email } });
          return resp && resp.data && resp.data.data;
        }
        var res = await fetch('/api/v1/users/lookup?email=' + encodeURIComponent(email));
        var json = await res.json();
        return json && json.data;
      } catch (e) { console.warn('lookup failed', e); return null; }
    }
    async function check(input){
      var modalEl = input.closest('.admin-users-edit-modal, .admin-edit-user-modal');
      var currentId = modalEl && modalEl.getAttribute('data-user-id');
      var email = (input.value || '').trim();
      var a = ensureAlert(input);
      if (!email){ a.style.display='none'; toggleSubmit(modalEl, false); return; }
      var data = await lookup(email);
      if (data && data.exists && data.user && String(data.user._id) !== String(currentId)){
        a.innerHTML = 'Este correo ya está registrado: <b>' + (data.user.name || 'Usuario') + '</b> (' + formatUserRolesLabel(data.user) + ')';
        a.style.display = '';
        toggleSubmit(modalEl, true);
      } else {
        a.style.display = 'none';
        toggleSubmit(modalEl, false);
      }
    }
    function toggleSubmit(modalEl, disable){
      var btn = modalEl && modalEl.querySelector('.admin-users-edit-submit, .admin-edit-user-submit');
      if (btn) btn.disabled = !!disable;
    }
    document.addEventListener('blur', function(e){
      var t = e.target;
      if (t && t.matches && t.matches('.admin-users-edit-form input[name="email"], .admin-edit-user-form input[name="email"]')){
        check(t);
      }
    }, true);
    document.addEventListener('input', function(e){
      var t = e.target;
      if (t && t.matches && t.matches('.admin-users-edit-form input[name="email"], .admin-edit-user-form input[name="email"]')){
        var a = t.parentNode && t.parentNode.querySelector('.admin-users-email-alert');
        if (a) a.style.display = 'none';
        toggleSubmit(t.closest('.admin-users-edit-modal, .admin-edit-user-modal'), false);
      }
    });
  })();

  // --- Normalize website so bare domains like 'portfolio.art' pass type=url ---
  function normalizeWebsiteValue(input){
    if (!input) return;
    var v = (input.value || '').trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) {
      input.value = 'https://' + v;
    }
  }
  // On blur of website input in edit modal, prefix https:// if missing
  document.addEventListener('blur', function(e){
    var t = e.target;
    if (t && t.matches && t.matches('.admin-users-edit-form input[name="website"], .admin-edit-user-form input[name="website"]')){
      normalizeWebsiteValue(t);
    }
  }, true);
  // Before clicking Save in edit modal, ensure normalization
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('.admin-users-edit-submit, .admin-edit-user-submit');
    if (!btn) return;
    var modalEl = btn.closest('.admin-users-edit-modal, .admin-edit-user-modal');
    if (!modalEl) return;
    var w = modalEl.querySelector('input[name="website"]');
    normalizeWebsiteValue(w);
  });

  // --- Normalize social handles: accept @user or full URL, store handle/route part ---
  function extractHandleFromUrl(platform, urlStr){
    try {
      var u = new URL(urlStr);
      var host = (u.hostname || '').toLowerCase();
      var path = (u.pathname || '').replace(/\/+$/, '');
      var segs = path.split('/').filter(Boolean);
      if (platform === 'instagram') {
        if (host.includes('instagram.com') && segs[0]) return segs[0];
      } else if (platform === 'x') {
        if ((host.includes('x.com') || host.includes('twitter.com')) && segs[0]) return segs[0];
      } else if (platform === 'facebook') {
        if (host.includes('facebook.com')) {
          if (segs[0] === 'profile.php') {
            return 'profile.php' + (u.search || '');
          }
          if (segs[0]) return segs[0];
        }
      }
    } catch(_) {}
    return null;
  }
  function normalizeSocialInput(platform, input){
    if (!input) return;
    var v = (input.value || '').trim();
    if (!v) return;
    if (v[0] === '@') v = v.slice(1);
    if (/^https?:\/\//i.test(v) || /^(?:www\.)?(instagram|twitter|x|facebook)\.com\//i.test(v)) {
      var handle = extractHandleFromUrl(platform, /^https?:/i.test(v) ? v : ('https://' + v));
      if (handle) v = handle;
    }
    input.value = v;
  }
  // Blur normalization for social inputs in edit modal
  document.addEventListener('blur', function(e){
    var t = e.target;
    if (!t || !t.matches) return;
    if (t.matches('.admin-users-edit-form input[name="social.instagram"], .admin-edit-user-form input[name="social.instagram"]')){
      normalizeSocialInput('instagram', t);
    }
    if (t.matches('.admin-users-edit-form input[name="social.x"], .admin-edit-user-form input[name="social.x"]')){
      normalizeSocialInput('x', t);
    }
    if (t.matches('.admin-users-edit-form input[name="social.facebook"], .admin-edit-user-form input[name="social.facebook"]')){
      normalizeSocialInput('facebook', t);
    }
  }, true);
  // Before save, normalize all three if present
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('.admin-users-edit-submit, .admin-edit-user-submit');
    if (!btn) return;
    var modalEl = btn.closest('.admin-users-edit-modal, .admin-edit-user-modal');
    if (!modalEl) return;
    normalizeSocialInput('instagram', modalEl.querySelector('input[name="social.instagram"]'));
    normalizeSocialInput('x', modalEl.querySelector('input[name="social.x"]'));
    normalizeSocialInput('facebook', modalEl.querySelector('input[name="social.facebook"]'));
  });
});



;/* ==== admin-artworks.js ==== */

'use strict';

// Handle admin artwork modal save, including optional image upload
document.addEventListener('DOMContentLoaded', function () {
  // Artist search for create modal
  (function setupArtistSearch(){
    var container = document.querySelector('#adminCreateArtwork');
    if (!container) return;
    var input = container.querySelector('.admin-artworks-artist-search');
    var list = container.querySelector('.admin-artworks-artist-suggestions');
    var hidden = container.querySelector('input[name="artist"]');
    var selectedBox = container.querySelector('.admin-artworks-artist-selected');
    function clearList(){ if (list){ list.innerHTML=''; list.style.display='none'; } }
    function selectArtist(u){ if (!hidden) return; hidden.value = u._id; if (selectedBox){ selectedBox.innerHTML = '<span class="badge text-bg-light">' + (u.name||u.email) + ' &middot; ' + (u.email||'') + '</span>'; } if (input) input.value = ''; clearList(); }
    var lastController = null;
    function search(q){
      if (!q || q.length < 2) { clearList(); return; }
      var url = '/api/v1/users/search?q=' + encodeURIComponent(q) + '&role=artist&limit=8';
      if (lastController && lastController.abort) try{ lastController.abort(); } catch(_){}
      lastController = (window.AbortController ? new AbortController() : null);
      var options = { credentials: 'include' };
      if (lastController) options.signal = lastController.signal;
      fetch(url, options).then(function(res){ if(!res.ok) throw new Error('search failed'); return res.json(); }).then(function(data){
        var users = (data && data.data && data.data.users) || [];
        if (!Array.isArray(users) || users.length === 0) { clearList(); return; }
        list.innerHTML = users.map(function(u){ return '<button type="button" class="list-group-item list-group-item-action" data-id="'+u._id+'" data-name="'+(u.name||'')+'" data-email="'+(u.email||'')+'">' + (u.name || u.email) + (u.email ? ' <small class="text-muted">&middot; ' + u.email + '</small>' : '') + '</button>'; }).join('');
        list.style.display = 'block';
      }).catch(function(err){ console.error(err); clearList(); });
    }
    if (input){
      var debounce;
      input.addEventListener('input', function(){ var v = input.value.trim(); if (debounce) clearTimeout(debounce); debounce = setTimeout(function(){ search(v); }, 200); });
    }
    if (list){
      list.addEventListener('click', function(e){ var btn = e.target.closest('.list-group-item'); if(!btn) return; var u = { _id: btn.getAttribute('data-id'), name: btn.getAttribute('data-name'), email: btn.getAttribute('data-email') }; selectArtist(u); });
    }
  })();

  // Handle create artwork submit
  (function setupCreateArtwork(){
    var modal = document.getElementById('adminCreateArtwork');
    if (!modal) return;
    var form = modal.querySelector('form.admin-create-artwork-form');
    if (!form) return;
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      // Clear previous invalid states
      ['title','price_usd','width_cm','height_cm','image'].forEach(function(n){ var el=form.querySelector('[name="'+n+'"]'); if(el) el.classList.remove('is-invalid'); });
      var artistError = modal.querySelector('.admin-artworks-artist-error'); if (artistError) artistError.textContent = 'Selecciona un artista de la lista';
      var imageError = modal.querySelector('.admin-artworks-image-error'); if (imageError) imageError.textContent = 'Debes subir una imagen';
      var hasError = false;
      var title = form.querySelector('[name="title"]');
      if (!title || !title.value.trim()) { if (title) title.classList.add('is-invalid'); hasError = true; }
      var price = form.querySelector('[name="price_usd"]');
      var priceVal = price && parseFloat(price.value);
      if (!price || !isFinite(priceVal) || priceVal <= 0) { if (price) price.classList.add('is-invalid'); hasError = true; }
      var w = form.querySelector('[name="width_cm"]'); var wv = w && parseFloat(w.value);
      if (!w || !isFinite(wv) || wv <= 0) { if (w) w.classList.add('is-invalid'); hasError = true; }
      var h = form.querySelector('[name="height_cm"]'); var hv = h && parseFloat(h.value);
      if (!h || !isFinite(hv) || hv <= 0) { if (h) h.classList.add('is-invalid'); hasError = true; }
      var artist = form.querySelector('[name="artist"]');
      var artistSearch = form.querySelector('.admin-artworks-artist-search');
      if (!artist || !artist.value) { if (artistSearch) artistSearch.classList.add('is-invalid'); hasError = true; }
      else if (artistSearch) artistSearch.classList.remove('is-invalid');
      var fileInput = form.querySelector('.admin-artworks-image-input');
      if (!fileInput || !fileInput.files || !fileInput.files[0]) { if (fileInput) fileInput.classList.add('is-invalid'); hasError = true; }
      else fileInput.classList.remove('is-invalid');
      if (hasError) { if (window.showAdminToast) showAdminToast('Revisa los campos requeridos', 'warning'); return; }
      var fd = new FormData(form);
      // Map price_usd -> amount
      if (price && price.value !== '') fd.set('amount', price.value);
      // Remove non-whitelisted field from payload
      try { fd.delete('price_usd'); } catch(_) {}
      // Image required is ensured by HTML; ensure artist present
      // artist exists validated above
      var btn = modal.querySelector('.admin-artworks-create-submit');
      var old = btn && btn.textContent; if (btn){ btn.disabled = true; btn.textContent = 'Creando...'; }
      try {
        var res = await fetch('/api/v1/artworks', { method: 'POST', body: fd, credentials: 'include' });
        if (!res.ok) {
          var errMsg = 'Crear fallÃ³';
          try { var errJson = await res.json(); errMsg = (errJson && (errJson.message || (errJson.error && (errJson.error.message || errJson.error.code)) )) || errMsg; } catch(_){ }
          throw new Error(errMsg);
        }
        if (window.showAdminToast) showAdminToast('Obra creada', 'success');
        // Reload to see new item
        setTimeout(function(){ window.location.reload(); }, 600);
      } catch (err) {
        console.error(err);
        var msg = (err && err.message) || 'No se pudo crear la obra';
        if (window.showAdminToast) showAdminToast(msg, 'danger');
      } finally {
        if (btn){ btn.disabled = false; btn.textContent = old || 'Crear'; }
      }
    });
  })();
  // Initialize saved preview srcs
  document.querySelectorAll('form.admin-edit-artwork-form').forEach(function (form) {
    var imgPrev = form.querySelector('.admin-artworks-image-preview');
    if (imgPrev && imgPrev.getAttribute('src')) {
      imgPrev.dataset.savedSrc = imgPrev.getAttribute('src');
    }
  });

  document.querySelectorAll('form.admin-edit-artwork-form').forEach(function (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var id = form.getAttribute('data-artwork-id');
      if (!id) return;
      // Capture initial vs new values for status/availability to drive dedicated endpoints
      var initialStatus = form.getAttribute('data-initial-status') || '';
      var initialAvail = form.getAttribute('data-initial-availability') || '';
      var statusEl = form.querySelector('select[name="status"]');
      var availEl = form.querySelector('select[name="availability"]');
      var reservedUntilEl = form.querySelector('input[name="reservedUntil"]');
      var newStatus = statusEl && statusEl.value || '';
      var newAvail = availEl && availEl.value || '';
      var reservedUntilVal = reservedUntilEl && reservedUntilEl.value || '';

      var fd = new FormData();
      var pick = function (n) { return form.querySelector('[name="' + n + '"]'); };

      // Whitelisted fields for updateArtwork
      ['title', 'description', 'type', 'width_cm', 'height_cm', 'technique', 'completedAt'].forEach(function (name) {
        var el = pick(name);
        if (!el) return;
        var allowEmpty = el.dataset && el.dataset.allowEmpty === 'true';
        if (allowEmpty || el.value !== '') {
          fd.append(name, el.value);
        }
      });

      // price_usd -> amount (USD)
      var priceUsd = pick('price_usd');
      if (priceUsd && priceUsd.value !== '') fd.append('amount', priceUsd.value);

      // Optional image
      var file = pick('image');
      if (file && file.files && file.files[0]) fd.append('image', file.files[0]);

      // Submit PATCH
      var btn = document.querySelector('button.admin-artworks-save[form="' + form.id + '"]');
      var oldText = btn && btn.textContent;
      if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
      try {
        var res = await fetch('/api/v1/artworks/' + encodeURIComponent(id), {
          method: 'PATCH',
          body: fd,
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Guardar fallÃ³');
        var data = null; try { data = await res.json(); } catch (_) {}
        // Update preview if returned
        if (data && data.data && data.data.imageUrl) {
          var imgPrev = form.querySelector('.admin-artworks-image-preview');
          if (imgPrev) {
            imgPrev.src = data.data.imageUrl;
            imgPrev.dataset.savedSrc = data.data.imageUrl;
            imgPrev.hidden = false;
          }
        }
        // Update basic row fields (title, price) for quick feedback
        try {
          var modalEl2 = form.closest('.modal');
          var row2 = modalEl2 && modalEl2.closest && modalEl2.closest('tr');
          if (!row2) {
            var triggerBtn2 = modalEl2 && document.querySelector('button[data-bs-target="#' + modalEl2.id + '"]');
            row2 = triggerBtn2 && triggerBtn2.closest && triggerBtn2.closest('tr');
          }
          if (row2) {
            var tcell2 = row2.querySelector('td:nth-child(1)');
            var pc2 = row2.querySelector('td:nth-child(5)');
            var titleEl2 = pick('title');
            if (tcell2 && titleEl2 && titleEl2.value) tcell2.textContent = titleEl2.value;
            var priceUsd2 = pick('price_usd');
            if (pc2 && priceUsd2 && priceUsd2.value) {
              var n2 = parseFloat(priceUsd2.value);
              if (isFinite(n2)) pc2.textContent = '$' + n2.toLocaleString('en-US');
            }
          }
        } catch(_){ }
        // After generic PATCH, apply status/availability changes via dedicated endpoints
        async function updateStatusIfNeeded(){
          if (!statusEl) return;
          if (newStatus === initialStatus) return;
          var endpoint = null;
          var options = { method: 'PATCH', credentials: 'include' };
          if (newStatus === 'submitted') {
            endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/submit';
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify({});
          } else if (newStatus === 'under_review') {
            // Estado removido: trata como 'submitted'
            endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/submit';
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify({});
          } else if (newStatus === 'approved') {
            endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/approve';
          } else if (newStatus === 'rejected') {
            // Abrir modal de rechazo para capturar motivo
            var rejModal = document.getElementById('adminRejectArtwork-' + id);
            if (rejModal && window.bootstrap && bootstrap.Modal) {
              // Marcar pendiente para saber si hay que revertir si se cierra
              rejModal.setAttribute('data-pending-reject', '1');
              // Asegurar apunta al form de edición correcto
              var rejForm = rejModal.querySelector('form.admin-reject-artwork-form');
              if (rejForm) {
                rejForm.setAttribute('data-artwork-id', id);
                rejForm.setAttribute('data-edit-form-id', form.id);
                rejForm.setAttribute('data-initial-status', initialStatus);
              }
              bootstrap.Modal.getOrCreateInstance(rejModal).show();
            }
            return; // No continuar aquí; el submit del modal hará la llamada
          } else if (newStatus === 'trashed' || newStatus === 'draft') {
            // Not handled here; keep UI consistent
            statusEl.value = initialStatus;
            if (window.showAdminToast) showAdminToast('Usa los controles de Papelera/Restaurar para este estado', 'warning');
            return;
          } else { return; }
          var r = await fetch(endpoint, options);
          if (!r.ok) {
            statusEl.value = initialStatus;
            var txt = 'No se pudo actualizar el estado';
            try { var j = await r.json(); txt = (j && (j.message || (j.error && j.error.message))) || txt; } catch(_){ }
            throw new Error(txt);
          }
          // Update badge on table row (prefer closest row)
          var modalEl = form.closest('.modal');
          var row = modalEl && modalEl.closest && modalEl.closest('tr');
          if (!row) {
            var triggerBtn = modalEl && document.querySelector('button[data-bs-target="#' + modalEl.id + '"]');
            row = triggerBtn && triggerBtn.closest && triggerBtn.closest('tr');
          }
          var badge = row && row.querySelector('td:nth-child(3) .badge');
          if (badge) {
            badge.classList.remove('text-bg-success','text-bg-warning','text-bg-danger','text-bg-secondary');
            var cls = (newStatus === 'approved') ? 'text-bg-success' : (newStatus === 'submitted') ? 'text-bg-warning' : (newStatus === 'rejected') ? 'text-bg-danger' : 'text-bg-secondary';
            badge.classList.add(cls);
            badge.textContent = newStatus || 'draft';
          }
          form.setAttribute('data-initial-status', newStatus);
          if (window.showAdminToast) showAdminToast('Estado actualizado', 'success');
        }

        async function updateAvailabilityIfNeeded(){
          if (!availEl) return;
          if (newAvail === initialAvail) return;
          var endpoint = null;
          var options = { method: 'PATCH', credentials: 'include' };
          if (newAvail === 'for_sale') {
            endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/for-sale';
          } else if (newAvail === 'reserved') {
            endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/reserve';
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify({ reservedUntil: reservedUntilVal || undefined });
          } else if (newAvail === 'not_for_sale') {
            endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/not-for-sale';
          } else if (newAvail === 'on_loan') {
            endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/on-loan';
          } else if (newAvail === 'sold') {
            // Needs sale data; revert and notify
            availEl.value = initialAvail;
            if (window.showAdminToast) showAdminToast('Para marcar como vendida se requieren datos de venta', 'warning');
            return;
          } else { return; }
          var r = await fetch(endpoint, options);
          if (!r.ok) {
            availEl.value = initialAvail;
            var txt = 'No se pudo actualizar la disponibilidad';
            try { var j = await r.json(); txt = (j && (j.message || (j.error && j.error.message))) || txt; } catch(_){ }
            throw new Error(txt);
          }
          // Update availability badge
          var modalEl = form.closest('.modal');
          var row = modalEl && modalEl.closest && modalEl.closest('tr');
          if (!row) {
            var triggerBtn = modalEl && document.querySelector('button[data-bs-target="#' + modalEl.id + '"]');
            row = triggerBtn && triggerBtn.closest && triggerBtn.closest('tr');
          }
          var badge = row && row.querySelector('td:nth-child(4) .badge');
          if (badge) {
            badge.classList.remove('text-bg-success','text-bg-warning','text-bg-secondary','text-bg-info');
            var cls = (newAvail === 'for_sale') ? 'text-bg-success' : (newAvail === 'reserved') ? 'text-bg-warning' : (newAvail === 'sold') ? 'text-bg-secondary' : 'text-bg-info';
            badge.classList.add(cls);
            badge.textContent = newAvail || '';
          }
          form.setAttribute('data-initial-availability', newAvail);
          if (window.showAdminToast) showAdminToast('Disponibilidad actualizada', 'success');
        }

        try { await updateStatusIfNeeded(); } catch (e) { console.error(e); if (window.showAdminToast) showAdminToast(e.message || 'Error al actualizar estado', 'danger'); }
        try { await updateAvailabilityIfNeeded(); } catch (e) { console.error(e); if (window.showAdminToast) showAdminToast(e.message || 'Error al actualizar disponibilidad', 'danger'); }

        if (window.showAdminToast) showAdminToast('Cambios guardados', 'success');
      } catch (err) {
        console.error(err);
        if (window.showAdminToast) showAdminToast('No se pudieron guardar los cambios', 'danger');
        else alert('No se pudieron guardar los cambios');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = oldText || 'Guardar cambios'; }
      }
    });
  });

  // Live preview on image file selection
  document.addEventListener('change', function (e) {
    var input = e.target.closest && e.target.closest('.admin-artworks-image-input');
    if (!input) return;
    var scope = input.closest('form.admin-edit-artwork-form') || input.closest('#adminCreateArtwork');
    if (!scope) return;
    var imgPrev = scope.querySelector('.admin-artworks-image-preview');
    if (!imgPrev) return;
    if (input.files && input.files[0]) {
      var url = URL.createObjectURL(input.files[0]);
      imgPrev.src = url;
      imgPrev.hidden = false;
    } else {
      if (imgPrev.dataset && imgPrev.dataset.savedSrc) {
        imgPrev.src = imgPrev.dataset.savedSrc;
        imgPrev.hidden = !imgPrev.dataset.savedSrc;
      } else {
        imgPrev.hidden = true;
      }
    }
  });

  // Click handler for image Upload and Remove buttons
  document.addEventListener('click', async function (e) {
    var uploadBtn = e.target.closest && e.target.closest('.admin-artworks-image-upload-btn');
    if (uploadBtn) {
      var form = uploadBtn.closest('form.admin-edit-artwork-form');
      // If inside create modal, just acknowledge and ensure preview; no server call
      var createModal = uploadBtn.closest && uploadBtn.closest('#adminCreateArtwork');
      if (!form && createModal) {
        var inputFile = createModal.querySelector('.admin-artworks-image-input');
        if (!inputFile || !inputFile.files || !inputFile.files[0]) {
          if (window.showAdminToast) showAdminToast('Elige una imagen primero', 'warning');
          return;
        }
        var prev = createModal.querySelector('.admin-artworks-image-preview');
        if (prev) {
          try { prev.src = URL.createObjectURL(inputFile.files[0]); prev.hidden = false; } catch(_){ }
        }
        if (window.showAdminToast) showAdminToast('Imagen lista para crear', 'success');
        return;
      }
      if (!form) return;
      var id = form.getAttribute('data-artwork-id');
      if (!id) return;
      var fileInput = form.querySelector('.admin-artworks-image-input');
      if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        if (window.showAdminToast) showAdminToast('Elige una imagen primero', 'warning');
        return;
      }
      var fd = new FormData();
      fd.append('image', fileInput.files[0]);
      var oldText = uploadBtn.textContent;
      uploadBtn.disabled = true; uploadBtn.textContent = 'Subiendo...';
      try {
        var res = await fetch('/api/v1/artworks/' + encodeURIComponent(id), {
          method: 'PATCH',
          body: fd,
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Upload failed');
        var data = null; try { data = await res.json(); } catch(_) {}
        var imgPrev = form.querySelector('.admin-artworks-image-preview');
        if (data && data.data && data.data.imageUrl && imgPrev) {
          imgPrev.src = data.data.imageUrl;
          imgPrev.dataset.savedSrc = data.data.imageUrl;
          imgPrev.hidden = false;
        }
        // clear file selection after upload
        try { fileInput.value = ''; } catch(_){ }
        if (window.showAdminToast) showAdminToast('Imagen actualizada', 'success');
      } catch (err) {
        console.error(err);
        if (window.showAdminToast) showAdminToast('No se pudo subir la imagen', 'danger');
      } finally {
        uploadBtn.disabled = false; uploadBtn.textContent = oldText;
      }
      return;
    }

    var removeBtn = e.target.closest && e.target.closest('.admin-artworks-image-remove-btn');
    if (removeBtn) {
      var form2 = removeBtn.closest('form.admin-edit-artwork-form');
      var createModal2 = removeBtn.closest && removeBtn.closest('#adminCreateArtwork');
      var scope2 = form2 || createModal2;
      if (!scope2) return;
      var input2 = scope2.querySelector('.admin-artworks-image-input');
      var imgPrev2 = scope2.querySelector('.admin-artworks-image-preview');
      if (input2) { try { input2.value = ''; } catch(_) {} }
      if (imgPrev2) {
        if (imgPrev2.dataset && imgPrev2.dataset.savedSrc) {
          imgPrev2.src = imgPrev2.dataset.savedSrc;
          imgPrev2.hidden = !imgPrev2.dataset.savedSrc;
        } else {
          imgPrev2.hidden = true;
        }
      }
      return;
    }
  });

  // Submit handler for reject modal
  document.addEventListener('submit', async function(e){
    var form = e.target.closest && e.target.closest('form.admin-reject-artwork-form');
    if (!form) return;
    e.preventDefault();
    var id = form.getAttribute('data-artwork-id');
    var editFormId = form.getAttribute('data-edit-form-id');
    var initialStatus = form.getAttribute('data-initial-status') || '';
    var reasonEl = form.querySelector('textarea[name="reason"]');
    var reason = (reasonEl && reasonEl.value || '').trim();
    if (reason.length > MAX_REJECT_REASON) {
      reason = reason.slice(0, MAX_REJECT_REASON);
      if (reasonEl) { reasonEl.value = reason; enforceRejectReasonLimit(reasonEl); }
    }
    if (reason.length > MAX_REJECT_REASON) {
      reason = reason.slice(0, MAX_REJECT_REASON);
      if (reasonEl) { reasonEl.value = reason; enforceRejectReasonLimit(reasonEl); }
    }
    if (!id || !reason) { if (window.showAdminToast) showAdminToast('Debes indicar un motivo', 'warning'); return; }
    var btn = form.querySelector('button[type="submit"]');
    var oldText = btn && btn.textContent; if (btn){ btn.disabled = true; btn.textContent = 'Sending...'; }
    try {
      var res = await fetch('/api/v1/artworks/' + encodeURIComponent(id) + '/reject', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: reason })
      });
      if (!res.ok) throw new Error('No se pudo rechazar la obra');
      // Update UI: badge + form initial status
      var editForm = document.getElementById(editFormId);
      if (editForm) {
        editForm.setAttribute('data-initial-status', 'rejected');
        var sel = editForm.querySelector('select[name="status"]');
        if (sel) sel.value = 'rejected';
      }
      // Table badge
      var modalEl = form.closest('.modal');
      var triggerBtn = modalEl && document.querySelector('button[data-bs-target="#' + (editFormId && editFormId.replace('Form','')) + '"]');
      // Fallback: find the corresponding edit modal and then its trigger
      var editModal = document.getElementById((editFormId || '').replace('Form',''));
      if (editModal) triggerBtn = document.querySelector('button[data-bs-target="#' + editModal.id + '"]');
      var row = triggerBtn && triggerBtn.closest('tr');
      var badge = row && row.querySelector('td:nth-child(3) .badge');
      if (badge){
        badge.classList.remove('text-bg-success','text-bg-warning','text-bg-danger','text-bg-secondary');
        badge.classList.add('text-bg-danger');
        badge.textContent = 'rejected';
      }
      // Close reject modal and edit modal
      var rejModal = form.closest('.modal');
      if (rejModal && window.bootstrap && bootstrap.Modal) {
        rejModal.removeAttribute('data-pending-reject');
        bootstrap.Modal.getOrCreateInstance(rejModal).hide();
      }
      if (editFormId) {
        var editModalEl = document.getElementById((editFormId || '').replace('Form',''));
        if (editModalEl && window.bootstrap && bootstrap.Modal) {
          bootstrap.Modal.getOrCreateInstance(editModalEl).hide();
        }
      }
      if (window.showAdminToast) showAdminToast('Obra rechazada', 'success');
    } catch (err) {
      console.error(err);
      if (window.showAdminToast) showAdminToast(err && err.message || 'No se pudo rechazar la obra', 'danger');
      // Revert select to initial on failure
      var ef = document.getElementById(editFormId);
      if (ef) { var s = ef.querySelector('select[name="status"]'); if (s) s.value = initialStatus; }
    } finally {
      if (btn){ btn.disabled = false; btn.textContent = oldText || 'Confirmar rechazo'; }
    }
  }, true);

  // Submit handler for status modal (centraliza cambios de estado)
  document.addEventListener('submit', async function(e){
    var form = e.target.closest && e.target.closest('form.admin-status-artwork-form');
    if (!form) return;
    e.preventDefault();
    var id = form.getAttribute('data-artwork-id');
    var initialStatus = form.getAttribute('data-initial-status') || '';
    if (!id) return;
    var statusInput = form.querySelector('input[name="status"]:checked');
    var newStatus = statusInput && statusInput.value;
    var reasonEl = form.querySelector('textarea[name="reason"]');
    var reason = (reasonEl && reasonEl.value || '').trim();
    if (!newStatus) { if (window.showAdminToast) showAdminToast('Selecciona un estado', 'warning'); return; }
    var endpoint = null, options = { method: 'PATCH', credentials: 'include' };

    async function restoreIfTrashed(){
      if (initialStatus !== 'trashed') return true;
      // Restaurar a borrador primero
      var res = await fetch('/api/v1/artworks/' + encodeURIComponent(id) + '/draft', { method: 'PATCH', credentials: 'include' });
      if (!res.ok) {
        var txt = 'No se pudo restaurar la obra desde la papelera';
        try { var j = await res.json(); txt = (j && (j.message || (j.error && j.error.message))) || txt; } catch(_){ }
        throw new Error(txt);
      }
      // Actualiza UI a draft de inmediato
      try {
        var modalEl0 = form.closest('.modal');
        var row0 = modalEl0 && modalEl0.closest && modalEl0.closest('tr');
        if (!row0) {
          var triggerBtn0 = modalEl0 && document.querySelector('button[data-bs-target="#' + modalEl0.id + '"]');
          row0 = triggerBtn0 && triggerBtn0.closest && triggerBtn0.closest('tr');
        }
        var badge0 = row0 && row0.querySelector('td:nth-child(3) .badge');
        if (badge0) {
          badge0.classList.remove('text-bg-success','text-bg-warning','text-bg-danger','text-bg-secondary');
          badge0.classList.add('text-bg-secondary');
          badge0.textContent = 'draft';
        }
      } catch(_){ }
      return true;
    }
    if (newStatus === 'submitted') {
      endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/submit';
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify({});
      } else if (newStatus === 'under_review') {
        // Estado removido: usa 'submitted'
        endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/submit';
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify({});
      } else if (newStatus === 'approved') {
      endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/approve';
    } else if (newStatus === 'rejected') {
      if (!reason) { if (window.showAdminToast) showAdminToast('Indica el motivo de rechazo', 'warning'); return; }
      endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/reject';
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify({ reason: reason });
    } else {
      if (window.showAdminToast) showAdminToast('Estado no soportado desde este modal', 'warning');
      return;
    }
    var btn = form.querySelector('button[type="submit"]');
    var old = btn && btn.textContent; if (btn){ btn.disabled = true; btn.textContent = 'Guardando...'; }
    try {
      // Si estaba en papelera y el nuevo estado no es 'trashed', restaurar primero (a draft)
      await restoreIfTrashed();
      if (newStatus === 'draft') {
        // Ya restaurado, solo cerrar y actualizar estado inicial del form
        form.setAttribute('data-initial-status', 'draft');
        var modalElDraft = form.closest('.modal');
        if (modalElDraft && window.bootstrap && bootstrap.Modal) bootstrap.Modal.getOrCreateInstance(modalElDraft).hide();
        if (window.showAdminToast) showAdminToast('Obra restaurada a borrador', 'success');
        return;
      }
      var res = await fetch(endpoint, options);
      if (!res.ok) {
        var txt = 'No se pudo actualizar el estado';
        try { var j = await res.json(); txt = (j && (j.message || (j.error && j.error.message))) || txt; } catch(_){ }
        if (res.status === 404) {
          txt = txt || 'Obra no encontrada.';
          txt += ' Verifica que la obra no esté en la papelera o haya sido eliminada.';
        }
        throw new Error(txt);
      }
      // Update status badge on row
      var modalEl = form.closest('.modal');
      var row = modalEl && modalEl.closest && modalEl.closest('tr');
      if (!row) {
        var triggerBtn = modalEl && document.querySelector('button[data-bs-target="#' + modalEl.id + '"]');
        row = triggerBtn && triggerBtn.closest && triggerBtn.closest('tr');
      }
      var badge = row && row.querySelector('td:nth-child(3) .badge');
      if (badge) {
        badge.classList.remove('text-bg-success','text-bg-warning','text-bg-danger','text-bg-secondary');
        var cls = (newStatus === 'approved') ? 'text-bg-success' : (newStatus === 'submitted') ? 'text-bg-warning' : (newStatus === 'rejected') ? 'text-bg-danger' : 'text-bg-secondary';
        badge.classList.add(cls);
        badge.textContent = newStatus || 'draft';
      }
      // Close modal
      if (modalEl && window.bootstrap && bootstrap.Modal) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      // Also sync edit modal initial status if present
      try {
        var editForm = document.getElementById('adminEditArtworkForm-' + id);
        if (editForm) editForm.setAttribute('data-initial-status', newStatus);
      } catch(_){ }
      if (window.showAdminToast) showAdminToast('Estado actualizado', 'success');
    } catch (err) {
      console.error(err);
      if (window.showAdminToast) showAdminToast(err && err.message || 'No se pudo actualizar el estado', 'danger');
    } finally {
      if (btn){ btn.disabled = false; btn.textContent = old || 'Guardar estado'; }
    }
  }, true);

  // If reject modal closes without submitting, revert status select
  document.addEventListener('hidden.bs.modal', function (e) {
    var modal = e.target;
    if (!modal || modal.id.indexOf('adminRejectArtwork-') !== 0) return;
    if (modal.getAttribute('data-pending-reject') !== '1') return;
    var editFormId = (modal.querySelector('form.admin-reject-artwork-form') || {}).getAttribute && modal.querySelector('form.admin-reject-artwork-form').getAttribute('data-edit-form-id');
    var initialStatus = (modal.querySelector('form.admin-reject-artwork-form') || {}).getAttribute && modal.querySelector('form.admin-reject-artwork-form').getAttribute('data-initial-status');
    if (editFormId) {
      var ef = document.getElementById(editFormId);
      if (ef) { var s = ef.querySelector('select[name="status"]'); if (s) s.value = initialStatus || s.value; }
    }
    modal.removeAttribute('data-pending-reject');
  });
});


;/* ==== admin-exhibitions.js ==== */

'use strict';

document.addEventListener('DOMContentLoaded', function(){
  // Create exhibition submit
  (function setupCreate(){
    var modal = document.getElementById('adminCreateExhibition');
    if (!modal) return;
    var form = modal.querySelector('form.admin-create-exhibition-form');
    if (!form) return;
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      var title = (form.querySelector('[name="title"]')||{}).value || '';
      var status = (form.querySelector('[name="status"]')||{}).value || 'draft';
      var description = (form.querySelector('[name="description"]')||{}).value || '';
      var startDate = (form.querySelector('[name="startDate"]')||{}).value || '';
      var endDate = (form.querySelector('[name="endDate"]')||{}).value || '';
      var locType = (form.querySelector('[name="location_type"]')||{}).value || '';
      var locValue = (form.querySelector('[name="location_value"]')||{}).value || '';

      // basic validation
      var hasError = false;
      var titleEl = form.querySelector('[name="title"]');
      var startEl = form.querySelector('[name="startDate"]');
      var endEl = form.querySelector('[name="endDate"]');
      [titleEl,startEl,endEl].forEach(function(el){ if(el) el.classList.remove('is-invalid'); });
      if (!title.trim()) { if (titleEl) titleEl.classList.add('is-invalid'); hasError = true; }
      if (!startDate) { if (startEl) startEl.classList.add('is-invalid'); hasError = true; }
      if (!endDate) { if (endEl) endEl.classList.add('is-invalid'); hasError = true; }
      if (hasError) { if (window.showAdminToast) showAdminToast('Revisa los campos requeridos','warning'); return; }

      var payload = { title: title.trim(), status: status, description: description || undefined, startDate, endDate };
      if (locType) {
        payload.location = { type: locType };
        if (locType === 'physical' && locValue) payload.location.address = locValue;
        if (locType === 'virtual' && locValue) payload.location.url = locValue;
      }

      var btn = modal.querySelector('.admin-exhibitions-create-submit');
      var oldText = btn && btn.textContent;
      if (btn) { btn.disabled = true; btn.textContent = 'Creando...'; }
      try {
        var res = await fetch('/api/v1/exhibitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Create failed');
        var json = await res.json();
        var created = json && json.data;
        // Si se seleccionÃ³ una portada, subirla ahora
        var coverInput = form.querySelector('input[name="coverImage"]');
        if (created && created._id && coverInput && coverInput.files && coverInput.files[0]) {
          var fd = new FormData();
          fd.append('coverImage', coverInput.files[0]);
          var up = await fetch('/api/v1/exhibitions/' + encodeURIComponent(created._id) + '/cover-image', {
            method: 'PATCH',
            credentials: 'include',
            body: fd
          });
          if (!up.ok) console.warn('Cover upload failed after create');
        }
        if (window.showAdminToast) showAdminToast('exposición creada','success');
        // simple: reload to see it in the list
        setTimeout(function(){ window.location.reload(); }, 400);
      } catch (err) {
        console.error(err);
        if (window.showAdminToast) showAdminToast('No se pudo crear','danger');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = oldText || 'Crear'; }
      }
    });
  })();

  // Edit exhibition submit
  document.addEventListener('submit', async function(e){
    var form = e.target.closest && e.target.closest('form.admin-edit-exhibition-form');
    if (!form) return;
    e.preventDefault();
    var id = form.getAttribute('data-exhibition-id');
    if (!id) return;
    var title = (form.querySelector('[name="title"]')||{}).value || '';
    var status = (form.querySelector('[name="status"]')||{}).value || '';
    var description = (form.querySelector('[name="description"]')||{}).value || '';
    var startDate = (form.querySelector('[name="startDate"]')||{}).value || '';
    var endDate = (form.querySelector('[name="endDate"]')||{}).value || '';
    var locType = (form.querySelector('[name="location_type"]')||{}).value || '';
    var locValue = (form.querySelector('[name="location_value"]')||{}).value || '';

    var payload = { };
    if (title) payload.title = title;
    if (status) payload.status = status;
    payload.description = description || '';
    if (startDate) payload.startDate = startDate;
    if (endDate) payload.endDate = endDate;
    if (locType) {
      payload.location = { type: locType };
      if (locType === 'physical') payload.location.address = locValue || '';
      if (locType === 'virtual') payload.location.url = locValue || '';
    } else {
      // clear location if empty type and no value
      payload.location = {};
    }

    var btn = document.querySelector('button.admin-exhibitions-save[form="' + form.id + '"]');
    var oldText = btn && btn.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    try {
      var res = await fetch('/api/v1/exhibitions/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Update failed');
      // Update visible row quickly
      var row = document.getElementById('exhRow-' + id);
      if (row) {
        var tcell = row.querySelector('td:nth-child(1)'); if (tcell) tcell.textContent = title || tcell.textContent;
        var statusCell = row.querySelector('td:nth-child(2) .badge');
        if (statusCell && status) {
          statusCell.classList.remove('text-bg-success','text-bg-dark','text-bg-secondary');
          statusCell.classList.add(status === 'published' ? 'text-bg-success' : (status === 'archived' ? 'text-bg-dark' : 'text-bg-secondary'));
          statusCell.textContent = status;
        }
        var locTypeTxt = locType ? (locType === 'physical' ? 'Fisica' : 'Virtual') : '';
        var locCell = row.querySelector('td:nth-child(4)'); if (locCell) locCell.textContent = locType ? locTypeTxt : locCell.textContent;
        var sdCell = row.querySelector('td:nth-child(6)'); if (sdCell && startDate) { try { sdCell.textContent = new Date(startDate).toLocaleDateString('es-ES'); } catch(_){} }
        var edCell = row.querySelector('td:nth-child(7)'); if (edCell && endDate) { try { edCell.textContent = new Date(endDate).toLocaleDateString('es-ES'); } catch(_){} }
      }
      if (window.showAdminToast) showAdminToast('Cambios guardados','success');
      // close modal
      var modalEl = form.closest('.modal');
      if (modalEl && window.bootstrap && bootstrap.Modal) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    } catch (err) {
      console.error(err);
      if (window.showAdminToast) showAdminToast('No se pudieron guardar los cambios','danger');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = oldText || 'Guardar cambios'; }
    }
  });

  // Portada: subir/actualizar
  document.addEventListener('submit', async function(e){
    var form = e.target.closest && e.target.closest('form.admin-exhibition-cover-form');
    if (!form) return;
    e.preventDefault();
    var id = form.getAttribute('data-exhibition-id');
    var fileInput = form.querySelector('input[name="coverImage"]');
    if (!id || !fileInput || !fileInput.files || !fileInput.files[0]) {
      if (window.showAdminToast) showAdminToast('Selecciona una imagen', 'warning');
      return;
    }
    var btn = form.querySelector('button[type="submit"]');
    var oldText = btn && btn.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
    try {
      var fd = new FormData();
      fd.append('coverImage', fileInput.files[0]);
      var res = await fetch('/api/v1/exhibitions/' + encodeURIComponent(id) + '/cover-image', {
        method: 'PATCH',
        credentials: 'include',
        body: fd
      });
      if (!res.ok) throw new Error('Upload cover failed');
      if (window.showAdminToast) showAdminToast('Portada actualizada', 'success');
      setTimeout(function(){ window.location.reload(); }, 300);
    } catch (err) {
      console.error(err);
      if (window.showAdminToast) showAdminToast('No se pudo actualizar la portada', 'danger');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = oldText || 'Guardar portada'; }
    }
  });

  // Portada: eliminar
  document.addEventListener('click', async function(e){
    var btn = e.target.closest && e.target.closest('button[data-action="remove-cover"]');
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute('data-exhibition-id');
    if (!id) return;
    var oldText = btn.textContent;
    btn.disabled = true; btn.textContent = 'Eliminando...';
    try {
      var res = await fetch('/api/v1/exhibitions/' + encodeURIComponent(id) + '/cover-image', {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Delete cover failed');
      if (window.showAdminToast) showAdminToast('Portada eliminada', 'success');
      setTimeout(function(){ window.location.reload(); }, 300);
    } catch (err) {
      console.error(err);
      if (window.showAdminToast) showAdminToast('No se pudo eliminar la portada', 'danger');
    } finally {
      btn.disabled = false; btn.textContent = oldText || 'Eliminar portada';
    }
  });

  // (Sin gestiÃ³n de galerÃ­a por URLs)
});


;/* ==== admin-exhibitions-artworks.js ==== */

'use strict';

(function(){
  // Utilidades
  function qs(el, sel){ return el.querySelector(sel); }
  function qsa(el, sel){ return Array.prototype.slice.call(el.querySelectorAll(sel)); }
  function normalize(s){ return (s||'').toLowerCase(); }

  async function fetchApprovedArtworks(){
    // Devuelve obras aprobadas (admin puede ver todas)
    const res = await fetch('/api/v1/artworks?status=approved', { credentials: 'include' });
    if (!res.ok) throw new Error('No se pudieron cargar las obras');
    const json = await res.json();
    return json && json.data ? json.data : [];
  }

  function getAddSort(modal){
    const v = modal.getAttribute('data-add-sort') || 'alpha';
    return (v === 'recent' || v === 'oldest') ? v : 'alpha';
  }

  function renderArtworkList(modal, artworks){
    const list = qs(modal, '.artwork-list');
    if (!list) return;
    list.innerHTML = '';

    const existingCsv = modal.getAttribute('data-existing-ids') || '';
    const existingSet = new Set(existingCsv.split(',').map(s => s.trim()).filter(Boolean));

    if (!artworks.length){
      const empty = document.createElement('div');
      empty.className = 'text-center py-4 text-muted';
      empty.textContent = 'No se encontraron obras aprobadas.';
      list.appendChild(empty);
      return;
    }

    // Orden: primero ya agregadas; dentro del grupo, segÃºn selector (alpha | recent | oldest)
    const sortMode = getAddSort(modal);
    const sorted = artworks.slice().sort((a, b) => {
      const ia = existingSet.has(String(a._id));
      const ib = existingSet.has(String(b._id));
      if (ia !== ib) return ia ? -1 : 1;
      if (sortMode === 'alpha'){
        const ta = normalize(a.title || '');
        const tb = normalize(b.title || '');
        if (ta < tb) return -1; if (ta > tb) return 1; return 0;
      } else if (sortMode === 'recent'){
        const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return cb - ca; // mÃ¡s recientes primero
      } else {
        const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return ca - cb; // mÃ¡s antiguas primero
      }
    });

    sorted.forEach(a => {
      const item = document.createElement('label');
      item.className = 'list-group-item d-flex align-items-center gap-3';
      item.setAttribute('data-title', normalize(a.title));
      const artistName = a.artist && a.artist.name ? a.artist.name : '';
      item.setAttribute('data-artist', normalize(artistName));
      const isExisting = existingSet.has(String(a._id));
      item.setAttribute('data-is-existing', isExisting ? '1' : '0');
      const createdAt = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      item.setAttribute('data-created-at', String(createdAt));

      const thumb = document.createElement('img');
      thumb.className = 'rounded border';
      thumb.style.width = '48px';
      thumb.style.height = '48px';
      thumb.style.objectFit = 'cover';
      thumb.alt = a.title || 'obra';
      thumb.src = a.imageUrl || 'about:blank';

      const info = document.createElement('div');
      info.className = 'flex-grow-1';
      const t = document.createElement('div');
      t.className = 'fw-semibold';
      t.textContent = a.title || '(Sin titulo)';
      const s = document.createElement('div');
      s.className = 'text-muted small';
      s.textContent = artistName || '';
      info.appendChild(t); info.appendChild(s);

      const controls = document.createElement('div');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'form-check-input';
      input.value = a._id;
      input.style.marginLeft = 'auto';

      if (isExisting){
        input.disabled = true;
        const already = document.createElement('span');
        already.className = 'badge text-bg-secondary ms-2';
        already.textContent = 'Ya agregada';
        controls.appendChild(already);
      }

      controls.appendChild(input);

      item.appendChild(thumb);
      item.appendChild(info);
      item.appendChild(controls);
      list.appendChild(item);
    });

    updateSelectionState(modal);
  }

  function resortAddList(modal){
    const list = qs(modal, '.artwork-list');
    if (!list) return;
    const items = qsa(list, '.list-group-item');
    const mode = getAddSort(modal);
    items.sort((ia, ib) => {
      const aAdded = ia.getAttribute('data-is-existing') === '1';
      const bAdded = ib.getAttribute('data-is-existing') === '1';
      if (aAdded !== bAdded) return aAdded ? -1 : 1;
      if (mode === 'alpha'){
        const ta = (ia.getAttribute('data-title')||'');
        const tb = (ib.getAttribute('data-title')||'');
        if (ta < tb) return -1; if (ta > tb) return 1; return 0;
      } else if (mode === 'recent'){
        const ca = parseInt(ia.getAttribute('data-created-at')||'0',10);
        const cb = parseInt(ib.getAttribute('data-created-at')||'0',10);
        return cb - ca;
      } else {
        const ca = parseInt(ia.getAttribute('data-created-at')||'0',10);
        const cb = parseInt(ib.getAttribute('data-created-at')||'0',10);
        return ca - cb;
      }
    });
    items.forEach(el => list.appendChild(el));
  }
  
  async function fetchArtworksByIds(ids){
    const unique = Array.from(new Set((ids||[]).map(String))); if (!unique.length) return [];
    const results = [];
    for (const id of unique){
      try {
        const res = await fetch('/api/v1/artworks/private/' + encodeURIComponent(id), { credentials: 'include' });
        if (!res.ok) continue;
        const json = await res.json();
        if (json && json.data) results.push(json.data);
      } catch(_){}
    }
    return results;
  }

  function renderRemoveList(modal, artworks){
    const list = qs(modal, '.artwork-remove-list');
    if (!list) return;
    list.innerHTML = '';
    if (!artworks.length){
      const empty = document.createElement('div');
      empty.className = 'text-center py-4 text-muted';
      empty.textContent = 'Esta exposiciÃ³n no tiene obras.';
      list.appendChild(empty);
      return;
    }
    artworks.forEach(a => {
      const item = document.createElement('label');
      item.className = 'list-group-item d-flex align-items-center gap-3';
      item.setAttribute('data-title', normalize(a.title));
      const artistName = a.artist && a.artist.name ? a.artist.name : '';
      item.setAttribute('data-artist', normalize(artistName));

      const thumb = document.createElement('img');
      thumb.className = 'rounded border';
      thumb.style.width = '48px';
      thumb.style.height = '48px';
      thumb.style.objectFit = 'cover';
      thumb.alt = a.title || 'obra';
      thumb.src = a.imageUrl || 'about:blank';

      const info = document.createElement('div');
      info.className = 'flex-grow-1';
      const t = document.createElement('div');
      t.className = 'fw-semibold';
      t.textContent = a.title || '(Sin titulo)';
      const s = document.createElement('div');
      s.className = 'text-muted small';
      s.textContent = artistName || '';
      info.appendChild(t); info.appendChild(s);

      const controls = document.createElement('div');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'form-check-input';
      input.value = a._id;
      input.style.marginLeft = 'auto';
      controls.appendChild(input);

      item.appendChild(thumb);
      item.appendChild(info);
      item.appendChild(controls);
      list.appendChild(item);
    });

    updateRemoveSelectionState(modal);
  }

  function updateRemoveSelectionState(modal){
    const btn = qs(modal, 'button[data-action="remove-selected"]');
    const selected = qsa(modal, '.artwork-remove-list input[type="checkbox"]:checked');
    if (btn){
      btn.disabled = selected.length === 0;
      btn.setAttribute('data-selected-count', String(selected.length));
      btn.innerHTML = '<i class="fas fa-trash-can me-1"></i> Quitar obras' + (selected.length ? ' (' + selected.length + ')' : '');
    }
  }

  function updateSelectionState(modal){
    const btn = qs(modal, 'button[data-action="add-selected"]');
    const selected = qsa(modal, '.artwork-list input[type="checkbox"]:checked:not(:disabled)');
    if (btn){
      btn.disabled = selected.length === 0;
      btn.setAttribute('data-selected-count', String(selected.length));
      btn.innerHTML = '<i class="fas fa-plus me-1"></i> Agregar seleccionadas' + (selected.length ? ' (' + selected.length + ')' : '');
    }
  }

  // Cargar obras al abrir el modal
  document.addEventListener('show.bs.modal', async function(ev){
    const modal = ev.target;
    if (!modal.classList || !modal.classList.contains('exhibition-add-artworks-modal')) return;
    if (modal.getAttribute('data-loaded') === '1') return;
    const list = modal.querySelector('.artwork-list [data-role="loading"]');
    try {
      const artworks = await fetchApprovedArtworks();
      renderArtworkList(modal, artworks || []);
      resortAddList(modal);
      // Cargar obras actuales para Quitar
      const existingCsv = modal.getAttribute('data-existing-ids') || '';
      const ids = existingCsv.split(',').map(s=>s.trim()).filter(Boolean);
      if (ids.length){
        const currentArts = await fetchArtworksByIds(ids);
        renderRemoveList(modal, currentArts || []);
      } else {
        renderRemoveList(modal, []);
      }
    } catch (err){
      console.error(err);
      if (list) list.innerHTML = '<div class="text-danger">No se pudieron cargar las obras.</div>';
      if (window.showAdminToast) showAdminToast('No se pudieron cargar las obras', 'danger');
    } finally {
      modal.setAttribute('data-loaded', '1');
    }
  });

  // Cambio de orden en pane Agregar
  document.addEventListener('change', function(e){
    const sel = e.target.closest && e.target.closest('select[data-action="artwork-add-sort"]');
    if (!sel) return;
    const modal = sel.closest('.modal');
    if (!modal) return;
    const val = sel.value === 'recent' || sel.value === 'oldest' ? sel.value : 'alpha';
    modal.setAttribute('data-add-sort', val);
    resortAddList(modal);
  });

  // Buscar dentro del modal
  document.addEventListener('input', function(e){
    const addInput = e.target.closest && e.target.closest('input[data-action="artwork-search"]');
    const rmInput  = e.target.closest && e.target.closest('input[data-action="artwork-remove-search"]');
    if (!addInput && !rmInput) return;
    const modal = (addInput || rmInput).closest('.modal');
    if (!modal) return;
    const term = normalize((addInput || rmInput).value);
    const selector = addInput ? '.artwork-list .list-group-item' : '.artwork-remove-list .list-group-item';
    qsa(modal, selector).forEach(item => {
      const t = item.getAttribute('data-title') || '';
      const a = item.getAttribute('data-artist') || '';
      const match = !term || t.includes(term) || a.includes(term);
      item.style.display = match ? '' : 'none';
    });
  });

  // Actualiza contador cuando se selecciona/deselecciona
  document.addEventListener('change', function(e){
    const cb = e.target && e.target.closest('input[type="checkbox"]');
    if (!cb) return;
    const modal = cb.closest('.modal');
    if (!modal || !modal.classList.contains('exhibition-add-artworks-modal')) return;
    const activePane = modal.getAttribute('data-active-pane') || 'add';
    if (activePane === 'add') updateSelectionState(modal);
    else updateRemoveSelectionState(modal);
  });

  // Agregar seleccionadas
  document.addEventListener('click', async function(e){
    // Tab switch
    const tabBtn = e.target.closest && e.target.closest('[data-role="mode-tabs"] .nav-link');
    if (tabBtn){
      const modal = tabBtn.closest('.modal');
      if (!modal) return;
      const pane = tabBtn.getAttribute('data-pane') || 'add';
      modal.setAttribute('data-active-pane', pane);
      // toggle active class
      qsa(modal, '[data-role="mode-tabs"] .nav-link').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      // toggle panes
      const addPane = qs(modal, '.pane-add');
      const removePane = qs(modal, '.pane-remove');
      if (addPane && removePane){
        if (pane === 'add'){ addPane.classList.remove('d-none'); removePane.classList.add('d-none'); }
        else { removePane.classList.remove('d-none'); addPane.classList.add('d-none'); }
      }
      // toggle footer buttons
      const addBtn = qs(modal, 'button[data-action="add-selected"]');
      const rmBtn = qs(modal, 'button[data-action="remove-selected"]');
      if (addBtn && rmBtn){
        if (pane === 'add'){ addBtn.classList.remove('d-none'); rmBtn.classList.add('d-none'); updateSelectionState(modal); }
        else { rmBtn.classList.remove('d-none'); addBtn.classList.add('d-none'); updateRemoveSelectionState(modal); }
      }
      return;
    }

    const btn = e.target.closest && e.target.closest('button[data-action="add-selected"]');
    if (!btn) return;
    e.preventDefault();
    const modal = btn.closest('.modal');
    const id = btn.getAttribute('data-exhibition-id');
    if (!modal || !id) return;
    const checks = qsa(modal, '.artwork-list input[type="checkbox"]:checked:not(:disabled)');
    if (!checks.length) return;

    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Agregando...';
    try {
      // Ejecutar en serie para feedback simple
      for (const c of checks){
        const payload = { artworkId: c.value };
        const res = await fetch('/api/v1/exhibitions/' + encodeURIComponent(id) + '/add-artwork', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Fallo al agregar obra');
        // Deshabilitar inmediatamente la casilla
        c.checked = false;
        c.disabled = true;
        const badge = document.createElement('span');
        badge.className = 'badge text-bg-secondary ms-2';
        badge.textContent = 'Ya agregada';
        c.parentElement && c.parentElement.appendChild(badge);
      }

      // Actualiza contador "Obras" en la fila
      const row = document.getElementById('exhRow-' + id);
      if (row){
        // la celda de "Obras" sigue siendo la quinta columna
        const obrasCell = row.querySelector('td:nth-child(5)');
        if (obrasCell){
          const current = parseInt(obrasCell.textContent, 10);
          const added = checks.length;
          const next = isNaN(current) ? added : current + added;
          obrasCell.textContent = String(next);
        }
      }

      if (window.showAdminToast) showAdminToast('Obras agregadas a la exposición', 'success');
      if (window.bootstrap && bootstrap.Modal) bootstrap.Modal.getOrCreateInstance(modal).hide();
    } catch (err){
      console.error(err);
      if (window.showAdminToast) showAdminToast('No se pudieron agregar algunas obras', 'danger');
    } finally {
      btn.disabled = false;
      btn.textContent = old || 'Agregar seleccionadas';
    }
  });

  // Quitar seleccionadas
  document.addEventListener('click', async function(e){
    const btn = e.target.closest && e.target.closest('button[data-action="remove-selected"]');
    if (!btn) return;
    e.preventDefault();
    const modal = btn.closest('.modal');
    const id = btn.getAttribute('data-exhibition-id');
    if (!modal || !id) return;
    const checks = qsa(modal, '.artwork-remove-list input[type="checkbox"]:checked');
    if (!checks.length) return;
    if (!confirm('¿Quitar las obras seleccionadas de la exposiciÃ³n?')) return;

    const oldHTML = btn.innerHTML; btn.disabled = true; btn.textContent = 'Quitando...';
    try {
      for (const c of checks){
        const payload = { artworkId: c.value };
        const res = await fetch('/api/v1/exhibitions/' + encodeURIComponent(id) + '/remove-artwork', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Fallo al quitar obra');
        // Quitar elemento de la lista
        const li = c.closest('.list-group-item');
        if (li) li.remove();
        // Actualizar atributo existing-ids
        const existingCsv = modal.getAttribute('data-existing-ids') || '';
        const ids = existingCsv.split(',').map(s=>s.trim()).filter(Boolean);
        const nextIds = ids.filter(x => x !== c.value);
        modal.setAttribute('data-existing-ids', nextIds.join(','));
        // Habilitar en la lista de Agregar (si estaba deshabilitada)
        const addInput = qs(modal, '.artwork-list input[type="checkbox"][value="' + c.value + '"]');
        if (addInput){
          addInput.disabled = false;
          const badge = addInput.parentElement && addInput.parentElement.querySelector && addInput.parentElement.querySelector('.badge.text-bg-secondary');
          if (badge) badge.remove();
          // Actualiza marca y reordena
          const item = addInput.closest('.list-group-item');
          if (item) {
            item.setAttribute('data-is-existing', '0');
          }
        }
      }

      // Actualiza contador "Obras" en la fila
      const row = document.getElementById('exhRow-' + id);
      if (row){
        const obrasCell = row.querySelector('td:nth-child(5)');
        if (obrasCell){
          const current = parseInt(obrasCell.textContent, 10);
          const removed = checks.length;
          const next = isNaN(current) ? 0 : Math.max(0, current - removed);
          obrasCell.textContent = String(next);
        }
      }

      if (window.showAdminToast) showAdminToast('Obras removidas de la exposiciÃ³n', 'success');
      // Reordenar lista de Agregar tras cambios
      resortAddList(modal);
      // Si la lista quedÃ³ vacÃ­a, render mensaje
      const remList = qs(modal, '.artwork-remove-list');
      if (remList && !remList.querySelector('.list-group-item')){
        const empty = document.createElement('div');
        empty.className = 'text-center py-4 text-muted';
        empty.textContent = 'Esta exposiciÃ³n no tiene obras.';
        remList.innerHTML = '';
        remList.appendChild(empty);
      }
      // Resetear estado del botón: texto base y deshabilitar
      updateRemoveSelectionState(modal);
      var rmBtn = qs(modal, 'button[data-action="remove-selected"]');
      if (rmBtn){ rmBtn.innerHTML = '<i class="fas fa-trash-can me-1"></i> Quitar obras'; }
    } catch (err){
      console.error(err);
      if (window.showAdminToast) showAdminToast('No se pudieron quitar algunas obras', 'danger');
    } finally {
      updateRemoveSelectionState(modal);
    }
  });
})();




// ==== admin-artworks-bulk.js ====
(function(){
  function getSelected(){
    return Array.prototype.slice.call(document.querySelectorAll('.artwork-select:checked')).map(function(cb){ return cb.value; });
  }
  function setBulkEnabled(){
    var any = getSelected().length > 0;
    ['#bulkStatusBtn','#bulkRestoreBtn','#bulkTrashBtn'].forEach(function(sel){ var b=document.querySelector(sel); if(b) b.disabled = !any; });
    var master = document.getElementById('selectAllArtworks'); if (master) master.checked = any && document.querySelectorAll('.artwork-select:not(:checked)').length===0;
    var masterH = document.getElementById('selectAllArtworksHead'); if (masterH) masterH.checked = any && document.querySelectorAll('.artwork-select:not(:checked)').length===0;
  }
  document.addEventListener('change', function(e){
    var cb = e.target.closest && e.target.closest('.artwork-select');
    if (cb) setBulkEnabled();
    var all = e.target.closest && (e.target.closest('#selectAllArtworks') || e.target.closest('#selectAllArtworksHead'));
    if (all){
      var checked = e.target.checked;
      document.querySelectorAll('.artwork-select').forEach(function(c){ c.checked = checked; });
      setBulkEnabled();
    }
  });
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('button[data-action="bulk-status"]');
    if (btn){ e.preventDefault(); var modal = document.getElementById('adminBulkStatusModal'); if (modal && window.bootstrap && bootstrap.Modal) bootstrap.Modal.getOrCreateInstance(modal).show(); }
  });
  // Bulk restore
  document.addEventListener('click', async function(e){
    var btn = e.target.closest && e.target.closest('button[data-action="bulk-restore"]');
    if (!btn) return;
    e.preventDefault();
    var ids = getSelected(); if (!ids.length) return;
    var old = btn.textContent; btn.disabled = true; btn.textContent = 'Restaurando...';
    try {
      for (const id of ids){
        var res = await fetch('/api/v1/artworks/' + encodeURIComponent(id) + '/draft', { method: 'PATCH', credentials: 'include' });
        if (!res.ok) continue;
        var row = document.getElementById('artRow-' + id);
        if (row){ var b = row.querySelector('td:nth-child(3) .badge'); if (b){ b.classList.remove('text-bg-success','text-bg-warning','text-bg-danger','text-bg-secondary'); b.classList.add('text-bg-secondary'); b.textContent='draft'; } }
      }
      if (window.showAdminToast) showAdminToast('Obras restauradas a borrador','success');
    } catch(err){ console.error(err); if (window.showAdminToast) showAdminToast('No se pudo restaurar algunas obras','danger'); }
    finally { btn.disabled=false; btn.textContent = old; }
  });
  // Bulk trash
  document.addEventListener('click', async function(e){
    var btn = e.target.closest && e.target.closest('button[data-action="bulk-trash"]');
    if (!btn) return;
    e.preventDefault();
    var ids = getSelected(); if (!ids.length) return;
    if (!confirm('Enviar ' + ids.length + ' obra(s) a la papelera?')) return;
    var old = btn.textContent; btn.disabled = true; btn.textContent = 'Sending...';
    try {
      for (const id of ids){
        var res = await fetch('/api/v1/artworks/' + encodeURIComponent(id) + '/trash', { method: 'PATCH', credentials: 'include' });
        if (!res.ok) continue;
        var row = document.getElementById('artRow-' + id); if (row) row.remove();
      }
      if (window.showAdminToast) showAdminToast('Obras enviadas a la papelera','success');
      setBulkEnabled();
    } catch(err){ console.error(err); if (window.showAdminToast) showAdminToast('No se pudo enviar algunas obras a la papelera','danger'); }
    finally { btn.disabled=false; btn.textContent = old; }
  });
  // Bulk status submit
  document.addEventListener('submit', async function(e){
    var form = e.target.closest && e.target.closest('form.admin-bulk-status-form');
    if (!form) return;
    e.preventDefault();
    var ids = getSelected(); if (!ids.length) { if (window.showAdminToast) showAdminToast('Selecciona al menos una obra','warning'); return; }
    var statusInput = form.querySelector('input[name="status"]:checked'); var newStatus = statusInput && statusInput.value;
    var reasonEl = form.querySelector('textarea[name="reason"]'); var reason = (reasonEl && reasonEl.value || '').trim();
    if (reason.length > MAX_REJECT_REASON) {
      reason = reason.slice(0, MAX_REJECT_REASON);
      if (reasonEl) { reasonEl.value = reason; enforceRejectReasonLimit(reasonEl); }
    }
    if (!newStatus) { if (window.showAdminToast) showAdminToast('Selecciona un estado','warning'); return; }
    if (newStatus === 'rejected' && !reason) { if (window.showAdminToast) showAdminToast('Indica el motivo de rechazo','warning'); return; }
    var btn = form.querySelector('button[type="submit"]'); var old = btn && btn.textContent; if (btn){ btn.disabled=true; btn.textContent='Aplicando...'; }
    try {
      for (const id of ids){
        async function doChange(){
          var endpoint = null, options = { method:'PATCH', credentials:'include' };
          if (newStatus === 'draft') { endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/draft'; }
          else if (newStatus === 'submitted') { endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/submit'; options.headers={ 'Content-Type':'application/json' }; options.body=JSON.stringify({}); }
          else if (newStatus === 'under_review') { endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/submit'; options.headers={ 'Content-Type':'application/json' }; options.body=JSON.stringify({}); }
          else if (newStatus === 'approved') { endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/approve'; }
          else if (newStatus === 'rejected') { endpoint = '/api/v1/artworks/' + encodeURIComponent(id) + '/reject'; options.headers={ 'Content-Type':'application/json' }; options.body=JSON.stringify({ reason: reason }); }
          if (!endpoint) return;
          var r = await fetch(endpoint, options);
          if (!r.ok) {
            if (r.status === 404 && newStatus !== 'draft') {
              var rr = await fetch('/api/v1/artworks/' + encodeURIComponent(id) + '/draft', { method:'PATCH', credentials:'include' });
              if (rr.ok) {
                if (newStatus === 'draft') return;
                r = await fetch(endpoint, options);
              }
            }
            if (!r.ok) return;
          }
          var row = document.getElementById('artRow-' + id);
          if (row) {
            var badge = row.querySelector('td:nth-child(3) .badge');
            if (badge){
              badge.classList.remove('text-bg-success','text-bg-warning','text-bg-danger','text-bg-secondary');
        var cls = (newStatus === 'approved') ? 'text-bg-success' : (newStatus === 'submitted') ? 'text-bg-warning' : (newStatus === 'rejected') ? 'text-bg-danger' : 'text-bg-secondary';
              badge.classList.add(cls); badge.textContent = newStatus || 'draft';
            }
          }
        }
        await doChange();
      }
      if (window.showAdminToast) showAdminToast('Estado aplicado a ' + ids.length + ' obra(s)','success');
      var modal = document.getElementById('adminBulkStatusModal'); if (modal && window.bootstrap && bootstrap.Modal) bootstrap.Modal.getOrCreateInstance(modal).hide();
    } catch(err){ console.error(err); if (window.showAdminToast) showAdminToast('No se pudo aplicar el estado a algunas obras','danger'); }
    finally { if (btn){ btn.disabled=false; btn.textContent= old || 'Aplicar'; } }
  }, true);
})();
