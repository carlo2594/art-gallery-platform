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