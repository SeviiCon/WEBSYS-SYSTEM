// "My Appointments": patients look up, reschedule, or cancel using reference number + email.
document.addEventListener('DOMContentLoaded', () => {
  const lookupForm = document.getElementById('lookup-form');
  const lookupStatus = document.getElementById('lookup-status');
  const result = document.getElementById('result-card');
  const details = document.getElementById('result-details');
  const badge = document.getElementById('result-status');
  const changeBox = document.getElementById('change-box');
  const finalNote = document.getElementById('final-note');
  const actionStatus = document.getElementById('action-status');
  const newDate = document.getElementById('new-date');
  const newTime = document.getElementById('new-time');
  const rescheduleBtn = document.getElementById('reschedule-btn');
  const cancelBtn = document.getElementById('cancel-btn');

  const VISITS = {
    'consultation': 'General Consultation',
    'checkup': 'Routine Checkup',
    'follow-up': 'Follow-Up Visit',
    'medical-certificate': 'Medical Certificate Inquiry'
  };
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const max = new Date(); max.setDate(max.getDate() + 60);
  newDate.min = iso(new Date());
  newDate.max = iso(max);

  let current = null; // {reference, email, appointment}

  function say(box, type, text) {
    box.className = 'form-status ' + type;
    box.textContent = text;
  }

  function prettyDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  async function post(url, body) {
    const res = await fetch(url, { method: 'POST', body: new URLSearchParams(body) });
    return res.json();
  }

  function render(a) {
    details.innerHTML = '';
    const rows = [
      ['Reference', a.reference],
      ['Doctor', `${a.doctor_name} (${a.specialty})`],
      ['Visit type', VISITS[a.visit_type] || a.visit_type],
      ['Date', prettyDate(a.appointment_date)],
      ['Time', a.time_label]
    ];
    if (a.patient_note) rows.push(['Your note', a.patient_note]);
    rows.forEach(([k, v]) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      details.append(dt, dd);
    });

    badge.textContent = a.status.charAt(0).toUpperCase() + a.status.slice(1);
    badge.className = 'status-badge status-' + a.status;

    const editable = a.status === 'pending' || a.status === 'confirmed';
    changeBox.hidden = !editable;
    finalNote.hidden = editable;
    if (!editable) {
      finalNote.textContent = a.status === 'cancelled'
        ? (a.cancelled_by === 'clinic' ? 'This appointment was cancelled by the clinic. You can book a new one anytime.'
                                       : 'You cancelled this appointment. You can book a new one anytime.')
        : 'This appointment is completed.';
    }
    result.hidden = false;
  }

  async function lookup(reference, email, quiet) {
    const data = await post('php/lookup.php', { reference, email });
    if (!data.ok) {
      result.hidden = true;
      say(lookupStatus, 'error', data.message);
      return false;
    }
    current = { reference, email };
    if (!quiet) lookupStatus.className = 'form-status';
    render(data.appointment);
    return true;
  }

  lookupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    actionStatus.className = 'form-status';
    const ref = lookupForm.reference.value.trim().toUpperCase();
    const email = lookupForm.email.value.trim();
    try { await lookup(ref, email); }
    catch (err) { say(lookupStatus, 'error', 'Could not reach the server. Make sure Apache and MySQL are running.'); }
  });

  // Availability for the new date (doctor stays the same)
  async function loadSlots() {
    newTime.innerHTML = '<option value="">Select a time</option>';
    if (!newDate.value || !current) return;
    const lookupData = await post('php/lookup.php', current);
    if (!lookupData.ok) return;
    const res = await fetch(`php/availability.php?doctor_id=${lookupData.appointment.doctor_id}&date=${encodeURIComponent(newDate.value)}`);
    const data = await res.json();
    newTime.innerHTML = '';
    const first = document.createElement('option');
    first.value = '';
    if (!data.ok || !data.slots.length) first.textContent = 'Doctor is not available on this date';
    else if (!data.slots.some(s => s.available)) first.textContent = 'Fully booked: try another date';
    else first.textContent = 'Select a time';
    newTime.append(first);
    (data.ok ? data.slots : []).forEach(s => {
      const o = document.createElement('option');
      o.value = s.time;
      o.textContent = s.available ? s.label : `${s.label} (booked)`;
      o.disabled = !s.available;
      newTime.append(o);
    });
  }
  newDate.addEventListener('change', () => loadSlots().catch(() => {}));

  rescheduleBtn.addEventListener('click', async () => {
    if (!newDate.value || !newTime.value) { say(actionStatus, 'error', 'Please choose a new date and time.'); return; }
    rescheduleBtn.disabled = true;
    try {
      const data = await post('php/manage.php', { ...current, action: 'reschedule', date: newDate.value, time: newTime.value });
      say(actionStatus, data.ok ? 'success' : 'error', data.message);
      if (data.ok) { newDate.value = ''; newTime.innerHTML = '<option value="">Select a time</option>'; await lookup(current.reference, current.email, true); }
    } catch (e) { say(actionStatus, 'error', 'Could not reach the server.'); }
    rescheduleBtn.disabled = false;
  });

  cancelBtn.addEventListener('click', async () => {
    if (!confirm('Cancel this appointment? This cannot be undone.')) return;
    cancelBtn.disabled = true;
    try {
      const data = await post('php/manage.php', { ...current, action: 'cancel' });
      say(actionStatus, data.ok ? 'success' : 'error', data.message);
      if (data.ok) await lookup(current.reference, current.email, true);
    } catch (e) { say(actionStatus, 'error', 'Could not reach the server.'); }
    cancelBtn.disabled = false;
  });
});
