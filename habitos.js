// habitos.js

let state = loadState();
initState(fresh => { state = fresh; renderAll(); });
const today = new Date();
document.getElementById('today-label').textContent =
  today.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });

const openSecs = { warmup: true, session: true, colddown: true };

function toggleSec(sec) {
  openSecs[sec] = !openSecs[sec];
  document.getElementById('body-' + sec).classList.toggle('open', openSecs[sec]);
  document.getElementById('chev-' + sec).classList.toggle('open', openSecs[sec]);
}

function toggleHabit(id, sec) {
  const h = state.habits[sec].find(x => x.id === id);
  if (!h) return;
  h.done = !h.done;
  if (h.done) h.streak = (h.streak || 0) + 1;
  saveState(state);
  renderAll();
}

function delHabit(id, sec) {
  state.habits[sec] = state.habits[sec].filter(x => x.id !== id);
  saveState(state);
  renderAll();
}

function addHabit(sec) {
  const inp = document.getElementById('new-' + sec);
  const label = inp.value.trim();
  if (!label) return;
  state.habits[sec].push({ id: Date.now(), label, streak: 0, done: false });
  inp.value = '';
  saveState(state);
  renderAll();
}

function renderSection(sec) {
  const arr = state.habits[sec] || [];
  const doneCount = arr.filter(h => h.done).length;
  document.getElementById('meta-' + sec).textContent = `${doneCount}/${arr.length}`;
  document.getElementById('list-' + sec).innerHTML = arr.map(h => `
    <div class="hc">
      <div class="hck ${h.done ? 'done' : ''}" onclick="toggleHabit(${h.id},'${sec}')">${h.done ? '✓' : ''}</div>
      <span class="hcl ${h.done ? 'done' : ''}">${escapeHtml(h.label)}</span>
      <span class="hcs">${h.streak > 0 ? '🔥' + h.streak : ''}</span>
      <button class="del-btn" onclick="delHabit(${h.id},'${sec}')">×</button>
    </div>`).join('');
}

function renderProgress() {
  const all  = Object.values(state.habits).flat();
  const done = all.filter(h => h.done).length;
  const total = all.length;
  document.getElementById('progress-label').textContent = `${done} / ${total}`;
  document.getElementById('progress-fill').style.width  = total > 0 ? Math.round(done / total * 100) + '%' : '0%';
}

function renderStreaks() {
  const wu  = state.habits.warmup   || [];
  const cd  = state.habits.colddown || [];
  const all = Object.values(state.habits).flat();
  const pct = arr => arr.length > 0 ? Math.round(arr.filter(h => h.done).length / arr.length * 100) : 0;
  document.getElementById('streak-grid').innerHTML = `
    <div class="streak-card"><div class="streak-val">${pct(wu)}%</div><div class="streak-lbl">Warm up</div></div>
    <div class="streak-card"><div class="streak-val">${pct(all)}%</div><div class="streak-lbl">Total hoy</div></div>
    <div class="streak-card"><div class="streak-val">${pct(cd)}%</div><div class="streak-lbl">Cold down</div></div>`;
}

function renderAll() {
  renderSection('warmup');
  renderSection('session');
  renderSection('colddown');
  renderProgress();
  renderStreaks();
}

renderAll();
