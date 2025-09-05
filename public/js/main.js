// Login/SignUp form handler
  const loginSignUpForm = document.querySelector('.login-signin-form');
  if (loginSignUpForm) {
    loginSignUpForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      // Get mode from data attribute or hidden input if needed
  const mode = window.loginSignUpMode || loginSignUpForm.getAttribute('data-mode')
  console.log('Modo actual del formulario:', mode);
  const url = mode === 'signUp' ? '/api/v1/auth/signup' : '/api/v1/auth/login';
      const emailInput = loginSignUpForm.querySelector('input[name="email"]');
      if (!emailInput) {
        alert('No se encontró el campo de correo electrónico.');
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
        if (res.data.success || res.data.token) {
          window.location = '/';
        } else {
          alert(res.data.message || 'Acción completada');
        }
        if (res.data.success) {
          alert(res.data.message || 'Acción completada');
          // Si quieres mostrar una pantalla personalizada, puedes ocultar el formulario y mostrar un div de éxito.
          // Por ejemplo:
          // document.querySelector('.login-signin-form').style.display = 'none';
          // document.querySelector('.success-message').style.display = 'block';
        }
      } catch (err) {
        alert(err.response?.data?.message || 'Error al enviar el formulario');
      }
    });
  }
document.addEventListener('DOMContentLoaded', function () {
  const resetForm = document.querySelector('.reset-password-form');
  if (resetForm) {
    resetForm.addEventListener('submit', async function (e) {
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