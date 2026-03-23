// ============================================================
// shared.js — Poker Tracker + Supabase
// ============================================================

const SUPABASE_URL = 'https://dpuqrpptjtypoacslocd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdXFycHB0anR5cG9hY3Nsb2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTcxMjQsImV4cCI6MjA4OTg3MzEyNH0.RpkKpzK20oW504kxm2aBSRnwVbtRCe-e3ICkeJMnovg';
const TABLE        = 'poker_state';
const USER_ID      = 'default';
const LOCAL_KEY    = 'poker_tracker_v4';

// ---- Constants ----

const DOT_COLORS = {
  estudio:  '#3B8BD4',
  coaching: '#c9a227',
  juego:    '#22a362',
  revision: '#8b5cf6',
  libre:    '#9c9a94',
  gym:      '#e67e22',
  otros:    '#9c9a94',
};

const TYPE_LABELS = {
  estudio:  'Estudio',
  coaching: 'Coaching',
  juego:    'Grind',
  revision: 'Revisión',
  libre:    'Libre',
  gym:      'Gym',
  otros:    'Otros',
};

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_ES   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

// ---- Default state ----

function defaultState() {
  return {
    sessions:  [],
    calEvents: [],
    lessons: [
      { id:1, title:'Fundamentos 3-bet preflop',   cat:'preflop',  source:'Upswing Poker',   link:'', day:'', done:false },
      { id:2, title:'Bet sizing postflop strategy', cat:'postflop', source:'GTO Wizard',      link:'', day:'', done:false },
      { id:3, title:'Mental game & tilt control',   cat:'mental',   source:'Jared Tendler',   link:'', day:'', done:false },
    ],
    habits: {
      warmup: [
        { id:1, label:'Revisar stats sesión anterior',             streak:0, done:false },
        { id:2, label:'Ejercicio de respiración / mindfulness',    streak:0, done:false },
        { id:3, label:'Repasar 1 situación en solver',             streak:0, done:false },
      ],
      session: [
        { id:4, label:'Tomar notas de manos interesantes',         streak:0, done:false },
        { id:5, label:'No jugar tilteado (stop loss activo)',       streak:0, done:false },
        { id:6, label:'Cumplir las horas planificadas',            streak:0, done:false },
      ],
      colddown: [
        { id:7, label:'Revisar 2-3 manos del día',                 streak:0, done:false },
        { id:8, label:'Escribir nota/reflexión de sesión',          streak:0, done:false },
        { id:9, label:'Actualizar stats en tracker',               streak:0, done:false },
      ],
    },
    goals:    { estudio:10, coaching:3, juego:15 },
    bankroll: { initial:0, weeks:[] },
    notes:    [],
  };
}

function sanitize(p) {
  if (!p)                p = {};
  if (!p.sessions)       p.sessions   = [];
  if (!p.calEvents)      p.calEvents  = [];
  if (!p.lessons)        p.lessons    = [];
  if (!p.notes)          p.notes      = [];
  if (!p.bankroll)       p.bankroll   = { initial:0, weeks:[] };
  if (!p.bankroll.weeks) p.bankroll.weeks = [];
  if (!p.habits)         p.habits     = defaultState().habits;
  ['warmup','session','colddown'].forEach(k => { if (!p.habits[k]) p.habits[k] = []; });
  if (!p.goals)          p.goals      = { estudio:10, coaching:3, juego:15 };
  return p;
}

// ---- Supabase fetch wrapper ----

async function sbFetch(path, opts = {}) {
  const url = SUPABASE_URL + path;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type':  'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---- loadState — synchronous, reads localStorage cache ----

function loadState() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch(e) {}
  return defaultState();
}

// ---- initState — async, fetches from Supabase then calls render ----
// Use this at the top of every page instead of calling loadState() directly.
//
// Usage:
//   initState(state => {
//     // assign to your local state variable and render
//   });

async function initState(callback) {
  // 1. Render immediately from local cache (fast)
  const cached = loadState();
  if (callback) callback(cached);

  // 2. Fetch fresh data from Supabase
  setSyncDot('loading');
  try {
    const rows = await sbFetch(
      `/rest/v1/${TABLE}?user_id=eq.${USER_ID}&select=data&limit=1`
    );

    if (rows && rows.length && rows[0].data) {
      // Got fresh data — update cache and re-render
      const fresh = sanitize(rows[0].data);
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(fresh)); } catch(e) {}
      if (callback) callback(fresh);
      setSyncDot('ok');
    } else {
      // No row yet — insert current local state as starting point
      await sbFetch(`/rest/v1/${TABLE}`, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: USER_ID, data: cached, updated_at: new Date().toISOString() }),
      });
      setSyncDot('ok');
    }
  } catch(e) {
    console.warn('Supabase fetch failed, using cache:', e.message);
    setSyncDot('error');
  }
}

// ---- saveState — sync to localStorage + async push to Supabase ----

function saveState(s) {
  // Always save locally first (instant, no network needed)
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(s)); } catch(e) {}

  // Push to Supabase in background
  setSyncDot('saving');
  sbFetch(`/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: USER_ID, data: s, updated_at: new Date().toISOString() }),
  })
  .then(() => setSyncDot('ok'))
  .catch(e => {
    console.warn('Supabase save failed:', e.message);
    setSyncDot('error');
  });
}

// ---- Sync indicator dot ----

function setSyncDot(status) {
  let el = document.getElementById('sync-dot');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sync-dot';
    el.style.cssText = [
      'position:fixed', 'bottom:20px', 'right:16px', 'z-index:9000',
      'width:9px', 'height:9px', 'border-radius:50%',
      'transition:background .4s, opacity .6s',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(el);
  }
  const colors = { loading:'#c9a227', saving:'#c9a227', ok:'#22a362', error:'#E24B4A' };
  el.style.background = colors[status] || '#888';
  el.style.opacity    = status === 'ok' ? '0.5' : '1';
  el.title = { loading:'Cargando...', saving:'Guardando...', ok:'Sincronizado', error:'Sin conexión' }[status] || '';
}

// ---- Utilities ----

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getWeekNumber(dateStr) {
  const d      = new Date(dateStr + 'T12:00:00');
  const jan4   = new Date(d.getFullYear(), 0, 4);
  const startW = new Date(jan4);
  startW.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  return Math.floor((d - startW) / (7 * 86400000)) + 1;
}
