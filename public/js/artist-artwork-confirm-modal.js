'use strict';

(function initArtistArtworkConfirmModal(){
  function qs(sel, ctx){ return (ctx || document).querySelector(sel); }

  function onReady(cb){
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cb, { once: true });
    } else {
      cb();
    }
  }

  onReady(function(){
    const submitBtn = qs('#wizardSubmit');
    const saveDraftBtn = qs('#wizardSaveDraft');
    const modalEl = qs('#artistSubmitConfirmModal');
    if (!submitBtn || !modalEl) return;

    let confirmModal = null;
    if (window.bootstrap && window.bootstrap.Modal){
      try {
        confirmModal = new window.bootstrap.Modal(modalEl);
      } catch(_) {
        confirmModal = null;
      }
    }

    let bypassIntercept = false;

    // Interceptar el click original antes de que llegue al handler viejo
    submitBtn.addEventListener('click', function(e){
      if (bypassIntercept) {
        // Dejar que el handler original corra normalmente
        return;
      }
      if (!confirmModal) return;
      try {
        e.preventDefault();
        e.stopImmediatePropagation();
      } catch(_) {}
      try {
        confirmModal.show();
      } catch(_) {}
    }, true);

    const keepEditingBtn = qs('#artistSubmitKeepEditingBtn', modalEl);
    const saveDraftModalBtn = qs('#artistSubmitSaveDraftBtn', modalEl);
    const confirmBtn = qs('#artistSubmitConfirmBtn', modalEl);

    // Seguir editando: el propio data-bs-dismiss ya cierra el modal
    if (keepEditingBtn){
      keepEditingBtn.addEventListener('click', function(){
        // no-op, solo cierra
      });
    }

    // Guardar en borrador y volver al panel
    if (saveDraftModalBtn){
      saveDraftModalBtn.addEventListener('click', async function(){
        const prevText = saveDraftModalBtn.textContent;
        saveDraftModalBtn.disabled = true;
        saveDraftModalBtn.textContent = 'Guardando...';
        try {
          let ok = false;
          const saveFn = (typeof window !== 'undefined' && window.artistWizardSaveDraftWithImage)
            ? window.artistWizardSaveDraftWithImage
            : null;
          if (typeof saveFn === 'function') {
            ok = await saveFn(true);
          } else if (saveDraftBtn) {
            saveDraftBtn.click();
            ok = true;
          }
          if (ok) {
            try {
              if (confirmModal) confirmModal.hide();
            } catch(_) {}
            window.location.href = '/artists/panel';
          } else {
            saveDraftModalBtn.disabled = false;
            saveDraftModalBtn.textContent = prevText;
          }
        } catch(err){
          saveDraftModalBtn.disabled = false;
          saveDraftModalBtn.textContent = prevText;
        }
      });
    }

    // Enviar obra definitivamente
    if (confirmBtn){
      confirmBtn.addEventListener('click', function(){
        const prevHtml = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>' +
          'Sending...';
        if (saveDraftModalBtn) saveDraftModalBtn.disabled = true;
        if (keepEditingBtn) keepEditingBtn.disabled = true;

        // Ejecutar el flujo original de submit, pero sin mostrar el confirm nativo
        const originalConfirm = window.confirm;
        bypassIntercept = true;
        try {
          window.confirm = function(){ return true; };
          submitBtn.click();
        } catch(_) {
          // Si algo falla, reactivar botones
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = prevHtml;
          if (saveDraftModalBtn) saveDraftModalBtn.disabled = false;
          if (keepEditingBtn) keepEditingBtn.disabled = false;
        } finally {
          window.confirm = originalConfirm;
          bypassIntercept = false;
        }

        // No reactivamos botones aquí porque el flujo original redirige al panel;
        // si hubiera un error en el envío, el usuario verá el mensaje pero seguirá en la página.
      });
    }
  });
})();
