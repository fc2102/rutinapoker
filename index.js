// index.js — Dashboard

let state = loadState();
const today    = new Date();
const todayStr = todayISO();

// Currently viewed date
let viewDate = todayStr;

// ---- Header ----
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
  const date = new Date(d);
  const dow  = date.getDay();
  date.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1));
  return date;
}

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function getWeekSessions() {
  const mon = getMondayOf(today);
  mon.setHours(0,0,0,0);
  return (state.sessions || []).filter(s => {
    const d = new Date(s.date + 'T00:00:00');
    return d >= mon && d <= today;
  });
}

function timeToMins(str) {
  if (!str) return null;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + (m || 0);
}

// ---- Day navigation ----
function shiftDay(n) {
  const d = new Date(viewDate + 'T12:00:00');
  d.setDate(d.getDate() + n);
  viewDate = dateISO(d);
  renderDayView();
}

function goToday() {
  viewDate = todayStr;
  renderDayView();
}

function selectDay(ds) {
  viewDate = ds;
  renderDayView();
}

// ---- Day strip (Mon–Sun of viewDate's week) ----
function renderDayStrip() {
  const SHORT = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const mon   = getMondayOf(new Date(viewDate + 'T12:00:00'));
  const strip = document.getElementById('day-strip');
  strip.innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d   = addDays(mon, i);
    const ds  = dateISO(d);
    const evs = (state.calEvents || []).filter(e => e.date === ds);
    const ses = (state.sessions  || []).filter(s => s.date === ds);
    const all = [...evs, ...ses];
    const dots = all.slice(0, 4).map(e =>
      `<div class="dp-dot" style="background:${DOT_COLORS[e.type] || '#888'}"></div>`
    ).join('');
    const isTodayDay = ds === todayStr;
    const isSel      = ds === viewDate;
    return `
      <div class="day-pill${isTodayDay ? ' today-day' : ''}${isSel ? ' selected' : ''}" onclick="selectDay('${ds}')">
        <div class="dp-name">${SHORT[i]}</div>
        <div class="dp-num">${d.getDate()}</div>
        <div class="dp-dots">${dots}</div>
      </div>`;
  }).join('');
}

// ---- Day nav label ----
function renderDayLabel() {
  const d   = new Date(viewDate + 'T12:00:00');
  const isToday  = viewDate === todayStr;
  const label    = isToday
    ? 'Hoy'
    : d.toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' });
  document.getElementById('day-nav-label').textContent = label;
  document.getElementById('today-pill').style.display  = isToday ? 'none' : 'inline-flex';
}

