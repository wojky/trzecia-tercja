// ─── Statystyki & wykres kumulatywnego xG ───────────────────────────────────
// COLORS, STATUS_LABELS — defined in config.js

let xgChart = null;
let shotDistChart = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseMinutes(t) {
  if (!t || t.trim() === '') return null;
  const parts = t.trim().split(':');
  if (parts.length === 2) return parseInt(parts[0]) + parseInt(parts[1]) / 60;
  if (parts.length === 1) return parseFloat(parts[0]);
  return null;
}

function calcTeamStats(list) {
  const count  = list.length;
  const goals  = list.filter(s => s.status.includes('gol')).length;
  const assists = list.filter(s => s.passerNumber && s.passerNumber.trim() !== '' && s.status.includes('gol')).length;
  const xg     = list.reduce((sum, s) => sum + (parseFloat(s.xg) || 0), 0);
  const xa     = list
    .filter(s => s.passerNumber && s.passerNumber.trim() !== '')
    .reduce((sum, s) => sum + (parseFloat(s.xg) || 0), 0);
  const xgps   = count > 0 ? xg / count : 0;
  return { count, goals, assists, xg, xa, xgps };
}

function buildTimeline(list) {
  const withTime = list
    .map(s => ({ min: parseMinutes(s.matchTime), xg: parseFloat(s.xg) || 0 }))
    .filter(s => s.min !== null)
    .sort((a, b) => a.min - b.min);

  if (withTime.length === 0) return [{ x: 0, y: 0, isStart: true }];

  let cum = 0;
  const points = [{ x: 0, y: 0, isStart: true }];
  withTime.forEach(s => {
    cum += s.xg;
    points.push({ x: parseFloat(s.min.toFixed(1)), y: parseFloat(cum.toFixed(3)) });
  });
  return points;
}

// ─── Rozkład uderzeń — helpers ───────────────────────────────────────────────

function makeHalfFilledCircle(color) {
  const d = 18;
  const canvas = document.createElement('canvas');
  canvas.width = d;
  canvas.height = d;
  const ctx = canvas.getContext('2d');
  const cx = d / 2, cy = d / 2, r = d / 2 - 2;
  // Prawa połowa zamalowana
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  // Pełny okrąg — obramowanie
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return canvas;
}

function shotCategory(s) {
  if (s.status.includes('zablokowany')) return 'zablokowany';
  if (s.status.includes('niecelny'))   return 'niecelny';
  return 'celne';
}

function buildScatterData(list, category) {
  return list
    .filter(s => parseMinutes(s.matchTime) !== null)
    .filter(s => shotCategory(s) === category)
    .map(s => ({
      x: parseFloat(parseMinutes(s.matchTime).toFixed(1)),
      y: parseFloat((parseFloat(s.xg) || 0).toFixed(3)),
      playerNumber: s.playerNumber || '—',
      statusStr: s.status.length ? s.status.join(', ') : '—',
    }));
}

