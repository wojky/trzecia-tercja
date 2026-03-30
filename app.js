const canvas = document.getElementById('pitchCanvas');
const ctx = canvas.getContext('2d');
const shotList = document.getElementById('shotList');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const counter = document.getElementById('counter');
const teamFilter = document.getElementById('teamFilter');

const shots = [];
let hoveredShotIndex = null;
let hoveredFromList = false;
let activeTeamFilter = 'all';
let isMirrored = false;
let isReadMode = false;

const mirrorBtn = document.getElementById('mirrorBtn');
const pitchHint = null;
const readModeBtn = document.getElementById('readModeBtn');
const videoFragmentsCount = document.getElementById('videoFragmentsCount');
const importFileInput = document.getElementById('importFileInput');

const opponentNameInput = document.getElementById('opponentName');
const matchDateInput = document.getElementById('matchDate');
const venueSelect = document.getElementById('venueSelect');
const startBtn = document.getElementById('startBtn');
const mainLayout = document.getElementById('mainLayout');
const setupImportBtn = document.getElementById('setupImportBtn');

function validateStart() {
  const ready =
    opponentNameInput.value.trim() !== '' &&
    matchDateInput.value !== '' &&
    venueSelect.value !== '';
  startBtn.disabled = !ready;
}

opponentNameInput.addEventListener('input', validateStart);
matchDateInput.addEventListener('change', validateStart);
venueSelect.addEventListener('change', validateStart);

startBtn.addEventListener('click', () => {
  mainLayout.style.display = '';
  startBtn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Aktywny';
  startBtn.classList.add('active');
});

function getFragmentOptions(selectedValue) {
  const count = Math.max(1, parseInt(videoFragmentsCount.value) || 1);
  let options = '';
  for (let i = 1; i <= count; i++) {
    options += `<option value="${i}" ${selectedValue == i ? 'selected' : ''}>${i}</option>`;
  }
  return options;
}

const pitch = {
  x: 40,
  y: 20,
  width: 720,
  height: 370,
};

function getVisibleShots() {
  if (activeTeamFilter === 'all') {
    return shots;
  }

  return shots.filter((shot) => shot.team === activeTeamFilter);
}

function drawPitch() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scaleX = pitch.width / 68;
  const scaleY = pitch.height / 35;

  ctx.fillStyle = '#2d8f45';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  if (isMirrored) {
    // obrot 180 wzgledem srodka boiska: translate(2*midX, 2*midY) + scale(-1,-1)
    const pitchMidX = pitch.x + pitch.width / 2;
    const pitchMidY = pitch.y + pitch.height / 2;
    ctx.translate(2 * pitchMidX, 2 * pitchMidY);
    ctx.scale(-1, -1);
  }

  ctx.fillStyle = '#339c50';
  ctx.fillRect(pitch.x, pitch.y, pitch.width, pitch.height);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;

  ctx.strokeRect(pitch.x, pitch.y, pitch.width, pitch.height);

  ctx.beginPath();
  ctx.moveTo(pitch.x, pitch.y);
  ctx.lineTo(pitch.x + pitch.width, pitch.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pitch.x, pitch.y + pitch.height);
  ctx.lineTo(pitch.x + pitch.width, pitch.y + pitch.height);
  ctx.stroke();

  const penaltyAreaWidth = 40.32 * scaleX;
  const penaltyAreaDepth = 16.5 * scaleY;
  const penaltyAreaX = pitch.x + (pitch.width - penaltyAreaWidth) / 2;
  ctx.strokeRect(penaltyAreaX, pitch.y, penaltyAreaWidth, penaltyAreaDepth);

  const goalAreaWidth = 18.32 * scaleX;
  const goalAreaDepth = 5.5 * scaleY;
  const goalAreaX = pitch.x + (pitch.width - goalAreaWidth) / 2;
  ctx.strokeRect(goalAreaX, pitch.y, goalAreaWidth, goalAreaDepth);

  const goalWidth = 7.32 * scaleX;
  const goalDepth = 2.2 * scaleY;
  const goalX = pitch.x + (pitch.width - goalWidth) / 2;
  ctx.strokeRect(goalX, pitch.y - goalDepth, goalWidth, goalDepth);

  const penaltySpotX = pitch.x + pitch.width / 2;
  const penaltySpotY = pitch.y + 11 * scaleY;
  ctx.beginPath();
  ctx.arc(penaltySpotX, penaltySpotY, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(penaltySpotX, penaltySpotY, 9.15 * scaleY, 0.23 * Math.PI, 0.77 * Math.PI, false);
  ctx.stroke();

  ctx.restore();

  // strzaly rysowane po restore() z jawnie obliczonym display X i Y
  const pitchMidX = pitch.x + pitch.width / 2;
  const pitchMidY = pitch.y + pitch.height / 2;
  const visibleShots = getVisibleShots();

  visibleShots.forEach((shot) => {
    const originalIndex = shots.indexOf(shot);
    const isHovered = originalIndex === hoveredShotIndex;
    const displayX = isMirrored ? (2 * pitchMidX - shot.x) : shot.x;
    const displayY = isMirrored ? (2 * pitchMidY - shot.y) : shot.y;
    drawShot(displayX, displayY, originalIndex + 1, isHovered, shot.team, shot);
  });
}

