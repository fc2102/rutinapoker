// calendario.js — Horario semanal

let state = loadState();
initState(fresh => { state = fresh; render(); });

const todayObj = new Date();
const TODAY    = todayISO();

let weekStart     = getMondayOf(todayObj);
let selectedType  = 'estudio';
let addTargetDate = null;
let copySourceDate = null;

// ---- Helpers ----

function getMondayOf(d) {
  const date = new Date(d);
  const dow  = date.getDay();
  date.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function toISO(d) {
  // Use local year/month/day to avoid UTC timezone shift
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function timeToMinutes(str) {
  if (!str) return 0;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + (m || 0);
}

function getEventsForDate(ds) {
  return (state.calEvents || []).filter(e => e.date === ds);
}

// ---- Navigation ----

function prevWeek() { weekStart = addDays(weekStart, -7); render(); }
function nextWeek() { weekStart = addDays(weekStart,  7); render(); }
function goToday()  { weekStart = getMondayOf(todayObj); render(); }

// ---- Header ----

function renderHeader() {
  const monday   = weekStart;
  const sunday   = addDays(monday, 6);
  const wn       = getWeekNumber(toISO(monday));
  const fmt      = d => d.toLocaleDateString('es-ES', { day:'numeric', month:'short' });
  document.getElementById('week-label').textContent =
    `Sem. ${wn} · ${fmt(monday)} – ${fmt(sunday)}`;
}

// ---- Day tabs ----

function renderDayTabs() {
  const SHORT = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  document.getElementById('day-tabs').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d   = addDays(weekStart, i);
    const ds  = toISO(d);
    const evs = getEventsForDate(ds);
    const dots = evs.slice(0, 4).map(e =>
      `<div class="day-tab-dot" style="background:${DOT_COLORS[e.type] || '#888'}"></div>`
    ).join('');
    const isToday = ds === TODAY;
    return `
      <div class="day-tab${isToday ? ' today' : ''}" onclick="scrollToDay(${i})">
        <div class="day-tab-name">${SHORT[i]}</div>
        <div class="day-tab-num">${d.getDate()}</div>
        <div class="day-tab-dots">${dots}</div>
      </div>`;
  }).join('');
}

function scrollToDay(idx) {
  const cols = document.querySelectorAll('.day-col');
  if (cols[idx]) cols[idx].scrollIntoView({ behavior:'smooth', block:'nearest', inline:'start' });
}

// ---- Stats bar ----

function renderStatsBar() {
  const evs = Array.from({ length: 7 }, (_, i) =>
    getEventsForDate(toISO(addDays(weekStart, i)))
  ).flat();

  const hrs = { estudio:0, coaching:0, juego:0, revision:0, gym:0, libre:0, otros:0 };
  evs.forEach(e => {
    const h = parseFloat(e.hours) || 0;
    if (hrs[e.type] !== undefined) hrs[e.type] += h;
  });
  const total = Object.values(hrs).reduce((a, b) => a + b, 0);

  let bar = document.getElementById('stats-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'stats-bar';
    bar.className = 'stats-bar';
    document.getElementById('day-tabs').insertAdjacentElement('afterend', bar);
  }

  const items = [
    { label:'Total',    val: total.toFixed(1)+'h',          color:'' },
    { label:'Estudio',  val: hrs.estudio.toFixed(1)+'h',   color:'#3B8BD4' },
    { label:'Coaching', val: hrs.coaching.toFixed(1)+'h',  color:'#c9a227' },
    { label:'Juego',    val: hrs.juego.toFixed(1)+'h',     color:'#22a362' },
    { label:'Gym',      val: hrs.gym.toFixed(1)+'h',       color:'#e67e22' },
    { label:'Revisión', val: hrs.revision.toFixed(1)+'h',  color:'#8b5cf6' },
  ].filter(it => it.label === 'Total' || parseFloat(it.val) > 0);

  bar.innerHTML = items.map(it =>
    `<div class="stat-chip">${it.label}<span style="${it.color?'color:'+it.color:''}">${it.val}</span></div>`
  ).join('');
}

// ---- Schedule grid ----

const HOUR_START = 7;
const HOUR_END   = 24;
const PX_PER_HR  = 60;

