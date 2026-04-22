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

// ---- Cards render ----
function renderCards() {
  const planned = (state.calEvents||[])
    .filter(e => e.date === viewDate)
    .sort((a,b) => (timeToMins(a.time)??9999) - (timeToMins(b.time)??9999));
  const real = (state.sessions||[]).filter(s => s.date === viewDate).map(s => ({...s}));
  const el   = document.getElementById('pvr-card');

  if (!planned.length && !real.length) {
    el.innerHTML = `<div class="pvr-empty-screen">
      <div class="pvr-empty-icon">📋</div>
      <div class="pvr-empty-title">Sin actividades este día</div>
      <div class="pvr-empty-sub">Planifica tu día en el horario<br>o registra una sesión</div>
      <div class="pvr-empty-btns">
        <a class="pvr-empty-btn" href="calendario.html">📅 Planificar</a>
        <a class="pvr-empty-btn" href="registrar.html">📝 Registrar</a>
      </div>
    </div>`;
    return;
  }

  const nowMins = viewDate === todayStr
    ? today.getHours() * 60 + today.getMinutes()
    : 24 * 60;

  const cards = [];
  let doneCount = 0, missedCount = 0, pendCount = 0;
  let planTotal = 0, realTotal = 0;

  // Planned event cards
  planned.forEach(ev => {
    const color  = DOT_COLORS[ev.type] || '#888';
    const label  = ev.desc || TYPE_LABELS[ev.type] || ev.type;
    const evS    = timeToMins(ev.time);
    const evE    = ev.endTime ? timeToMins(ev.endTime) : (evS !== null ? evS + Math.round((ev.hours||1)*60) : null);
    const timeStr = ev.time
      ? `${ev.time}${ev.endTime ? ' – ' + ev.endTime : ''}`
      : '';
    const match  = real.find(s => s.type === ev.type && !s._matched);
    const planH  = ev.hours || 0;
    planTotal += planH;

    let status, realH = 0, diff = 0;
    if (match) {
      match._matched = true;
      realH   = parseFloat(match.hours || 0);
      diff    = realH - planH;
      status  = 'done'; doneCount++;
      realTotal += realH;
    } else if (evE !== null && evE < nowMins) {
      status = 'missed'; missedCount++;
    } else {
      status = 'pending'; pendCount++;
    }

    const barPct = status === 'done' && planH > 0
      ? Math.min(100, (realH / planH) * 100) : 0;

    const badgeHtml = {
      done:    `<span class="act-badge badge-done">✓ Hecho</span>`,
      missed:  `<span class="act-badge badge-missed">✗ No hecho</span>`,
      pending: `<span class="act-badge badge-pending">Pendiente</span>`,
    }[status];

    const hoursHtml = status === 'done'
      ? `<div class="act-hours-row">
           <div class="act-hours-real">${realH.toFixed(1)}h</div>
           <div class="act-hours-plan">/ ${planH.toFixed(1)}h plan</div>
           ${Math.abs(diff) >= 0.25
             ? `<div class="act-hours-diff ${diff>0?'diff-pos':'diff-neg'}">${diff>0?'+':''}${diff.toFixed(1)}h</div>`
             : ''}
         </div>
         <div class="act-progress"><div class="act-progress-fill" style="width:${barPct}%;background:${color}"></div></div>`
      : status === 'missed'
        ? `<div class="act-hours-row"><div class="act-hours-real" style="color:var(--red)">0h</div><div class="act-hours-plan">/ ${planH.toFixed(1)}h plan</div></div>`
        : `<div class="act-hours-row"><div class="act-hours-real" style="color:var(--hint)">${planH.toFixed(1)}h</div><div class="act-hours-plan">planificado</div></div>`;

    cards.push(`
      <div class="act-card ${status}">
        <div class="act-card-bar" style="background:${color}"></div>
        <div class="act-card-body">
          <div class="act-card-top">
            <div class="act-card-left">
              <div class="act-name">${escapeHtml(label)}</div>
              ${timeStr ? `<div class="act-time">${timeStr} · ${planH}h</div>` : ''}
            </div>
            ${badgeHtml}
          </div>
          ${hoursHtml}
        </div>
      </div>`);
  });

  // Extra (unplanned) session cards
  real.filter(s => !s._matched).forEach(s => {
    const color  = DOT_COLORS[s.type] || '#888';
    const label  = s.topic || TYPE_LABELS[s.type] || s.type;
    const realH  = parseFloat(s.hours || 0);
    realTotal += realH;
    cards.push(`
      <div class="act-card extra">
        <div class="act-card-bar" style="background:${color}"></div>
        <div class="act-card-body">
          <div class="act-card-top">
            <div class="act-card-left">
              <div class="act-name">${escapeHtml(label)}</div>
              ${s.time ? `<div class="act-time">${s.time} · ${realH.toFixed(1)}h</div>` : ''}
            </div>
            <span class="act-badge badge-extra">+ Extra</span>
          </div>
          <div class="act-hours-row">
            <div class="act-hours-real">${realH.toFixed(1)}h</div>
            <div class="act-hours-plan">no planificado</div>
          </div>
        </div>
      </div>`);
  });

  // Summary card at bottom
  const pct   = planTotal > 0 ? Math.round(realTotal / planTotal * 100) : null;
  const pctC  = pct === null ? 'var(--muted)' : pct >= 80 ? 'var(--green-l)' : pct >= 50 ? 'var(--gold)' : 'var(--red)';
  const summary = `
    <div class="pvr-summary-strip">
      <div class="pvr-sum-chips">
        ${doneCount  > 0 ? `<span class="pvr-sum-chip chip-done">✓ ${doneCount} hecho${doneCount!==1?'s':''}</span>` : ''}
        ${missedCount> 0 ? `<span class="pvr-sum-chip chip-missed">✗ ${missedCount} perdido${missedCount!==1?'s':''}</span>` : ''}
        ${pendCount  > 0 ? `<span class="pvr-sum-chip chip-pend">${pendCount} pendiente${pendCount!==1?'s':''}</span>` : ''}
        ${real.filter(s=>!s._matched).length > 0 ? `<span class="pvr-sum-chip" style="color:#3B8BD4">+${real.filter(s=>!s._matched).length} extra</span>` : ''}
      </div>
      ${pct !== null ? `<div class="pvr-pct" style="color:${pctC}">${pct}%</div>` : ''}
    </div>`;

  el.innerHTML = cards.join('') + summary;
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