function drawShot(x, y, number, isHovered = false, team = 'ourTeam', shot = null) {
  const radius = isHovered ? 6 : 4;
  const fontSize = isHovered ? 7 : 5.5;
  const lineWidth = isHovered ? 1.5 : 1;
  const fillColor = team === 'opponent' ? '#2563eb' : '#e11d48';

  // draw goal lines and tooltip when hovered in read mode or from list
  if (isHovered && shot && (isReadMode || hoveredFromList)) {
    const scaleX = pitch.width / 68;
    const scaleY = pitch.height / 35;
    const goalHalfWidth = 7.32 / 2; // metres
    // goal centre in canvas coords (always top of pitch before mirror)
    const goalCentreCanvasX = pitch.x + pitch.width / 2;
    const goalCentreCanvasY = pitch.y;
    const postLCanvasX = goalCentreCanvasX - goalHalfWidth * scaleX;
    const postRCanvasX = goalCentreCanvasX + goalHalfWidth * scaleX;

    // apply mirror to goal coords
    const pitchMidX = pitch.x + pitch.width / 2;
    const pitchMidY = pitch.y + pitch.height / 2;
    const gCX = isMirrored ? 2 * pitchMidX - goalCentreCanvasX : goalCentreCanvasX;
    const gCY = isMirrored ? 2 * pitchMidY - goalCentreCanvasY : goalCentreCanvasY;
    const gLX = isMirrored ? 2 * pitchMidX - postLCanvasX : postLCanvasX;
    const gRX = isMirrored ? 2 * pitchMidX - postRCanvasX : postRCanvasX;
    const gPostY = gCY;

    // lines to posts
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(gLX, gPostY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(gRX, gPostY); ctx.stroke();
    // bold centre line
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(gCX, gCY); ctx.stroke();
    ctx.restore();

    // compute distance (metres) from shot canonical coords to goal centre
    const cxM = parseFloat(shot.contextX); // metres from origin
    const cyM = parseFloat(shot.contextY);
    // goal centre in metres: contextX origin is left of penalty area
    // pitch centre X = (68-40.32)/2 = 13.84m from left touch; goal centre is at pitch width centre = 34m from left touch
    // So goal centre contextX = 34 - 13.84 = 20.16
    const goalCxM = 20.16;
    const goalCyM = 0; // goal line
    const dx = cxM - goalCxM;
    const dy = cyM - goalCyM;
    const distM = Math.sqrt(dx * dx + dy * dy);

    // shooting angle (angle subtended by goal)
    const postLM = goalCxM - 7.32 / 2;
    const postRM = goalCxM + 7.32 / 2;
    const dL = Math.sqrt((cxM - postLM) ** 2 + cyM ** 2);
    const dR = Math.sqrt((cxM - postRM) ** 2 + cyM ** 2);
    const cosAngle = (dL * dL + dR * dR - 7.32 * 7.32) / (2 * dL * dR);
    const angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;

    // tooltip box
    const pad = 4;
    const lh = 9;
    const label1 = `${distM.toFixed(1)} m`;
    const label2 = `${angleDeg.toFixed(1)}\u00b0`;
    const xgVal = shot.xg && shot.xg !== '' ? shot.xg : 'n/a';
    const label3 = `xG: ${xgVal}`;
    ctx.font = 'bold 8px Arial';
    const w = Math.max(ctx.measureText(label1).width, ctx.measureText(label2).width, ctx.measureText(label3).width) + pad * 2;
    const h = lh * 3 + pad * 2;
    let tx = x + 8;
    let ty = y - h / 2;
    // keep inside canvas
    if (tx + w > canvas.width - 4) tx = x - w - 8;
    if (ty < 4) ty = 4;
    if (ty + h > canvas.height - 4) ty = canvas.height - h - 4;

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tx, ty, w, h, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label1, tx + pad, ty + pad);
    ctx.fillText(label2, tx + pad, ty + pad + lh);
    ctx.fillText(label3, tx + pad, ty + pad + lh * 2);
  }

  ctx.beginPath();
  ctx.fillStyle = fillColor;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), x, y + 0.5);
}

