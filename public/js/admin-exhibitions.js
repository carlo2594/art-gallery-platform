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
        // Si se seleccionó una portada, subirla ahora
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
        if (window.showAdminToast) showAdminToast('Exposicion creada','success');
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

  // (Sin gestión de galería por URLs)
});
