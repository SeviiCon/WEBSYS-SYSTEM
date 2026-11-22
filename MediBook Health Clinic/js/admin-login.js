document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const status = document.getElementById('login-status');
  const btn = form.querySelector('button');
  btn.disabled = true;
  try {
    const res = await fetch('../php/admin_login.php', { method: 'POST', body: new FormData(form) });
    const data = await res.json();
    if (data.ok) { location.href = 'index.html'; return; }
    status.className = 'form-status error';
    status.textContent = data.message;
  } catch (err) {
    status.className = 'form-status error';
    status.textContent = 'Could not reach the server. Make sure Apache and MySQL are running.';
  }
  btn.disabled = false;
});
