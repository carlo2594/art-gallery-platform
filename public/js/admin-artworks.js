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
});
