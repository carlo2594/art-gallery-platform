'use strict';
(function(){
  function ready(cb){ if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', cb); else cb(); }
  ready(function(){
    var form = document.getElementById('purchaseInquiryForm');
    if (!form) return;
    var ok = document.getElementById('purchaseInquirySuccess');
    var err = document.getElementById('purchaseInquiryError');
    var btn = document.getElementById('purchaseInquirySubmit');
    function setLoading(d){ if(btn){ btn.disabled = !!d; btn.textContent = d ? 'Enviando…' : 'Enviar consulta'; } }
    form.addEventListener('submit', function(e){
      try { if (!window.api) return; } catch(_) { return; }
      e.preventDefault();
      if (ok) ok.classList.add('d-none');
      if (err) err.classList.add('d-none');
      var fd = new FormData(form);
      var payload = { artworkId: fd.get('artworkId'), message: (fd.get('message')||'').toString().trim() };
      if (!payload.artworkId) { if (err){ err.textContent = 'Falta ID de la obra.'; err.classList.remove('d-none'); } return; }
      setLoading(true);
      window.api.post('/api/v1/purchase-inquiries', payload).then(function(res){
        setLoading(false);
        if (res && res.data && res.data.ok) {
          if (ok) ok.classList.remove('d-none');
          try { form.reset(); } catch(_){}
        } else {
          if (err) err.classList.remove('d-none');
        }
      }).catch(function(){ setLoading(false); if (err) err.classList.remove('d-none'); });
    });
  });
})();