function renderShotsList() {
  const visibleShots = getVisibleShots();
  counter.textContent = String(visibleShots.length);

  if (visibleShots.length === 0) {
    shotList.innerHTML = '<div class="empty">Brak uderzeń dla wybranego filtra.</div>';
    return;
  }

  shotList.innerHTML = [...visibleShots].reverse()
    .map((shot) => {
      const index = shots.indexOf(shot);
      return `
      <div class="shot-item" data-index="${index}">
        <div class="shot-header-row">
          <strong>Uderzenie ${index + 1}</strong>
          <span class="shot-coords">x: ${shot.contextX} y: ${shot.contextY}</span>
        </div>
        <div class="shot-fields">
          <div class="shot-fields-row">
            <div class="shot-field">
              <label for="fragment-${index}">Fragment wideo</label>
              <select id="fragment-${index}" class="shot-text-input shot-fragment-select" data-index="${index}" data-field="videoFragment">
                ${getFragmentOptions(shot.videoFragment)}
              </select>
            </div>
            <div class="shot-field">
              <label for="timestamp-${index}">Timestamp</label>
              <input id="timestamp-${index}" type="text" class="shot-text-input" data-index="${index}" data-field="timestamp" value="${shot.timestamp || ''}" placeholder="np. 00:12:34" />
            </div>
          </div>
          <div class="shot-fields-row">
            <div class="shot-field">
              <label for="match-time-${index}">Czas meczu</label>
              <input id="match-time-${index}" type="text" class="shot-text-input" data-index="${index}" data-field="matchTime" value="${shot.matchTime || ''}" placeholder="np. 67:15" />
            </div>
            <div class="shot-field">
              <label for="xg-${index}">xG</label>
              <input id="xg-${index}" type="text" class="shot-text-input" data-index="${index}" data-field="xg" value="${shot.xg || ''}" placeholder="np. 0.18" />
            </div>
          </div>
          <div class="shot-fields-row">
            <div class="shot-field">
              <label for="player-${index}">Zawodnik</label>
              <input id="player-${index}" type="text" class="shot-text-input" data-index="${index}" data-field="playerNumber" value="${shot.playerNumber || ''}" placeholder="np. 9" />
            </div>
            <div class="shot-field">
              <label for="passer-${index}">Asysta</label>
              <input id="passer-${index}" type="text" class="shot-text-input" data-index="${index}" data-field="passerNumber" value="${shot.passerNumber || ''}" placeholder="np. 10" />
            </div>
          </div>
        </div>
        <div class="shot-team">
          <label class="shot-checkbox" for="team-home-${index}">
            <input id="team-home-${index}" type="checkbox" class="shot-team-checkbox" data-index="${index}" data-team="ourTeam" ${shot.team === 'ourTeam' ? 'checked' : ''} />
            Nasz zespół
          </label>
          <label class="shot-checkbox" for="team-opponent-${index}">
            <input id="team-opponent-${index}" type="checkbox" class="shot-team-checkbox" data-index="${index}" data-team="opponent" ${shot.team === 'opponent' ? 'checked' : ''} />
            Przeciwnik
          </label>
        </div>
        <div class="shot-actions">
          <select data-index="${index}" class="shot-status-select" multiple>
            <option value="gol" ${shot.status.includes('gol') ? 'selected' : ''}>GOL</option>
            <option value="zablokowany" ${shot.status.includes('zablokowany') ? 'selected' : ''}>Zablokowany</option>
            <option value="niecelny" ${shot.status.includes('niecelny') ? 'selected' : ''}>Niecelny</option>
            <option value="dosrodkowanie" ${shot.status.includes('dosrodkowanie') ? 'selected' : ''}>Dośrodkowanie</option>
            <option value="uderzenie-glowa" ${shot.status.includes('uderzenie-glowa') ? 'selected' : ''}>Uderzenie głową</option>
            <option value="z-powietrza-noga" ${shot.status.includes('z-powietrza-noga') ? 'selected' : ''}>Z powietrza nogą</option>
            <option value="1-kontakt" ${shot.status.includes('1-kontakt') ? 'selected' : ''}>1 kontakt</option>
            <option value="zza-pk" ${shot.status.includes('zza-pk') ? 'selected' : ''}>Zza PK</option>
            <option value="rzut-karny" ${shot.status.includes('rzut-karny') ? 'selected' : ''}>Rzut karny</option>
            <option value="interwencja-bramkarza" ${shot.status.includes('interwencja-bramkarza') ? 'selected' : ''}>Interwencja bramkarza</option>
            <option value="po-bledzie-indywidualnym" ${shot.status.includes('po-bledzie-indywidualnym') ? 'selected' : ''}>Po błędzie indywidualnym</option>
          </select>
          <button type="button" class="delete-shot-btn" data-index="${index}" title="Usuń"><i class="bi bi-trash3-fill"></i></button>
        </div>
      </div>
    `;
    })
    .join('');
}

