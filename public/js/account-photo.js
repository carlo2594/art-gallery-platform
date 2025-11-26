'use strict';

(function initAccountPhoto() {
  // Early exit if form not present
  var photoForm = document.getElementById('accountPhotoForm');
  var photoDeleteForm = document.getElementById('accountPhotoDeleteForm');
  var coverForm = document.getElementById('accountCoverForm');
  var coverDeleteForm = document.getElementById('accountCoverDeleteForm');
  var alerts = document.getElementById('accountAlerts');
  var hasAxios = !!(window.axios && typeof window.axios.post === 'function');
  var PHOTO_ASPECT_RATIO = 1;
  var PHOTO_EXPORT_SIZE = 800;
  var cropperWrapper = document.getElementById('accountPhotoCropperWrapper');
  var cropperImageEl = document.getElementById('accountPhotoCropperImg');
  var photoCropper = null;
  var photoCropperUrl = null;

  function showAlert(type, message) {
    if (!message) return;
    if (alerts) {
      var wrapper = document.createElement('div');
      wrapper.className = 'alert alert-' + type + ' alert-dismissible fade show';
      wrapper.setAttribute('role', 'alert');
      wrapper.textContent = message;
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'btn-close';
      closeBtn.setAttribute('data-bs-dismiss', 'alert');
      closeBtn.setAttribute('aria-label', 'Cerrar');
      wrapper.appendChild(closeBtn);
      alerts.innerHTML = '';
      alerts.appendChild(wrapper);
    } else {
      try { console.log('[AccountPhoto] ' + type + ': ' + message); } catch(_) {}
    }
  }

  function setBtn(btn, disabled, text) {
    if (!btn) return;
    btn.disabled = !!disabled;
    if (text != null) btn.textContent = text;
  }

  function updatePreviewWith(url) {
    var container = document.querySelector('.account-photo-preview-group');
    if (container) {
      var img = container.querySelector('img.account-photo-preview');
      if (!img) {
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
      // Cache busting to avoid stale cached image
      var sep = url.indexOf('?') === -1 ? '?' : '&';
      img.src = url + sep + 't=' + Date.now();
    }
  }

  function updateCoverPreviewWith(url) {
    var container = document.querySelector('.account-cover-preview-group');
    if (container) {
      var img = container.querySelector('img.account-cover-preview');
      if (!img) {
        container.innerHTML = '';
        img = document.createElement('img');
        img.className = 'img-fluid rounded account-cover-preview';
        img.style.maxWidth = '420px';
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        img.alt = 'Imagen de portada';
        container.appendChild(img);
      }
      var sep = url.indexOf('?') === -1 ? '?' : '&';
      img.src = url + sep + 't=' + Date.now();
    }
  }

  function destroyPhotoCropper() {
    if (photoCropper) {
      try { photoCropper.destroy(); } catch (_) {}
      photoCropper = null;
    }
    if (photoCropperUrl) {
      try { URL.revokeObjectURL(photoCropperUrl); } catch (_) {}
      photoCropperUrl = null;
    }
    if (cropperWrapper) cropperWrapper.classList.add('d-none');
    if (cropperImageEl) cropperImageEl.removeAttribute('src');
  }

  function initPhotoCropper(file) {
    if (!cropperWrapper || !cropperImageEl) return;
    destroyPhotoCropper();
    if (!file) return;
    if (typeof window.Cropper !== 'function') {
      showAlert('warning', 'No se pudo cargar la herramienta de recorte. Intenta recargar la página.');
      return;
    }
    try {
      photoCropperUrl = URL.createObjectURL(file);
    } catch (err) {
      console.error(err);
      showAlert('danger', 'No se pudo previsualizar la imagen seleccionada.');
      return;
    }
    cropperImageEl.src = photoCropperUrl;
    cropperWrapper.classList.remove('d-none');
    var init = function () {
      try {
        photoCropper = new Cropper(cropperImageEl, {
          aspectRatio: PHOTO_ASPECT_RATIO,
          viewMode: 1,
          autoCropArea: 1,
          dragMode: 'move',
          background: false,
          responsive: true,
          minContainerHeight: 220,
        });
      } catch (err) {
        console.error(err);
        showAlert('danger', 'No se pudo iniciar el recorte. Intenta de nuevo.');
        destroyPhotoCropper();
      }
    };
    if (window.requestAnimationFrame) window.requestAnimationFrame(init);
    else setTimeout(init, 0);
  }

  function requirePhotoBlob() {
    return new Promise(function (resolve, reject) {
      if (!photoCropper) {
        reject(new Error('Selecciona una imagen y ajusta el recorte antes de continuar.'));
        return;
      }
      var canvas;
      try {
        canvas = photoCropper.getCroppedCanvas({
          width: PHOTO_EXPORT_SIZE,
          height: PHOTO_EXPORT_SIZE,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high',
          fillColor: '#ffffff',
        });
      } catch (err) {
        reject(err);
        return;
      }
      if (!canvas) {
        reject(new Error('No se pudo generar el recorte.'));
        return;
      }
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error('No se pudo exportar el recorte.'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', 0.92);
    });
  }

  function showCoverPlaceholder() {
    var container = document.querySelector('.account-cover-preview-group');
    if (container) {
      container.innerHTML = '';
      var placeholder = document.createElement('div');
      placeholder.className = 'd-inline-flex align-items-center justify-content-center bg-light rounded account-cover-placeholder';
      placeholder.style.width = '420px';
      placeholder.style.height = '160px';
      var icon = document.createElement('i');
      icon.className = 'fas fa-image fa-3x text-muted';
      placeholder.appendChild(icon);
      container.appendChild(placeholder);
    }
  }

  function showPlaceholder() {
    destroyPhotoCropper();
    var container = document.querySelector('.account-photo-preview-group');
    if (container) {
      container.innerHTML = '';
      var placeholder = document.createElement('div');
      placeholder.className = 'd-inline-flex align-items-center justify-content-center bg-light rounded account-photo-placeholder';
      placeholder.style.width = '220px';
      placeholder.style.height = '220px';
      var icon = document.createElement('i');
      icon.className = 'fas fa-user fa-3x text-muted account-photo-placeholder-icon';
      placeholder.appendChild(icon);
      container.appendChild(placeholder);
    }
  }

  if (photoForm) {
    try { console.log('[AccountPhoto:new] Hooked photo upload'); } catch(_) {}
    var photoInput = photoForm.querySelector('input[name="profileImage"][type="file"]');
    if (photoInput) {
      photoInput.addEventListener('change', function () {
        var file = photoInput.files && photoInput.files[0];
        if (!file) {
          destroyPhotoCropper();
          return;
        }
        initPhotoCropper(file);
      });
    }
    photoForm.addEventListener('submit', function (e) {
      if (e) { try { e.stopImmediatePropagation(); } catch(_) {} }
      e.preventDefault();
      var btn = photoForm.querySelector('button[type=submit]');
      var fileInput = photoInput;
      var fileExists = fileInput && fileInput.files && fileInput.files[0];
      if (!fileExists) { showAlert('warning', 'Selecciona una imagen.'); return; }

      setBtn(btn, true, 'Subiendo...');
      if (fileInput) fileInput.disabled = true;

      var onSuccess = function (payload) {
        var data = payload || {};
        showAlert('success', (data.message) || 'Foto actualizada');
        if (data.data && data.data.profileImage) {
          updatePreviewWith(data.data.profileImage);
        }
      };
      var onError = function (err) {
        var msg = (err && err.response && err.response.data && err.response.data.message) || err && err.message || 'No se pudo actualizar la foto';
        showAlert('danger', msg);
      };
      var onFinally = function () {
        setBtn(btn, false, 'Actualizar foto');
        photoForm.reset();
        destroyPhotoCropper();
        if (fileInput) fileInput.disabled = false;
      };

      requirePhotoBlob()
        .then(function (blob) {
          var formData = new FormData();
          formData.append('profileImage', blob, 'profile-' + Date.now() + '.jpg');
          if (hasAxios) {
            return axios.post(photoForm.action, formData, { headers: { Accept: 'application/json' }, withCredentials: true })
              .then(function (res) { onSuccess(res && res.data); })
              .catch(onError)
              .finally(onFinally);
          }
          return fetch(photoForm.action, { method: 'POST', headers: { Accept: 'application/json' }, body: formData, credentials: 'same-origin' })
            .then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error((d && d.message) || 'Error'); return d; }); })
            .then(onSuccess)
            .catch(onError)
            .finally(onFinally);
        })
        .catch(function (err) {
          setBtn(btn, false, 'Actualizar foto');
          if (fileInput) fileInput.disabled = false;
          var msg = (err && err.message) || 'Ajusta el recorte antes de subir.';
          showAlert('warning', msg);
        });
    });
  }

  if (photoDeleteForm) {
    try { console.log('[AccountPhoto:new] Hooked photo delete'); } catch(_) {}
    photoDeleteForm.addEventListener('submit', function (e) {
      if (e) { try { e.stopImmediatePropagation(); } catch(_) {} }
      e.preventDefault();
      var btn = photoDeleteForm.querySelector('button[type=submit]');
      setBtn(btn, true, 'Eliminando...');

      var body = new URLSearchParams();
      body.set('profileImage', '');

      var onSuccess = function (payload) {
        showAlert('success', (payload && payload.message) || 'Foto eliminada');
        showPlaceholder();
      };
      var onError = function (err) {
        var msg = (err && err.response && err.response.data && err.response.data.message) || err.message || 'No se pudo eliminar la foto';
        showAlert('danger', msg);
      };
      var onFinally = function () { setBtn(btn, false, 'Eliminar foto'); };

      if (hasAxios) {
        axios.post(photoDeleteForm.action, body, { headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, withCredentials: true })
          .then(function (res) { onSuccess(res && res.data); })
          .catch(onError)
          .finally(onFinally);
      } else {
        fetch(photoDeleteForm.action, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: body, credentials: 'same-origin' })
          .then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error(d && d.message || 'Error'); return d; }); })
          .then(onSuccess)
          .catch(onError)
          .finally(onFinally);
      }
    });
  }

  if (coverForm) {
    try { console.log('[AccountPhoto:new] Hooked cover upload'); } catch(_) {}
    coverForm.addEventListener('submit', function (e) {
      if (e) { try { e.stopImmediatePropagation(); } catch(_) {} }
      e.preventDefault();
      var btn = coverForm.querySelector('button[type=submit]');
      var fileInput = coverForm.querySelector('input[name="coverImage"][type="file"]');
      var file = fileInput && fileInput.files && fileInput.files[0];
      if (!file) { showAlert('warning', 'Selecciona una imagen.'); return; }
      setBtn(btn, true, 'Subiendo...');
      var formData = new FormData(coverForm);
      if (fileInput) fileInput.disabled = true;
      var onSuccess = function (payload) {
        var data = payload || {};
        showAlert('success', (data.message) || 'Portada actualizada');
        if (data.data && data.data.coverImage) updateCoverPreviewWith(data.data.coverImage);
      };
      var onError = function (err) {
        var msg = (err && err.response && err.response.data && err.response.data.message) || err.message || 'No se pudo actualizar la portada';
        showAlert('danger', msg);
      };
      var onFinally = function () {
        setBtn(btn, false, 'Actualizar portada');
        coverForm.reset();
        if (fileInput) fileInput.disabled = false;
      };
      if (hasAxios) {
        axios.post(coverForm.action, formData, { headers: { Accept: 'application/json' }, withCredentials: true })
          .then(function (res) { onSuccess(res && res.data); })
          .catch(onError)
          .finally(onFinally);
      } else {
        fetch(coverForm.action, { method: 'POST', headers: { Accept: 'application/json' }, body: formData, credentials: 'same-origin' })
          .then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error(d && d.message || 'Error'); return d; }); })
          .then(onSuccess)
          .catch(onError)
          .finally(onFinally);
      }
    });
  }

  if (coverDeleteForm) {
    try { console.log('[AccountPhoto:new] Hooked cover delete'); } catch(_) {}
    coverDeleteForm.addEventListener('submit', function (e) {
      if (e) { try { e.stopImmediatePropagation(); } catch(_) {} }
      e.preventDefault();
      var btn = coverDeleteForm.querySelector('button[type=submit]');
      setBtn(btn, true, 'Eliminando...');
      var body = new URLSearchParams();
      body.set('coverImage', '');
      var onSuccess = function (payload) { showAlert('success', (payload && payload.message) || 'Portada eliminada'); showCoverPlaceholder(); };
      var onError = function (err) { var msg = (err && err.response && err.response.data && err.response.data.message) || err.message || 'No se pudo eliminar la portada'; showAlert('danger', msg); };
      var onFinally = function () { setBtn(btn, false, 'Eliminar portada'); };
      if (hasAxios) {
        axios.post(coverDeleteForm.action, body, { headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, withCredentials: true })
          .then(function (res) { onSuccess(res && res.data); })
          .catch(onError)
          .finally(onFinally);
      } else {
        fetch(coverDeleteForm.action, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: body, credentials: 'same-origin' })
          .then(function (res) { return res.json().then(function (d) { if (!res.ok) throw new Error(d && d.message || 'Error'); return d; }); })
          .then(onSuccess)
          .catch(onError)
          .finally(onFinally);
      }
    });
  }
})();
