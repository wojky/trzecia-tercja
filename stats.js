// ─── Statystyki & wykres kumulatywnego xG ───────────────────────────────────

// Paleta kolorów zgodna z aplikacją
const COLORS = {
  ourTeam:       '#e11d48',
  ourTeamFill:   'rgba(225, 29, 72, 0.12)',
  ourTeamPoint:  '#e11d48',
  opponent:      '#2563eb',
  opponentFill:  'rgba(37, 99, 235, 0.08)',
  opponentPoint: '#2563eb',
  gridLine:      '#e5e7eb',
  axisText:      '#6b7280',
  axisTitle:     '#374151',
  legendText:    '#111827',
  tooltipBg:     '#1f2937',
  tooltipText:   '#f9fafb',
};

const STATUS_LABELS = {
  'celne':                   'Celne',
  'zablokowany':             'Zablokowany',
  'niecelny':                'Niecelny',
  'interwencja-bramkarza':   'Interwencja bramkarza',
  'dosrodkowanie':           'Dośrodkowanie',
  'uderzenie-glowa':         'Uderzenie głową',
  'z-powietrza-noga':        'Z powietrza nogą',
  '1-kontakt':               '1 kontakt',
  'zza-pk':                  'Zza PK',
  'rzut-karny':              'Rzut karny',
  'po-bledzie-indywidualnym':'Po błędzie indywid.',
};

let xgChart = null;

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

  if (withTime.length === 0) return [{ x: 0, y: 0 }];

  let cum = 0;
  const points = [{ x: 0, y: 0 }];
  withTime.forEach(s => {
    cum += s.xg;
    points.push({ x: parseFloat(s.min.toFixed(1)), y: parseFloat(cum.toFixed(3)) });
  });
  return points;
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
          fill: true,
          tension: 0,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: COLORS.ourTeamPoint,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          stepped: false,
        },
        {
          label: 'Przeciwnik',
          data: oppPoints,
          borderColor: COLORS.opponent,
          backgroundColor: COLORS.opponentFill,
          borderWidth: 2,
          fill: true,
          tension: 0,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: COLORS.opponentPoint,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          stepped: false,
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
            title: items => `${items[0].parsed.x.toFixed(1)}'`,
            label: item => ` ${item.dataset.label}: ${item.parsed.y.toFixed(3)} xG`,
          },
        },
      },
    },
  });
}

// ─── Przełączanie zakładek ────────────────────────────────────────────────────

document.getElementById('tabMap').addEventListener('click', () => {
  document.getElementById('tabMap').classList.add('active');
  document.getElementById('tabStats').classList.remove('active');
  document.getElementById('mapPanel').style.display = 'block';
  document.getElementById('statsPanel').style.display = 'none';
  document.getElementById('shotListCard').style.display = 'block';
  document.getElementById('mainLayout').style.gridTemplateColumns = '';
});

document.getElementById('tabStats').addEventListener('click', () => {
  document.getElementById('tabStats').classList.add('active');
  document.getElementById('tabMap').classList.remove('active');
  document.getElementById('mapPanel').style.display = 'none';
  document.getElementById('statsPanel').style.display = 'block';
  document.getElementById('shotListCard').style.display = 'none';
  document.getElementById('mainLayout').style.gridTemplateColumns = '1fr';
  renderStats();
});