function getCanvasCoordinates(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  return { x, y };
}

function isInsidePitch(x, y) {
  return (
    x >= pitch.x &&
    x <= pitch.x + pitch.width &&
    y >= pitch.y &&
    y <= pitch.y + pitch.height
  );
}

function createShot(x, y, team = 'ourTeam') {
  const scaleX = pitch.width / 68;
  const scaleY = pitch.height / 35;
  const penaltyAreaLeftX = pitch.x + ((68 - 40.32) / 2) * scaleX;
  const originX = penaltyAreaLeftX;
  const originY = pitch.y;

  const last = shots.length > 0 ? shots[shots.length - 1] : null;

  const cxM = ((x - originX) / scaleX);
  const cyM = ((y - originY) / scaleY);
  const goalCxM = 20.16;
  const goalCyM = 0;
  const distanceM = Math.sqrt((cxM - goalCxM) ** 2 + (cyM - goalCyM) ** 2).toFixed(2);

  return {
    x,
    y,
    contextX: cxM.toFixed(2),
    contextY: cyM.toFixed(2),
    distance: distanceM,
    status: [],
    timestamp: last ? last.timestamp : '',
    matchTime: last ? last.matchTime : '',
    playerNumber: '',
    passerNumber: '',
    xg: '',
    videoFragment: last ? last.videoFragment : '',
    team,
  };
}

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
      if (err.name === 'AbortError') return; // użytkownik anulował
    }
  }

  // Fallback dla przeglądarek bez File System Access API
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportShotsToCsv() {
  if (shots.length === 0) {
    alert('Brak uderzeń do eksportu.');
    return;
  }

  const headers = [
    'id',
    'opponent',
    'matchDate',
    'venue',
    'contextX',
    'contextY',
    'distance',
    'status',
    'timestamp',
    'matchTime',
    'playerNumber',
    'passerNumber',
    'xg',
    'videoFragment',
    'team'
  ];

  const escapeCsvValue = (value) => {
    const stringValue = String(value ?? '');
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const lines = [];
  lines.push(headers.map(escapeCsvValue).join(','));

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
      shot.team,
    ];

    lines.push(row.map(escapeCsvValue).join(','));
  });

  const csvContent = lines.join('\n');
  const filenameDate = matchDateInput.value || new Date().toISOString().slice(0, 10);
  const filenameOpponent = opponentNameInput.value.trim().replace(/[^a-zA-Z0-9\-_]/g, '_') || 'eksport';
  downloadCsv(`uderzenia-${filenameDate}-${filenameOpponent}.csv`, csvContent);
}

