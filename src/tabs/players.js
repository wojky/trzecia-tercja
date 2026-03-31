import { shots, state } from '../core/state.js';
import { COLORS, STATUS_LABELS, CMP_COLORS } from '../core/config.js';

let _collabPlayers  = [];
let _collabMapPS    = {};
let _collabMapSP    = {};
let _collabMapC     = {};
let _allPlayerRows  = [];
let _compareSelection = [];
let _compareChart   = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _playerStats(num) {
  const ourShots  = shots.filter(s => s.team === 'ourTeam');
  const asShooter = ourShots.filter(s => (s.playerNumber || '').trim() === num);
  const asPasser  = ourShots.filter(s => (s.passerNumber  || '').trim() === num);

  const xg    = asShooter.reduce((acc, s) => acc + (parseFloat(s.xg) || 0), 0);
  const xa    = asPasser .reduce((acc, s) => acc + (parseFloat(s.xg) || 0), 0);
  const shots_ = asShooter.length;
  const celne  = asShooter.filter(s => s.status.includes('celne')).length;
  const niecel = asShooter.filter(s => s.status.includes('niecelny')).length;
  const zablok = asShooter.filter(s => s.status.includes('zablokowany')).length;
  const gole   = asShooter.filter(s => s.status.includes('gol')).length;
  const asysty = asPasser.length;
  return { num, xg, xa, shots_, celne, niecel, zablok, gole, asysty, asShooter, asPasser };
}

// ─── Players table ────────────────────────────────────────────────────────────

export function renderPlayers() {
  const ourShots = shots.filter(s => s.team === 'ourTeam');

  const playerNums = new Set();
  ourShots.forEach(s => {
    if (s.playerNumber) playerNums.add(s.playerNumber.trim());
    if (s.passerNumber)  playerNums.add(s.passerNumber.trim());
  });

  const rows = [];
  playerNums.forEach(num => rows.push(_playerStats(num)));
  rows.sort((a, b) => b.xg - a.xg || a.num.localeCompare(b.num, undefined, { numeric: true }));
  _allPlayerRows = rows;

  const tbody = document.getElementById('playersTableBody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="muted" style="text-align:center;padding:20px">Brak uderzeń naszego zespołu z podanym numerem zawodnika.</td></tr>';
    document.getElementById('collabSection').style.display  = 'none';
    document.getElementById('compareSection').style.display = 'none';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const selIdx   = _compareSelection.indexOf(r.num);
    const checked  = selIdx !== -1;
    const color    = checked ? CMP_COLORS[selIdx] : '';
    const disabled = !checked && _compareSelection.length >= 3;
    return `
    <tr class="${checked ? 'cmp-row-selected' : ''}">
      <td class="cmp-check-col">
        <input type="checkbox" class="cmp-checkbox" data-num="${r.num}"
          ${checked ? 'checked' : ''}
          ${disabled ? 'disabled' : ''}
          style="accent-color:${color || '#e11d48'}" />
      </td>
      <td class="num-badge"><span class="player-num-badge">${r.num}</span></td>
      <td class="player-name muted">—</td>
      <td class="num">${r.xg > 0 ? r.xg.toFixed(2) : '<span class="muted">—</span>'}</td>
      <td class="num">${r.xa > 0 ? r.xa.toFixed(2) : '<span class="muted">—</span>'}</td>
      <td class="num">${r.celne  || '<span class="muted">—</span>'}</td>
      <td class="num">${r.niecel || '<span class="muted">—</span>'}</td>
      <td class="num">${r.zablok || '<span class="muted">—</span>'}</td>
      <td class="num muted">—</td>
      <td><button class="btn-player-details" data-num="${r.num}" title="Szczegóły zawodnika"><i class="bi bi-search"></i></button></td>
    </tr>
    `;
  }).join('');

  // Collab matrix
  const collabSection = document.getElementById('collabSection');
  const collabEl      = document.getElementById('collabMatrix');

  _collabMapPS = {};
  _collabMapSP = {};
  _collabMapC  = {};

  ourShots.forEach(s => {
    const shooter = (s.playerNumber || '').trim();
    const passer  = (s.passerNumber  || '').trim();
    if (!shooter || !passer || shooter === passer) return;

    if (!_collabMapPS[passer]) _collabMapPS[passer] = {};
    _collabMapPS[passer][shooter] = (_collabMapPS[passer][shooter] || 0) + 1;

    if (!_collabMapSP[shooter]) _collabMapSP[shooter] = {};
    _collabMapSP[shooter][passer] = (_collabMapSP[shooter][passer] || 0) + 1;

    const key = [shooter, passer].sort().join('||');
    _collabMapC[key] = (_collabMapC[key] || 0) + 1;
  });

  _collabPlayers = [...new Set(
    Object.keys(_collabMapC).flatMap(k => k.split('||'))
  )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (_collabPlayers.length < 2) {
    collabSection.style.display = 'none';
  } else {
    collabSection.style.display = 'block';
    const activeMode = document.querySelector('input[name="collabMode"]:checked')?.value || 'combined';
    collabEl.innerHTML = renderCollabMatrix(activeMode);
  }

  if (rows.length >= 2) {
    document.getElementById('compareSection').style.display = 'block';
    _renderCompareViz();
  } else {
    document.getElementById('compareSection').style.display = 'none';
  }
}

