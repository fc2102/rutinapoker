// index.js — Dashboard (fullscreen day view)

let state    = loadState();
const today  = new Date();
const todayStr = todayISO();
let viewDate = todayStr;

// ---- Header date ----
document.getElementById('today-label').textContent =
  `${DAYS_ES[today.getDay()]} · ${today.toLocaleDateString('es-ES', { day:'numeric', month:'long', year:'numeric' })}`;

// ---- Helpers ----
function dateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function getMondayOf(d) {
  const r = new Date(d); const dow = r.getDay();
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1));
  return r;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function timeToMins(str) {
  if (!str) return null;
  const [h, m] = str.split(':').map(Number); return h * 60 + (m || 0);
}
function getWeekSessions() {
  const mon = getMondayOf(today); mon.setHours(0,0,0,0);
  return (state.sessions||[]).filter(s => {
    const d = new Date(s.date + 'T00:00:00'); return d >= mon && d <= today;
  });
}

// ---- More menu ----
function toggleMore() {
  document.getElementById('more-menu').classList.toggle('open');
  document.getElementById('more-overlay').classList.toggle('open');
}

// ---- Nav badges ----
function renderNavBadges() {
  const pending = (state.lessons||[]).filter(l => !l.done).length;
  document.getElementById('nav-clases').textContent  = pending ? pending + ' pend.' : 'Clases';
  const allH    = Object.values(state.habits||{}).flat();
  const habDone = allH.filter(h => h.done).length;
  document.getElementById('nav-habitos').textContent = allH.length ? `${habDone}/${allH.length}` : 'Hábitos';
  const brTotal = (state.bankroll?.initial||0) + (state.bankroll?.weeks||[]).reduce((a,w)=>a+parseFloat(w.result||0),0);
  document.getElementById('nav-bankroll').textContent = '€' + brTotal.toFixed(0) + ' Bankroll';
  document.getElementById('nav-notas').textContent    = (state.notes||[]).length + ' Notas';
}

