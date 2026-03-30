// ─── Globals ──────────────────────────────────────────────────────────────────

let _collabPlayers = [];
let _collabMapPS   = {}; // [passer][shooter]
let _collabMapSP   = {}; // [shooter][passer]
let _collabMapC    = {}; // symmetric key → count

let _allPlayerRows = []; // full rows for comparison picker
let _compareSelection = []; // up to 3 player numbers
let _compareChart = null;

const CMP_COLORS = ['#e11d48', '#2563eb', '#f59e0b'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _playerStats(num) {
  const ourShots = shots.filter(s => s.team === 'ourTeam');
  const asShooter = ourShots.filter(s => (s.playerNumber || '').trim() === num);
  const asPasser  = ourShots.filter(s => (s.passerNumber  || '').trim() === num);

  const xg     = asShooter.reduce((acc, s) => acc + (parseFloat(s.xg) || 0), 0);
  const xa     = asPasser .reduce((acc, s) => acc + (parseFloat(s.xg) || 0), 0);
  const shots_ = asShooter.length;
  const celne  = asShooter.filter(s => s.status.includes('celne')).length;
  const niecel = asShooter.filter(s => s.status.includes('niecelny')).length;
  const zablok = asShooter.filter(s => s.status.includes('zablokowany')).length;
  const gole   = asShooter.filter(s => s.status.includes('gol')).length;
  const asysty = asPasser.length;
  return { num, xg, xa, shots_, celne, niecel, zablok, gole, asysty, asShooter, asPasser };
}

// ─── Tabela zawodników ────────────────────────────────────────────────────────

function renderPlayers() {
  const ourShots = shots.filter(s => s.team === 'ourTeam');

  const playerNums = new Set();
  ourShots.forEach(s => {
    if (s.playerNumber) playerNums.add(s.playerNumber.trim());
    if (s.passerNumber)  playerNums.add(s.passerNumber.trim());
  });

  const rows = [];
  playerNums.forEach(num => {
    const st = _playerStats(num);
    rows.push(st);
  });

  rows.sort((a, b) => b.xg - a.xg || a.num.localeCompare(b.num, undefined, { numeric: true }));
  _allPlayerRows = rows;

  const tbody = document.getElementById('playersTableBody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:20px">Brak uderzeń naszego zespołu z podanym numerem zawodnika.</td></tr>';
    document.getElementById('collabSection').style.display = 'none';
    document.getElementById('compareSection').style.display = 'none';
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="muted">—</td>
      <td class="num-badge"><span class="player-num-badge">${r.num}</span></td>
      <td class="num">${r.xg > 0 ? r.xg.toFixed(2) : '<span class="muted">—</span>'}</td>
      <td class="num">${r.xa > 0 ? r.xa.toFixed(2) : '<span class="muted">—</span>'}</td>
      <td class="num">${r.celne  || '<span class="muted">—</span>'}</td>
      <td class="num">${r.niecel || '<span class="muted">—</span>'}</td>
      <td class="num">${r.zablok || '<span class="muted">—</span>'}</td>
      <td class="num muted">—</td>
      <td><button class="btn-player-details" onclick="openPlayerDialog('${r.num}')" title="Szczegóły zawodnika"><i class="bi bi-search"></i></button></td>
    </tr>
  `).join('');

  // ─── Macierz współpracy ───────────────────────────────────────────────────
  const collabSection = document.getElementById('collabSection');
  const collabEl = document.getElementById('collabMatrix');

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

  // ─── Sekcja porównania ────────────────────────────────────────────────────
  if (rows.length >= 2) {
    document.getElementById('compareSection').style.display = 'block';
    _renderComparePicker();
    _renderCompareViz();
  } else {
    document.getElementById('compareSection').style.display = 'none';
  }
}

// ─── Dialog szczegółów zawodnika ──────────────────────────────────────────────

function openPlayerDialog(num) {
  const st = _playerStats(num);
  const { xg, xa, shots_, celne, niecel, zablok, gole, asysty, asShooter } = st;

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
      const min = s.matchTime ? `${s.matchTime}'` : '—';
      const xgVal = parseFloat(s.xg) > 0 ? `xG ${parseFloat(s.xg).toFixed(2)}` : '';
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
  document.getElementById('pdgBody').innerHTML = `
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
      ${kv('Asysty', asysty || '—', false)}
      ${kv('Celne', celne || '—', false)}
      ${kv('Niecelne', niecel || '—', false)}
      ${kv('Zablokowane', zablok || '—', false)}
    </div>
    ${asShooter.length > 0 ? `
    <div class="pdg-section-title">Strzały (${asShooter.length})</div>
    <ul class="pdg-shot-list">${shotRows}</ul>` : ''}
  `;

  const dlg = document.getElementById('playerDialog');
  document.getElementById('pdgClose').onclick = () => dlg.close();
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }, { once: true });

  let tip = dlg.querySelector('#pdg-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'pdg-tooltip';
    tip.className = 'pdg-popover';
    tip.style.display = 'none';
    tip.style.position = 'fixed';
    tip.style.zIndex = '99999';
    dlg.appendChild(tip);
  }

  document.querySelectorAll('#pdgBody .pdg-info-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      tip.textContent = btn.dataset.tooltip;
      tip.style.display = 'block';
      const rect = btn.getBoundingClientRect();
      const tipW = Math.min(280, window.innerWidth - 8);
      let left = rect.left;
      if (left + tipW > window.innerWidth - 4) left = window.innerWidth - tipW - 4;
      tip.style.top  = `${rect.bottom + 6}px`;
      tip.style.left = `${Math.max(4, left)}px`;
      tip.style.maxWidth = `${tipW}px`;
    });
    btn.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
  });

  dlg.showModal();
}