function renderSchedule() {
  // Time column: top spacer + hour slots
  const timeCol = document.getElementById('time-col');
  timeCol.innerHTML =
    `<div class="time-col-top"></div>` +
    Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => {
      const h = HOUR_START + i;
      return `<div class="time-slot">${h < HOUR_END ? String(h).padStart(2,'0')+':00' : ''}</div>`;
    }).join('');

  // Days grid
  const daysGrid = document.getElementById('days-grid');
  daysGrid.style.gridTemplateColumns = `repeat(7, minmax(48px, 1fr))`;

  const SHORT = ['L','M','X','J','V','S','D'];

  daysGrid.innerHTML = Array.from({ length: 7 }, (_, dayIdx) => {
    const d       = addDays(weekStart, dayIdx);
    const ds      = toISO(d);
    const isToday = ds === TODAY;

    // Column header: date label + copy button
    const hd = `
      <div class="day-col-hd${isToday ? ' today-col-hd' : ''}">
        <span class="day-col-date">${SHORT[dayIdx]} ${d.getDate()}</span>
        <button class="copy-col-btn" onclick="openCopyModal('${ds}')" title="Copiar este día a otro">⧉</button>
      </div>`;

    // Hour rows (clickable to add)
    const rows = Array.from({ length: HOUR_END - HOUR_START }, (_, hi) => {
      const hour = HOUR_START + hi;
      return `<div class="hour-row" onclick="openAdd('${ds}', ${hour})"></div>`;
    }).join('');

    // Current time line
    let nowLine = '';
    if (isToday) {
      const now  = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const top  = (mins - HOUR_START * 60) * (PX_PER_HR / 60);
      if (top >= 0 && top <= (HOUR_END - HOUR_START) * PX_PER_HR)
        nowLine = `<div class="now-line" style="top:${top + 32}px"><div class="now-dot"></div></div>`;
    }

    // Event blocks
    const blocks = getEventsForDate(ds).map(e => renderEventBlock(e)).join('');

    return `<div class="day-col${isToday ? ' today-col' : ''}" id="daycol-${ds}">${hd}${rows}${nowLine}${blocks}</div>`;
  }).join('');
}

function renderEventBlock(e) {
  const startMins = timeToMinutes(e.time || '08:00');
  const endMins   = e.endTime
    ? timeToMinutes(e.endTime)
    : startMins + Math.round(parseFloat(e.hours || 1) * 60);

  // +32px offset to account for the column header
  const top    = Math.max(0, (startMins - HOUR_START * 60)) * (PX_PER_HR / 60) + 32;
  const height = Math.max(20, (endMins - startMins)) * (PX_PER_HR / 60);
  const color  = DOT_COLORS[e.type] || '#888';
  const title  = escapeHtml(e.desc || TYPE_LABELS[e.type] || e.type);
  const timeLbl = e.time ? e.time + (e.endTime ? '–' + e.endTime : '') : '';

  return `
    <div class="ev-block"
         style="top:${top}px;height:${height}px;background:${color}22;border-left-color:${color}"
         title="${title}">
      <div class="ev-block-title" style="color:${color}">${title}</div>
      ${height > 30 ? `<div class="ev-block-time">${timeLbl}</div>` : ''}
      <button class="ev-block-del" onclick="delEvent(event,'${e.id}')">×</button>
    </div>`;
}

// ---- Add event panel ----

function openAdd(ds, hour) {
  addTargetDate = ds;
  const d = new Date(ds + 'T12:00:00');
  document.getElementById('add-panel-date').textContent =
    d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
  document.getElementById('ev-time').value = String(hour).padStart(2,'0') + ':00';
  document.getElementById('ev-end').value  = String(Math.min(hour + 2, 23)).padStart(2,'0') + ':00';
  document.getElementById('ev-desc').value = '';
  document.getElementById('add-panel').classList.add('open');
  document.getElementById('panel-overlay').classList.add('open');
  document.getElementById('add-panel').style.display = 'block';
}

function closePanel() {
  document.getElementById('add-panel').classList.remove('open');
  document.getElementById('panel-overlay').classList.remove('open');
  setTimeout(() => { document.getElementById('add-panel').style.display = 'none'; }, 250);
}

