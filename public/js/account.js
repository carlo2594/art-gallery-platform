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
      setBtnState(btn, true, 'Guardando...');
      try {
        const formData = new FormData(profileForm);
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
      setBtnState(btn, true, 'Subiendo...');
      try {
        const fd = new FormData(photoForm);
        const res = await fetch(photoForm.action, { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'No se pudo actualizar la foto');
        showAlert('success', 'Foto actualizada');
        if (data && data.data && data.data.profileImage) {
          const img = document.querySelector('#tab-foto img');
          if (img) img.src = data.data.profileImage;
        } else {
          setTimeout(() => location.reload(), 600);
        }
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