// ─── Player detail dialog ─────────────────────────────────────────────────────

export function openPlayerDialog(num) {
  const st = _playerStats(num);
  const { xg, xa, shots_, celne, niecel, zablok, gole, asysty, asShooter, asPasser } = st;

  const xgPerShot  = shots_ > 0 ? xg / shots_ : null;
  const xaPerPass  = asysty > 0 ? xa / asysty : null;
  const xD         = xg + xa;
  const minutesPlayed = null;

  const kv = (label, value, accent, tooltipText) => {
    const infoBtn = tooltipText
      ? `<button class="pdg-info-btn" data-tooltip="${tooltipText.replace(/"/g, '&quot;')}"><i class="bi bi-info-circle"></i></button>`
      : '';
    return `<div class="pdg-kv">
      <span class="pdg-kv-label">${label}${infoBtn}</span>
      <span class="pdg-kv-value${accent ? ' accent' : ''}">${value}</span>
    </div>`;
  };

  const shotRows = asShooter
    .slice()
    .sort((a, b) => (parseFloat(a.matchTime) || 0) - (parseFloat(b.matchTime) || 0))
    .map(s => {
      const min      = s.matchTime ? `${s.matchTime}'` : '—';
      const xgVal    = parseFloat(s.xg) > 0 ? `xG ${parseFloat(s.xg).toFixed(2)}` : '';
      const statuses = (s.status || [])
        .map(st => STATUS_LABELS[st] || st)
        .join(', ');
      return `<li class="pdg-shot-item">
        <span class="pdg-shot-min">${min}</span>
        <span class="pdg-shot-xg">${xgVal}</span>
        <span class="pdg-shot-status">${statuses || '—'}</span>
      </li>`;
    }).join('');

  const TIPS = {
    xg:     'xG (Expected Goals) — oczekiwane gole. Suma prawdopodobieństw strzelenia gola z każdej oddanej okazji, na podstawie jakości sytuacji.',
    xa:     'xA (Expected Assists) — oczekiwane asysty. Suma wartości xG akcji, do których zawodnik dostarczył kluczowe podanie.',
    xgShot: 'xG / strzał — średnia jakość sytuacji strzeleckiej. Im wyżej, tym lepsze okazje stwarza sobie zawodnik.',
    xaPass: 'xA / podanie — średnia wartość xG akcji wynikających z podań zawodnika. Mierzy efektywność jego asyst.',
    xd:     'xD (Expected Danger) — oczekiwane zagrożenie. Suma xG i xA: łączny wkład zawodnika w stwarzanie sytuacji bramkowych zarówno jako strzelec, jak i podający.',
    xdMin:  'xD / min — oczekiwane zagrożenie na minutę gry. Pozwala porównywać zawodników o różnym czasie gry.',
  };

  document.getElementById('pdgNum').textContent = num;
  document.getElementById('pdgBody').innerHTML  = `
    <div class="pdg-section-title">Podsumowanie</div>
    <div class="pdg-kv-grid">
      ${kv('xG', xg > 0 ? xg.toFixed(2) : '—', xg > 0, TIPS.xg)}
      ${kv('xA', xa > 0 ? xa.toFixed(2) : '—', xa > 0, TIPS.xa)}
      ${kv('xG / strzał', xgPerShot !== null ? xgPerShot.toFixed(3) : '—', false, TIPS.xgShot)}
      ${kv('xA / podanie', xaPerPass !== null ? xaPerPass.toFixed(3) : '—', false, TIPS.xaPass)}
      ${kv('xD', xD > 0 ? xD.toFixed(2) : '—', xD > 0, TIPS.xd)}
      ${kv('xD / min', minutesPlayed ? (xD / minutesPlayed).toFixed(3) : '—', false, TIPS.xdMin)}
      ${kv('Strzały', shots_ || '—', false)}
      ${kv('Gole', gole || '—', gole > 0)}
      ${kv('Próby asyst', asysty || '—', false)}
      ${kv('Celne', celne || '—', false)}
      ${kv('Niecelne', niecel || '—', false)}
      ${kv('Zablokowane', zablok || '—', false)}
    </div>
    ${(asShooter.length > 0 || asPasser.length > 0) ? `
    <div class="pdg-section-title">Mapa uderzeń</div>
    <div class="pdg-map-row">
      <div class="pdg-map-col">
        <canvas id="pdgPitchCanvas" width="400" height="235"></canvas>
        <div class="pdg-map-legend">
          <span class="pdg-legend-dot" style="background:#e11d48"></span> Strzał
          ${asPasser.length > 0 ? '<span class="pdg-legend-dot" style="background:none;border:2px solid #f59e0b;box-shadow:none"></span> Cel asysty' : ''}
          ${asPasser.some(s => s.assistPos) ? '<span class="pdg-legend-dot" style="background:rgba(251,191,36,0.9);box-shadow:none"></span> Pozycja asystującego' : ''}
          ${asPasser.some(s => s.assistArrow) ? '<span style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:#6b7280"><span style="display:inline-block;width:18px;height:2px;background:#fbbf24;vertical-align:middle"></span> Podanie</span>' : ''}
          ${asShooter.some(s => (s.status||[]).includes('gol')) ? '<span class="pdg-legend-dot" style="background:#e11d48;box-shadow:0 0 0 2px #fbbf24"></span> Gol' : ''}
        </div>
      </div>
      ${asShooter.length > 0 ? `
      <div class="pdg-shots-col">
        <div class="pdg-section-title" style="margin-top:0">Lista strzałów</div>
        <ul class="pdg-shot-list">${shotRows}</ul>
      </div>` : ''}
    </div>` : ''}
  `;

  const dlg = document.getElementById('playerDialog');
  document.getElementById('pdgClose').onclick = () => dlg.close();
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }, { once: true });

  const pitchCanvas = document.getElementById('pdgPitchCanvas');
  if (pitchCanvas) _drawPlayerPitch(pitchCanvas, asShooter, asPasser);

  let tip = dlg.querySelector('#pdg-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id          = 'pdg-tooltip';
    tip.className   = 'pdg-popover';
    tip.style.display  = 'none';
    tip.style.position = 'fixed';
    tip.style.zIndex   = '99999';
    dlg.appendChild(tip);
  }

  document.querySelectorAll('#pdgBody .pdg-info-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      tip.textContent  = btn.dataset.tooltip;
      tip.style.display = 'block';
      const rect = btn.getBoundingClientRect();
      const tipW = Math.min(280, window.innerWidth - 8);
      let left   = rect.left;
      if (left + tipW > window.innerWidth - 4) left = window.innerWidth - tipW - 4;
      tip.style.top     = `${rect.bottom + 6}px`;
      tip.style.left    = `${Math.max(4, left)}px`;
      tip.style.maxWidth = `${tipW}px`;
    });
    btn.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  });

  dlg.showModal();
}

