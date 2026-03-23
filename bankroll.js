// bankroll.js

let state = loadState();
initState(fresh => { state = fresh; renderBankroll(); });
document.getElementById('week-date').value = todayISO();

function setInitial() {
  const v = parseFloat(document.getElementById('initial-input').value);
  if (isNaN(v)) { showToast('Introduce un número válido'); return; }
  state.bankroll.initial = v;
  document.getElementById('initial-input').value = '';
  saveState(state);
  showToast('Bankroll inicial establecido ✓');
  renderBankroll();
}

function saveWeek() {
  const result = parseFloat(document.getElementById('week-result').value);
  const date   = document.getElementById('week-date').value;
  if (isNaN(result) || !date) { showToast('Rellena resultado y fecha'); return; }
  state.bankroll.weeks.push({
    id:     Date.now(),
    result, date,
    format: document.getElementById('week-format').value,
    stakes: document.getElementById('week-stakes').value.trim(),
    notes:  document.getElementById('week-notes').value.trim(),
  });
  document.getElementById('week-result').value = '';
  document.getElementById('week-notes').value  = '';
  saveState(state);
  showToast('Semana guardada ✓');
  renderBankroll();
}

function delWeek(id) {
  state.bankroll.weeks = state.bankroll.weeks.filter(w => w.id !== id);
  saveState(state);
  showToast('Eliminada');
  renderBankroll();
}

function renderBankroll() {
  const initial = state.bankroll.initial || 0;
  const weeks   = state.bankroll.weeks   || [];
  const total   = initial + weeks.reduce((a, w) => a + parseFloat(w.result || 0), 0);
  const month   = new Date().getMonth();
  const mw      = weeks.filter(w => new Date(w.date).getMonth() === month);
  const won     = mw.filter(w => w.result > 0).reduce((a, w) => a + w.result, 0);
  const lost    = Math.abs(mw.filter(w => w.result < 0).reduce((a, w) => a + w.result, 0));
  const roi     = initial > 0 ? ((total - initial) / initial * 100).toFixed(1) : 0;

  const totalEl = document.getElementById('br-total');
  totalEl.textContent = (total >= 0 ? '€' : '-€') + Math.abs(total).toFixed(0);
  totalEl.className   = 'br-total' + (total < 0 ? ' neg' : '');
  document.getElementById('br-sub').textContent   = `Bankroll actual · inicio €${initial.toFixed(0)}`;
  document.getElementById('br-won').textContent   = '+€' + won.toFixed(0);
  document.getElementById('br-lost').textContent  = '-€' + lost.toFixed(0);
  document.getElementById('br-weeks').textContent = weeks.length;

  const roiEl = document.getElementById('br-roi');
  roiEl.textContent = (parseFloat(roi) >= 0 ? '+' : '') + roi + '%';
  roiEl.className   = 'brc-v ' + (parseFloat(roi) >= 0 ? 'pos' : 'neg');

  // Chart
  if (weeks.length > 1) {
    document.getElementById('chart-card').style.display = 'block';
    const last8 = weeks.slice(-8);
    let running = initial;
    const points = last8.map(w => { running += parseFloat(w.result || 0); return { v: running, r: w.result, d: w.date.slice(5) }; });
    const vals = points.map(p => p.v);
    const minV = Math.min(...vals, initial);
    const maxV = Math.max(...vals, initial);
    const range = maxV - minV || 1;
    document.getElementById('br-chart').innerHTML = points.map(p => {
      const h = Math.max(4, (p.v - minV) / range * 70);
      const color = p.r >= 0 ? 'var(--green-l)' : 'var(--red)';
      return `<div class="cbar-wrap"><div class="cbar" style="height:${h}px;background:${color}"></div><div class="cbar-lbl">${p.d}</div></div>`;
    }).join('');
  }

  // History
  const hel = document.getElementById('br-history');
  if (!weeks.length) {
    hel.innerHTML = '<p style="color:var(--hint);font-size:13px;text-align:center;padding:.75rem 0">Sin semanas registradas</p>';
    return;
  }
  hel.innerHTML = [...weeks].reverse().map(w => `
    <div class="week-item">
      <div class="week-dot" style="background:${w.result >= 0 ? 'var(--green-l)' : 'var(--red)'}"></div>
      <div class="week-info">
        <div class="week-title">${escapeHtml(w.format || 'Cash')}${w.stakes ? ' · ' + escapeHtml(w.stakes) : ''}</div>
        <div class="week-meta">Semana del ${w.date}${w.notes ? ' · ' + escapeHtml(w.notes) : ''}</div>
      </div>
      <span class="week-result ${w.result >= 0 ? 'pos' : 'neg'}">${w.result >= 0 ? '+' : ''}€${Math.abs(w.result).toFixed(0)}</span>
      <button class="del-btn" onclick="delWeek(${w.id})">×</button>
    </div>`).join('');
}

renderBankroll();
