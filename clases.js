// clases.js

let state = loadState();
initState(fresh => { state = fresh; renderNav(); renderLessons(); });
if (!state.lessons || !state.lessons.length) {
  state.lessons = [
    { id:1, title:'Fundamentos 3-bet preflop', cat:'preflop', source:'Upswing Poker', link:'', day:'', done:false },
    { id:2, title:'Bet sizing postflop strategy', cat:'postflop', source:'GTO Wizard', link:'', day:'', done:false },
    { id:3, title:'Mental game & tilt control', cat:'mental', source:'Jared Tendler', link:'', day:'', done:false },
  ];
}

document.getElementById('les-day').value = todayISO();

let activeCat   = 'all';
let activeView  = 'week';  // 'week' | 'all'

// viewWeekOffset: 0 = current week, -1 = prev, +1 = next, etc.
let weekOffset  = 0;

// ---- Week helpers ----

function getMondayOf(d) {
  const date = new Date(typeof d === 'string' ? d + 'T12:00:00' : d);
  const dow  = date.getDay();
  date.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1));
  date.setHours(0,0,0,0);
  return date;
}

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

// Monday of the currently-viewed week
function viewedMonday() {
  const base = getMondayOf(todayISO());
  return addDays(base, weekOffset * 7);
}

function isoOf(d) {
  return d.toISOString().split('T')[0];
}

function isoWeekKey(dateStr) {
  const wn = getWeekNumber(dateStr);
  const y  = new Date(dateStr + 'T12:00:00').getFullYear();
  return `${y}-W${String(wn).padStart(2,'0')}`;
}

function weekLabel(monday) {
  const sun = addDays(monday, 6);
  const fmt = dt => dt.toLocaleDateString('es-ES', { day:'numeric', month:'short' });
  const wn  = getWeekNumber(isoOf(monday));
  return `Sem. ${wn} · ${fmt(monday)}–${fmt(sun)}`;
}

function currentWeekKey() {
  return isoWeekKey(todayISO());
}

function viewedWeekKey() {
  return isoWeekKey(isoOf(viewedMonday()));
}

// ---- Navigation ----

function shiftWeek(n) {
  weekOffset += n;
  renderNav();
  renderLessons();
}

function goThisWeek() {
  weekOffset = 0;
  renderNav();
  renderLessons();
}

function renderNav() {
  const mon   = viewedMonday();
  const isNow = weekOffset === 0;
  document.getElementById('wnav-label').textContent = isNow ? 'Esta semana' : weekLabel(mon);
  const todayBtn = document.getElementById('wnav-today');
  todayBtn.classList.toggle('hidden', isNow);
}

// ---- View toggle ----

function setView(v) {
  activeView = v;
  document.querySelectorAll('.view-pill').forEach(p =>
    p.classList.toggle('active', p.dataset.view === v)
  );
  renderNav();
  renderLessons();
}

// ---- Category filter ----

function filterCat(el) {
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  activeCat = el.dataset.cat;
  renderLessons();
}

// ---- Form ----

function toggleForm() {
  const card = document.getElementById('add-form-card');
  card.style.display = card.style.display === 'none' ? 'block' : 'none';
}

function addLesson() {
  const title = document.getElementById('les-title').value.trim();
  if (!title) { showToast('Añade un título'); return; }
  state.lessons.push({
    id:     Date.now(), title,
    cat:    document.getElementById('les-cat').value,
    source: document.getElementById('les-source').value.trim(),
    link:   document.getElementById('les-link').value.trim(),
    day:    document.getElementById('les-day').value,
    done:   false,
  });
  document.getElementById('les-title').value  = '';
  document.getElementById('les-source').value = '';
  document.getElementById('les-link').value   = '';
  saveState(state);
  showToast('Clase añadida ✓');
  renderLessons();
}

function toggleLesson(id) {
  const l = state.lessons.find(x => x.id === id);
  if (l) { l.done = !l.done; saveState(state); renderLessons(); }
}

function delLesson(id) {
  if (!confirm('¿Eliminar esta clase?')) return;
  state.lessons = state.lessons.filter(x => x.id !== id);
  saveState(state);
  showToast('Clase eliminada');
  renderLessons();
}

// ---- Item HTML ----

