// registrar.js

const MENTAL_LABELS = ['','Muy mal','Mal','Neutral','Bien','Excelente'];

let state = loadState();
initState(fresh => { state = fresh; renderHistory(); });
document.getElementById('log-date').value = todayISO();
let mental = 3;

function setMental(v) {
  mental = v;
  document.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.v) <= v);
  });
  document.getElementById('mental-label').textContent = MENTAL_LABELS[v];
}

function logSession() {
  const type  = document.getElementById('log-type').value;
  const hours = parseFloat(document.getElementById('log-hours').value);
  const date  = document.getElementById('log-date').value;
  const time  = document.getElementById('log-time').value;
  const topic = document.getElementById('log-topic').value.trim();
  const notes = document.getElementById('log-notes').value.trim();
  if (!hours || !date) { showToast('Rellena duración y fecha'); return; }
  state.sessions.push({ id: Date.now(), type, hours, date, time, topic, notes, mental });
  saveState(state);
  showToast('Sesión registrada ✓');
  document.getElementById('log-topic').value = '';
  document.getElementById('log-notes').value = '';
  setMental(3);
  renderHistory();
}

function deleteSession(id) {
  state.sessions = state.sessions.filter(s => s.id !== id);
  saveState(state);
  showToast('Sesión eliminada');
  renderHistory();
}

function renderHistory() {
  const sorted = [...state.sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const el = document.getElementById('history-list');
  if (!sorted.length) {
    el.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Sin sesiones registradas</p></div>';
    return;
  }
  el.innerHTML = sorted.map(x => {
    const color = DOT_COLORS[x.type] || '#888';
    const label = TYPE_LABELS[x.type] || x.type;
    const stars = x.mental ? '★'.repeat(x.mental) : '';
    return `
      <div class="session-card">
        <div class="session-card-top">
          <div class="dot" style="background:${color};margin-top:4px"></div>
          <div class="si-info">
            <div class="si-title">${escapeHtml(x.topic || label)}</div>
            <div class="si-meta">${x.date}${x.time ? ' · ' + x.time : ''}${stars ? ' · ' + stars : ''} · ${label}</div>
            ${x.notes ? `<div class="si-note">${escapeHtml(x.notes)}</div>` : ''}
          </div>
          <div class="session-actions">
            <span class="si-hrs">${x.hours.toFixed(1)}h</span>
            <button class="del-btn" onclick="deleteSession(${x.id})">×</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

renderHistory();
