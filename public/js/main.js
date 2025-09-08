// public/js/main.js

document.addEventListener('DOMContentLoaded', function () {
  /* ------------------------------- */
  /* Login / SignUp                  */
  /* ------------------------------- */
  const loginSignUpForm = document.querySelector('.login-signin-form');
  if (loginSignUpForm) {
    loginSignUpForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const submitBtn = loginSignUpForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
      }

      const mode = window.loginSignUpMode || loginSignUpForm.getAttribute('data-mode');
      const url = mode === 'signUp' ? '/api/v1/auth/signup' : '/api/v1/auth/login';

      const emailInput = loginSignUpForm.querySelector('input[name="email"]');
      if (!emailInput) {
        alert('No se encontró el campo de correo electrónico.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = mode === 'signUp' ? 'Registrarse' : 'Iniciar sesión';
        }
        return;
      }

      const email = emailInput.value;
      let password = '';
      if (mode !== 'signUp') {
        const passwordInput = loginSignUpForm.querySelector('input[name="password"]');
        if (passwordInput) password = passwordInput.value;
      }

      const data = { email };
      if (password) data.password = password;

      if (mode === 'signUp') {
        const nameInput = loginSignUpForm.querySelector('input[name="name"]');
        if (nameInput) data.name = nameInput.value || email;
      }

      try {
        const res = await axios.post(url, data);

        // usar "next" si el backend lo manda
        const next = res.data?.data?.next || res.data?.next;

        if (mode !== 'signUp' && (res.data?.success || res.data?.token || next)) {
          window.location = next || '/';
          return;
        } else if (res.status === 201 || (res.data && res.data.success)) {
          // Estado "revisa tu correo" para sign up con magic link de password
          const form = loginSignUpForm;
          const wrapper = form.parentElement;
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
          alert(res.data.message || 'Acción completada');
        }
      } catch (err) {
        alert(err.response?.data?.message || 'Error al enviar el formulario');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = mode === 'signUp' ? 'Registrarse' : 'Iniciar sesión';
        }
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
      if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

      const email = forgotForm.querySelector('input[name="email"]')?.value || '';
      if (!email) {
        alert('Ingresa tu correo.');
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar enlace'; }
        return;
      }

      try {
        const res = await axios.post('/api/v1/auth/password/forgot', { email });
        alert(res.data?.message || 'Si el email existe, se enviará un enlace.');
      } catch (err) {
        // Respuesta deliberadamente ambigua por seguridad
        alert(err.response?.data?.message || 'Si el email existe, se enviará un enlace.');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar enlace'; }
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
      if (btn) { btn.disabled = true; btn.textContent = 'Actualizando...'; }

      const uid = document.querySelector('input[name="uid"]').value;
      const token = document.querySelector('input[name="token"]').value;
      const newPassword = document.querySelector('input[name="newPassword"]').value;
      const confirmPassword = document.querySelector('input[name="confirmPassword"]').value;

      if (newPassword !== confirmPassword) {
        alert('Las contraseñas no coinciden');
        if (btn) { btn.disabled = false; btn.textContent = 'Cambiar contraseña'; }
        return;
      }

      try {
        const res = await axios.post('/api/v1/auth/password/reset', { uid, token, newPassword });
        alert(res.data?.message || 'Contraseña actualizada.');
        if ((res.data?.message || '').toLowerCase().includes('correctamente')) {
          window.location = '/';
        }
      } catch (err) {
        alert(err.response?.data?.message || 'Error al restablecer contraseña');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Cambiar contraseña'; }
      }
    });
  }
});
