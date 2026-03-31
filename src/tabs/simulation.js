import { shots } from '../core/state.js';
import { COLORS } from '../core/config.js';

let goalDistChart = null;
let goalDiffChart = null;

// ─── Math ─────────────────────────────────────────────────────────────────────

function goalsPMF(xgList) {
  let pmf = [1.0];
  for (const p of xgList) {
    const next = new Array(pmf.length + 1).fill(0);
    for (let k = 0; k < pmf.length; k++) {
      next[k]     += pmf[k] * (1 - p);
      next[k + 1] += pmf[k] * p;
    }
    pmf = next;
  }
  return pmf;
}

function pmfStats(pmf) {
  let mean = 0, variance = 0;
  pmf.forEach((p, k) => { mean     += p * k; });
  pmf.forEach((p, k) => { variance += p * (k - mean) ** 2; });
  return { mean, std: Math.sqrt(variance) };
}

function matchResult(pmfA, pmfB) {
  let win = 0, draw = 0, loss = 0;
  for (let i = 0; i < pmfA.length; i++) {
    for (let j = 0; j < pmfB.length; j++) {
      const p = pmfA[i] * pmfB[j];
      if      (i > j)  win  += p;
      else if (i === j) draw += p;
      else              loss += p;
    }
  }
  return { win, draw, loss };
}

