document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.contact-form');
  const btn = form.querySelector('button[type="submit"]');
  const select = document.getElementById('inquiry-type');

  const types = {
    'appointment': 'Appointment Question',
    'services': 'Clinic Services',
    'medical-certificate': 'Medical Certificate',
    'feedback': 'Feedback',
    'other': 'Other'
  };
  Object.entries(types).forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  });

  const status = document.createElement('p');
  status.className = 'form-status';
  status.setAttribute('role', 'status');
  btn.before(status);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Sending...';
    status.className = 'form-status';

    try {
      const res = await fetch('php/contact.php', { method: 'POST', body: new FormData(form) });
      const data = await res.json();
      status.className = 'form-status ' + (data.ok ? 'success' : 'error');
      status.textContent = data.message || 'Something went wrong.';
      if (data.ok) form.reset();
    } catch (err) {
      status.className = 'form-status error';
      status.textContent = 'Could not reach the server. Make sure Apache and MySQL are running.';
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });
});
