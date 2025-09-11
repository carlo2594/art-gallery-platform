// public/js/main.js
'use strict';

document.addEventListener('DOMContentLoaded', function () {

  // Utilidades pequeñas reutilizables
  const setBtnState = (btn, disabled, text) => {
    if (!btn) return;
    btn.disabled = !!disabled;
    if (typeof text === 'string') btn.textContent = text;
  };

  const debounce = (fn, wait = 200) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  /* ------------------------------- */
  /* Login / SignUp                  */
  /* ------------------------------- */
  const loginSignUpForm = document.querySelector('.login-signin-form');
  if (loginSignUpForm) {
    loginSignUpForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const submitBtn = loginSignUpForm.querySelector('button[type="submit"]');
      setBtnState(submitBtn, true, 'Enviando...');

      const modeAttr = loginSignUpForm.getAttribute('data-mode');
      const mode = (window.loginSignUpMode || modeAttr || '').trim() === 'signUp' ? 'signUp' : 'login';
      const url = mode === 'signUp' ? '/api/v1/auth/signup' : '/api/v1/auth/login';

      const emailInput = loginSignUpForm.querySelector('input[name="email"]');
      if (!emailInput) {
        alert('No se encontró el campo de correo electrónico.');
        setBtnState(submitBtn, false, mode === 'signUp' ? 'Registrarse' : 'Iniciar sesión');
        return;
      }

      const email = (emailInput.value || '').trim();
      if (!email) {
        alert('Ingresa tu correo.');
        setBtnState(submitBtn, false, mode === 'signUp' ? 'Registrarse' : 'Iniciar sesión');
        return;
      }

      let password = '';
      if (mode !== 'signUp') {
        const passwordInput = loginSignUpForm.querySelector('input[name="password"]');
        password = (passwordInput && passwordInput.value) || '';
      }

      const data = { email };
      if (password) data.password = password;

      if (mode === 'signUp') {
        const nameInput = loginSignUpForm.querySelector('input[name="name"]');
        if (nameInput) data.name = (nameInput.value || '').trim() || email;
      }

      try {
        const res = await axios.post(url, data);

        // usar "next" si el backend lo manda
        const next = res?.data?.data?.next || res?.data?.next;

        if (mode !== 'signUp' && (res?.data?.success || res?.data?.token || next)) {
          window.location = next || '/';
          return;
        } else if (res.status === 201 || res?.data?.success) {
          // Estado "revisa tu correo" para sign up con magic link/password
          const form = loginSignUpForm;
          const wrapper = form.parentElement || document.body;
          form.style.display = 'none';
          const panel = document.createElement('div');
          panel.className = 'check-email-state';
          panel.innerHTML = `
            <h1 class="h3 mb-2">Revisa tu correo</h1>
            <p>Te enviamos un enlace para crear tu contraseña en <strong>${email}</strong>. El enlace expira en 24 horas.</p>
            <p class="mb-3">Si no lo ves, revisa spam o espera unos segundos.</p>
            <div class="stack">
              <a class="btn btn-primary w-100" href="/">Volver al inicio</a>
            </div>
          `;
          wrapper.appendChild(panel);
          return;
        } else {
          alert(res?.data?.message || 'Acción completada');
        }
      } catch (err) {
        alert(err?.response?.data?.message || 'Error al enviar el formulario');
      } finally {
        setBtnState(submitBtn, false, mode === 'signUp' ? 'Registrarse' : 'Iniciar sesión');
      }
    });
  }

  /* ------------------------------- */
  /* Forgot Password                 */
  /* ------------------------------- */
  const forgotForm = document.querySelector('.forgot-password-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = forgotForm.querySelector('button[type="submit"]');
      setBtnState(btn, true, 'Enviando...');

      const email = (forgotForm.querySelector('input[name="email"]')?.value || '').trim();
      if (!email) {
        alert('Ingresa tu correo.');
        setBtnState(btn, false, 'Enviar enlace');
        return;
      }

      try {
        const res = await axios.post('/api/v1/auth/password/forgot', { email });
        alert(res?.data?.message || 'Si el email existe, se enviará un enlace.');
      } catch (err) {
        // Respuesta deliberadamente ambigua por seguridad
        alert(err?.response?.data?.message || 'Si el email existe, se enviará un enlace.');
      } finally {
        setBtnState(btn, false, 'Enviar enlace');
      }
    });
  }

  /* ------------------------------- */
  /* Reset Password                  */
  /* ------------------------------- */
  const resetForm = document.querySelector('.reset-password-form');
  if (resetForm) {
    resetForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const btn = resetForm.querySelector('button[type="submit"]');
      setBtnState(btn, true, 'Actualizando...');

      const uid = resetForm.querySelector('input[name="uid"]')?.value || '';
      const token = resetForm.querySelector('input[name="token"]')?.value || '';
      const newPassword = resetForm.querySelector('input[name="newPassword"]')?.value || '';
      const confirmPassword = resetForm.querySelector('input[name="confirmPassword"]')?.value || '';

      // Leer el valor del checkbox "Recuérdame" como booleano
      const rememberInput = resetForm.querySelector('input[name="remember"]');
      const remember = !!(rememberInput && rememberInput.checked);

      if (newPassword !== confirmPassword) {
        alert('Las contraseñas no coinciden');
        setBtnState(btn, false, 'Cambiar contraseña');
        return;
      }

      try {
        const data = { uid, token, newPassword };
        if (remember) data.remember = true;

        const res = await axios.post('/api/v1/auth/password/reset', data);
        alert(res?.data?.message || 'Contraseña actualizada.');

        const next = res?.data?.data?.next;
        if (next) {
          window.location = next;
          return;
        }
        if ((res?.data?.message || '').toLowerCase().includes('correctamente')) {
          window.location = '/';
        }
      } catch (err) {
        alert(err?.response?.data?.message || 'Error al restablecer contraseña');
      } finally {
        setBtnState(btn, false, 'Cambiar contraseña');
      }
    });
  }

  /* ------------------------------- */
  /* Gallery Wall: reveal on scroll  */
  /* ------------------------------- */
  // Detecta los primeros 3 items de la primera fila visual y los marca como 'first-item' y visibles
  const wallItems = document.querySelectorAll('.gallery-wall-item');

  // Si no hay ítems, no hacemos nada
  if (!wallItems.length) return;

  // Marcar primeros 3 de la primera fila
  const markFirstRow = () => {
    let minTop = Infinity;
    wallItems.forEach(el => { if (el.offsetTop < minTop) minTop = el.offsetTop; });
    const firstRowItems = Array.from(wallItems)
      .filter(el => el.offsetTop === minTop)
      .slice(0, 3);

    // Limpia posibles marcas anteriores
    wallItems.forEach(el => el.classList.remove('first-item'));

    firstRowItems.forEach(el => el.classList.add('first-item'));
  };

  // Estado inicial: los first-item visibles, el resto con clase de reveal
  const applyInitialRevealState = () => {
    wallItems.forEach(el => {
      el.classList.remove('is-visible', 'reveal-on-scroll');
      if (el.classList.contains('first-item')) {
       
      } else {
        el.classList.add('reveal-on-scroll');
      }
    });
  };

  // Queue + IntersectionObserver
  const STAGGER_MS = 320;   // separa cada ítem 0.32s (comentario corregido)
  const queue = [];
  let flushing = false;

  const flushQueue = () => {
    if (!queue.length) { flushing = false; return; }
    const el = queue.shift();
    el.classList.add('is-visible'); // dispara la transición CSS
    setTimeout(flushQueue, STAGGER_MS);
  };

  const io = new IntersectionObserver((entries, obs) => {
    // Toma los que entran al viewport y ordénalos por posición vertical
    const toShow = entries
      .filter(e => e.isIntersecting && !e.target.dataset.revealed)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

    toShow.forEach(e => {
      e.target.dataset.revealed = '1'; // evita repetir
      queue.push(e.target);
      obs.unobserve(e.target);         // solo una vez
    });

    if (!flushing && queue.length) {
      flushing = true;
      flushQueue();
    }
  }, {
    rootMargin: '0px 0px -10% 0px',  // empieza un poco antes del bottom
    threshold: 0.2                   // cuando ~20% del ítem es visible
  });

  // Observar todos los que no sean first-item (esos ya están visibles)
  const observeRevealItems = () => {
    wallItems.forEach(el => {
      if (!el.classList.contains('first-item')) {
        io.observe(el);
      }
    });
  };

  // Oculta la última fila si está incompleta (responsive)
  setTimeout(() => {
    const rows = {};
    wallItems.forEach(el => {
      const top = el.offsetTop;
      if (!rows[top]) rows[top] = [];
      rows[top].push(el);
    });
    const rowTops = Object.keys(rows).map(Number).sort((a, b) => a - b);
    if (rowTops.length) {
      const lastRow = rows[rowTops[rowTops.length - 1]];
      let fullRowSize = 0;
      for (let i = 0; i < rowTops.length - 1; i++) {
        fullRowSize = Math.max(fullRowSize, rows[rowTops[i]].length);
      }
      // Si la última fila está incompleta, ocúltala
      if (lastRow.length < fullRowSize) {
        lastRow.forEach(el => {
          // Solo oculta si el elemento NO está visible (no tiene is-visible)
          if (!el.classList.contains('is-visible')) {
            el.style.display = 'none';
          }
        });
      }
    }
  }, 500); // Espera a que el layout esté listo

  // Espera a que las imágenes de la pared estén listas (o usa un pequeño timeout de respaldo)
  const wallRoot = document.querySelector('.gallery-wall-grid') || document;
  const whenImagesSettled = (root) => {
    const imgs = root.querySelectorAll ? root.querySelectorAll('.gallery-wall-item img') : [];
    const pending = [];
    imgs.forEach(img => {
      if (!img.complete) {
        pending.push(new Promise(res => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
        }));
      }
    });
    if (!pending.length) return Promise.resolve();
    // Fianza por si alguna imagen tarda demasiado
    const safety = new Promise(res => setTimeout(res, 800));
    return Promise.race([Promise.all(pending), safety]);
  };

  // Inicialización de la galería
  whenImagesSettled(wallRoot).then(() => {
    observeRevealItems();
    markFirstRow();
    applyInitialRevealState();
    updateIncompleteLastRow();
  }).catch(() => {
    // Si algo falla, al menos intenta proceder
    markFirstRow();
    applyInitialRevealState();
    observeRevealItems();
    updateIncompleteLastRow();
  });

  // Recalcular solo la "última fila incompleta" en resize (no tocamos animaciones ya lanzadas)
  window.addEventListener('resize', debounce(updateIncompleteLastRow, 150));

  function isFirstRowItem(item, allItems) {
    if (!item || !allItems?.length) return false;
    let minTop = Infinity;
    allItems.forEach(el => { if (el.offsetTop < minTop) minTop = el.offsetTop; });
    return item.offsetTop === minTop;
  }
});
