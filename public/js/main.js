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

      const emailInput = loginSignUpForm.querySelector('input[name="email"]');
      const passwordInput = loginSignUpForm.querySelector('input[name="password"]');
      const modeInput = loginSignUpForm.querySelector('input[name="mode"]');

      const email = emailInput?.value || '';
      const password = passwordInput?.value || '';
      const mode = modeInput?.value || 'login';

      // simple validación
      if (!email || !password) {
        alert('Por favor, completa email y contraseña.');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Enviar'; }
        return;
      }

      const url = mode === 'signUp' ? '/api/v1/users/signup' : '/api/v1/users/login';
      const data = { email, password };

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
          window.location = next || '/';
          return;
        } else {
          alert(res.data?.message || 'Operación completada');
        }
      } catch (err) {
        console.error(err);
        alert(err.response?.data?.message || 'Ocurrió un error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Enviar';
        }
      }
    });
  }

  /* ------------------------------- */
  /* Forgot Password                 */
  /* ------------------------------- */
  const forgotForm = document.querySelector('.forgot-password-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = forgotForm.querySelector('button[type="submit"]');
      const email = forgotForm.querySelector('input[name="email"]')?.value || '';
      if (!email) {
        alert('Ingresa tu email');
        return;
      }
      try {
        if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
        const res = await axios.post('/api/v1/users/forgotPassword', { email });
        alert(res.data?.message || 'Te enviamos un email si la cuenta existe.');
      } catch (err) {
        alert(err.response?.data?.message || 'Error al solicitar recuperación');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar'; }
      }
    });
  }

  /* ------------------------------- */
  /* Reset Password                  */
  /* ------------------------------- */
  const resetForm = document.que
