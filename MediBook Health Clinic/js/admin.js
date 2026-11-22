document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('rows');
  const toast = document.getElementById('toast');
  const filters = document.getElementById('filters');
  const dialog = document.getElementById('edit-dialog');
  const editDate = document.getElementById('edit-date');
  const editTime = document.getElementById('edit-time');
  const editStatus = document.getElementById('edit-status');
  let editing = null;

  const VISITS = {
    'consultation': 'General Consultation', 'checkup': 'Routine Checkup',
    'follow-up': 'Follow-Up Visit', 'medical-certificate': 'Medical Certificate Inquiry'
  };
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  editDate.min = iso(new Date());

  function notify(type, text) {
    toast.className = 'form-status ' + type;
    toast.textContent = text;
    clearTimeout(notify.t);
    notify.t = setTimeout(() => { toast.className = 'form-status'; }, 4000);
  }

  async function api(url, options = {}) {
    options.headers = { 'X-Requested-With': 'fetch' };
    const res = await fetch(url, options);
    if (res.status === 401) { location.href = 'login.html'; throw new Error('auth'); }
    return res.json();
  }

  function cell(text, cls) {
    const td = document.createElement('td');
    if (cls) td.className = cls;
    td.textContent = text;
    return td;
  }

  function btn(label, cls, handler) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = 'admin-btn ' + cls;
    b.addEventListener('click', handler);
    return b;
  }

  async function act(id, action, extra = {}) {
    const body = new URLSearchParams({ id, action, ...extra });
    const data = await api('../php/admin_appointments.php', { method: 'POST', body });
    notify(data.ok ? 'success' : 'error', data.message);
    if (data.ok) load();
    return data;
  }

  async function load() {
    const params = new URLSearchParams(new FormData(filters));
    [...params.keys()].forEach(k => { if (!params.get(k)) params.delete(k); });
    try {
      const data = await api('../php/admin_appointments.php?' + params);
      if (!data.ok) return;

      document.getElementById('c-pending').textContent = data.counts.pending;
      document.getElementById('c-confirmed').textContent = data.counts.confirmed;
      document.getElementById('c-completed').textContent = data.counts.completed;
      document.getElementById('c-cancelled').textContent = data.counts.cancelled;
      document.getElementById('c-today').textContent = data.today;

      tbody.innerHTML = '';
      if (!data.appointments.length) {
        const tr = document.createElement('tr');
        const td = cell('No appointments found.', 'empty');
        td.colSpan = 7;
        tr.append(td);
        tbody.append(tr);
        return;
      }
      data.appointments.forEach(a => {
        const tr = document.createElement('tr');
        tr.append(cell(a.reference));
        const patient = document.createElement('td');
        const name = document.createElement('strong'); name.textContent = a.full_name;
        const contact = document.createElement('small'); contact.textContent = `${a.email} · ${a.phone}`;
        patient.append(name, document.createElement('br'), contact);
        tr.append(patient);
        tr.append(cell(a.doctor_name));
        tr.append(cell(VISITS[a.visit_type] || a.visit_type));
        tr.append(cell(`${a.appointment_date} · ${a.time_label}`));

        const st = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'status-badge status-' + a.status;
        badge.textContent = a.status.charAt(0).toUpperCase() + a.status.slice(1);
        st.append(badge);
        tr.append(st);

        const actions = document.createElement('td');
        actions.className = 'actions';
        if (a.status === 'pending') actions.append(btn('Confirm', 'primary', () => act(a.id, 'confirm')));
        if (a.status === 'confirmed') actions.append(btn('Complete', 'primary', () => act(a.id, 'complete')));
        if (a.status === 'pending' || a.status === 'confirmed') {
          actions.append(btn('Edit', '', () => openEdit(a)));
          actions.append(btn('Cancel', 'danger', () => {
            if (confirm(`Cancel appointment ${a.reference} for ${a.full_name}?`)) act(a.id, 'cancel');
          }));
        } else {
          actions.textContent = '—';
        }
        tr.append(actions);
        tbody.append(tr);
      });
    } catch (e) { /* redirected to login or network error */ }
  }

  // ---- Edit (reschedule) dialog ----
  function openEdit(a) {
    editing = a;
    document.getElementById('edit-info').textContent = `${a.reference} · ${a.full_name} · ${a.doctor_name}`;
    editDate.value = '';
    editTime.innerHTML = '<option value="">Select a time</option>';
    editStatus.className = 'form-status';
    dialog.showModal();
  }

  editDate.addEventListener('change', async () => {
    editTime.innerHTML = '<option value="">Select a time</option>';
    if (!editDate.value || !editing) return;
    const res = await fetch(`../php/availability.php?doctor_id=${editing.doctor_id}&date=${encodeURIComponent(editDate.value)}`);
    const data = await res.json();
    if (!data.ok || !data.slots.length) { editTime.firstChild.textContent = 'Doctor is not available on this date'; return; }
    data.slots.forEach(s => {
      const o = document.createElement('option');
      o.value = s.time;
      o.textContent = s.available ? s.label : `${s.label} (booked)`;
      o.disabled = !s.available;
      editTime.append(o);
    });
  });

  document.getElementById('edit-save').addEventListener('click', async () => {
    if (!editDate.value || !editTime.value) {
      editStatus.className = 'form-status error';
      editStatus.textContent = 'Choose a new date and time.';
      return;
    }
    const data = await act(editing.id, 'reschedule', { date: editDate.value, time: editTime.value });
    if (data.ok) dialog.close();
    else { editStatus.className = 'form-status error'; editStatus.textContent = data.message; }
  });
  document.getElementById('edit-close').addEventListener('click', () => dialog.close());

  filters.addEventListener('submit', (e) => { e.preventDefault(); load(); });
  filters.addEventListener('reset', () => setTimeout(load, 0));
  console.log('Registering Clear All listener...');

  document.getElementById('logout').addEventListener('click', async () => {
    await fetch('../php/admin_logout.php');
    location.href = 'login.html';
  });

  load();
});