// ---- Plan vs Realidad ----
function renderPlanVsReal() {
  const planned = (state.calEvents || []).filter(e => e.date === viewDate);
  const real    = (state.sessions  || []).filter(s => s.date === viewDate).map(s => ({...s}));
  const el      = document.getElementById('pvr-card');

  if (!planned.length && !real.length) {
    el.innerHTML = `<div class="pvr-empty">
      Sin plan ni sesiones este día.
      <a href="calendario.html">Planifica</a> o <a href="registrar.html">registra</a>.
    </div>`;
    return;
  }

  const rows   = [];
  const nowObj = new Date();
  const nowMins = viewDate === todayStr
    ? nowObj.getHours() * 60 + nowObj.getMinutes()
    : 24 * 60; // treat past days as fully elapsed

  // Planned items
  planned.forEach(ev => {
    const color   = DOT_COLORS[ev.type] || '#888';
    const label   = ev.desc || TYPE_LABELS[ev.type] || ev.type;
    const evStart = timeToMins(ev.time);
    const evEnd   = ev.endTime ? timeToMins(ev.endTime) : (evStart !== null ? evStart + Math.round((ev.hours||1)*60) : null);
    const timeStr = ev.time ? `${ev.time}${ev.endTime ? ' – '+ev.endTime : ''} · ${ev.hours}h` : `${ev.hours}h`;

    const match = real.find(s => s.type === ev.type && !s._matched);
    let badge, hoursStr = '';

    if (match) {
      match._matched = true;
      const realH = parseFloat(match.hours || 0);
      const planH = ev.hours || 0;
      const diff  = realH - planH;
      badge    = `<span class="pvr-badge done">✓ Hecho</span>`;
      hoursStr = `${realH.toFixed(1)}h / ${planH.toFixed(1)}h`;
      if (Math.abs(diff) >= 0.25) {
        hoursStr += diff > 0
          ? ` <span style="color:var(--green-l)">+${diff.toFixed(1)}h</span>`
          : ` <span style="color:var(--red)">${diff.toFixed(1)}h</span>`;
      }
    } else if (evEnd !== null && evEnd < nowMins) {
      badge    = `<span class="pvr-badge missed">✗ No hecho</span>`;
      hoursStr = `0 / ${ev.hours}h`;
    } else {
      badge    = `<span class="pvr-badge pending">⏳ Pendiente</span>`;
      hoursStr = `${ev.hours}h`;
    }

    rows.push(`
      <div class="pvr-row">
        <div class="pvr-dot" style="background:${color}"></div>
        <div class="pvr-info">
          <div class="pvr-title">${escapeHtml(label)}</div>
          <div class="pvr-time">${timeStr}</div>
        </div>
        <div class="pvr-status">
          ${badge}
          <span class="pvr-hours">${hoursStr}</span>
        </div>
      </div>`);
  });

  // Extra unplanned sessions
  real.filter(s => !s._matched).forEach(s => {
    const color = DOT_COLORS[s.type] || '#888';
    const label = s.topic || TYPE_LABELS[s.type] || s.type;
    rows.push(`
      <div class="pvr-row">
        <div class="pvr-dot" style="background:${color}"></div>
        <div class="pvr-info">
          <div class="pvr-title">${escapeHtml(label)}</div>
          <div class="pvr-time">${s.time ? s.time+' · ' : ''}${s.hours}h · no planificado</div>
        </div>
        <div class="pvr-status">
          <span class="pvr-badge extra">+ Extra</span>
          <span class="pvr-hours">${parseFloat(s.hours).toFixed(1)}h</span>
        </div>
      </div>`);
  });

  // Summary bar
  const planTotal = planned.reduce((a, e) => a + (e.hours||0), 0);
  const realTotal = real.reduce((a, s) => a + parseFloat(s.hours||0), 0);
  const pct       = planTotal > 0 ? Math.round(realTotal / planTotal * 100) : null;
  const pctColor  = pct === null ? '' : pct >= 80 ? 'var(--green-l)' : pct >= 50 ? 'var(--gold)' : 'var(--red)';

  const summary = planTotal > 0 ? `
    <div class="pvr-summary">
      <span class="pvr-sum-item"><span class="pvr-sum-dot" style="background:var(--hint)"></span>Plan: <strong>${planTotal.toFixed(1)}h</strong></span>
      <span class="pvr-sum-item"><span class="pvr-sum-dot" style="background:var(--green-l)"></span>Real: <strong>${realTotal.toFixed(1)}h</strong></span>
      ${pct !== null ? `<span style="margin-left:auto;color:${pctColor};font-weight:700;font-size:12px;font-family:var(--fm)">${pct}%</span>` : ''}
    </div>` : '';

  el.innerHTML = rows.join('') + summary;
}

function renderDayView() {
  renderDayLabel();
  renderDayStrip();
  renderPlanVsReal();
}

// ---- Week stats ----
const week   = getWeekSessions();
const totals = { estudio:0, coaching:0, juego:0 };
week.forEach(s => { if (totals[s.type] !== undefined) totals[s.type] += parseFloat(s.hours||0); });
document.getElementById('stat-study').textContent    = totals.estudio.toFixed(1)  + 'h';
document.getElementById('stat-coaching').textContent = totals.coaching.toFixed(1) + 'h';
document.getElementById('stat-game').textContent     = totals.juego.toFixed(1)    + 'h';