// ─── Macierz współpracy ───────────────────────────────────────────────────────

function renderCollabMatrix(mode) {
  const players = _collabPlayers;
  const header = `<tr><th></th>${players.map(p => `<th>${p}</th>`).join('')}</tr>`;
  const bodyRows = players.map(row => {
    const cells = players.map(col => {
      if (row === col) return `<td class="collab-self"></td>`;
      let val = 0;
      if (mode === 'ps') {
        val = (_collabMapPS[row] || {})[col] || 0;
      } else if (mode === 'sp') {
        val = (_collabMapSP[row] || {})[col] || 0;
      } else {
        val = _collabMapC[[row, col].sort().join('||')] || 0;
      }
      const tip = mode === 'ps' ? `${row} → ${col}` : mode === 'sp' ? `${col} → ${row}` : `${row} ↔ ${col}`;
      return val > 0
        ? `<td class="collab-val" title="${tip}: ${val}">${val}</td>`
        : `<td class="collab-zero">·</td>`;
    }).join('');
    return `<tr><th>${row}</th>${cells}</tr>`;
  }).join('');
  return `<table class="collab-table"><thead>${header}</thead><tbody>${bodyRows}</tbody></table>`;
}

// ─── Porównanie zawodników ────────────────────────────────────────────────────

function toggleCompare(num) {
  const idx = _compareSelection.indexOf(num);
  if (idx !== -1) {
    _compareSelection.splice(idx, 1);
  } else {
    if (_compareSelection.length >= 3) return; // max 3
    _compareSelection.push(num);
  }
  _renderComparePicker();
  _renderCompareViz();
}

function _renderComparePicker() {
  const picker = document.getElementById('comparePicker');
  picker.innerHTML = _allPlayerRows.map(r => {
    const selIdx = _compareSelection.indexOf(r.num);
    const selected = selIdx !== -1;
    const color = selected ? CMP_COLORS[selIdx] : null;
    const disabled = !selected && _compareSelection.length >= 3;
    return `<button
      class="cmp-pill${selected ? ' cmp-pill-active' : ''}"
      style="${color ? `--cmp-color:${color};border-color:${color};background:${color}18;color:${color}` : ''}"
      onclick="toggleCompare('${r.num}')"
      ${disabled ? 'disabled title="Możesz wybrać maksymalnie 3 zawodników"' : ''}
    >${r.num}</button>`;
  }).join('');
  document.getElementById('compareHint').style.display =
    _compareSelection.length < 2 ? 'block' : 'none';
}

