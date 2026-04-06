// stats.js

let state = loadState();
initState(fresh => { state = fresh; render(); });

const todayD  = new Date();
const TODAY   = todayISO();

let mode   = 'week';  // 'week' | 'month'
let offset = 0;       // 0 = current, -1 = prev, +1 = next

// ---- Date helpers ----

function localISO(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

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

// ---- Period boundaries ----

function getPeriod() {
  if (mode === 'week') {
    const base = getMondayOf(todayD);
    const mon  = addDays(base, offset * 7);
    const sun  = addDays(mon, 6);
    return { start: localISO(mon), end: localISO(sun), mon, sun };
  } else {
    // month
    const ref = new Date(todayD.getFullYear(), todayD.getMonth() + offset, 1);
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end   = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { start: localISO(start), end: localISO(end), ref, start, end };
  }
}

function sessionsInPeriod(p) {
  return (state.sessions || []).filter(s => s.date >= p.start && s.date <= p.end);
}

// ---- Navigation ----

function setMode(m) {
  mode   = m;
  offset = 0;
  document.querySelectorAll('.mode-pill').forEach(p =>
    p.classList.toggle('active', p.dataset.mode === m)
  );
  render();
}

function shiftPeriod(n) { offset += n; render(); }
function goCurrent()    { offset = 0;  render(); }

// ---- Period label ----

function renderNav() {
  const p   = getPeriod();
  const now = document.getElementById('pnav-now');

  if (mode === 'week') {
    const wn  = getWeekNumber(p.start);
    const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short' });
    document.getElementById('pnav-label').textContent =
      offset === 0 ? 'Esta semana' : `Sem. ${wn} · ${fmt(p.start)}–${fmt(p.end)}`;
    document.getElementById('period-label').textContent =
      `Semana ${wn} · ${fmt(p.start)} – ${fmt(p.end)}`;
  } else {
    const ref  = p.ref;
    const name = `${MONTHS_ES[ref.getMonth()]} ${ref.getFullYear()}`;
    document.getElementById('pnav-label').textContent = offset === 0 ? 'Este mes' : name;
    document.getElementById('period-label').textContent = name;
  }

  now.classList.toggle('hidden', offset === 0);
}

// ---- Totals ----

function renderTotals(sessions) {
  const totalH  = sessions.reduce((a, s) => a + parseFloat(s.hours || 0), 0);
  const studyH  = sessions.filter(s => s.type === 'estudio').reduce((a, s) => a + parseFloat(s.hours || 0), 0);
  const gameH   = sessions.filter(s => s.type === 'juego').reduce((a, s) => a + parseFloat(s.hours || 0), 0);
  const avgMental = sessions.filter(s => s.mental).length
    ? (sessions.filter(s => s.mental).reduce((a, s) => a + s.mental, 0) / sessions.filter(s => s.mental).length).toFixed(1)
    : '—';

  const el = document.getElementById('totals-grid');
  el.innerHTML = `
    <div class="total-card">
      <div class="total-val" style="color:var(--green-l)">${totalH.toFixed(1)}h</div>
      <div class="total-lbl">Total</div>
      <div class="total-sub">${sessions.length} sesión${sessions.length !== 1 ? 'es' : ''}</div>
    </div>
    <div class="total-card">
      <div class="total-val" style="color:#3B8BD4">${studyH.toFixed(1)}h</div>
      <div class="total-lbl">Estudio</div>
      <div class="total-sub">${sessions.filter(s=>s.type==='estudio').length} ses.</div>
    </div>
    <div class="total-card">
      <div class="total-val" style="color:var(--gold)">${avgMental}★</div>
      <div class="total-lbl">Mental</div>
      <div class="total-sub">media</div>
    </div>`;
}

// ---- Bar chart ---- 
// Shows hours per sub-period: days within week, or weeks within month

function renderChart(sessions, period) {
  const el    = document.getElementById('bar-chart');
  const legEl = document.getElementById('chart-legend');

  let bars = [];

  if (mode === 'week') {
    // 7 days
    document.getElementById('chart-label').textContent = 'Horas por día';
    const DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    bars = Array.from({ length: 7 }, (_, i) => {
      const d   = addDays(new Date(period.start + 'T12:00:00'), i);
      const ds  = localISO(d);
      const hrs = sessions.filter(s => s.date === ds).reduce((a, s) => a + parseFloat(s.hours || 0), 0);
      return { label: DAYS[i], hrs, ds, isCurrent: ds === TODAY };
    });
  } else {
    // Weeks within month
    document.getElementById('chart-label').textContent = 'Horas por semana';
    const monthStart = new Date(period.start + 'T12:00:00');
    const monthEnd   = new Date(period.end   + 'T12:00:00');
    let cursor       = getMondayOf(monthStart);
    while (cursor <= monthEnd) {
      const wStart = localISO(cursor);
      const wEnd   = localISO(addDays(cursor, 6));
      const wn     = getWeekNumber(wStart);
      const hrs    = sessions
        .filter(s => s.date >= wStart && s.date <= wEnd)
        .reduce((a, s) => a + parseFloat(s.hours || 0), 0);
      const curWeekStart = localISO(getMondayOf(todayD));
      bars.push({ label: `S${wn}`, hrs, isCurrent: wStart === curWeekStart });
      cursor = addDays(cursor, 7);
    }
  }

  const maxH = Math.max(...bars.map(b => b.hrs), 0.1);

  el.innerHTML = bars.map(b => {
    const h    = Math.max(2, (b.hrs / maxH) * 88);
    const color = b.hrs > 0 ? 'var(--green-d)' : 'var(--bg2)';
    const valHtml = b.hrs > 0 ? `<div class="bar-val">${b.hrs.toFixed(1)}</div>` : '';
    return `
      <div class="bar-col">
        <div class="bar-wrap">
          <div class="bar-fill" style="height:${h}px;background:${color}">
            ${valHtml}
          </div>
        </div>
        <div class="bar-lbl${b.isCurrent ? ' current' : ''}">${b.label}</div>
      </div>`;
  }).join('');

  // Legend
  legEl.innerHTML = `
    <div class="cleg"><div class="cleg-dot" style="background:var(--green-d)"></div>Horas totales</div>`;
}

// ---- Type breakdown ----

function renderBreakdown(sessions) {
  const types = [
    { key:'estudio',  label:'Estudio',   color:'#3B8BD4' },
    { key:'coaching', label:'Coaching',  color:'#c9a227' },
    { key:'juego',    label:'Grind',     color:'#22a362' },
    { key:'revision', label:'Revisión',  color:'#8b5cf6' },
    { key:'gym',      label:'Gym',       color:'#e67e22' },
    { key:'otros',    label:'Otros',     color:'#9c9a94' },
  ];

  const totalH = sessions.reduce((a, s) => a + parseFloat(s.hours || 0), 0);
  const el     = document.getElementById('breakdown');

  const rows = types.map(t => {
    const typeSess = sessions.filter(s => s.type === t.key);
    const hrs      = typeSess.reduce((a, s) => a + parseFloat(s.hours || 0), 0);
    if (!hrs && !typeSess.length) return '';
    const pct = totalH > 0 ? (hrs / totalH * 100) : 0;
    return `
      <div class="bk-row">
        <div class="bk-dot" style="background:${t.color}"></div>
        <span class="bk-label">${t.label}</span>
        <div class="bk-bar-wrap"><div class="bk-bar" style="width:${pct}%;background:${t.color}"></div></div>
        <span class="bk-hrs" style="color:${t.color}">${hrs.toFixed(1)}h</span>
        <span class="bk-count">${typeSess.length} ses.</span>
      </div>`;
  }).filter(Boolean).join('');

  el.innerHTML = rows ||
    `<p style="color:var(--hint);font-size:13px;text-align:center;padding:.75rem 0">Sin sesiones en este período</p>`;
}

// ---- Session list ----

function renderSessions(sessions) {
  const el     = document.getElementById('session-list');
  const sorted = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!sorted.length) {
    el.innerHTML = `<div class="empty-period">Sin sesiones en este período</div>`;
    return;
  }

  el.innerHTML = sorted.map(s => {
    const color = DOT_COLORS[s.type] || '#888';
    const label = TYPE_LABELS[s.type] || s.type;
    const stars = s.mental ? '★'.repeat(s.mental) : '';
    return `
      <div class="sess-card">
        <div class="sess-top">
          <div class="sess-dot" style="background:${color}"></div>
          <div class="sess-info">
            <div class="sess-title">${escapeHtml(s.topic || label)}</div>
            <div class="sess-meta">${s.date}${s.time?' · '+s.time:''}${stars?' · '+stars:''} · ${label}</div>
            ${s.notes ? `<div class="sess-note">${escapeHtml(s.notes)}</div>` : ''}
          </div>
          <span class="sess-hrs">${parseFloat(s.hours||0).toFixed(1)}h</span>
        </div>
      </div>`;
  }).join('');
}

// ---- Full render ----

function render() {
  renderNav();
  const period   = getPeriod();
  const sessions = sessionsInPeriod(period);
  renderTotals(sessions);
  renderChart(sessions, period);
  renderBreakdown(sessions);
  renderSessions(sessions);
}

render();
