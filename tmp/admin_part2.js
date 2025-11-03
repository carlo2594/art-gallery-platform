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
    function selectArtist(u){ if (!hidden) return; hidden.value = u._id; if (selectedBox){ selectedBox.innerHTML = '<span class="badge text-bg-light">' + (u.name||u.email) + ' · ' + (u.email||'') + '</span>'; } if (input) input.value = ''; clearList(); }
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
        list.innerHTML = users.map(function(u){ return '<button type="button" class="list-group-item list-group-item-action" data-id="'+u._id+'" data-name="'+(u.name||'')+'" data-email="'+(u.email||'')+'">' + (u.name || u.email) + (u.email ? ' <small class="text-muted">· ' + u.email + '</small>' : '') + '</button>'; }).join('');
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
          var errMsg = 'Crear falló';
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
      ['title', 'description', 'type', 'width_cm', 'height_cm', 'technique'].forEach(function (name) {
        var el = pick(name);
        if (el && el.value !== '') fd.append(name, el.value);
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
        if (!res.ok) throw new Error('Guardar falló');
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