function renderShotDistribution(teamShots, xAxisMax) {
  const halfOur = makeHalfFilledCircle(COLORS.ourTeam);
  const halfOpp = makeHalfFilledCircle(COLORS.opponent);

  const sharedTooltip = {
    backgroundColor: COLORS.tooltipBg,
    titleColor: '#9ca3af',
    bodyColor: COLORS.tooltipText,
    borderColor: '#374151',
    borderWidth: 1,
    padding: 10,
    callbacks: {
      title: items => `${items[0].parsed.x.toFixed(1)}'`,
      label: ctx => [
        ` ${ctx.dataset.label}`,
        ` xG: ${ctx.raw.y.toFixed(3)}`,
        ` Zawodnik: #${ctx.raw.playerNumber}`,
        ` Status: ${ctx.raw.statusStr}`,
      ],
    },
  };

  const datasets = [
    {
      label: 'Nasz — celne',
      data: buildScatterData(teamShots.ourTeam, 'celne'),
      backgroundColor: COLORS.ourTeam,
      borderColor: COLORS.ourTeam,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBorderWidth: 1.5,
    },
    {
      label: 'Nasz — niecelne',
      data: buildScatterData(teamShots.ourTeam, 'niecelny'),
      backgroundColor: 'transparent',
      borderColor: COLORS.ourTeam,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBorderWidth: 2,
    },
    {
      label: 'Nasz — zablokowane',
      data: buildScatterData(teamShots.ourTeam, 'zablokowany'),
      pointStyle: halfOur,
      pointRadius: 6,
      pointHoverRadius: 8,
    },
    {
      label: 'Przeciwnik — celne',
      data: buildScatterData(teamShots.opponent, 'celne'),
      backgroundColor: COLORS.opponent,
      borderColor: COLORS.opponent,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBorderWidth: 1.5,
    },
    {
      label: 'Przeciwnik — niecelne',
      data: buildScatterData(teamShots.opponent, 'niecelny'),
      backgroundColor: 'transparent',
      borderColor: COLORS.opponent,
      pointRadius: 6,
      pointHoverRadius: 8,
      pointBorderWidth: 2,
    },
    {
      label: 'Przeciwnik — zablokowane',
      data: buildScatterData(teamShots.opponent, 'zablokowany'),
      pointStyle: halfOpp,
      pointRadius: 6,
      pointHoverRadius: 8,
    },
  ];

  const canvas = document.getElementById('shotDistributionChart');
  if (shotDistChart) { shotDistChart.destroy(); shotDistChart = null; }

  shotDistChart = new Chart(canvas, {
    type: 'scatter',
    data: { datasets },
    options: {
      animation: { duration: 300 },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: xAxisMax,
          ticks: { stepSize: 15, color: COLORS.axisText, font: { family: 'Arial, sans-serif', size: 12 } },
          title: { display: true, text: 'Minuta meczu', color: COLORS.axisTitle, font: { family: 'Arial, sans-serif', size: 12, weight: '600' } },
          grid: { color: COLORS.gridLine },
          border: { color: COLORS.gridLine },
        },
        y: {
          beginAtZero: true,
          ticks: { color: COLORS.axisText, font: { family: 'Arial, sans-serif', size: 12 } },
          title: { display: true, text: 'xG', color: COLORS.axisTitle, font: { family: 'Arial, sans-serif', size: 12, weight: '600' } },
          grid: { color: COLORS.gridLine },
          border: { color: COLORS.gridLine },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: sharedTooltip,
      },
    },
  });

  // Renderuj własną legendę
  const legendEl = document.getElementById('shotDistLegend');
  if (legendEl) {
    const shapes = [
      {
        label: 'Celny',
        html: `<span class="legend-dot" style="background:currentColor"></span>`,
      },
      {
        label: 'Niecelny',
        html: `<span class="legend-dot-empty" style="border-color:currentColor"></span>`,
      },
      {
        label: 'Zablokowany',
        html: `<span class="legend-dot-half" style="border-color:currentColor; background:linear-gradient(to right, currentColor 50%, transparent 50%)"></span>`,
      },
    ];
    const teams = [
      { label: 'Nasz zespół', color: COLORS.ourTeam },
      { label: 'Przeciwnik',  color: COLORS.opponent },
    ];

    const shapeHtml = shapes.map(s =>
      `<span class="shot-dist-legend-item" style="color:${COLORS.ourTeam}">${s.html}` +
      `<span style="color:#374151">${s.label}</span></span>`
    ).join('');

    const teamHtml = teams.map(t =>
      `<span class="shot-dist-legend-item">` +
      `<span class="legend-dot" style="background:${t.color}"></span>` +
      `<span style="color:#374151">${t.label}</span></span>`
    ).join('');

    legendEl.innerHTML =
      `<div class="shot-dist-legend-group">${shapeHtml}</div>` +
      `<div class="shot-dist-legend-sep"></div>` +
      `<div class="shot-dist-legend-group">${teamHtml}</div>`;
  }
}

// ─── Główna funkcja renderująca ─────────────────────────────────────────────