function renderItem(l) {
  const dayLabel = l.day
    ? new Date(l.day + 'T12:00:00').toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' })
    : '';
  return `
    <div class="lesson-item">
      <div class="l-check ${l.done ? 'done' : ''}" onclick="toggleLesson(${l.id})">${l.done ? '✓' : ''}</div>
      <div class="l-info">
        <div class="l-title ${l.done ? 'done' : ''}">${escapeHtml(l.title)}</div>
        <div class="l-sub">
          <span class="l-cat">${l.cat}</span>
          ${l.source ? `<span class="l-source">${escapeHtml(l.source)}</span>` : ''}
          ${l.link   ? `<a class="l-link" href="${l.link}" target="_blank">▶ Ver clase</a>` : ''}
          ${l.day    ? `<span class="l-day">${dayLabel}</span>` : ''}
        </div>
      </div>
      <button class="del-btn" onclick="delLesson(${l.id})">×</button>
    </div>`;
}

// ---- Render pending by week ----

function renderPending(list) {
  // Group by week key
  const groups = {};
  const noDate = [];
  list.forEach(l => {
    if (!l.day) { noDate.push(l); return; }
    const wk = isoWeekKey(l.day);
    if (!groups[wk]) {
      const mon = getMondayOf(l.day);
      groups[wk] = { label: weekLabel(mon), items: [], key: wk, mon };
    }
    groups[wk].items.push(l);
  });

  const sorted = Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
  const ck     = currentWeekKey();
  const vk     = viewedWeekKey();

  // ---- WEEK VIEW: show only the viewed week ----
  if (activeView === 'week') {
    const thisGroup = sorted.find(g => g.key === vk);
    const items     = thisGroup ? thisGroup.items : [];

    if (!items.length && !noDate.length) {
      const msg = weekOffset === 0
        ? `Sin clases esta semana`
        : `Sin clases en esta semana`;
      return `<div class="week-empty">
        ${msg}
        <button class="btn-link" onclick="setView('all')">Ver todas</button>
      </div>`;
    }

    let html = '';
    if (items.length) {
      const isNow = vk === ck;
      html += `<div class="week-group-label${isNow ? ' current' : ''}">
        ${isNow ? 'Esta semana' : weekLabel(viewedMonday())} · ${items.length} clase${items.length !== 1 ? 's' : ''}
      </div>`;
      html += items.map(renderItem).join('');
    }
    if (weekOffset === 0 && noDate.length) {
      html += `<div class="week-group-label" style="margin-top:8px">Sin fecha asignada</div>`;
      html += noDate.map(renderItem).join('');
    }
    return html || `<p style="color:var(--hint);font-size:13px;text-align:center;padding:.75rem 0">—</p>`;
  }

  // ---- ALL VIEW: grouped by week, all weeks ----
  if (!sorted.length && !noDate.length) {
    return `<p style="color:var(--hint);font-size:13px;text-align:center;padding:.75rem 0">Sin clases pendientes</p>`;
  }

  let html = '';
  sorted.forEach(g => {
    const isCurrent = g.key === ck;
    const isViewed  = g.key === vk;
    let labelText   = g.label;
    if (isCurrent) labelText += ' · Esta semana';
    html += `<div class="week-group-label${isCurrent ? ' current' : ''}${isViewed && !isCurrent ? ' viewed' : ''}">
      ${labelText} · ${g.items.length} clase${g.items.length !== 1 ? 's' : ''}
    </div>`;
    html += g.items.map(renderItem).join('');
  });
  if (noDate.length) {
    html += `<div class="week-group-label">Sin fecha asignada · ${noDate.length} clase${noDate.length !== 1 ? 's' : ''}</div>`;
    html += noDate.map(renderItem).join('');
  }
  return html;
}

// ---- Main render ----

function renderLessons() {
  let list = state.lessons || [];
  if (activeCat !== 'all') list = list.filter(l => l.cat === activeCat);

  const pending = list.filter(l => !l.done);
  const done    = list.filter(l => l.done);

  document.getElementById('pending-count').textContent           = pending.length + ' clases';
  document.getElementById('done-count').textContent             = done.length    + ' clases';
  document.getElementById('done-section').style.display         = done.length ? 'block' : 'none';
  document.getElementById('lessons-pending').innerHTML          = renderPending(pending);
  document.getElementById('lessons-done').innerHTML             = done.length
    ? done.map(renderItem).join('')
    : '<p style="color:var(--hint);font-size:13px;text-align:center;padding:.5rem 0">—</p>';
}

// ---- Init ----
renderNav();
renderLessons();