function _renderCompareViz() {
  const selected = _compareSelection.map(num => _playerStats(num));

  const tableEl = document.getElementById('compareTable');
  const chartWrap = document.getElementById('compareChartWrap');

  if (selected.length < 2) {
    tableEl.innerHTML = '';
    chartWrap.style.display = 'none';
    if (_compareChart) { _compareChart.destroy(); _compareChart = null; }
    return;
  }

  chartWrap.style.display = 'block';

  // ── Radar chart ────────────────────────────────────────────────────────────
  const metrics = [
    { key: 'xg',     label: 'xG' },
    { key: 'xa',     label: 'xA' },
    { key: 'xd',     label: 'xD',    derive: r => r.xg + r.xa },
    { key: 'shots_', label: 'Strzały' },
    { key: 'gole',   label: 'Gole' },
    { key: 'celne',  label: 'Celne' },
  ];

  // Normalize: find max per metric across ALL players (not just selected)
  const maxVals = metrics.map(m => {
    const vals = _allPlayerRows.map(r => m.derive ? m.derive(r) : r[m.key]);
    return Math.max(...vals, 0.001); // avoid div by 0
  });

  const datasets = selected.map((r, i) => {
    const data = metrics.map((m, mi) => {
      const raw = m.derive ? m.derive(r) : r[m.key];
      return maxVals[mi] > 0 ? raw / maxVals[mi] : 0;
    });
    const color = CMP_COLORS[i];
    return {
      label: `Nr ${r.num}`,
      data,
      backgroundColor: `${color}1a`,
      borderColor: color,
      borderWidth: 2,
      pointBackgroundColor: color,
      pointBorderColor: '#ffffff',
      pointBorderWidth: 1.5,
      pointRadius: 4,
      pointHoverRadius: 6,
    };
  });

  const ctx = document.getElementById('compareRadarChart').getContext('2d');
  if (_compareChart) _compareChart.destroy();
  _compareChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: metrics.map(m => m.label),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 300 },
      scales: {
        r: {
          min: 0,
          max: 1,
          ticks: { display: false },
          grid: { color: COLORS.gridLine },
          angleLines: { color: COLORS.gridLine },
          pointLabels: {
            font: { family: 'Arial, sans-serif', size: 13, weight: '700' },
            color: COLORS.axisTitle,
          },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: COLORS.legendText,
            font: { family: 'Arial, sans-serif', size: 13, weight: '600' },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: COLORS.tooltipBg,
          titleColor: '#9ca3af',
          bodyColor: COLORS.tooltipText,
          borderColor: '#374151',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: items => metrics[items[0].dataIndex].label,
            label: item => {
              const r = selected[item.datasetIndex];
              const m = metrics[item.dataIndex];
              const raw = m.derive ? m.derive(r) : r[m.key];
              const fmt = Number.isInteger(raw) ? raw : raw.toFixed(2);
              return ` Nr ${r.num}: ${fmt}`;
            },
          },
        },
      },
    },
  });

  // ── Tabela porównawcza ─────────────────────────────────────────────────────
  const allMetrics = [
    { label: 'xG',          fn: r => r.xg > 0 ? r.xg.toFixed(2) : '—',   best: 'max', float: true },
    { label: 'xA',          fn: r => r.xa > 0 ? r.xa.toFixed(2) : '—',   best: 'max', float: true },
    { label: 'xD',          fn: r => { const v = r.xg + r.xa; return v > 0 ? v.toFixed(2) : '—'; }, best: 'max', float: true },
    { label: 'xG / strzał', fn: r => r.shots_ > 0 ? (r.xg / r.shots_).toFixed(3) : '—', best: 'max', float: true },
    { label: 'Strzały',     fn: r => r.shots_ || '—', best: 'max', float: false },
    { label: 'Gole',        fn: r => r.gole   || '—', best: 'max', float: false },
    { label: 'Asysty',      fn: r => r.asysty || '—', best: 'max', float: false },
    { label: 'Celne',       fn: r => r.celne   || '—', best: 'max', float: false },
    { label: 'Niecelne',    fn: r => r.niecel  || '—', best: 'min', float: false },
    { label: 'Zablokowane', fn: r => r.zablok  || '—', best: 'max', float: false },
  ];

  const headerCells = selected.map((r, i) =>
    `<th style="color:${CMP_COLORS[i]};white-space:nowrap">Nr ${r.num}</th>`
  ).join('');

  const bodyRows = allMetrics.map(m => {
    const rawVals = selected.map(r => m.fn(r));
    // Find best (numeric) value index
    const numericVals = rawVals.map(v => parseFloat(v));
    const validNums = numericVals.filter(v => !isNaN(v));
    const bestVal = validNums.length ? (m.best === 'max' ? Math.max(...validNums) : Math.min(...validNums)) : null;

    const cells = rawVals.map((v, i) => {
      const isNum = !isNaN(parseFloat(v));
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
