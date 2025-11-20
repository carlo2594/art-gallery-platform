'use strict';

(function initArtistArtworkWizard(){
  let currentArtworkId = null;
  let isSaving = false;
  let hasImage = false;

  function qs(sel, ctx){ return (ctx||document).querySelector(sel); }
  function qsa(sel, ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(sel)); }

  function alertToast(type, msg){
    try { console.log('[ArtistArtworkWizard]', type, msg); } catch(_){}
    const container = qs('#artistArtworkWizardAlerts') || qs('#artistPanelAlerts') || qs('#accountAlerts');
    if (!container) return;
    const level = type || 'info';
    const text = (msg || '').trim();
    if (level === 'danger') {
      const normalized = text.toLowerCase();
      // Ocultar errores genéricos de red para no generar desconfianza
      if (!normalized || normalized === 'network error') return;
    }
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
    btn.type = 'button';
    btn.className = 'btn-close';
    btn.setAttribute('data-bs-dismiss','alert');
    btn.setAttribute('aria-label','Cerrar');
    el.appendChild(btn);
    container.appendChild(el);
  }

  function setStep(step){
    const panes = qsa('.artist-wizard-pane');
    panes.forEach(p => {
      const s = p.getAttribute('data-step');
      p.classList.toggle('d-none', String(s) !== String(step));
    });
    const steps = qsa('.artist-wizard-step');
    steps.forEach(el => {
      const s = el.getAttribute('data-step');
      el.classList.toggle('active', String(s) === String(step));
    });
    const bar = qs('#artistWizardProgressBar');
    const current = Number(step) || 1;
    const total = 4;
    if (bar){
      const percent = Math.max(0, Math.min(100, (current / total) * 100));
      bar.style.width = percent + '%';
      bar.setAttribute('aria-valuenow', String(current));
    }
    const titleEl = qs('#artistWizardStepTitle');
    if (titleEl){
      const labels = {
        1: 'Información básica',
        2: 'Dimensiones',
        3: 'Técnica y precio',
        4: 'Imagen'
      };
      const label = labels[current] || '';
      titleEl.textContent = `Paso ${current} de ${total} · ${label}`;
    }
  }

  function isStepValid(step){
    const form = qs('#artistArtworkWizardForm');
    if (!form) return false;
    const s = Number(step);
    if (s === 1){
      const titleEl = form.querySelector('input[name="title"]');
      const val = titleEl && String(titleEl.value || '').trim();
      return !!val;
    }
    if (s === 2){
      const wEl = form.querySelector('input[name="width_cm"]');
      const hEl = form.querySelector('input[name="height_cm"]');
      const w = wEl ? Number(wEl.value) : NaN;
      const h = hEl ? Number(hEl.value) : NaN;
      return Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0;
    }
    if (s === 3){
      const amtEl = form.querySelector('input[name="amount"]');
      if (!amtEl) return false;
      if (amtEl.value === '') return false;
      const amt = Number(amtEl.value);
      return Number.isFinite(amt) && amt >= 0;
    }
    return true;
  }

  function updateNextButtonsState(){
    const form = qs('#artistArtworkWizardForm');
    if (!form) return;
    const buttons = qsa('[data-wizard-next]');
    buttons.forEach((btn) => {
      const next = Number(btn.getAttribute('data-wizard-next') || '0');
      const current = next > 1 ? next - 1 : 1;
      btn.disabled = !isStepValid(current);
    });
  }

  function updateSubmitButtonState(){
    const submitBtn = qs('#wizardSubmit');
    if (!submitBtn) return;
    submitBtn.disabled = !hasImage;
  }

  function initCharacterCounters(){
    const titleInput = qs('#wizardTitle');
    const descInput = qs('#wizardDescription');
    const titleCounter = qs('#wizardTitleCounter');
    const descCounter = qs('#wizardDescriptionCounter');

    const attachCounter = (input, counter, max) => {
      if (!input || !counter) return;
      const limit = max || Number(input.getAttribute('maxlength')) || 0;
      const update = () => {
        const len = input.value ? input.value.length : 0;
        counter.textContent = `${len}/${limit || '∞'}`;
      };
      update();
      input.addEventListener('input', update);
    };

    attachCounter(titleInput, titleCounter, 50);
    attachCounter(descInput, descCounter, 200);
  }

  function adjustPreviewAspect(img){
    try {
      if (!img) return;
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      img.classList.remove('is-landscape', 'is-portrait', 'is-square');
      if (!w || !h) return;
      const ratio = w / h;
      if (Math.abs(ratio - 1) < 0.08) {
        img.classList.add('is-square');
      } else if (ratio > 1) {
        img.classList.add('is-landscape');
      } else {
        img.classList.add('is-portrait');
      }
    } catch(_){}
  }

  function computeInitialStepFromArtwork(art){
    try {
      if (!art || typeof art !== 'object') return 1;
      const hasTitle = !!(art.title && String(art.title).trim());
      if (!hasTitle) return 1;
      const hasDims =
        typeof art.width_cm === 'number' && isFinite(art.width_cm) && art.width_cm > 0 &&
        typeof art.height_cm === 'number' && isFinite(art.height_cm) && art.height_cm > 0;
      if (!hasDims) return 2;
      const hasPrice =
        typeof art.price_cents === 'number' && isFinite(art.price_cents) && art.price_cents >= 0;
      if (!hasPrice) return 3;
      const hasImage = !!art.imageUrl;
      if (!hasImage) return 4;
      return 4;
    } catch(_){
      return 1;
    }
  }

  async function loadExistingArtworkFromQuery(){
    // 1) Intentar primero con sessionStorage (flujo desde el panel)
    try {
      const raw = window.sessionStorage && window.sessionStorage.getItem('artistDraftToEdit');
      if (raw) {
        window.sessionStorage.removeItem('artistDraftToEdit');
        try {
          const stored = JSON.parse(raw);
          if (stored && typeof stored === 'object' && stored._id) {
            const art = stored;
            currentArtworkId = art._id;
            const form = qs('#artistArtworkWizardForm');
            if (form){
              const setVal = (selector, value) => {
                const el = qs(selector, form);
                if (!el) return;
                el.value = value != null ? String(value) : '';
                try {
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                } catch(_){}
              };
              setVal('input[name="title"]', art.title || '');
              setVal('textarea[name="description"]', art.description || '');
              if (art.width_cm != null) setVal('input[name="width_cm"]', art.width_cm);
              if (art.height_cm != null) setVal('input[name="height_cm"]', art.height_cm);
              setVal('input[name="type"]', art.type || '');
              setVal('input[name="technique"]', art.technique || '');
              if (art.completedAt){
                try {
                  const d = new Date(art.completedAt);
                  if (!isNaN(d.getTime())){
                    setVal('input[name="completedAt"]', d.toISOString().slice(0,10));
                  }
                } catch(_) {}
              }
              if (typeof art.price_cents === 'number'){
                const amount = (art.price_cents / 100).toFixed(2);
                setVal('input[name="amount"]', amount);
              }
              const hiddenId = qs('#artistArtworkId', form);
              if (hiddenId) hiddenId.value = art._id;
              const imgPrev = qs('#wizardImagePreview', form);
              if (imgPrev){
                if (art.imageUrl){
                  imgPrev.onload = function(){
                    adjustPreviewAspect(imgPrev);
                  };
                  imgPrev.src = art.imageUrl;
                  imgPrev.hidden = false;
                  hasImage = true;
                } else {
                  imgPrev.hidden = true;
                  imgPrev.removeAttribute('src');
                  hasImage = false;
                }
                updateSubmitButtonState();
              }
            }
            return computeInitialStepFromArtwork(art);
          }
        } catch(_) {}
      }
    } catch(_) {}

    // 2) Fallback: cargar por querystring vía API
    let search = '';
    try { search = window.location.search || ''; } catch(_){ return null; }
    if (!search) return null;
    let artworkId = null;
    try {
      const params = new URLSearchParams(search);
      artworkId = params.get('artworkId') || params.get('id');
    } catch(_){
      return null;
    }
    if (!artworkId) return null;

    const url = '/api/v1/artworks/private/' + encodeURIComponent(artworkId);
    let payload;
    try {
      if (window.api && window.api.get){
        const r = await window.api.get(url, { headers: { Accept: 'application/json' }, withCredentials: true });
        payload = r && r.data;
      } else {
        const res = await fetch(url, { credentials: 'same-origin' });
        payload = await res.json();
      }
    } catch(err){
      alertToast('danger', (err && err.message) || 'No se pudo cargar el borrador.');
      return null;
    }
    const art = (payload && payload.data) || null;
    if (!art){
      alertToast('danger', 'No se encontro el borrador solicitado.');
      return null;
    }

    currentArtworkId = art._id;

    const form = qs('#artistArtworkWizardForm');
    if (form){
      const setVal = (selector, value) => {
        const el = qs(selector, form);
        if (!el) return;
        el.value = value != null ? String(value) : '';
        try {
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } catch(_){}
      };
      setVal('input[name="title"]', art.title || '');
      setVal('textarea[name="description"]', art.description || '');
      if (art.width_cm != null) setVal('input[name="width_cm"]', art.width_cm);
      if (art.height_cm != null) setVal('input[name="height_cm"]', art.height_cm);
      setVal('input[name="type"]', art.type || '');
      setVal('input[name="technique"]', art.technique || '');
      if (art.completedAt){
        try {
          const d = new Date(art.completedAt);
          if (!isNaN(d.getTime())){
            setVal('input[name="completedAt"]', d.toISOString().slice(0,10));
          }
        } catch(_) {}
      }
      if (typeof art.price_cents === 'number'){
        const amount = (art.price_cents / 100).toFixed(2);
        setVal('input[name="amount"]', amount);
      }
      const hiddenId = qs('#artistArtworkId', form);
      if (hiddenId) hiddenId.value = art._id;
      const imgPrev = qs('#wizardImagePreview', form);
      if (imgPrev){
        if (art.imageUrl){
          imgPrev.onload = function(){
            adjustPreviewAspect(imgPrev);
          };
          imgPrev.src = art.imageUrl;
          imgPrev.hidden = false;
          hasImage = true;
        } else {
          imgPrev.hidden = true;
          imgPrev.removeAttribute('src');
          hasImage = false;
        }
        updateSubmitButtonState();
      }
    }

    return computeInitialStepFromArtwork(art);
  }

  function collectPayload(){
    const form = qs('#artistArtworkWizardForm');
    if (!form) return {};
    const getVal = (name) => {
      const el = form.querySelector('[name="'+name+'"]');
      if (!el) return undefined;
      if (el.type === 'number') {
        return el.value === '' ? undefined : el.value;
      }
      return el.value != null ? el.value : undefined;
    };
    const payload = {};
    const title = getVal('title');
    if (title) payload.title = title;
    const description = getVal('description');
    if (description) payload.description = description;
    const width_cm = getVal('width_cm');
    if (width_cm !== undefined) payload.width_cm = width_cm;
    const height_cm = getVal('height_cm');
    if (height_cm !== undefined) payload.height_cm = height_cm;
    const type = getVal('type');
    if (type) payload.type = type;
    const technique = getVal('technique');
    if (technique) payload.technique = technique;
    const amount = getVal('amount');
    if (amount !== undefined) payload.amount = amount;
    const completedAt = getVal('completedAt');
    if (completedAt) payload.completedAt = completedAt;
    return payload;
  }

  async function createDraft(){
    const payload = collectPayload();
    if (!payload.title || String(payload.title).trim() === ''){
      alertToast('warning', 'Agrega al menos un t\u00edtulo para crear el borrador.');
      return null;
    }
    payload._draftOnly = '1';
    isSaving = true;
    try {
      const res = await fetch('/api/v1/artworks', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data || !data.data){
        const msg = (data && data.message) || (data && data.error && data.error.message) || 'No se pudo crear el borrador.';
        alertToast('danger', msg);
        return null;
      }
      currentArtworkId = data.data._id;
      const hiddenId = qs('#artistArtworkId');
      if (hiddenId) hiddenId.value = currentArtworkId;
      alertToast('success', 'Borrador creado.');
      return currentArtworkId;
    } catch(err){
      alertToast('danger', err && err.message ? err.message : 'Error al crear el borrador.');
      return null;
    } finally {
      isSaving = false;
    }
  }

  async function updateDraft(showToast){
    if (!currentArtworkId){
      return await createDraft();
    }
    const payload = collectPayload();
    if (Object.keys(payload).length === 0) return currentArtworkId;
    isSaving = true;
    try {
      const res = await fetch('/api/v1/artworks/' + encodeURIComponent(currentArtworkId), {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data || !data.data){
        const msg = (data && data.message) || (data && data.error && data.error.message) || 'No se pudo actualizar el borrador.';
        alertToast('danger', msg);
        return null;
      }
      if (showToast) alertToast('success', 'Borrador guardado.');
      return currentArtworkId;
    } catch(err){
      alertToast('danger', err && err.message ? err.message : 'Error al guardar el borrador.');
      return null;
    } finally {
      isSaving = false;
    }
  }

  async function saveDraft(showToast){
    if (isSaving) return currentArtworkId;
    if (!currentArtworkId){
      return await createDraft();
    }
    return await updateDraft(showToast);
  }

  async function saveDraftWithImage(showToast){
    const id = await saveDraft(showToast);
    if (!id) return false;
    const imgResult = await uploadImageIfNeeded();
    if (imgResult === null) return false;
    return true;
  }

  async function uploadImageIfNeeded(){
    const form = qs('#artistArtworkWizardForm');
    if (!form || !currentArtworkId) return currentArtworkId;
    const fileInput = qs('input[name=\"image\"]', form);
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) return currentArtworkId;
    const fd = new FormData();
    fd.append('image', file);
    isSaving = true;
    try {
      const res = await fetch('/api/v1/artworks/' + encodeURIComponent(currentArtworkId), {
        method: 'PATCH',
        credentials: 'same-origin',
        body: fd
      });
      const data = await res.json();
      if (!res.ok || !data || !data.data){
        const msg = (data && data.message) || (data && data.error && data.error.message) || 'No se pudo guardar la imagen.';
        alertToast('danger', msg);
        return null;
      }
      alertToast('success', 'Imagen guardada en el borrador.');
      return currentArtworkId;
    } catch(err){
      alertToast('danger', err && err.message ? err.message : 'Error al subir la imagen.');
      return null;
    } finally {
      isSaving = false;
    }
  }

  async function submitArtwork(){
    const submitBtn = qs('#wizardSubmit');
    let wizardOverlayTimeout = null;
    if (submitBtn){
      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>' +
          'Enviando obra...';
      } catch (_) {}
    }

    let wizardOverlay = document.getElementById('artistWizardBlockingOverlay');
    if (!wizardOverlay){
      try {
        wizardOverlay = document.createElement('div');
        wizardOverlay.id = 'artistWizardBlockingOverlay';
        wizardOverlay.style.position = 'fixed';
        wizardOverlay.style.inset = '0';
        wizardOverlay.style.background = 'rgba(0,0,0,0.45)';
        wizardOverlay.style.zIndex = '10500';
        wizardOverlay.style.display = 'flex';
        wizardOverlay.style.alignItems = 'center';
        wizardOverlay.style.justifyContent = 'center';
        wizardOverlay.innerHTML =
          '<div class="text-center text-white"><div class="spinner-border text-light mb-2" role="status"></div><div>Enviando obra...</div></div>';
        document.body.appendChild(wizardOverlay);
      } catch (_) {}
    } else {
      try { wizardOverlay.style.display = 'flex'; } catch (_) {}
    }

    if (wizardOverlay){
      try {
        wizardOverlayTimeout = setTimeout(function(){
          try { wizardOverlay.style.display = 'none'; } catch (_){}
          const btn = qs('#wizardSubmit');
          if (btn){
            try {
              btn.disabled = false;
              btn.innerHTML = 'Enviar obra para revisiA3n';
            } catch (_){}
          }
        }, 15000);
      } catch (_){}
    }

    const pageOverlay = document.getElementById('page-loading-overlay');
    if (pageOverlay){
      try {
        document.body && document.body.classList && document.body.classList.add('loading');
        pageOverlay.style.display = 'flex';
      } catch (_) {}
    }
    if (!currentArtworkId){
      const id = await saveDraft(false);
      if (!id) return;
    } else {
      const id = await updateDraft(false);
      if (!id) return;
    }
    const imgId = await uploadImageIfNeeded();
    if (!imgId) return;

    try {
      const res = await fetch('/api/v1/artworks/' + encodeURIComponent(currentArtworkId) + '/submit', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok){
        const msg = (data && data.message) || (data && data.error && data.error.message) || 'No se pudo enviar la obra a revisión.';
        alertToast('danger', msg);
        return;
      }
      alertToast('success', 'Obra enviada a revisión.');
      setTimeout(() => {
        window.location.href = '/artists/panel';
      }, 800);
    } catch(err){
      alertToast('danger', err && err.message ? err.message : 'Error al enviar la obra.');
    }
  }

  function hookSteps(){
    const container = qs('.artist-artwork-wizard');
    if (!container) return;
    setStep(1);
    updateNextButtonsState();
    updateSubmitButtonState();

    // Si venimos desde el panel con un borrador existente, precargar datos
    // y mover al paso correspondiente segun los campos completos.
    try {
      const p = loadExistingArtworkFromQuery();
      if (p && typeof p.then === 'function'){
        p.then((step) => {
          if (!step || step === 1) return;
          setStep(step);
          updateNextButtonsState();
        }).catch(() => {});
      }
    } catch(_) {}

    qsa('[data-wizard-next]').forEach(btn => {
      btn.addEventListener('click', async function(){
        const next = this.getAttribute('data-wizard-next');
        const current = Number(next) - 1;
        if (current === 1){
          const titleEl = qs('input[name=\"title\"]');
          const titleVal = titleEl && String(titleEl.value || '').trim();
          if (!titleVal){
            if (titleEl){
              titleEl.classList.add('is-invalid');
              titleEl.addEventListener('input', function onin(){ titleEl.classList.remove('is-invalid'); titleEl.removeEventListener('input', onin); }, { once: true });
            }
            alertToast('warning', 'El título es obligatorio para continuar.');
            return;
          }
        }
        await saveDraft(false);
        if (next) {
          setStep(next);
          updateNextButtonsState();
        }
      });
    });

    qsa('[data-wizard-prev]').forEach(btn => {
      btn.addEventListener('click', function(){
        const prev = this.getAttribute('data-wizard-prev');
        if (prev) setStep(prev);
      });
    });

    const saveBtn = qs('#wizardSaveDraft');
    if (saveBtn){
      const originalLabel = saveBtn.textContent;
      saveBtn.addEventListener('click', async function(){
        if (saveBtn.disabled) return;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';
        try {
          await saveDraftWithImage(true);
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = originalLabel;
        }
      });
    }
    const submitBtn = qs('#wizardSubmit');
    if (submitBtn){
      submitBtn.addEventListener('click', function(){
        const confirmed = window.confirm(
          '¿Estás seguro de enviar la obra para revisión?\n\n' +
          'Después de enviarla ya no podrás editar ni la obra ni la información que subiste. ' +
          'Si quieres hacer cambios más adelante, tendrás que eliminar esta solicitud y crear una nueva.'
        );
        if (!confirmed) return;
        submitArtwork();
      });
    }

    initCharacterCounters();
    const imgInput = qs('#wizardImage');
    const imgPrev = qs('#wizardImagePreview');
    if (imgInput && imgPrev){
      imgInput.addEventListener('change', function(){
        const f = this.files && this.files[0];
        if (!f){
          imgPrev.hidden = true;
          imgPrev.removeAttribute('src');
          imgPrev.classList.remove('is-landscape', 'is-portrait', 'is-square');
          hasImage = false;
          updateSubmitButtonState();
          return;
        }
        const url = URL.createObjectURL(f);
        imgPrev.src = url;
        imgPrev.hidden = false;
        imgPrev.onload = function(){
          adjustPreviewAspect(imgPrev);
          try { URL.revokeObjectURL(url); } catch(_){}
        };
        hasImage = true;
        updateSubmitButtonState();
      });
      const dropzone = qs('#artistImageDropzone');
      const trigger = qs('#wizardImageTrigger');
      if (trigger){
        trigger.addEventListener('click', function(){
          try { imgInput.click(); } catch(_){}
        });
      }
      if (dropzone){
        ['dragenter','dragover'].forEach(function(ev){
          dropzone.addEventListener(ev, function(e){
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('is-dragover');
          });
        });
        ['dragleave','drop'].forEach(function(ev){
          dropzone.addEventListener(ev, function(e){
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('is-dragover');
          });
        });
        dropzone.addEventListener('drop', function(e){
          const dt = e.dataTransfer;
          if (!dt || !dt.files || !dt.files.length) return;
          const file = dt.files[0];
          try {
            const dataTx = new DataTransfer();
            dataTx.items.add(file);
            imgInput.files = dataTx.files;
          } catch(_){
            // Fallback: asignar directamente si DataTransfer no existe
            try { imgInput.files = dt.files; } catch(__){}
          }
          imgInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
    }

    // Validacion en vivo para habilitar/deshabilitar "Siguiente"
    const form = qs('#artistArtworkWizardForm');
    if (form){
      const fields = [
        'input[name="title"]',
        'input[name="width_cm"]',
        'input[name="height_cm"]',
        'input[name="amount"]'
      ];
      fields.forEach((sel) => {
        const el = form.querySelector(sel);
        if (!el) return;
        el.addEventListener('input', () => {
          updateNextButtonsState();
        });
      });
    }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', hookSteps);
  } else {
    hookSteps();
  }
  try {
    window.artistWizardSaveDraftWithImage = saveDraftWithImage;
  } catch(_) {}
})();