// ---- Nav badges ----
const pending    = (state.lessons||[]).filter(l => !l.done).length;
document.getElementById('nav-clases').textContent   = pending + ' pendientes';
const allHabits  = Object.values(state.habits||{}).flat();
const habitsDone = allHabits.filter(h => h.done).length;
document.getElementById('nav-habitos').textContent  = `${habitsDone}/${allHabits.length} hoy`;
const brTotal = (state.bankroll?.initial||0) + (state.bankroll?.weeks||[]).reduce((a,w) => a+parseFloat(w.result||0), 0);
document.getElementById('nav-bankroll').textContent = '€' + brTotal.toFixed(0);
document.getElementById('nav-notas').textContent    = (state.notes||[]).length + ' notas';

// ---- Week chart ----
const DNAMES    = ['L','M','X','J','V','S','D'];
const dow       = today.getDay();
const monOffset = dow === 0 ? 6 : dow - 1;
let maxH = 0;
const bars = [];
for (let i = 0; i < 7; i++) {
  const d  = new Date(today); d.setDate(today.getDate() - monOffset + i);
  const ds = dateISO(d);
  const hrs = (state.sessions||[]).filter(s => s.date === ds).reduce((a,s) => a + parseFloat(s.hours||0), 0);
  if (hrs > maxH) maxH = hrs;
  bars.push({ label: DNAMES[i], hrs, isToday: ds === todayStr, ds });
}
if (maxH < 1) maxH = 1;
document.getElementById('week-chart').innerHTML = bars.map(b => `
  <div class="wday" onclick="selectDay('${b.ds}')" style="cursor:pointer">
    <div class="wbar-wrap">
      <div class="wbar" style="height:${Math.max(2,(b.hrs/maxH)*52)}px;background:${b.isToday ? '#3B8BD4' : 'var(--green-d)'}"></div>
    </div>
    <div class="wlbl" style="font-weight:${b.isToday?700:400};color:${b.isToday?'var(--text)':'var(--hint)'}">${b.label}</div>
  </div>`).join('');

// ---- Goals ----
const GOAL_COLORS = { estudio:'#3B8BD4', coaching:'var(--gold)', juego:'var(--green-l)' };
const GOAL_LABELS = { estudio:'Estudio', coaching:'Coaching', juego:'Juego' };
const goals = state.goals || { estudio:10, coaching:3, juego:15 };
document.getElementById('goals-section').innerHTML = Object.keys(goals).map(k => {
  const pct = Math.min(100, (totals[k]||0) / (goals[k]||1) * 100);
  return `
    <div class="goal-row">
      <span class="gl">${GOAL_LABELS[k]}</span>
      <div class="gb"><div class="gf" style="width:${pct}%;background:${GOAL_COLORS[k]}"></div></div>
      <span class="gp">${Math.round(pct)}%</span>
    </div>
    <div class="goal-sub">${(totals[k]||0).toFixed(1)}h / ${goals[k]}h</div>`;
}).join('');

// ---- Recent sessions ----
const sorted = [...(state.sessions||[])].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,5);
if (sorted.length) {
  document.getElementById('recent-sessions').innerHTML = sorted.map(x => {
    const color = DOT_COLORS[x.type] || '#888';
    const label = TYPE_LABELS[x.type] || x.type;
    const stars = x.mental ? '★'.repeat(x.mental) : '';
    return `
      <div class="si">
        <div class="dot" style="background:${color}"></div>
        <div class="si-info">
          <div class="si-title">${escapeHtml(x.topic||label)}</div>
          <div class="si-meta">${x.date}${x.time?' · '+x.time:''}${stars?' · '+stars:''}</div>
        </div>
        <span class="si-hrs">${parseFloat(x.hours||0).toFixed(1)}h</span>
      </div>`;
  }).join('');
}

// ---- Init ----
renderDayView(); // render from cache immediately
initState(fresh => { state = fresh; renderDayView(); }); // then refresh from Supabase