function renderStats() {
  // Podziel uderzenia na drużyny
  const teamShots = { ourTeam: [], opponent: [] };
  shots.forEach(s => {
    const t = s.team === 'opponent' ? 'opponent' : 'ourTeam';
    teamShots[t].push(s);
  });

  // Aktualizuj liczby w panelu statystyk
  const our = calcTeamStats(teamShots.ourTeam);
  const opp = calcTeamStats(teamShots.opponent);

  document.getElementById('s-our-goals').textContent   = our.goals;
  document.getElementById('s-our-assists').textContent  = `${our.assists} asyst`;
  document.getElementById('s-our-xg').textContent       = our.xg.toFixed(2);
  document.getElementById('s-our-xa').textContent       = our.xa.toFixed(2);
  document.getElementById('s-our-shots').textContent    = our.count;
  document.getElementById('s-our-xgps').textContent     = our.xgps.toFixed(3);
  document.getElementById('s-opp-goals').textContent    = opp.goals;
  document.getElementById('s-opp-assists').textContent  = `${opp.assists} asyst`;
  document.getElementById('s-opp-xg').textContent       = opp.xg.toFixed(2);
  document.getElementById('s-opp-xa').textContent       = opp.xa.toFixed(2);
  document.getElementById('s-opp-shots').textContent    = opp.count;
  document.getElementById('s-opp-xgps').textContent     = opp.xgps.toFixed(3);

  // Podsumowanie statusów per drużyna
  function buildStatusCounts(list) {
    const counts = {};
    list.forEach(s => s.status.forEach(st => {
      counts[st] = (counts[st] || 0) + 1;
    }));
    counts['celne'] = list.filter(
      s => !s.status.includes('zablokowany') && !s.status.includes('niecelny')
    ).length;
    return counts;
  }

  function renderStatusGrid(id, counts) {
    document.getElementById(id).innerHTML = Object.entries(STATUS_LABELS)
      .map(([key, label]) =>
        `<div class="stats-status-row"><span>${label}</span><strong>${counts[key] ?? 0}</strong></div>`
      ).join('');
  }

  renderStatusGrid('s-status-grid-our', buildStatusCounts(teamShots.ourTeam));
  renderStatusGrid('s-status-grid-opp', buildStatusCounts(teamShots.opponent));

  // Buduj wykres
  const ourPoints = buildTimeline(teamShots.ourTeam);
  const oppPoints = buildTimeline(teamShots.opponent);

  // Oś X: domyślnie 90 minut, wydłuż jeśli któreś uderzenie jest późniejsze
  const allMinutes = shots
    .map(s => parseMinutes(s.matchTime))
    .filter(m => m !== null);
  const maxMinute = allMinutes.length > 0 ? Math.max(...allMinutes) : 0;
  const xAxisMax = maxMinute > 90 ? Math.ceil(maxMinute / 15) * 15 : 90;

  // Przedłuż linie do końca osi X
  const lastOur = ourPoints[ourPoints.length - 1];
  if (lastOur.x < xAxisMax) ourPoints.push({ x: xAxisMax, y: lastOur.y, isEnd: true });
  else lastOur.isEnd = true;
  const lastOpp = oppPoints[oppPoints.length - 1];
  if (lastOpp.x < xAxisMax) oppPoints.push({ x: xAxisMax, y: lastOpp.y, isEnd: true });
  else lastOpp.isEnd = true;

  renderShotDistribution(teamShots, xAxisMax);

  const chartCanvas = document.getElementById('xgTimelineChart');
  if (xgChart) { xgChart.destroy(); xgChart = null; }

  xgChart = new Chart(chartCanvas, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Nasz zespół',
          data: ourPoints,
          borderColor: COLORS.ourTeam,
          backgroundColor: COLORS.ourTeamFill,
          borderWidth: 2,
          fill: false,
          tension: 0,
          pointRadius: ctx => (ctx.raw?.isStart || ctx.raw?.isEnd) ? 3 : 4,
          pointHoverRadius: ctx => (ctx.raw?.isStart || ctx.raw?.isEnd) ? 5 : 6,
          pointBackgroundColor: ctx => (ctx.raw?.isStart || ctx.raw?.isEnd) ? 'transparent' : COLORS.ourTeamPoint,
          pointBorderColor: ctx => (ctx.raw?.isStart || ctx.raw?.isEnd) ? COLORS.ourTeam : '#ffffff',
          pointBorderWidth: 1.5,
          stepped: 'before',
        },
        {
          label: 'Przeciwnik',
          data: oppPoints,
          borderColor: COLORS.opponent,
          backgroundColor: COLORS.opponentFill,
          borderWidth: 2,
          fill: false,
          tension: 0,
          pointRadius: ctx => (ctx.raw?.isStart || ctx.raw?.isEnd) ? 3 : 4,
          pointHoverRadius: ctx => (ctx.raw?.isStart || ctx.raw?.isEnd) ? 5 : 6,
          pointBackgroundColor: ctx => (ctx.raw?.isStart || ctx.raw?.isEnd) ? 'transparent' : COLORS.opponentPoint,
          pointBorderColor: ctx => (ctx.raw?.isStart || ctx.raw?.isEnd) ? COLORS.opponent : '#ffffff',
          pointBorderWidth: 1.5,
          stepped: 'before',
        },
      ],
    },
    options: {
      parsing: { xAxisKey: 'x', yAxisKey: 'y' },
      animation: { duration: 300 },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: xAxisMax,
          ticks: {
            stepSize: 15,
            color: COLORS.axisText,
            font: { family: 'Arial, sans-serif', size: 12 },
          },
          title: {
            display: true,
            text: 'Minuta meczu',
            color: COLORS.axisTitle,
            font: { family: 'Arial, sans-serif', size: 12, weight: '600' },
          },
          grid: { color: COLORS.gridLine },
          border: { color: COLORS.gridLine },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: COLORS.axisText,
            font: { family: 'Arial, sans-serif', size: 12 },
          },
          title: {
            display: true,
            text: 'Kumulatywne xG',
            color: COLORS.axisTitle,
            font: { family: 'Arial, sans-serif', size: 12, weight: '600' },
          },
          grid: { color: COLORS.gridLine },
          border: { color: COLORS.gridLine },
        },
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: COLORS.legendText,
            font: { family: 'Arial, sans-serif', size: 13, weight: '600' },
            usePointStyle: true,
            pointStyle: 'line',
            pointStyleWidth: 24,
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
            title: items => {
              const raw = items[0].raw;
              if (raw?.isStart) return 'Rozpoczęcie meczu';
              if (raw?.isEnd) return 'Mecz zakończony';
              return `${items[0].parsed.x.toFixed(1)}'`;
            },
            label: item => ` ${item.dataset.label}: ${item.parsed.y.toFixed(3)} xG`,
          },
        },
      },
    },
  });
}

