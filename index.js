// index.js — Dashboard (fullscreen day view)

let state    = loadState();
const today  = new Date();
const todayStr = todayISO();
let viewDate = todayStr;

// ---- Header date ----
(document.getElementById('today-label')||{}).textContent =
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

// ---- Nav badges ----
function renderNavBadges() {
  const pending = (state.lessons||[]).filter(l => !l.done).length;
  (document.getElementById('nav-clases')||{}).textContent  = pending ? pending + ' pend.' : 'Clases';
  const allH    = Object.values(state.habits||{}).flat();
  const habDone = allH.filter(h => h.done).length;
  (document.getElementById('nav-habitos')||{}).textContent = allH.length ? `${habDone}/${allH.length}` : 'Hábitos';
  const brTotal = (state.bankroll?.initial||0) + (state.bankroll?.weeks||[]).reduce((a,w)=>a+parseFloat(w.result||0),0);
  // nav-bankroll not in this HTML version
  (document.getElementById('nav-notas')||{}).textContent    = (state.notes||[]).length + ' Notas';
}

// ---- KPIs (week totals in hero) ----
function renderKPIs() {
  const week   = getWeekSessions();
  const totals = { estudio:0, coaching:0, juego:0 };
  week.forEach(s => { if (totals[s.type]!==undefined) totals[s.type]+=parseFloat(s.hours||0); });
  const total = Object.values(totals).reduce((a,b)=>a+b,0);
  const brTotal = (state.bankroll?.initial||0) + (state.bankroll?.weeks||[]).reduce((a,w)=>a+parseFloat(w.result||0),0);

  const elTotal = document.getElementById('stat-total');
  const elStudy = document.getElementById('stat-study');
  const elGame  = document.getElementById('stat-game');
  const elBr    = document.getElementById('br-display');
  if (elTotal) elTotal.textContent = total.toFixed(1) + 'h';
  if (elStudy) elStudy.textContent = totals.estudio.toFixed(1) + 'h';
  if (elGame)  elGame.textContent  = totals.juego.toFixed(1)   + 'h';
  if (elBr)    elBr.textContent    = '€' + brTotal.toFixed(0);
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
  (document.getElementById('day-nav-label')||{}).textContent = label;
}

// ---- Week strip ----
function renderWeekStrip() {
  const SHORT = ['L','M','X','J','V','S','D'];
  const mon   = getMondayOf(new Date(viewDate + 'T12:00:00'));
  (document.getElementById('day-strip')||{}).innerHTML = Array.from({ length: 7 }, (_, i) => {
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
  renderWeekChart();
  renderGoals();
  renderRecent();
}

renderAll();
initState(fresh => { state = fresh; renderAll(); });

// ---- Week chart ----
function renderWeekChart() {
  const DNAMES = ['L','M','X','J','V','S','D'];
  const dow = today.getDay(), mo = dow===0?6:dow-1;
  let maxH = 0; const bars = [];
  for (let i = 0; i < 7; i++) {
    const d  = new Date(today); d.setDate(today.getDate()-mo+i);
    const ds = dateISO(d);
    const hrs = (state.sessions||[]).filter(s=>s.date===ds).reduce((a,s)=>a+parseFloat(s.hours||0),0);
    if (hrs > maxH) maxH = hrs;
    bars.push({ label:DNAMES[i], hrs, isToday:ds===todayStr, ds });
  }
  if (maxH < 1) maxH = 1;
  const el = document.getElementById('week-chart');
  if (!el) return;
  el.innerHTML = bars.map(b => `
    <div class="wday" onclick="selectDay('${b.ds}')">
      <div class="wbar-wrap">
        <div class="wbar" style="height:${Math.max(2,(b.hrs/maxH)*64)}px;background:${b.isToday?'#3B8BD4':'var(--green-d)'}"></div>
      </div>
      <div class="wlbl" style="font-weight:${b.isToday?700:400};color:${b.isToday?'var(--text)':'var(--hint)'}">${b.label}</div>
    </div>`).join('');
}

// ---- Goals ----
function renderGoals() {
  const totals = window._weekTotals || { estudio:0, coaching:0, juego:0 };
  const GC = { estudio:'#3B8BD4', coaching:'var(--gold)', juego:'var(--green-l)' };
  const GL = { estudio:'Estudio', coaching:'Coaching', juego:'Juego' };
  const goals = state.goals || { estudio:10, coaching:3, juego:15 };
  const el = document.getElementById('goals-section');
  if (!el) return;
  el.innerHTML = Object.keys(goals).map(k => {
    const pct = Math.min(100, (totals[k]||0)/(goals[k]||1)*100);
    return `<div class="goal-row">
      <span class="gl">${GL[k]}</span>
      <div class="gb"><div class="gf" style="width:${pct}%;background:${GC[k]}"></div></div>
      <span class="gp">${Math.round(pct)}%</span>
    </div>
    <div class="goal-sub">${(totals[k]||0).toFixed(1)}h / ${goals[k]}h</div>`;
  }).join('');
}

// ---- Recent sessions ----
function renderRecent() {
  const sorted = [...(state.sessions||[])].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  const el = document.getElementById('recent-sessions');
  if (!el) return;
  if (!sorted.length) { el.innerHTML='<p class="empty-msg">Sin sesiones aún</p>'; return; }
  el.innerHTML = sorted.map(x => {
    const color = DOT_COLORS[x.type]||'#888';
    const label = TYPE_LABELS[x.type]||x.type;
    const stars = x.mental?'★'.repeat(x.mental):'';
    return `<div class="si">
      <div class="dot" style="background:${color}"></div>
      <div class="si-info">
        <div class="si-title">${escapeHtml(x.topic||label)}</div>
        <div class="si-meta">${x.date}${x.time?' · '+x.time:''}${stars?' · '+stars:''}</div>
      </div>
      <span class="si-hrs">${parseFloat(x.hours||0).toFixed(1)}h</span>
    </div>`;
  }).join('');
}