// ─── Mini pitch map in dialog ─────────────────────────────────────────────────

function _drawPlayerPitch(canvasEl, asShooter, asPasser) {
  const S  = canvasEl.width / 800;
  const c  = canvasEl.getContext('2d');
  const p  = { x: 40 * S, y: 20 * S, width: 720 * S, height: 370 * S };
  const sx = p.width  / 68;
  const sy = p.height / 35;

  c.fillStyle = '#2d8f45';
  c.fillRect(0, 0, canvasEl.width, canvasEl.height);

  c.save();
  if (state.isMirrored) {
    const mx = p.x + p.width / 2, my = p.y + p.height / 2;
    c.translate(2 * mx, 2 * my);
    c.scale(-1, -1);
  }

  c.fillStyle = '#339c50';
  c.fillRect(p.x, p.y, p.width, p.height);

  c.strokeStyle = '#ffffff';
  c.lineWidth   = Math.max(1, 3 * S);

  c.strokeRect(p.x, p.y, p.width, p.height);

  const paW = 40.32 * sx, paD = 16.5 * sy, paX = p.x + (p.width - paW) / 2;
  c.strokeRect(paX, p.y, paW, paD);

  const gaW = 18.32 * sx, gaD = 5.5 * sy, gaX = p.x + (p.width - gaW) / 2;
  c.strokeRect(gaX, p.y, gaW, gaD);

  const gW = 7.32 * sx, gD = 2.2 * sy, gX = p.x + (p.width - gW) / 2;
  c.strokeRect(gX, p.y - gD, gW, gD);

  const psX = p.x + p.width / 2, psY = p.y + 11 * sy;
  c.beginPath();
  c.arc(psX, psY, Math.max(1, 3 * S), 0, Math.PI * 2);
  c.fillStyle = '#ffffff';
  c.fill();

  c.beginPath();
  c.arc(psX, psY, 9.15 * sy, 0.23 * Math.PI, 0.77 * Math.PI, false);
  c.stroke();

  c.restore();

  const origMidX = 400;
  const origMidY = 205;

  const toCanvas = s => ({
    x: (state.isMirrored ? 2 * origMidX - s.x : s.x) * S,
    y: (state.isMirrored ? 2 * origMidY - s.y : s.y) * S,
  });

  const r  = Math.max(3, 5 * S);
  const fs = Math.max(5, 5.5 * S);

  asPasser.forEach((s) => {
    const { x, y } = toCanvas(s);

    c.beginPath();
    c.arc(x, y, r + 1, 0, Math.PI * 2);
    c.strokeStyle = '#f59e0b';
    c.lineWidth   = Math.max(1.5, 2 * S);
    c.fillStyle   = 'rgba(245, 158, 11, 0.18)';
    c.fill();
    c.stroke();
    c.fillStyle      = '#f59e0b';
    c.font           = `bold ${fs}px Arial`;
    c.textAlign      = 'center';
    c.textBaseline   = 'middle';
    c.fillText('A', x, y + 0.5);

    if (s.assistPos) {
      const px = (state.isMirrored ? 2 * origMidX - s.assistPos.x : s.assistPos.x) * S;
      const py = (state.isMirrored ? 2 * origMidY - s.assistPos.y : s.assistPos.y) * S;
      c.beginPath();
      c.arc(px, py, r + 1, 0, Math.PI * 2);
      c.fillStyle = 'rgba(251,191,36,0.9)';
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth   = Math.max(1, 1.5 * S);
      c.stroke();
      c.fillStyle    = '#111827';
      c.font         = `bold ${fs}px Arial`;
      c.textAlign    = 'center';
      c.textBaseline = 'middle';
      c.fillText('P', px, py + 0.5);
    }

    if (s.assistArrow) {
      const ax1 = (state.isMirrored ? 2 * origMidX - s.assistArrow.x1 : s.assistArrow.x1) * S;
      const ay1 = (state.isMirrored ? 2 * origMidY - s.assistArrow.y1 : s.assistArrow.y1) * S;
      const ax2 = (state.isMirrored ? 2 * origMidX - s.assistArrow.x2 : s.assistArrow.x2) * S;
      const ay2 = (state.isMirrored ? 2 * origMidY - s.assistArrow.y2 : s.assistArrow.y2) * S;
      const dx  = ax2 - ax1, dy = ay2 - ay1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 3) {
        c.save();
        c.strokeStyle = '#fbbf24';
        c.fillStyle   = '#fbbf24';
        c.lineWidth   = Math.max(1.5, 2.5 * S);
        c.beginPath();
        c.moveTo(ax1, ay1);
        c.lineTo(ax2, ay2);
        c.stroke();
        const angle    = Math.atan2(dy, dx);
        const headLen  = Math.max(7, 12 * S);
        const headAngle = Math.PI / 7;
        c.beginPath();
        c.moveTo(ax2, ay2);
        c.lineTo(ax2 - headLen * Math.cos(angle - headAngle), ay2 - headLen * Math.sin(angle - headAngle));
        c.lineTo(ax2 - headLen * Math.cos(angle + headAngle), ay2 - headLen * Math.sin(angle + headAngle));
        c.closePath();
        c.fill();
        c.restore();
      }
    }
  });

  asShooter.forEach((s, i) => {
    const { x, y } = toCanvas(s);
    const isGoal   = (s.status || []).includes('gol');
    const shotR    = isGoal ? r + 2 : r;

    if (isGoal) {
      c.beginPath();
      c.arc(x, y, shotR + 3, 0, Math.PI * 2);
      c.fillStyle = 'rgba(251, 191, 36, 0.35)';
      c.fill();
    }

    c.beginPath();
    c.arc(x, y, shotR, 0, Math.PI * 2);
    c.fillStyle   = '#e11d48';
    c.fill();
    c.lineWidth   = Math.max(1, 1.5 * S);
    c.strokeStyle = '#ffffff';
    c.stroke();

    c.fillStyle    = '#ffffff';
    c.font         = `bold ${fs}px Arial`;
    c.textAlign    = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(i + 1), x, y + 0.5);
  });
}