// ─── Przełączanie zakładek ────────────────────────────────────────────────────

function setActiveTab(activeId) {
  ['tabMap', 'tabStats', 'tabPlayers', 'tabSim'].forEach(id => {
    document.getElementById(id).classList.toggle('active', id === activeId);
  });
  document.getElementById('mapPanel').style.display     = activeId === 'tabMap'     ? 'block' : 'none';
  document.getElementById('statsPanel').style.display   = activeId === 'tabStats'   ? 'block' : 'none';
  document.getElementById('playersPanel').style.display = activeId === 'tabPlayers' ? 'block' : 'none';
  document.getElementById('simPanel').style.display     = activeId === 'tabSim'     ? 'block' : 'none';
  document.getElementById('shotListCard').style.display = activeId === 'tabMap' ? 'block' : 'none';
  document.getElementById('mainLayout').style.gridTemplateColumns = activeId === 'tabMap' ? '' : '1fr';
}

document.getElementById('tabMap').addEventListener('click', () => setActiveTab('tabMap'));

document.getElementById('tabStats').addEventListener('click', () => {
  setActiveTab('tabStats');
  renderStats();
});

document.getElementById('tabPlayers').addEventListener('click', () => {
  setActiveTab('tabPlayers');
  renderPlayers();
});

document.getElementById('tabSim').addEventListener('click', () => {
  setActiveTab('tabSim');
  renderSimulation();
});
