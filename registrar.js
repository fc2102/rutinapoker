// registrar.js

const MENTAL_LABELS = ['','Muy mal','Mal','Neutral','Bien','Excelente'];
const MENTAL_COLORS = ['','#E24B4A','#e67e22','#c9a227','#22a362','#1a7a4a'];

let state = loadState();
initState(fresh => { state = fresh; renderHistory(); });

document.getElementById('log-date').value = todayISO();
let mental      = 3;
let logType     = 'estudio';
let deleteId    = null;

// ---- Type selector ----
function selectType(el) {
  document.querySelectorAll('.type-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  logType = el.dataset.type;
}

// ---- Duration presets ----
function setHours(h) {
  document.getElementById('log-hours').value = h;
  document.querySelectorAll('.dur-btn').forEach(b => {
    b.classList.toggle('active', parseFloat(b.textContent) === h ||
      (b.textContent === '30m' && h === 0.5));
  });
}

// Sync preset buttons when input changes manually
document.getElementById('log-hours').addEventListener('input', function() {
  const v = parseFloat(this.value);
  document.querySelectorAll('.dur-btn').forEach(b => {
    const bv = b.textContent === '30m' ? 0.5 : parseFloat(b.textContent);
    b.classList.toggle('active', bv === v);
  });
});

// ---- Mental ----
function setMental(v) {
  mental = v;
  document.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.v) <= v);
  });
  const lbl = document.getElementById('mental-label');
  lbl.textContent  = MENTAL_LABELS[v];
  lbl.style.color  = MENTAL_COLORS[v];
}

// ---- Save ----
function logSession() {
  const hours = parseFloat(document.getElementById('log-hours').value);
  const date  = document.getElementById('log-date').value;
  const time  = document.getElementById('log-time').value;
  const topic = document.getElementById('log-topic').value.trim();
  const notes = document.getElementById('log-notes').value.trim();
  if (!hours || !date) { showToast('Rellena duración y fecha'); return; }
  state.sessions.push({ id: Date.now(), type: logType, hours, date, time, topic, notes, mental });
  saveState(state);
  showToast('Sesión registrada ✓');
  document.getElementById('log-topic').value = '';
  document.getElementById('log-notes').value = '';
  setMental(3);
  renderHistory();
  // Scroll to history
  document.getElementById('history-list').scrollIntoView({ behavior:'smooth', block:'start' });
}

// ---- Delete with confirm ----
function deleteSession(id) {
  deleteId = id;
  const s   = state.sessions.find(x => x.id === id);
  const lbl = s ? `${s.date} · ${TYPE_LABELS[s.type]||s.type}${s.topic?' · '+s.topic:''}` : '';
  document.getElementById('confirm-desc').textContent = lbl;
  document.getElementById('confirm-modal').style.display = 'block';
  document.getElementById('confirm-overlay').classList.add('open');
  requestAnimationFrame(() => document.getElementById('confirm-modal').classList.add('open'));
}

function cancelDelete() {
  deleteId = null;
  document.getElementById('confirm-modal').classList.remove('open');
  document.getElementById('confirm-overlay').classList.remove('open');
  setTimeout(() => { document.getElementById('confirm-modal').style.display = 'none'; }, 200);
}

function confirmDelete() {
  if (!deleteId) return;
  state.sessions = state.sessions.filter(s => s.id !== deleteId);
  saveState(state);
  showToast('Sesión eliminada');
  cancelDelete();
  renderHistory();
}

document.getElementById('confirm-overlay').onclick = cancelDelete;

// ---- Render history ----
function renderHistory() {
  const sorted = [...state.sessions].sort((a, b) => {
    const dd = new Date(b.date) - new Date(a.date);
    if (dd !== 0) return dd;
    return (b.time || '').localeCompare(a.time || '');
  });

  const countEl = document.getElementById('history-count');
  if (countEl) countEl.textContent = sorted.length + ' sesiones';

  const el = document.getElementById('history-list');
  if (!sorted.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Sin sesiones registradas</p></div>';
    return;
  }

  // Group by date
  const byDate = {};
  sorted.forEach(s => {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  });

  el.innerHTML = Object.entries(byDate).map(([date, sessions]) => {
    const d        = new Date(date + 'T12:00:00');
    const dateStr  = d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
    const dayTotal = sessions.reduce((a, s) => a + parseFloat(s.hours || 0), 0);

    const items = sessions.map(x => {
      const color = DOT_COLORS[x.type] || '#888';
      const label = TYPE_LABELS[x.type] || x.type;
      const stars = x.mental ? '★'.repeat(x.mental) : '';
      const mentalColor = MENTAL_COLORS[x.mental] || 'var(--hint)';
      return `
        <div class="session-card">
          <div class="session-card-top">
            <div class="dot" style="background:${color};margin-top:4px;flex-shrink:0"></div>
            <div class="si-info">
              <div class="si-title">${escapeHtml(x.topic || label)}</div>
              <div class="si-meta">
                ${x.time ? x.time + ' · ' : ''}${label}${stars ? ' · <span style="color:'+mentalColor+'">'+stars+'</span>' : ''}
              </div>
              ${x.notes ? `<div class="si-note">${escapeHtml(x.notes)}</div>` : ''}
            </div>
            <div class="session-actions">
              <span class="si-hrs">${parseFloat(x.hours).toFixed(1)}h</span>
              <button class="del-btn" onclick="deleteSession(${x.id})" title="Eliminar">🗑</button>
            </div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="date-group">
        <div class="date-group-hd">
          <span class="date-group-label">${dateStr}</span>
          <span class="date-group-total">${dayTotal.toFixed(1)}h</span>
        </div>
        ${items}
      </div>`;
  }).join('');
}

renderHistory();
