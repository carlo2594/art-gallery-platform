'use strict';

document.addEventListener('DOMContentLoaded', function () {
  const alerts = document.getElementById('accountAlerts');
  const showAlert = (type, msg) => {
    if (!alerts) return;
    const el = document.createElement('div');
    el.className = `alert alert-${type} alert-dismissible fade show`;
    el.setAttribute('role','alert');
    el.textContent = msg;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-close';
    btn.setAttribute('data-bs-dismiss','alert');
    btn.setAttribute('aria-label','Cerrar');
    el.appendChild(btn);
    alerts.innerHTML = '';
    alerts.appendChild(el);
  };

  const ensureProfileHorizontal = (file) => {
    if (!file) return Promise.resolve();
    if (typeof window.ensureHorizontalImage === 'function') {
      return window.ensureHorizontalImage(file);
    }
    return new Promise((resolve, reject) => {
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
        showAlert('warning', `${label} no puede exceder ${max} caracteres.`);
        return false;
      }
    }
    return true;
  };

  const setBtnState = (btn, disabled, text) => {
    if (!btn) return;
    btn.disabled = !!disabled;
    if (text != null) btn.textContent = text;
  };

  // Perfil
  const profileForm = document.getElementById('accountProfileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = profileForm.querySelector('button[type=submit]');
      const formData = new FormData(profileForm);
      if (!validateProfileLengths(formData)) {
        return;
      }
      setBtnState(btn, true, 'Guardando...');
      try {
        const body = new URLSearchParams();
        for (const [k, v] of formData.entries()) body.append(k, v);
        const res = await fetch(profileForm.action, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'No se pudieron guardar los cambios');
        showAlert('success', 'Perfil actualizado correctamente');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        console.error(err);
        showAlert('danger', err.message || 'Ocurrió un error');
      } finally {
        setBtnState(btn, false, 'Guardar cambios');
      }
    });
  }

  // Foto
  const photoForm = document.getElementById('accountPhotoForm');
  if (photoForm) {
    photoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = photoForm.querySelector('button[type=submit]');
      try {
        const fileInput = photoForm.querySelector('input[name=\"profileImage\"][type=\"file\"]');
        const file = fileInput && fileInput.files && fileInput.files[0];
        if (file) {
          await ensureProfileHorizontal(file);
        }
        setBtnState(btn, true, 'Subiendo...');
        const fd = new FormData(photoForm);
        const res = await fetch(photoForm.action, { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'No se pudo actualizar la foto');
        showAlert('success', 'Foto actualizada');
        if (data && data.data && data.data.profileImage) {
          const img = document.querySelector('#tab-foto img');
          if (img) img.src = data.data.profileImage;
        }
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        console.error(err);
        showAlert('danger', err.message || 'Ocurrió un error');
      } finally {
        setBtnState(btn, false, 'Actualizar foto');
        photoForm.reset();
      }
    });
  }

  // Eliminar foto
  const photoDeleteForm = document.getElementById('accountPhotoDeleteForm');
  if (photoDeleteForm) {
    photoDeleteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = photoDeleteForm.querySelector('button[type=submit]');
      setBtnState(btn, true, 'Eliminando...');
      try {
        const body = new URLSearchParams();
        body.set('profileImage', '');
        const res = await fetch(photoDeleteForm.action, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'No se pudo eliminar la foto');
        showAlert('success', 'Foto eliminada');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        console.error(err);
        showAlert('danger', err.message || 'Ocurrió un error');
      } finally {
        setBtnState(btn, false, 'Eliminar foto');
      }
    });
  }

  // Contraseña
  const passwordForm = document.getElementById('accountPasswordForm');
  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = passwordForm.querySelector('button[type=submit]');
      setBtnState(btn, true, 'Actualizando...');
      try {
        const fd = new FormData(passwordForm);
        const currentPassword = fd.get('currentPassword');
        const newPassword = fd.get('newPassword');
        if (!currentPassword || !newPassword) throw new Error('Completa ambos campos de contraseña');
        const res = await fetch(passwordForm.action, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'No se pudo actualizar la contraseña');
        showAlert('success', 'Contraseña actualizada correctamente');
        passwordForm.reset();
      } catch (err) {
        console.error(err);
        showAlert('danger', err.message || 'Ocurrió un error');
      } finally {
        setBtnState(btn, false, 'Cambiar contraseña');
      }
    });
  }
});

