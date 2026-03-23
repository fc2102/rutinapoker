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

// Returns a "weight" score for a state object — more data = higher score.
// Used to avoid overwriting richer data with emptier data.
function stateWeight(p) {
  if (!p) return 0;
  return (
    (p.sessions   || []).length * 3 +
    (p.calEvents  || []).length * 3 +
    (p.lessons    || []).length * 2 +
    (p.notes      || []).length * 2 +
    Object.values(p.habits || {}).flat().length +
    ((p.bankroll && p.bankroll.weeks) ? p.bankroll.weeks.length * 2 : 0)
  );
}

// Save a timestamped backup to localStorage (keeps last 3)
function saveBackup(data, source) {
  try {
    const key = LOCAL_KEY + '_backups';
    let backups = [];
    try { backups = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) {}
    backups.unshift({ ts: new Date().toISOString(), source, data });
    backups = backups.slice(0, 3); // keep only last 3
    localStorage.setItem(key, JSON.stringify(backups));
  } catch(e) {}
}

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
      const remote = sanitize(rows[0].data);
      const remoteW = stateWeight(remote);
      const cachedW = stateWeight(cached);

      // Safety check: only use remote if it has more or equal data than local cache.
      // This prevents an empty remote from wiping out a rich local state.
      if (remoteW >= cachedW) {
        saveBackup(remote, 'supabase');
        try { localStorage.setItem(LOCAL_KEY, JSON.stringify(remote)); } catch(e) {}
        if (callback) callback(remote);
      } else {
        // Local cache is richer — push it to Supabase to fix the remote
        console.warn(`Local richer (${cachedW}) than remote (${remoteW}) — pushing local to Supabase`);
        saveBackup(cached, 'local-push');
        await sbFetch(`/rest/v1/${TABLE}`, {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ user_id: USER_ID, data: cached, updated_at: new Date().toISOString() }),
        });
        if (callback) callback(cached);
      }
      setSyncDot('ok');
    } else {
      // No row in Supabase yet — create it
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
  // Guard: never save an empty-ish state if current state is richer
  const current = loadState();
  if (stateWeight(s) < stateWeight(current) - 5) {
    console.warn('saveState blocked: new state is significantly emptier than current. Diff:', stateWeight(current) - stateWeight(s));
    return;
  }

  // Save backup before overwriting
  saveBackup(current, 'pre-save');

  // Save to localStorage immediately
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

// ---- Backup recovery (call from browser console if needed) ----
// Usage: restoreBackup(0)  → restores most recent backup
//        listBackups()     → shows all saved backups

function listBackups() {
  try {
    const backups = JSON.parse(localStorage.getItem(LOCAL_KEY + '_backups') || '[]');
    backups.forEach((b, i) => {
      const w = stateWeight(b.data);
      console.log(`[${i}] ${b.ts} | source: ${b.source} | weight: ${w} | calEvents: ${(b.data.calEvents||[]).length} | sessions: ${(b.data.sessions||[]).length}`);
    });
    return backups;
  } catch(e) { console.error(e); }
}

async function restoreBackup(index = 0) {
  try {
    const backups = JSON.parse(localStorage.getItem(LOCAL_KEY + '_backups') || '[]');
    if (!backups[index]) { console.error('No backup at index', index); return; }
    const data = backups[index].data;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    await sbFetch(`/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: USER_ID, data, updated_at: new Date().toISOString() }),
    });
    console.log('Backup restored. Reload the page.');
  } catch(e) { console.error('Restore failed:', e); }
}