// ─── Collab matrix ────────────────────────────────────────────────────────────

export function renderCollabMatrix(mode) {
  const players = _collabPlayers;
  const header  = `<tr><th></th>${players.map(p => `<th>${p}</th>`).join('')}</tr>`;
  const bodyRows = players.map(row => {
    const cells = players.map(col => {
      if (row === col) return `<td class="collab-self"></td>`;
      let val = 0;
      if      (mode === 'ps') val = (_collabMapPS[row] || {})[col] || 0;
      else if (mode === 'sp') val = (_collabMapSP[row] || {})[col] || 0;
      else                    val = _collabMapC[[row, col].sort().join('||')] || 0;
      const tip = mode === 'ps' ? `${row} → ${col}` : mode === 'sp' ? `${col} → ${row}` : `${row} ↔ ${col}`;
      return val > 0
        ? `<td class="collab-val" title="${tip}: ${val}">${val}</td>`
        : `<td class="collab-zero">·</td>`;
    }).join('');
    return `<tr><th>${row}</th>${cells}</tr>`;
  }).join('');
  return `<table class="collab-table"><thead>${header}</thead><tbody>${bodyRows}</tbody></table>`;
}

// ─── Player comparison ────────────────────────────────────────────────────────

export function toggleCompare(num) {
  const idx = _compareSelection.indexOf(num);
  if (idx !== -1) {
    _compareSelection.splice(idx, 1);
  } else {
    if (_compareSelection.length >= 3) return;
    _compareSelection.push(num);
  }

  document.querySelectorAll('.cmp-checkbox').forEach(cb => {
    const n      = cb.dataset.num;
    const selIdx = _compareSelection.indexOf(n);
    cb.checked              = selIdx !== -1;
    cb.style.accentColor    = selIdx !== -1 ? CMP_COLORS[selIdx] : '#e11d48';
    cb.disabled             = !cb.checked && _compareSelection.length >= 3;
  });

  document.querySelectorAll('#playersTableBody tr').forEach(tr => {
    const cb = tr.querySelector('.cmp-checkbox');
    if (cb) tr.classList.toggle('cmp-row-selected', cb.checked);
  });

  document.getElementById('compareHint').style.display =
    _compareSelection.length < 2 ? 'block' : 'none';

  _renderCompareViz();
}

