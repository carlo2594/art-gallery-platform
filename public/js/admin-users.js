'use strict';

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
        if (window.axios) {
          var resp = await axios.get('/api/v1/users/lookup', { params: { email: email } });
          return resp && resp.data && resp.data.data;
        } else {
          var res = await fetch('/api/v1/users/lookup?email=' + encodeURIComponent(email));
          var json = await res.json();
          return json && json.data;
        }
      } catch (e) { console.warn('lookup failed', e); return null; }
    }
    async function check(){
      var val = (emailEl && emailEl.value || '').trim();
      var a = ensureAlert();
      if (!val) { a.style.display='none'; toggleSubmit(false); return; }
      var data = await lookup(val);
      if (data && data.exists && data.user){
        a.innerHTML = 'Este correo ya está registrado: <b>' + (data.user.name || 'Usuario') + '</b> (' + (data.user.role || 'rol desconocido') + ')';
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
      if (data && data.exists){ e.preventDefault(); ensureAlert(); alertEl.innerHTML = 'Este correo ya está registrado: <b>' + (data.user && data.user.name || 'Usuario') + '</b> (' + (data.user && data.user.role || 'rol desconocido') + ')'; alertEl.style.display=''; toggleSubmit(true); }
    });
  })();

  // --- Edit modals email uniqueness ---
  (function(){
    function ensureAlert(input){
      var a = input.parentNode && input.parentNode.querySelector('.admin-users-email-alert');
      if (!a){ a = document.createElement('div'); a.className='alert alert-warning py-1 px-2 mt-1 admin-users-email-alert'; a.style.display='none'; input.parentNode.appendChild(a); }
      return a;
    }
    async function lookup(email){
      try {
        if (window.axios) {
          var resp = await axios.get('/api/v1/users/lookup', { params: { email: email } });
          return resp && resp.data && resp.data.data;
        } else {
          var res = await fetch('/api/v1/users/lookup?email=' + encodeURIComponent(email));
          var json = await res.json();
          return json && json.data;
        }
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
        a.innerHTML = 'Este correo ya está registrado: <b>' + (data.user.name || 'Usuario') + '</b> (' + (data.user.role || 'rol desconocido') + ')';
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
});