// ---- KPIs (week totals in hero) ----
function renderKPIs() {
  const week   = getWeekSessions();
  const totals = { estudio:0, coaching:0, juego:0 };
  week.forEach(s => { if (totals[s.type]!==undefined) totals[s.type]+=parseFloat(s.hours||0); });
  const total = Object.values(totals).reduce((a,b)=>a+b,0);
  document.getElementById('hero-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-val">${total.toFixed(1)}h</div><div class="kpi-lbl">Semana</div></div>
    <div class="kpi"><div class="kpi-val">${totals.estudio.toFixed(1)}h</div><div class="kpi-lbl">Estudio</div></div>
    <div class="kpi"><div class="kpi-val">${totals.coaching.toFixed(1)}h</div><div class="kpi-lbl">Coaching</div></div>
    <div class="kpi"><div class="kpi-val">${totals.juego.toFixed(1)}h</div><div class="kpi-lbl">Grind</div></div>`;
  window._weekTotals = totals;
}

// ---- Day navigation ----
function shiftDay(n) {
  const d = new Date(viewDate + 'T12:00:00'); d.setDate(d.getDate() + n);
  viewDate = dateISO(d); renderDayView();
}
function goToday()     { viewDate = todayStr; renderDayView(); }
function selectDay(ds) { viewDate = ds; renderDayView(); }

// ---- Day label ----
function renderDayLabel() {
  const d       = new Date(viewDate + 'T12:00:00');
  const isToday = viewDate === todayStr;
  const isTomorrow = viewDate === dateISO(addDays(today, 1));
  const isYesterday = viewDate === dateISO(addDays(today, -1));
  let label;
  if (isToday) label = 'Hoy · ' + d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
  else if (isTomorrow) label = 'Mañana · ' + d.toLocaleDateString('es-ES', { day:'numeric', month:'long' });
  else if (isYesterday) label = 'Ayer · ' + d.toLocaleDateString('es-ES', { day:'numeric', month:'long' });
  else label = d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
  document.getElementById('day-nav-label').textContent = label;
}

// ---- Week strip ----
function renderWeekStrip() {
  const SHORT = ['L','M','X','J','V','S','D'];
  const mon   = getMondayOf(new Date(viewDate + 'T12:00:00'));
  document.getElementById('day-strip').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d   = addDays(mon, i);
    const ds  = dateISO(d);
    const evs = [...(state.calEvents||[]).filter(e=>e.date===ds), ...(state.sessions||[]).filter(s=>s.date===ds)];
    const dots = evs.slice(0,3).map(e=>`<div class="dp-dot" style="background:${DOT_COLORS[e.type]||'#888'}"></div>`).join('');
    const cls  = `dp${ds===todayStr?' tod':''}${ds===viewDate?' sel':''}`;
    return `<div class="${cls}" onclick="selectDay('${ds}')">
      <div class="dp-d">${SHORT[i]}</div>
      <div class="dp-n">${d.getDate()}</div>
      <div class="dp-dots">${dots}</div>
    </div>`;
  }).join('');
}

// ---- Plan vs realidad ----
function renderCards() {
  const planned = (state.calEvents||[]).filter(e => e.date === viewDate);
  const real    = (state.sessions||[]).filter(s => s.date === viewDate);
  const el      = document.getElementById('pvr-card');

  if (!planned.length && !real.length) {
    el.innerHTML = `<div class="pvr-empty-screen">
      <div class="pvr-empty-icon">📋</div>
      <div class="pvr-empty-title">Sin actividades este día</div>
      <div class="pvr-empty-btns">
        <a class="pvr-empty-btn" href="calendario.html">📅 Planificar</a>
        <a class="pvr-empty-btn" href="registrar.html">📝 Registrar</a>
      </div>
    </div>`;
    return;
  }

  // Total horas reales hoy
  const totalReal = real.reduce((a,s) => a + parseFloat(s.hours||0), 0);

  // Agrupar sesiones reales por tipo
  const byType = {};
  real.forEach(s => {
    if (!byType[s.type]) byType[s.type] = { hrs:0, sessions:[] };
    byType[s.type].hrs += parseFloat(s.hours||0);
    byType[s.type].sessions.push(s);
  });

  // Número grande de horas
  const bigHours = `<div class="pvr-big-block">
    <div class="pvr-big-num">${totalReal.toFixed(1)}<span class="pvr-big-unit">h</span></div>
    <div class="pvr-big-sub">hoy${real.length > 1 ? ' · ' + real.length + ' sesiones' : ''}</div>
  </div>`;

  // Tipos con horas
  const typeChips = Object.entries(byType).map(([type, data]) => {
    const color = DOT_COLORS[type] || '#888';
    const label = TYPE_LABELS[type] || type;
    return `<div class="pvr-chip" style="border-color:${color}20;background:${color}10">
      <span class="pvr-chip-dot" style="background:${color}"></span>
      <span class="pvr-chip-label">${label}</span>
      <span class="pvr-chip-hrs" style="color:${color}">${data.hrs.toFixed(1)}h</span>
    </div>`;
  }).join('');

  // Sesiones individuales ordenadas por hora
  const sessList = [...real]
    .sort((a,b) => (a.time||'').localeCompare(b.time||''))
    .map(s => {
      const color = DOT_COLORS[s.type]||'#888';
      const label = s.topic || TYPE_LABELS[s.type] || s.type;
      const stars = s.mental ? '★'.repeat(s.mental) : '';
      const mentalColor = ['','#E24B4A','#e67e22','#c9a227','#22a362','#1a7a4a'][s.mental] || 'var(--hint)';
      return `<div class="pvr-sess-row">
        <div class="pvr-sess-dot" style="background:${color}"></div>
        <div class="pvr-sess-info">
          <span class="pvr-sess-name">${escapeHtml(label)}</span>
          ${s.time ? `<span class="pvr-sess-time">${s.time}</span>` : ''}
          ${stars ? `<span class="pvr-sess-stars" style="color:${mentalColor}">${stars}</span>` : ''}
        </div>
        <span class="pvr-sess-h">${parseFloat(s.hours).toFixed(1)}h</span>
      </div>`;
    }).join('');

  // Lo que había planificado y no se hizo
  const plannedTypes = planned.map(e => e.type);
  const realTypes    = Object.keys(byType);
  const notDone      = planned.filter(e => !realTypes.includes(e.type));
  const nowMins      = viewDate === todayStr
    ? today.getHours()*60+today.getMinutes() : 24*60;

  const notDoneHtml = notDone.length ? `<div class="pvr-notdone">
    ${notDone.map(e => {
      const evE  = e.endTime ? e.endTime.split(':').map(Number).reduce((h,m)=>h*60+m,0) : null;
      const past = evE !== null && evE < nowMins;
      const color = DOT_COLORS[e.type]||'#888';
      const label = e.desc || TYPE_LABELS[e.type] || e.type;
      return `<div class="pvr-notdone-row${past?' past':''}">
        <span class="pvr-notdone-dot" style="background:${color}"></span>
        <span class="pvr-notdone-label">${escapeHtml(label)}</span>
        <span class="pvr-notdone-hrs">${e.hours}h</span>
      </div>`;
    }).join('')}
  </div>` : '';

  el.innerHTML =
    bigHours +
    (typeChips ? `<div class="pvr-chips">${typeChips}</div>` : '') +
    (sessList  ? `<div class="pvr-sess-list">${sessList}</div>` : '') +
    notDoneHtml;
}

function renderDayView() {
  renderDayLabel();
  renderWeekStrip();
  renderCards();
}

// ---- Full render ----
function renderAll() {
  renderNavBadges();
  renderKPIs();
  renderDayView();
}

renderAll();
initState(fresh => { state = fresh; renderAll(); });