function goalDiffPMF(pmfA, pmfB) {
  const minDiff = -(pmfB.length - 1);
  const maxDiff =  (pmfA.length - 1);
  const offset  = -minDiff;
  const diffArr = new Array(maxDiff - minDiff + 1).fill(0);
  for (let i = 0; i < pmfA.length; i++) {
    for (let j = 0; j < pmfB.length; j++) {
      diffArr[i - j + offset] += pmfA[i] * pmfB[j];
    }
  }
  return { diffArr, minDiff };
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function renderSimulation() {
  const teamShots = { ourTeam: [], opponent: [] };
  shots.forEach(s => {
    const t = s.team === 'opponent' ? 'opponent' : 'ourTeam';
    teamShots[t].push(s);
  });

  const xgOur = teamShots.ourTeam.map(s  => parseFloat(s.xg) || 0).filter(v => v > 0);
  const xgOpp = teamShots.opponent.map(s => parseFloat(s.xg) || 0).filter(v => v > 0);

  if (xgOur.length === 0 && xgOpp.length === 0) {
    document.getElementById('sim-empty').style.display   = 'block';
    document.getElementById('sim-content').style.display = 'none';
    return;
  }
  document.getElementById('sim-empty').style.display   = 'none';
  document.getElementById('sim-content').style.display = 'block';

  const pmfOur  = goalsPMF(xgOur.length ? xgOur : [0]);
  const pmfOpp  = goalsPMF(xgOpp.length ? xgOpp : [0]);
  const statsOur = pmfStats(pmfOur);
  const statsOpp = pmfStats(pmfOpp);
  const result   = matchResult(pmfOur, pmfOpp);

  const ppgOur = result.win * 3 + result.draw * 1;
  const ppgOpp = result.loss * 3 + result.draw * 1;
  const pct    = v => (v * 100).toFixed(1) + '%';

  document.getElementById('sim-win-bar').style.width  = (result.win  * 100) + '%';
  document.getElementById('sim-draw-bar').style.width = (result.draw * 100) + '%';
  document.getElementById('sim-loss-bar').style.width = (result.loss * 100) + '%';
  document.getElementById('sim-win-pct').textContent  = pct(result.win);
  document.getElementById('sim-draw-pct').textContent = pct(result.draw);
  document.getElementById('sim-loss-pct').textContent = pct(result.loss);

  document.getElementById('sim-our-xg').textContent  = statsOur.mean.toFixed(2);
  document.getElementById('sim-our-std').textContent = '±' + statsOur.std.toFixed(2);
  document.getElementById('sim-our-ppg').textContent = ppgOur.toFixed(2);
  document.getElementById('sim-opp-xg').textContent  = statsOpp.mean.toFixed(2);
  document.getElementById('sim-opp-std').textContent = '±' + statsOpp.std.toFixed(2);
  document.getElementById('sim-opp-ppg').textContent = ppgOpp.toFixed(2);

  const maxGoals   = Math.max(pmfOur.length, pmfOpp.length) - 1;
  const goalLabels = Array.from({ length: Math.min(maxGoals + 1, 10) }, (_, i) => i);

  if (goalDistChart) { goalDistChart.destroy(); goalDistChart = null; }
  goalDistChart = new Chart(document.getElementById('goalDistChart'), {
    type: 'bar',
    data: {
      labels: goalLabels,
      datasets: [
        {
          label: 'Nasz zespół',
          data:  goalLabels.map(k => ((pmfOur[k] || 0) * 100)),
          backgroundColor: COLORS.ourTeamFill.replace('0.12', '0.75'),
          borderColor:     COLORS.ourTeam,
          borderWidth: 1, borderRadius: 4,
        },
        {
          label: 'Przeciwnik',
          data:  goalLabels.map(k => ((pmfOpp[k] || 0) * 100)),
          backgroundColor: COLORS.opponentFill.replace('0.08', '0.65'),
          borderColor:     COLORS.opponent,
          borderWidth: 1, borderRadius: 4,
        },
      ],
    },
    options: {
      animation: { duration: 300 },
      scales: {
        x: {
          title: { display: true, text: 'Liczba goli', color: COLORS.axisTitle, font: { size: 12, weight: '600' } },
          ticks: { color: COLORS.axisText }, grid: { color: COLORS.gridLine }, border: { color: COLORS.gridLine },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Prawdopodobieństwo (%)', color: COLORS.axisTitle, font: { size: 12, weight: '600' } },
          ticks: { color: COLORS.axisText, callback: v => v.toFixed(1) + '%' },
          grid: { color: COLORS.gridLine }, border: { color: COLORS.gridLine },
        },
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: COLORS.legendText, font: { size: 13, weight: '600' }, usePointStyle: true, pointStyle: 'circle', padding: 16 },
        },
        tooltip: {
          backgroundColor: COLORS.tooltipBg, titleColor: '#9ca3af', bodyColor: COLORS.tooltipText,
          callbacks: {
            title: items => `P(${items[0].label} gole)`,
            label: item  => ` ${item.dataset.label}: ${item.parsed.y.toFixed(2)}%`,
          },
        },
      },
    },
  });

  const { diffArr, minDiff } = goalDiffPMF(pmfOur, pmfOpp);
  const diffLabels = diffArr.map((_, i) => i + minDiff);
  const showRange  = diffLabels.map((d, i) => ({ d, i })).filter(({ d }) => d >= -8 && d <= 8);

  if (goalDiffChart) { goalDiffChart.destroy(); goalDiffChart = null; }
  goalDiffChart = new Chart(document.getElementById('goalDiffChart'), {
    type: 'bar',
    data: {
      labels: showRange.map(({ d }) => d > 0 ? `+${d}` : String(d)),
      datasets: [{
        label: 'Różnica bramek',
        data:  showRange.map(({ i }) => (diffArr[i] * 100)),
        backgroundColor: showRange.map(({ d }) =>
          d > 0  ? COLORS.ourTeamFill.replace('0.12', '0.75') :
          d === 0 ? 'rgba(107, 114, 128, 0.7)' :
                    COLORS.opponentFill.replace('0.08', '0.65')
        ),
        borderColor: showRange.map(({ d }) =>
          d > 0 ? COLORS.ourTeam : d === 0 ? '#6b7280' : COLORS.opponent
        ),
        borderWidth: 1, borderRadius: 4,
      }],
    },
    options: {
      animation: { duration: 300 },
      scales: {
        x: {
          title: { display: true, text: 'Różnica bramek (nasz − przeciwnik)', color: COLORS.axisTitle, font: { size: 12, weight: '600' } },
          ticks: { color: COLORS.axisText }, grid: { color: COLORS.gridLine }, border: { color: COLORS.gridLine },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Prawdopodobieństwo (%)', color: COLORS.axisTitle, font: { size: 12, weight: '600' } },
          ticks: { color: COLORS.axisText, callback: v => v.toFixed(1) + '%' },
          grid: { color: COLORS.gridLine }, border: { color: COLORS.gridLine },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: COLORS.tooltipBg, titleColor: '#9ca3af', bodyColor: COLORS.tooltipText,
          callbacks: {
            title: items => {
              const d = showRange[items[0].dataIndex].d;
              return d > 0 ? `Wygrywamy o ${d}` : d === 0 ? 'Remis' : `Przegrywamy o ${Math.abs(d)}`;
            },
            label: item => ` Pr.: ${item.parsed.y.toFixed(2)}%`,
          },
        },
      },
    },
  });
}