canvas.addEventListener('click', (event) => {
  if (isReadMode) return;
  const { x, y } = getCanvasCoordinates(event);

  const pitchMidX = pitch.x + pitch.width / 2;
  const pitchMidY = pitch.y + pitch.height / 2;
  const canonicalX = isMirrored ? (2 * pitchMidX - x) : x;
  const canonicalY = isMirrored ? (2 * pitchMidY - y) : y;

  if (!isInsidePitch(canonicalX, canonicalY)) return;

  shots.push(createShot(canonicalX, canonicalY, 'ourTeam'));
  drawPitch();
  renderShotsList();
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (isReadMode) return;
  const { x, y } = getCanvasCoordinates(event);

  const pitchMidX = pitch.x + pitch.width / 2;
  const pitchMidY = pitch.y + pitch.height / 2;
  const canonicalX = isMirrored ? (2 * pitchMidX - x) : x;
  const canonicalY = isMirrored ? (2 * pitchMidY - y) : y;

  if (!isInsidePitch(canonicalX, canonicalY)) return;

  shots.push(createShot(canonicalX, canonicalY, 'opponent'));
  drawPitch();
  renderShotsList();
});

clearBtn.addEventListener('click', () => {
  shots.length = 0;
  hoveredShotIndex = null;
  drawPitch();
  renderShotsList();
});

exportBtn.addEventListener('click', exportShotsToCsv);

readModeBtn.addEventListener('click', () => {
  isReadMode = !isReadMode;
  readModeBtn.classList.toggle('active', isReadMode);
  readModeBtn.innerHTML = isReadMode
    ? '<i class="bi bi-cursor-fill"></i> Tryb odczytu'
    : '<i class="bi bi-cursor"></i> Tryb odczytu';
  canvas.style.cursor = isReadMode ? 'crosshair' : 'default';
  if (!isReadMode) {
    hoveredShotIndex = null;
    drawPitch();
  }
});

mirrorBtn.addEventListener('click', () => {
  isMirrored = !isMirrored;
  mirrorBtn.classList.toggle('active', isMirrored);
  mirrorBtn.innerHTML = isMirrored
    ? '<i class="bi bi-arrow-down-circle-fill"></i> Kierunek ataku: dół'
    : '<i class="bi bi-arrow-up-circle-fill"></i> Kierunek ataku: góra';
  drawPitch();
});

videoFragmentsCount.addEventListener('change', () => {
  renderShotsList();
});

teamFilter.addEventListener('change', (event) => {
  activeTeamFilter = event.target.value;
  hoveredShotIndex = null;
  drawPitch();
  renderShotsList();
});

shotList.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('.delete-shot-btn');
  if (!deleteButton) return;

  const index = Number(deleteButton.dataset.index);
  shots.splice(index, 1);

  if (hoveredShotIndex === index) {
    hoveredShotIndex = null;
  } else if (hoveredShotIndex !== null && hoveredShotIndex > index) {
    hoveredShotIndex -= 1;
  }

  drawPitch();
  renderShotsList();
});

shotList.addEventListener('change', (event) => {
  const select = event.target.closest('.shot-status-select');
  if (select) {
    const index = Number(select.dataset.index);
    if (shots[index]) {
      shots[index].status = Array.from(select.selectedOptions).map(o => o.value);
    }
    return;
  }

  const fragmentSelect = event.target.closest('.shot-fragment-select');
  if (fragmentSelect) {
    const index = Number(fragmentSelect.dataset.index);
    if (shots[index]) {
      shots[index].videoFragment = fragmentSelect.value;
    }
    return;
  }

  const checkbox = event.target.closest('.shot-team-checkbox');
  if (checkbox) {
    const index = Number(checkbox.dataset.index);
    const team = checkbox.dataset.team;

    if (shots[index]) {
      shots[index].team = checkbox.checked ? team : 'ourTeam';
      renderShotsList();
    }
    return;
  }

  const input = event.target.closest('.shot-text-input');
  if (!input) return;

  const index = Number(input.dataset.index);
  const field = input.dataset.field;
  if (shots[index]) {
    shots[index][field] = input.value;
  }
});

