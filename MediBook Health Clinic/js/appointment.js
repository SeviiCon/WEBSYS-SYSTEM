document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('.appointment-card');
  const btn = form.querySelector('button[type="submit"]');
  const doctorSelect = document.getElementById('preferred-doctor');
  const dateInput = document.getElementById('preferred-date');
  const timeSelect = document.getElementById('preferred-time');

  // Date limits: today up to 60 days ahead (matches MAX_DAYS_AHEAD in php/config.php)
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const today = new Date();
  const max = new Date(); max.setDate(max.getDate() + 60);
  dateInput.min = iso(today);
  dateInput.max = iso(max);

  const status = document.createElement('p');
  status.className = 'form-status';
  status.setAttribute('role', 'status');
  btn.before(status);

  function show(type, node) {
    status.className = 'form-status ' + type;
    status.replaceChildren(node);
  }

  function setTimeOptions(text, slots) {
    timeSelect.innerHTML = '';
    const first = document.createElement('option');
    first.value = '';
    first.textContent = text;
    timeSelect.append(first);
    (slots || []).forEach(s => {
      const o = document.createElement('option');
      o.value = s.time;
      o.textContent = s.available ? s.label : `${s.label} (booked)`;
      o.disabled = !s.available;
      timeSelect.append(o);
    });
  }

  // Availability checker
  async function loadSlots() {
    const doctor = doctorSelect.value;
    const date = dateInput.value;
    if (!doctor || !date) { setTimeOptions('Choose a doctor and date first'); return; }
    setTimeOptions('Checking availability...');
    try {
      const res = await fetch(`php/availability.php?doctor_id=${encodeURIComponent(doctor)}&date=${encodeURIComponent(date)}`);
      const data = await res.json();
      if (!data.ok) { setTimeOptions(data.message || 'Could not check availability'); return; }
      const open = data.slots.filter(s => s.available).length;
      if (!data.slots.length) setTimeOptions('Doctor is not available on this date');
      else if (!open) setTimeOptions('Fully booked: try another date', data.slots);
      else setTimeOptions('Select a time', data.slots);
    } catch (e) {
      setTimeOptions('Could not check availability');
    }
  }

  doctorSelect.addEventListener('change', loadSlots);
  dateInput.addEventListener('change', loadSlots);
  setTimeOptions('Choose a doctor and date first');

  // Load doctors (preselect when arriving from the Our Doctors page)

// Load doctors from the database
async function loadDoctors() {
  try {
    console.log('Loading doctors...');

    const response = await fetch('php/doctors.php');
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();

    console.log('Doctors API response:', data);

    if (!data.ok) {
      throw new Error(data.message || 'Failed to load doctors.');
    }

    // Remove previous doctor options, keeping the placeholder
    doctorSelect.innerHTML = '<option value="">Select a doctor</option>';

    // Add doctors from MySQL
    data.doctors.forEach(doctor => {
      const option = document.createElement('option');

      option.value = doctor.id;
      option.textContent = `${doctor.name} (${doctor.specialty})`;

      doctorSelect.appendChild(option);
    });

    // Preselect doctor if arriving from another page
    const wanted = new URLSearchParams(location.search).get('doctor');

    if (wanted) {
      doctorSelect.value = wanted;
      doctorSelect.dispatchEvent(new Event('change'));
    }

    console.log('Doctors loaded successfully:', data.doctors.length);

  } catch (error) {
    console.error('Doctor loading failed:', error);

    doctorSelect.innerHTML =
      '<option value="">Could not load doctors</option>';

    show('error', document.createTextNode(
      'Unable to load doctors: ' + error.message
    ));
  }
}

loadDoctors();


  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Sending...';
    status.className = 'form-status';

    try {
      const res = await fetch('php/appointment.php', { method: 'POST', body: new FormData(form) });
      const data = await res.json();
      if (data.ok) {
        const wrap = document.createDocumentFragment();
        const msg = document.createElement('span');
        msg.textContent = `${data.message} Your reference number is `;
        const strong = document.createElement('strong');
        strong.textContent = data.reference;
        const link = document.createElement('a');
        link.href = 'manage.html';
        link.textContent = 'My Appointments';
        link.className = 'status-link';
        wrap.append(msg, strong, document.createTextNode('. Keep it to view, update, or cancel your booking on '), link, document.createTextNode('.'));
        show('success', wrap);
        form.reset();
        setTimeOptions('Choose a doctor and date first');
      } else {
        show('error', document.createTextNode(data.message || 'Something went wrong.'));
        if (res.status === 409) loadSlots();
      }
    } catch (err) {
      show('error', document.createTextNode('Could not reach the server. Make sure Apache and MySQL are running.'));
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });
});
