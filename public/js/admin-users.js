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

  // --- Normalize website on submit (edit forms) ---
  document.addEventListener('submit', function(e){
    var form = e.target && e.target.closest && e.target.closest('.admin-users-edit-form, .admin-edit-user-form');
    if (!form) return;
    var w = form.querySelector('input[name="website"]');
    if (w && w.value) {
      var s = String(w.value).trim();
      if (!/^https?:\/\//i.test(s)) {
        w.value = 'https://' + s;
      }
    }
  }, true);

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

  // --- Normalize website so bare domains like 'portfolio.art' pass type=url ---
  function normalizeWebsiteValue(input){
    if (!input) return;
    var v = (input.value || '').trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) {
      input.value = 'https://' + v;
    }
  }
  // On blur of website input in edit modal, prefix https:// if missing
  document.addEventListener('blur', function(e){
    var t = e.target;
    if (t && t.matches && t.matches('.admin-users-edit-form input[name="website"], .admin-edit-user-form input[name="website"]')){
      normalizeWebsiteValue(t);
    }
  }, true);
  // Before clicking Save in edit modal, ensure normalization
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('.admin-users-edit-submit, .admin-edit-user-submit');
    if (!btn) return;
    var modalEl = btn.closest('.admin-users-edit-modal, .admin-edit-user-modal');
    if (!modalEl) return;
    var w = modalEl.querySelector('input[name="website"]');
    normalizeWebsiteValue(w);
  });

  // --- Normalize social handles: accept @user or full URL, store handle/route part ---
  function extractHandleFromUrl(platform, urlStr){
    try {
      var u = new URL(urlStr);
      var host = (u.hostname || '').toLowerCase();
      var path = (u.pathname || '').replace(/\/+$/, '');
      var segs = path.split('/').filter(Boolean);
      if (platform === 'instagram') {
        if (host.includes('instagram.com') && segs[0]) return segs[0];
      } else if (platform === 'x') {
        if ((host.includes('x.com') || host.includes('twitter.com')) && segs[0]) return segs[0];
      } else if (platform === 'facebook') {
        if (host.includes('facebook.com')) {
          if (segs[0] === 'profile.php') {
            return 'profile.php' + (u.search || '');
          }
          if (segs[0]) return segs[0];
        }
      }
    } catch(_) {}
    return null;
  }
  function normalizeSocialInput(platform, input){
    if (!input) return;
    var v = (input.value || '').trim();
    if (!v) return;
    if (v[0] === '@') v = v.slice(1);
    if (/^https?:\/\//i.test(v) || /^(?:www\.)?(instagram|twitter|x|facebook)\.com\//i.test(v)) {
      var handle = extractHandleFromUrl(platform, /^https?:/i.test(v) ? v : ('https://' + v));
      if (handle) v = handle;
    }
    input.value = v;
  }
  // Blur normalization for social inputs in edit modal
  document.addEventListener('blur', function(e){
    var t = e.target;
    if (!t || !t.matches) return;
    if (t.matches('.admin-users-edit-form input[name="social.instagram"], .admin-edit-user-form input[name="social.instagram"]')){
      normalizeSocialInput('instagram', t);
    }
    if (t.matches('.admin-users-edit-form input[name="social.x"], .admin-edit-user-form input[name="social.x"]')){
      normalizeSocialInput('x', t);
    }
    if (t.matches('.admin-users-edit-form input[name="social.facebook"], .admin-edit-user-form input[name="social.facebook"]')){
      normalizeSocialInput('facebook', t);
    }
  }, true);
  // Before save, normalize all three if present
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('.admin-users-edit-submit, .admin-edit-user-submit');
    if (!btn) return;
    var modalEl = btn.closest('.admin-users-edit-modal, .admin-edit-user-modal');
    if (!modalEl) return;
    normalizeSocialInput('instagram', modalEl.querySelector('input[name="social.instagram"]'));
    normalizeSocialInput('x', modalEl.querySelector('input[name="social.x"]'));
    normalizeSocialInput('facebook', modalEl.querySelector('input[name="social.facebook"]'));
  });
});

