// Login/SignUp form handler
  const loginSignUpForm = document.querySelector('.login-signin-form');
  if (loginSignUpForm) {
    console.log('Handler de submit adjuntado para login/signUp');
    loginSignUpForm.addEventListener('submit', async function (e) {
      console.log('Evento submit disparado en login/signUp');
      console.log('Evento submit disparado');
      e.preventDefault();
      const submitBtn = loginSignUpForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
      }
      // Get mode from data attribute or hidden input if needed
      const mode = window.loginSignUpMode || loginSignUpForm.getAttribute('data-mode');
      console.log('Modo actual del formulario:', mode);
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
        if (passwordInput) {
          password = passwordInput.value;
        }
      }
      const data = { email };
      if (password) data.password = password;
      let name = email; // default to email if name not provided
      if (mode === 'signUp') {
        const nameInput = loginSignUpForm.querySelector('input[name="name"]');
        if (nameInput) {
          name = nameInput.value;
          data.name = name;
        }
      }
      try {
        const res = await axios.post(url, data);
        if (mode === 'signUp' && (res.status === 201 || (res.data && res.data.success))) {
          const form = loginSignUpForm;
          const wrapper = form.parentElement;
          const emailSafe = email;
          form.style.display = 'none';
          const panel = document.createElement('div');
          panel.className = 'check-email-state';
          panel.innerHTML = `
            <h1 class="h3 mb-2">Revisa tu correo</h1>
            <p>Te enviamos un enlace para crear tu contraseña en <strong>${emailSafe}</strong>. El enlace expira en 24 horas.</p>
            <p class="mb-3">Si no lo ves, revisa spam o espera unos segundos.</p>
            <div class="stack">
              <a class="btn btn-primary w-100" href="/">Volver al inicio</a>
            </div>
          `;
          wrapper.appendChild(panel);
          return;
        } else if (res.data.success || res.data.token) {
          window.location = '/';
        } else {
          alert(res.data.message || 'Acción completada');
        }
      } catch (err) {
        alert(err.response?.data?.message || 'Error al enviar el formulario');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = mode === 'signUp' ? 'Registrarse' : 'Iniciar sesión';
        }
      }
    });
  }
document.addEventListener('DOMContentLoaded', function () {
  const resetForm = document.querySelector('.reset-password-form');
  if (resetForm) {
    console.log('Handler de submit adjuntado para reset password');
    resetForm.addEventListener('submit', async function (e) {
      console.log('Evento submit disparado en reset password');
      e.preventDefault();
      const uid = document.querySelector('input[name="uid"]').value;
      const token = document.querySelector('input[name="token"]').value;
      const newPassword = document.querySelector('input[name="newPassword"]').value;
      const confirmPassword = document.querySelector('input[name="confirmPassword"]').value;

      if (newPassword !== confirmPassword) {
        alert('Las contraseñas no coinciden');
        return;
      }

      try {
        const res = await axios.post('/api/v1/auth/password/reset', { uid, token, newPassword });
        alert(res.data.message);
        if (res.data.message.includes('correctamente')) {
          window.location = '/';
        }
      } catch (err) {
        alert(err.response?.data?.message || 'Error al restablecer contraseña');
      }
    });
  }
});