function _renderCompareViz() {
  const selected = _compareSelection.map(num => _playerStats(num));
  const tableEl  = document.getElementById('compareTable');
  const chartWrap = document.getElementById('compareChartWrap');

  if (selected.length < 2) {
    tableEl.innerHTML      = '';
    chartWrap.style.display = 'none';
    if (_compareChart) { _compareChart.destroy(); _compareChart = null; }
    return;
  }

  chartWrap.style.display = 'block';

  const metrics = [
    { key: 'xg',     label: 'xG' },
    { key: 'xa',     label: 'xA' },
    { key: 'xd',     label: 'xD',    derive: r => r.xg + r.xa },
    { key: 'shots_', label: 'Strzały' },
    { key: 'gole',   label: 'Gole' },
    { key: 'celne',  label: 'Celne' },
  ];

  const maxVals = metrics.map(m => {
    const vals = _allPlayerRows.map(r => m.derive ? m.derive(r) : r[m.key]);
    return Math.max(...vals, 0.001);
  });

  const datasets = selected.map((r, i) => {
    const data  = metrics.map((m, mi) => {
      const raw = m.derive ? m.derive(r) : r[m.key];
      return maxVals[mi] > 0 ? raw / maxVals[mi] : 0;
    });
    const color = CMP_COLORS[i];
    return {
      label: `Nr ${r.num}`,
      data,
      backgroundColor:  `${color}1a`,
      borderColor:      color,
      borderWidth:      2,
      pointBackgroundColor: color,
      pointBorderColor:    '#ffffff',
      pointBorderWidth:    1.5,
      pointRadius:  4,
      pointHoverRadius: 6,
    };
  });

  const ctx = document.getElementById('compareRadarChart').getContext('2d');
  if (_compareChart) _compareChart.destroy();
  _compareChart = new Chart(ctx, {
    type: 'radar',
    data: { labels: metrics.map(m => m.label), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 300 },
      scales: {
        r: {
          min: 0, max: 1,
          ticks: { display: false },
          grid:        { color: COLORS.gridLine },
          angleLines:  { color: COLORS.gridLine },
          pointLabels: { font: { family: 'Arial, sans-serif', size: 13, weight: '700' }, color: COLORS.axisTitle },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: COLORS.legendText, font: { family: 'Arial, sans-serif', size: 13, weight: '600' }, usePointStyle: true, pointStyle: 'circle', padding: 16 },
        },
        tooltip: {
          backgroundColor: COLORS.tooltipBg, titleColor: '#9ca3af', bodyColor: COLORS.tooltipText,
          borderColor: '#374151', borderWidth: 1, padding: 10,
          callbacks: {
            title: items => metrics[items[0].dataIndex].label,
            label: item  => {
              const r    = selected[item.datasetIndex];
              const m    = metrics[item.dataIndex];
              const raw  = m.derive ? m.derive(r) : r[m.key];
              const fmt  = Number.isInteger(raw) ? raw : raw.toFixed(2);
              return ` Nr ${r.num}: ${fmt}`;
            },
          },
        },
      },
    },
  });

  const allMetrics = [
    { label: 'xG',          fn: r => r.xg > 0 ? r.xg.toFixed(2) : '—',   best: 'max' },
    { label: 'xA',          fn: r => r.xa > 0 ? r.xa.toFixed(2) : '—',   best: 'max' },
    { label: 'xD',          fn: r => { const v = r.xg + r.xa; return v > 0 ? v.toFixed(2) : '—'; }, best: 'max' },
    { label: 'xG / strzał', fn: r => r.shots_ > 0 ? (r.xg / r.shots_).toFixed(3) : '—', best: 'max' },
    { label: 'Strzały',     fn: r => r.shots_ || '—', best: 'max' },
    { label: 'Gole',        fn: r => r.gole   || '—', best: 'max' },
    { label: 'Asysty',      fn: r => r.asysty || '—', best: 'max' },
    { label: 'Celne',       fn: r => r.celne   || '—', best: 'max' },
    { label: 'Niecelne',    fn: r => r.niecel  || '—', best: 'min' },
    { label: 'Zablokowane', fn: r => r.zablok  || '—', best: 'max' },
  ];

  const headerCells = selected.map((r, i) =>
    `<th style="color:${CMP_COLORS[i]};white-space:nowrap">Nr ${r.num}</th>`
  ).join('');

  const bodyRows = allMetrics.map(m => {
    const rawVals     = selected.map(r => m.fn(r));
    const numericVals = rawVals.map(v => parseFloat(v));
    const validNums   = numericVals.filter(v => !isNaN(v));
    const bestVal     = validNums.length ? (m.best === 'max' ? Math.max(...validNums) : Math.min(...validNums)) : null;
    const cells       = rawVals.map((v, i) => {
      const isNum  = !isNaN(parseFloat(v));
      const isBest = isNum && bestVal !== null && parseFloat(v) === bestVal && validNums.length > 1;
      return `<td class="num${isBest ? ' cmp-best' : ''}">${v}</td>`;
    }).join('');
    return `<tr><td class="cmp-metric-label">${m.label}</td>${cells}</tr>`;
  }).join('');

  tableEl.innerHTML = `
    <table class="cmp-table">
      <thead><tr><th></th>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
}

// ─── Event delegation (replaces inline handlers) ─────────────────────────────

// Collab mode radios (static HTML)
document.querySelector('.collab-mode-toggle')?.addEventListener('change', e => {
  if (e.target.name === 'collabMode') {
    document.getElementById('collabMatrix').innerHTML = renderCollabMatrix(e.target.value);
  }
});

// Compare checkboxes and detail buttons (dynamic HTML in table body)
document.getElementById('playersTableBody').addEventListener('change', e => {
  const cb = e.target.closest('.cmp-checkbox');
  if (cb) toggleCompare(cb.dataset.num);
});

document.getElementById('playersTableBody').addEventListener('click', e => {
  const btn = e.target.closest('.btn-player-details');
  if (btn) openPlayerDialog(btn.dataset.num);
});
