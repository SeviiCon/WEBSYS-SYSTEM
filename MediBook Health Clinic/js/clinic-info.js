// Shows clinic hours and the doctor list (with schedules) from the database.
(function () {
  const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function renderHours(hours) {
    document.querySelectorAll('[data-clinic-hours]').forEach(list => {
      list.innerHTML = '';
      hours.forEach(h => {
        const li = el('li');
        li.append(el('span', '', DAYS[h.weekday]));
        li.append(el('span', h.is_open ? '' : 'closed', h.is_open ? `${h.open} – ${h.close}` : 'Closed'));
        list.append(li);
      });
    });
  }

  // "Mon, Wed, Fri: 9:00 AM – 12:00 PM, 1:00 PM – 4:00 PM"
  function scheduleLines(schedule) {
    const perDay = {};
    schedule.forEach(s => {
      (perDay[s.weekday] = perDay[s.weekday] || []).push(`${s.start} – ${s.end}`);
    });
    const groups = {};
    Object.keys(perDay).sort((a, b) => a - b).forEach(day => {
      const key = perDay[day].join(', ');
      (groups[key] = groups[key] || []).push(SHORT[day]);
    });
    return Object.entries(groups).map(([times, days]) => `${days.join(', ')}: ${times}`);
  }

  function renderDoctors(doctors) {
    const box = document.getElementById('doctor-list');
    if (!box) return;
    box.innerHTML = '';
    if (!doctors.length) {
      box.append(el('p', 'doctor-empty', 'No doctors are listed yet. Please check back soon.'));
      return;
    }
    doctors.forEach(d => {
      const card = el('article', 'doctor-card');
      const initials = d.name.replace(/^Dr\.?\s*/i, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
      card.append(el('div', 'doctor-avatar', initials));
      card.append(el('h3', '', d.name));
      card.append(el('p', 'doctor-specialty', d.specialty));

      const lines = scheduleLines(d.schedule);
      const ul = el('ul', 'doctor-schedule');
      if (lines.length) lines.forEach(l => ul.append(el('li', '', l)));
      else ul.append(el('li', '', 'Schedule to be announced'));
      card.append(ul);

      const a = el('a', 'booking-button', 'Book with this doctor');
      a.href = 'appointment.html?doctor=' + encodeURIComponent(d.id);
      card.append(a);
      box.append(card);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('[data-clinic-hours], #doctor-list')) return;
    fetch('php/doctors.php')
      .then(r => r.json())
      .then(data => {
        if (!data.ok) throw new Error();
        renderHours(data.hours);
        renderDoctors(data.doctors);
      })
      .catch(() => {
        document.querySelectorAll('[data-clinic-hours]').forEach(l => {
          l.innerHTML = '<li><span>Hours unavailable right now.</span></li>';
        });
      });
  });
})();
