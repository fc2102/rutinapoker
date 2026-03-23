// notas.js

let state = loadState();
initState(fresh => { state = fresh; renderNotes(); });
document.getElementById('note-date').value = todayISO();
let activeCat = 'all';

function filterCat(el) {
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  activeCat = el.dataset.cat;
  renderNotes();
}

function saveNote() {
  const text = document.getElementById('note-input').value.trim();
  if (!text) { showToast('Escribe algo primero'); return; }
  state.notes.push({
    id:   Date.now(),
    text,
    cat:  document.getElementById('note-cat').value,
    date: document.getElementById('note-date').value,
  });
  document.getElementById('note-input').value = '';
  saveState(state);
  showToast('Nota guardada ✓');
  renderNotes();
}

function delNote(id) {
  state.notes = state.notes.filter(n => n.id !== id);
  saveState(state);
  renderNotes();
}

function renderNotes() {
  const search = document.getElementById('search-input').value.trim().toLowerCase();
  let notes = [...state.notes].reverse();
  if (activeCat !== 'all') notes = notes.filter(n => n.cat === activeCat);
  if (search) notes = notes.filter(n =>
    n.text.toLowerCase().includes(search) || n.cat.toLowerCase().includes(search)
  );

  document.getElementById('notes-count').textContent = `(${notes.length})`;

  const el = document.getElementById('notes-list');
  if (!notes.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="icon">📓</div>
      <p>${state.notes.length === 0 ? 'Sin notas aún. Escribe tu primera reflexión.' : 'No hay notas con estos filtros.'}</p>
    </div>`;
    return;
  }
  el.innerHTML = notes.map(n => `
    <div class="note-card">
      <div class="note-header">
        <div class="note-meta">
          <span class="note-date">${n.date}</span>
          <span class="note-cat">${escapeHtml(n.cat)}</span>
        </div>
        <button class="del-btn" onclick="delNote(${n.id})">×</button>
      </div>
      <div class="note-text">${escapeHtml(n.text)}</div>
    </div>`).join('');
}

renderNotes();
