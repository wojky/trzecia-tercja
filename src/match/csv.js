import { state, shots } from '../core/state.js';
import { pitch } from '../core/config.js';
import { renderShotsList } from './shots.js';
import { drawPitch } from './pitch.js';
import { validateStart, syncVenueDisplay } from '../ui/setup.js';

// ─── CSV export ───────────────────────────────────────────────────────────────

async function downloadCsv(filename, content) {
  const csvWithBom = '\uFEFF' + content;
  const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8' });

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Plik CSV', accept: { 'text/csv': ['.csv'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportShotsToCsv() {
  if (shots.length === 0) {
    alert('Brak uderzeń do eksportu.');
    return;
  }

  const opponentNameInput   = document.getElementById('opponentName');
  const matchDateInput      = document.getElementById('matchDate');
  const venueSelect         = document.getElementById('venueSelect');
  const videoFragmentsCount = document.getElementById('videoFragmentsCount');

  const headers = [
    'id', 'opponent', 'matchDate', 'venue',
    'contextX', 'contextY', 'distance', 'status',
    'timestamp', 'matchTime', 'playerNumber', 'passerNumber',
    'xg', 'videoFragment', 'videoFragmentsCount', 'team',
    'assistPosX', 'assistPosY',
    'assistArrowX1', 'assistArrowY1', 'assistArrowX2', 'assistArrowY2',
    'assistArrowLength',
  ];

  const esc = (value) => {
    const s = String(value ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  };

  const lines = [headers.map(esc).join(',')];

  shots.forEach((shot, index) => {
    const row = [
      index + 1,
      opponentNameInput.value,
      matchDateInput.value,
      venueSelect.value,
      shot.contextX,
      shot.contextY,
      shot.distance,
      shot.status.join('|'),
      shot.timestamp,
      shot.matchTime,
      shot.playerNumber,
      shot.passerNumber,
      shot.xg,
      shot.videoFragment,
      videoFragmentsCount.value,
      shot.team,
      shot.assistPos ? shot.assistPos.x.toFixed(2) : '',
      shot.assistPos ? shot.assistPos.y.toFixed(2) : '',
      shot.assistArrow ? shot.assistArrow.x1.toFixed(2) : '',
      shot.assistArrow ? shot.assistArrow.y1.toFixed(2) : '',
      shot.assistArrow ? shot.assistArrow.x2.toFixed(2) : '',
      shot.assistArrow ? shot.assistArrow.y2.toFixed(2) : '',
      shot.assistArrow ? (() => {
        const scaleX = pitch.width / 68;
        const scaleY = pitch.height / 35;
        const dxM = (shot.assistArrow.x2 - shot.assistArrow.x1) / scaleX;
        const dyM = (shot.assistArrow.y2 - shot.assistArrow.y1) / scaleY;
        return Math.sqrt(dxM * dxM + dyM * dyM).toFixed(2);
      })() : '',
    ];
    lines.push(row.map(esc).join(','));
  });

  const csvContent     = lines.join('\n');
  const filenameDate   = matchDateInput.value || new Date().toISOString().slice(0, 10);
  const filenameOpp    = opponentNameInput.value.trim().replace(/[^a-zA-Z0-9\-_]/g, '_') || 'eksport';
  downloadCsv(`uderzenia-${filenameDate}-${filenameOpp}.csv`, csvContent);
}

// ─── CSV import ───────────────────────────────────────────────────────────────

function parseCsvLine(line) {
  const values = [];
  let current  = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

export function importFromCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) {
    alert('Plik CSV jest pusty lub nie zawiera danych.');
    return;
  }

  const headers = parseCsvLine(lines[0]).map(h => h.trim());

  const scaleX           = pitch.width / 68;
  const scaleY           = pitch.height / 35;
  const penaltyAreaLeftX = pitch.x + ((68 - 40.32) / 2) * scaleX;
  const originX          = penaltyAreaLeftX;
  const originY          = pitch.y;

  const imported = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const row  = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });

    const contextX = parseFloat(row.contextX);
    const contextY = parseFloat(row.contextY);
    if (isNaN(contextX) || isNaN(contextY)) continue;

    const x = originX + contextX * scaleX;
    const y = originY + contextY * scaleY;

    imported.push({
      x,
      y,
      contextX:     row.contextX,
      contextY:     row.contextY,
      distance:     row.distance || '',
      status:       row.status ? row.status.split('|').filter(Boolean) : [],
      timestamp:    row.timestamp || '',
      matchTime:    row.matchTime || '',
      playerNumber: row.playerNumber || '',
      passerNumber: row.passerNumber || '',
      xg:           row.xg || '',
      videoFragment: row.videoFragment || '',
      assistPos: row.assistPosX !== '' && !isNaN(parseFloat(row.assistPosX))
        ? { x: parseFloat(row.assistPosX), y: parseFloat(row.assistPosY) }
        : null,
      assistArrow: row.assistArrowX1 !== '' && !isNaN(parseFloat(row.assistArrowX1))
        ? { x1: parseFloat(row.assistArrowX1), y1: parseFloat(row.assistArrowY1),
            x2: parseFloat(row.assistArrowX2), y2: parseFloat(row.assistArrowY2) }
        : null,
      team: row.team === 'opponent' ? 'opponent' : 'ourTeam',
    });
  }

  if (imported.length === 0) {
    alert('Nie znaleziono poprawnych danych w pliku CSV.');
    return;
  }

  // Restore match metadata from first row
  const firstVals = parseCsvLine(lines[1]);
  const firstRow  = {};
  headers.forEach((h, idx) => { firstRow[h] = firstVals[idx] ?? ''; });

  const opponentNameInput   = document.getElementById('opponentName');
  const matchDateInput      = document.getElementById('matchDate');
  const venueSelect         = document.getElementById('venueSelect');
  const videoFragmentsCount = document.getElementById('videoFragmentsCount');
  const mainLayout          = document.getElementById('mainLayout');
  const startBtn            = document.getElementById('startBtn');

  if (firstRow.opponent)            opponentNameInput.value = firstRow.opponent;
  if (firstRow.matchDate)           matchDateInput.value    = firstRow.matchDate;
  if (firstRow.venue)               { venueSelect.value = firstRow.venue; syncVenueDisplay(firstRow.venue); }
  if (firstRow.videoFragmentsCount) videoFragmentsCount.value = Math.max(1, parseInt(firstRow.videoFragmentsCount) || 1);

  validateStart();
  mainLayout.style.display = '';
  document.getElementById('noMatchPlaceholder').style.display = 'none';
  startBtn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Aktywny';
  startBtn.classList.add('active');

  shots.length = 0;
  imported.forEach(s => shots.push(s));
  state.hoveredShotIndex = null;
  drawPitch();
  renderShotsList();
}