shotList.addEventListener('input', (event) => {
  const input = event.target.closest('.shot-text-input');
  if (!input) return;

  const index = Number(input.dataset.index);
  const field = input.dataset.field;
  if (shots[index]) {
    shots[index][field] = input.value;
  }
});

canvas.addEventListener('mousemove', (event) => {
  if (!isReadMode) return;
  const { x, y } = getCanvasCoordinates(event);
  const pitchMidX = pitch.x + pitch.width / 2;
  const pitchMidY = pitch.y + pitch.height / 2;
  const visibleShots = getVisibleShots();
  let found = null;
  for (const shot of visibleShots) {
    const displayX = isMirrored ? (2 * pitchMidX - shot.x) : shot.x;
    const displayY = isMirrored ? (2 * pitchMidY - shot.y) : shot.y;
    const dist = Math.sqrt((x - displayX) ** 2 + (y - displayY) ** 2);
    if (dist <= 10) { found = shots.indexOf(shot); break; }
  }
  if (found !== hoveredShotIndex) {
    hoveredShotIndex = found;
    drawPitch();
  }
});

canvas.addEventListener('mouseleave', () => {
  if (!isReadMode) return;
  if (hoveredShotIndex !== null) {
    hoveredShotIndex = null;
    drawPitch();
  }
});

shotList.addEventListener('mouseover', (event) => {
  const shotItem = event.target.closest('.shot-item');
  if (!shotItem) return;

  hoveredFromList = true;
  hoveredShotIndex = Number(shotItem.dataset.index);
  drawPitch();
});

shotList.addEventListener('mouseout', (event) => {
  const shotItem = event.target.closest('.shot-item');
  if (!shotItem) return;

  const relatedTarget = event.relatedTarget;
  if (relatedTarget && shotItem.contains(relatedTarget)) return;

  hoveredFromList = false;
  hoveredShotIndex = null;
  drawPitch();
});

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

function importFromCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) {
    alert('Plik CSV jest pusty lub nie zawiera danych.');
    return;
  }

  const headers = parseCsvLine(lines[0]).map(h => h.trim());

  const scaleX = pitch.width / 68;
  const scaleY = pitch.height / 35;
  const penaltyAreaLeftX = pitch.x + ((68 - 40.32) / 2) * scaleX;
  const originX = penaltyAreaLeftX;
  const originY = pitch.y;

  const imported = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });

    const contextX = parseFloat(row.contextX);
    const contextY = parseFloat(row.contextY);
    if (isNaN(contextX) || isNaN(contextY)) continue;

    const x = originX + contextX * scaleX;
    const y = originY + contextY * scaleY;

    imported.push({
      x,
      y,
      contextX: row.contextX,
      contextY: row.contextY,
      distance: row.distance || '',
      status: row.status ? row.status.split('|').filter(Boolean) : [],
      timestamp: row.timestamp || '',
      matchTime: row.matchTime || '',
      playerNumber: row.playerNumber || '',
      passerNumber: row.passerNumber || '',
      xg: row.xg || '',
      videoFragment: row.videoFragment || '',
      team: row.team === 'opponent' ? 'opponent' : 'ourTeam',
    });
  }

  if (imported.length === 0) {
    alert('Nie znaleziono poprawnych danych w pliku CSV.');
    return;
  }

  // Restore match metadata from first row
  const firstRow = (() => {
    const vals = parseCsvLine(lines[1]);
    const r = {};
    headers.forEach((h, idx) => { r[h] = vals[idx] ?? ''; });
    return r;
  })();
  if (firstRow.opponent) opponentNameInput.value = firstRow.opponent;
  if (firstRow.matchDate) matchDateInput.value = firstRow.matchDate;
  if (firstRow.venue) venueSelect.value = firstRow.venue;
  validateStart();
  mainLayout.style.display = '';
  startBtn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Aktywny';
  startBtn.classList.add('active');

  shots.length = 0;
  imported.forEach(s => shots.push(s));
  hoveredShotIndex = null;
  drawPitch();
  renderShotsList();
}

setupImportBtn.addEventListener('click', () => {
  importFileInput.value = '';
  importFileInput.click();
});

importFileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => importFromCsv(e.target.result);
  reader.readAsText(file, 'UTF-8');
});

drawPitch();
renderShotsList();

// Statystyki i zakładki obsługiwane przez stats.js