function selectType(el) {
  document.querySelectorAll('.type-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  selectedType = el.dataset.type;
}

function addEvent() {
  if (!addTargetDate) { showToast('Selecciona un día'); return; }
  const time    = document.getElementById('ev-time').value;
  const endTime = document.getElementById('ev-end').value;
  const desc    = document.getElementById('ev-desc').value.trim();
  if (!time || !endTime) { showToast('Pon hora de inicio y fin'); return; }
  if (timeToMinutes(endTime) <= timeToMinutes(time)) {
    showToast('La hora fin debe ser después del inicio'); return;
  }
  const hours = (timeToMinutes(endTime) - timeToMinutes(time)) / 60;
  if (!state.calEvents) state.calEvents = [];
  state.calEvents.push({
    id:      Date.now().toString(),
    date:    addTargetDate,
    type:    selectedType,
    time, endTime,
    hours:   parseFloat(hours.toFixed(2)),
    desc,
  });
  saveState(state);
  showToast('Actividad añadida ✓');
  closePanel();
  render();
}

function delEvent(evt, id) {
  evt.stopPropagation();
  state.calEvents = (state.calEvents || []).filter(e => String(e.id) !== String(id));
  saveState(state);
  showToast('Eliminado');
  render();
}

// ---- Copy day modal ----

function openCopyModal(ds) {
  copySourceDate = ds;
  const d = new Date(ds + 'T12:00:00');

  // Header: source date
  document.getElementById('copy-modal-src').textContent =
    d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });

  // Default target: same day next week
  const nextWeekDate = toISO(addDays(d, 7));
  document.getElementById('copy-target-date').value = nextWeekDate;
  document.getElementById('copy-overwrite').checked = false;

  // Preview of events to copy
  const evs = getEventsForDate(ds);
  const preview = document.getElementById('copy-preview');
  if (evs.length) {
    preview.innerHTML = evs.map(e => {
      const color   = DOT_COLORS[e.type] || '#888';
      const timeLbl = e.time ? `${e.time}${e.endTime ? '–'+e.endTime : ''}` : `${e.hours}h`;
      const name    = escapeHtml(e.desc || TYPE_LABELS[e.type] || e.type);
      return `
        <div class="copy-preview-item">
          <div class="copy-preview-dot" style="background:${color}"></div>
          <span class="copy-preview-time">${timeLbl}</span>
          <span>${name}</span>
        </div>`;
    }).join('');
  } else {
    preview.innerHTML = `<div class="copy-preview-empty">Este día no tiene actividades</div>`;
  }

  // Show modal
  document.getElementById('copy-modal').style.display = 'block';
  document.getElementById('copy-modal-overlay').classList.add('open');
  requestAnimationFrame(() => {
    document.getElementById('copy-modal').classList.add('open');
  });
}

function closeCopyModal() {
  document.getElementById('copy-modal').classList.remove('open');
  document.getElementById('copy-modal-overlay').classList.remove('open');
  setTimeout(() => { document.getElementById('copy-modal').style.display = 'none'; }, 200);
}

function confirmCopy() {
  const targetDate = document.getElementById('copy-target-date').value;
  if (!targetDate)               { showToast('Elige un día destino'); return; }
  if (targetDate === copySourceDate) { showToast('El destino es el mismo que el origen'); return; }

  const evs = getEventsForDate(copySourceDate);
  if (!evs.length) { showToast('No hay actividades que copiar'); closeCopyModal(); return; }

  const overwrite = document.getElementById('copy-overwrite').checked;

  // Remove existing events on target if overwrite is checked
  if (overwrite) {
    state.calEvents = (state.calEvents || []).filter(e => e.date !== targetDate);
  }

  // Copy events with new IDs and target date
  const copies = evs.map(e => ({
    ...e,
    id:   String(Date.now()) + Math.random().toString(36).slice(2, 6),
    date: targetDate,
  }));

  if (!state.calEvents) state.calEvents = [];
  state.calEvents.push(...copies);
  saveState(state);

  const d = new Date(targetDate + 'T12:00:00');
  const label = d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
  showToast(`${copies.length} actividad${copies.length !== 1 ? 'es' : ''} copiada${copies.length !== 1 ? 's' : ''} al ${label}`);

  closeCopyModal();

  // If target is in current week, navigate to show it
  const targetD    = new Date(targetDate + 'T12:00:00');
  const targetMon  = getMondayOf(targetD);
  const curMon     = toISO(weekStart);
  if (toISO(targetMon) !== curMon) {
    weekStart = targetMon;
  }

  render();
}

// ---- Full render ----

function render() {
  renderHeader();
  renderDayTabs();
  renderStatsBar();
  renderSchedule();
  scrollToCurrentHour();
}

function scrollToCurrentHour() {
  const now  = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const top  = Math.max(0, (mins - HOUR_START * 60 - 60)) * (PX_PER_HR / 60);
  const outer = document.querySelector('.schedule-outer');
  if (outer) outer.scrollTop = top;
}

render();

// Update now-line every minute
setInterval(() => {
  document.querySelectorAll('.now-line').forEach(el => {
    const now  = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const top  = (mins - HOUR_START * 60) * (PX_PER_HR / 60) + 32;
    el.style.top = top + 'px';
  });
}, 60000);
