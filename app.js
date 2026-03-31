const canvas = document.getElementById('pitchCanvas');
const ctx = canvas.getContext('2d');
const shotList = document.getElementById('shotList');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const counter = document.getElementById('counter');
const teamFilter = document.getElementById('teamFilter');

// ─── Sidebar toggle ─────────────────────────────────────────
const _sidebar = document.getElementById('sidebar');
const _shell = document.querySelector('.app-shell');

function _updateSidebarState() {
  const isCollapsed = _sidebar.classList.contains('collapsed');
  _shell.classList.toggle('sidebar-collapsed', isCollapsed);
}

document.getElementById('sidebarToggleBtn').addEventListener('click', () => {
  _sidebar.classList.remove('collapsed');
  _updateSidebarState();
});
document.getElementById('sidebarCollapseBtn').addEventListener('click', () => {
  _sidebar.classList.add('collapsed');
  _updateSidebarState();
});

_updateSidebarState();

const shots = [];
let hoveredShotIndex = null;
let hoveredFromList = false;
let activeTeamFilter = 'all';
let isMirrored = false;
let isReadMode = false;
let assistModeIndex = null;
let _assistToastTimer = null;
let assistSubMode = 'person'; // 'person' | 'arrow'
let _arrowDrawing = false;
let _arrowStart = null;      // { displayX, displayY, canonicalX, canonicalY }
let _arrowPreviewEnd = null; // { displayX, displayY }

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

// ── Custom venue select ────────────────────────────────────────────────────
const _venueTrigger  = document.getElementById('venueSelectTrigger');
const _venueDropdown = document.getElementById('venueSelectDropdown');
const _venueLabel    = document.getElementById('venueSelectLabel');

const VENUE_LABELS = { '': '— wybierz —', dom: 'Dom', wyjazd: 'Wyjazd', neutralne: 'Neutralne' };

function _syncVenueDisplay(val) {
  _venueLabel.textContent = VENUE_LABELS[val] ?? val;
  _venueDropdown.querySelectorAll('.custom-select-option').forEach(opt => {
    opt.setAttribute('aria-selected', opt.dataset.value === val ? 'true' : 'false');
  });
}

_venueTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = !_venueDropdown.hidden;
  _venueDropdown.hidden = isOpen;
  _venueTrigger.setAttribute('aria-expanded', String(!isOpen));
});

_venueDropdown.addEventListener('click', (e) => {
  const opt = e.target.closest('.custom-select-option');
  if (!opt) return;
  const val = opt.dataset.value;
  venueSelect.value = val;
  venueSelect.dispatchEvent(new Event('change'));
  _syncVenueDisplay(val);
  _venueDropdown.hidden = true;
  _venueTrigger.setAttribute('aria-expanded', 'false');
});

document.addEventListener('click', () => {
  if (!_venueDropdown.hidden) {
    _venueDropdown.hidden = true;
    _venueTrigger.setAttribute('aria-expanded', 'false');
  }
  document.querySelectorAll('.shot-frag-dropdown:not([hidden])').forEach(d => {
    d.hidden = true;
    const trigger = d.closest('.custom-select-wrap').querySelector('.shot-frag-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  });
});

startBtn.addEventListener('click', () => {
  mainLayout.style.display = '';
  document.getElementById('noMatchPlaceholder').style.display = 'none';
  startBtn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Aktywny';
  startBtn.classList.add('active');
});

function showAssistToast(msg) {
  document.getElementById('assistToastMsg').textContent = msg;
  const toast = document.getElementById('assistToast');
  clearTimeout(_assistToastTimer);
  toast.classList.add('visible');
  _assistToastTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
}

function enterAssistMode(index) {
  assistModeIndex = index;
  assistSubMode = 'person';
  _arrowDrawing = false;
  _arrowStart = null;
  _arrowPreviewEnd = null;
  document.querySelectorAll('.shot-passer-edit-btn').forEach(b => b.classList.remove('assist-active'));
  const btn = document.querySelector(`.shot-item[data-index="${index}"] .shot-passer-edit-btn`);
  if (btn) btn.classList.add('assist-active');
  document.getElementById('assistModeBar').style.display = 'flex';
  // default: person button selected
  document.getElementById('assistModePersonBtn').classList.add('selected');
  document.getElementById('assistModeArrowBtn').classList.remove('selected');
  showAssistToast('Tryb rysowania asysty');
}

function cancelAssistMode() {
  document.querySelectorAll('.shot-passer-edit-btn').forEach(b => b.classList.remove('assist-active'));
  assistModeIndex = null;
  assistSubMode = 'person';
  _arrowDrawing = false;
  _arrowStart = null;
  _arrowPreviewEnd = null;
  document.getElementById('assistModeBar').style.display = 'none';
  document.getElementById('assistModePersonBtn').classList.remove('selected');
  document.getElementById('assistModeArrowBtn').classList.remove('selected');
}

function getFragmentOptions(selectedValue) {
  const count = Math.max(1, parseInt(videoFragmentsCount.value) || 1);
  let options = '';
  for (let i = 1; i <= count; i++) {
    options += `<option value="${i}" ${selectedValue == i ? 'selected' : ''}>${i}</option>`;
  }
  return options;
}

function getFragmentCustomSelect(index, selectedValue) {
  const selVal = selectedValue || 1;
  const count = Math.max(1, parseInt(videoFragmentsCount.value) || 1);
  let liItems = '';
  for (let i = 1; i <= count; i++) {
    liItems += `<li class="custom-select-option frag-opt" data-value="${i}" data-index="${index}" role="option" aria-selected="${selVal == i ? 'true' : 'false'}">${i}</li>`;
  }
  return `<div class="custom-select-wrap shot-fragment-wrap">
      <select id="fragment-${index}" class="shot-fragment-select" data-index="${index}" data-field="videoFragment" style="display:none" aria-hidden="true">${getFragmentOptions(selectedValue)}</select>
      <button type="button" class="custom-select-trigger shot-frag-trigger" data-index="${index}" aria-haspopup="listbox" aria-expanded="false"><span class="shot-frag-label">${selVal}</span><i class="bi bi-chevron-down custom-select-chevron"></i></button>
      <ul class="custom-select-dropdown shot-frag-dropdown" hidden role="listbox">${liItems}</ul>
    </div>`;
}

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

  // Stripes anchored to key lines: 0, 5.5, 11, 16.5, 22, 28.5, 35m
  const stripesM = [0, 5.5, 11, 16.5, 22, 28.5, 35];
  const stripeColors = ['#2e9148', '#39a856'];
  for (let s = 0; s < stripesM.length - 1; s++) {
    const sy = pitch.y + stripesM[s] * scaleY;
    const sh = (stripesM[s + 1] - stripesM[s]) * scaleY;
    ctx.fillStyle = stripeColors[s % 2];
    ctx.fillRect(pitch.x, sy, pitch.width, sh);
  }

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
  const visibleShots = assistModeIndex !== null
    ? shots.filter((_, i) => i === assistModeIndex)
    : getVisibleShots();

  visibleShots.forEach((shot) => {
    const originalIndex = shots.indexOf(shot);
    const isHovered = originalIndex === hoveredShotIndex;
    const isAssistTarget = originalIndex === assistModeIndex;
    const showOverlay = isAssistTarget || (isHovered && (isReadMode || hoveredFromList));
    const displayX = isMirrored ? (2 * pitchMidX - shot.x) : shot.x;
    const displayY = isMirrored ? (2 * pitchMidY - shot.y) : shot.y;
    if (showOverlay) drawAssistOverlay(shot, isAssistTarget, displayX, displayY);
    drawShot(displayX, displayY, originalIndex + 1, isHovered, shot.team, shot);
  });
}

function _drawArrow(x1, y1, x2, y2, isPreview) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 5) return;
  ctx.save();
  ctx.strokeStyle = isPreview ? 'rgba(251,191,36,0.7)' : '#fbbf24';
  ctx.fillStyle  = isPreview ? 'rgba(251,191,36,0.7)' : '#fbbf24';
  ctx.lineWidth = 2.5;
  if (isPreview) ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const angle = Math.atan2(dy, dx);
  const headLen = 12;
  const headAngle = Math.PI / 7;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - headAngle), y2 - headLen * Math.sin(angle - headAngle));
  ctx.lineTo(x2 - headLen * Math.cos(angle + headAngle), y2 - headLen * Math.sin(angle + headAngle));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawAssistOverlay(shot, isAssistTarget, shotDisplayX, shotDisplayY) {
  const pitchMidX = pitch.x + pitch.width / 2;
  const pitchMidY = pitch.y + pitch.height / 2;

  if (shot.assistPos) {
    const px = isMirrored ? (2 * pitchMidX - shot.assistPos.x) : shot.assistPos.x;
    const py = isMirrored ? (2 * pitchMidY - shot.assistPos.y) : shot.assistPos.y;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251,191,36,0.9)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', px, py + 0.5);
  }

  if (shot.assistArrow) {
    const x1 = isMirrored ? (2 * pitchMidX - shot.assistArrow.x1) : shot.assistArrow.x1;
    const y1 = isMirrored ? (2 * pitchMidY - shot.assistArrow.y1) : shot.assistArrow.y1;
    const x2 = isMirrored ? (2 * pitchMidX - shot.assistArrow.x2) : shot.assistArrow.x2;
    const y2 = isMirrored ? (2 * pitchMidY - shot.assistArrow.y2) : shot.assistArrow.y2;
    _drawArrow(x1, y1, x2, y2, false);
  }

  // live arrow preview while dragging
  if (isAssistTarget && assistSubMode === 'arrow' && _arrowDrawing && _arrowStart && _arrowPreviewEnd) {
    _drawArrow(_arrowStart.displayX, _arrowStart.displayY, _arrowPreviewEnd.displayX, _arrowPreviewEnd.displayY, true);
  }
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
          <div class="shot-item-menu-wrap">
            <button type="button" class="shot-item-menu-btn" data-index="${index}" title="Opcje"><i class="bi bi-three-dots-vertical"></i></button>
            <div class="shot-item-dropdown" hidden>
              <button type="button" class="shot-item-dropdown-item danger delete-shot-btn" data-index="${index}">
                <i class="bi bi-trash3"></i> Usuń uderzenie
              </button>
            </div>
          </div>
        </div>
        <div class="shot-fields">
          <div class="shot-fields-row">
            <div class="shot-field">
              <label for="fragment-${index}">Fragment wideo</label>
              ${getFragmentCustomSelect(index, shot.videoFragment)}
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
              <div class="shot-field-input-row">
                <input id="xg-${index}" type="text" class="shot-text-input" data-index="${index}" data-field="xg" value="${shot.xg || ''}" placeholder="np. 0.18" />
                <button type="button" class="shot-xg-recalc-btn" data-index="${index}" title="Przelicz xG według aktywnego modelu"><i class="bi bi-arrow-repeat"></i></button>
              </div>
            </div>
          </div>
          <div class="shot-fields-row">
            <div class="shot-field">
              <label for="player-${index}">Zawodnik</label>
              <input id="player-${index}" type="text" class="shot-text-input" data-index="${index}" data-field="playerNumber" value="${shot.playerNumber || ''}" placeholder="np. 9" />
            </div>
            <div class="shot-field">
              <label for="passer-${index}">Asysta</label>
              <div class="shot-field-input-row">
                <input id="passer-${index}" type="text" class="shot-text-input" data-index="${index}" data-field="passerNumber" value="${shot.passerNumber || ''}" placeholder="np. 10" />
                <button type="button" class="shot-passer-edit-btn${assistModeIndex === index ? ' assist-active' : ''}" title="Tryb rysowania asysty"><i class="bi bi-pencil"></i></button>
              </div>
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
          <select data-index="${index}" class="shot-status-select" multiple size="12">
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
            <option value="sfg-strzal" ${shot.status.includes('sfg-strzal') ? 'selected' : ''}>SFG strzał</option>
          </select>
        </div>
      </div>
    `;
    })
    .join('');

  if (isReadMode) {
    document.querySelectorAll('#shotList input, #shotList select, #shotList button:not(.shot-item-menu-btn)').forEach(el => {
      el.disabled = true;
    });
  }
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

/**
 * Compute xG — delegates to the currently selected model from settings.js.
 * Falls back to the built-in logistic model if settings.js is not loaded yet.
 */
function computeXg(cxM, cyM, statusArray) {
  if (typeof xgModels !== 'undefined' && typeof activeXgModelKey !== 'undefined') {
    const model = xgModels[activeXgModelKey];
    if (model) return model.compute(cxM, cyM, statusArray);
  }
  // Fallback: built-in logistic model
  return _xgLogistic(cxM, cyM, statusArray);
}

/**
 * Built-in 2-feature logistic regression (distance + goal angle).
 * Coordinate system: cxM = metres from penalty-area left edge,
 * cyM = metres from goal line (positive = inside pitch).
 */
function _xgLogistic(cxM, cyM, statusArray) {
  const cx = parseFloat(cxM);
  const cy = parseFloat(cyM);
  const status = Array.isArray(statusArray) ? statusArray : [];

  if (status.includes('rzut-karny')) return 0.79;
  if (cy <= 0) return 0.01;

  const GOAL_X    = 20.16;
  const GOAL_HALF = 3.66;

  const dist = Math.sqrt((cx - GOAL_X) ** 2 + cy ** 2);

  const a1 = Math.atan2(-cy, GOAL_X - GOAL_HALF - cx);
  const a2 = Math.atan2(-cy, GOAL_X + GOAL_HALF - cx);
  let angle = Math.abs(a1 - a2);
  if (angle > Math.PI) angle = 2 * Math.PI - angle;

  const isHeader = status.includes('uderzenie-glowa');
  const logit = isHeader
    ? -3.8 + (-0.05 * dist) + (2.5 * angle)
    : -3.0 + (-0.05 * dist) + (3.0 * angle);

  return Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-logit))));
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
    xg: computeXg(cxM, cyM, []).toFixed(2),
    videoFragment: last ? last.videoFragment : '',
    assistPos: null,
    assistArrow: null,
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
    'videoFragmentsCount',
    'team',
    'assistPosX',
    'assistPosY',
    'assistArrowX1',
    'assistArrowY1',
    'assistArrowX2',
    'assistArrowY2',
    'assistArrowLength',
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

  if (assistModeIndex !== null) {
    if (assistSubMode === 'person') {
      shots[assistModeIndex].assistPos = { x: canonicalX, y: canonicalY };
      drawPitch();
    }
    // arrow mode handled by mousedown/mouseup
    return;
  }

  shots.push(createShot(canonicalX, canonicalY, 'ourTeam'));
  drawPitch();
  renderShotsList();
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (assistModeIndex !== null) return;
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

canvas.addEventListener('mousedown', (event) => {
  if (assistModeIndex === null || assistSubMode !== 'arrow') return;
  if (event.button !== 0) return;
  const { x, y } = getCanvasCoordinates(event);
  const pitchMidX = pitch.x + pitch.width / 2;
  const pitchMidY = pitch.y + pitch.height / 2;
  const canonicalX = isMirrored ? (2 * pitchMidX - x) : x;
  const canonicalY = isMirrored ? (2 * pitchMidY - y) : y;
  if (!isInsidePitch(canonicalX, canonicalY)) return;
  _arrowDrawing = true;
  _arrowStart = { displayX: x, displayY: y, canonicalX, canonicalY };
  _arrowPreviewEnd = { displayX: x, displayY: y };
});

canvas.addEventListener('mouseup', (event) => {
  if (!_arrowDrawing) return;
  _arrowDrawing = false;
  if (!_arrowStart) { _arrowStart = null; _arrowPreviewEnd = null; return; }
  const { x, y } = getCanvasCoordinates(event);
  const pitchMidX = pitch.x + pitch.width / 2;
  const pitchMidY = pitch.y + pitch.height / 2;
  const canonicalX = isMirrored ? (2 * pitchMidX - x) : x;
  const canonicalY = isMirrored ? (2 * pitchMidY - y) : y;
  const dx = x - _arrowStart.displayX;
  const dy = y - _arrowStart.displayY;
  if (Math.sqrt(dx * dx + dy * dy) > 5) {
    shots[assistModeIndex].assistArrow = {
      x1: _arrowStart.canonicalX, y1: _arrowStart.canonicalY,
      x2: canonicalX, y2: canonicalY,
    };
  }
  _arrowStart = null;
  _arrowPreviewEnd = null;
  drawPitch();
});

clearBtn.addEventListener('click', () => {
  if (!window.confirm(`Usunąć wszystkie uderzenia (${shots.length})?\n\nTej operacji nie można cofnąć.`)) return;
  cancelAssistMode();
  shots.length = 0;
  hoveredShotIndex = null;
  drawPitch();
  renderShotsList();
  document.getElementById('shotListMenu').hidden = true;
});

const shotListMenuBtn = document.getElementById('shotListMenuBtn');
const shotListMenu = document.getElementById('shotListMenu');
shotListMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  shotListMenu.hidden = !shotListMenu.hidden;
});
document.addEventListener('click', () => {
  shotListMenu.hidden = true;
  document.querySelectorAll('.shot-item-dropdown:not([hidden])').forEach(d => d.hidden = true);
});
shotListMenu.addEventListener('click', (e) => e.stopPropagation());

exportBtn.addEventListener('click', exportShotsToCsv);

readModeBtn.addEventListener('click', () => {
  isReadMode = !isReadMode;
  readModeBtn.classList.toggle('active', isReadMode);
  readModeBtn.innerHTML = isReadMode
    ? '<i class="bi bi-cursor-fill"></i> Tryb odczytu'
    : '<i class="bi bi-cursor"></i> Tryb odczytu';
  canvas.style.cursor = isReadMode ? 'crosshair' : 'default';

  // block/unblock shot list inputs
  document.querySelectorAll('#shotList input, #shotList select, #shotList button:not(.shot-item-menu-btn)').forEach(el => {
    el.disabled = isReadMode;
  });
  // block/unblock match setup inputs
  document.querySelectorAll('.match-setup input, .match-setup select').forEach(el => {
    el.disabled = isReadMode;
  });

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

document.getElementById('videoFragmentsMinus').addEventListener('click', () => {
  const val = Math.max(1, parseInt(videoFragmentsCount.value) || 1);
  if (val > 1) { videoFragmentsCount.value = val - 1; renderShotsList(); }
});

document.getElementById('videoFragmentsPlus').addEventListener('click', () => {
  const val = parseInt(videoFragmentsCount.value) || 1;
  videoFragmentsCount.value = val + 1;
  renderShotsList();
});

document.getElementById('assistModeCancelBtn').addEventListener('click', cancelAssistMode);

document.getElementById('assistModeClearBtn').addEventListener('click', () => {
  if (assistModeIndex === null) return;
  shots[assistModeIndex].assistPos   = null;
  shots[assistModeIndex].assistArrow = null;
  drawPitch();
});

document.getElementById('assistModePersonBtn').addEventListener('click', () => {
  assistSubMode = 'person';
  document.getElementById('assistModePersonBtn').classList.add('selected');
  document.getElementById('assistModeArrowBtn').classList.remove('selected');
});

document.getElementById('assistModeArrowBtn').addEventListener('click', () => {
  assistSubMode = 'arrow';
  document.getElementById('assistModeArrowBtn').classList.add('selected');
  document.getElementById('assistModePersonBtn').classList.remove('selected');
});

teamFilter.addEventListener('change', (event) => {
  activeTeamFilter = event.target.value;
  hoveredShotIndex = null;
  drawPitch();
  renderShotsList();
});

shotList.addEventListener('click', (event) => {
  // fragment custom select – trigger
  const fragTrigger = event.target.closest('.shot-frag-trigger');
  if (fragTrigger) {
    event.stopPropagation();
    const wrap = fragTrigger.closest('.custom-select-wrap');
    const dd = wrap.querySelector('.shot-frag-dropdown');
    document.querySelectorAll('.shot-frag-dropdown:not([hidden])').forEach(d => {
      if (d !== dd) {
        d.hidden = true;
        d.closest('.custom-select-wrap').querySelector('.shot-frag-trigger').setAttribute('aria-expanded', 'false');
      }
    });
    dd.hidden = !dd.hidden;
    fragTrigger.setAttribute('aria-expanded', String(!dd.hidden));
    return;
  }

  // fragment custom select – option
  const fragOpt = event.target.closest('.frag-opt');
  if (fragOpt) {
    event.stopPropagation();
    const val = fragOpt.dataset.value;
    const wrap = fragOpt.closest('.custom-select-wrap');
    const select = wrap.querySelector('.shot-fragment-select');
    select.value = val;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    wrap.querySelector('.shot-frag-label').textContent = val;
    wrap.querySelectorAll('.frag-opt').forEach(o => o.setAttribute('aria-selected', o.dataset.value === val ? 'true' : 'false'));
    wrap.querySelector('.shot-frag-trigger').setAttribute('aria-expanded', 'false');
    wrap.querySelector('.shot-frag-dropdown').hidden = true;
    return;
  }

  // shot item kebab menu toggle
  const shotMenuBtn = event.target.closest('.shot-item-menu-btn');
  if (shotMenuBtn) {
    event.stopPropagation();
    const wrap = shotMenuBtn.closest('.shot-item-menu-wrap');
    const dropdown = wrap.querySelector('.shot-item-dropdown');
    // close all other open shot dropdowns first
    document.querySelectorAll('.shot-item-dropdown:not([hidden])').forEach(d => {
      if (d !== dropdown) d.hidden = true;
    });
    dropdown.hidden = !dropdown.hidden;
    return;
  }

  // prevent click inside a shot dropdown from bubbling to document (which would close it)
  const shotDropdown = event.target.closest('.shot-item-dropdown');
  if (shotDropdown) {
    event.stopPropagation();
  }

  const xgRecalcBtn = event.target.closest('.shot-xg-recalc-btn');
  if (xgRecalcBtn) {
    const index = Number(xgRecalcBtn.dataset.index);
    const shot = shots[index];
    if (!shot) return;
    const modelName = (typeof xgModels !== 'undefined' && typeof activeXgModelKey !== 'undefined')
      ? xgModels[activeXgModelKey].name
      : 'domyślny';
    const confirmed = window.confirm(
      `Przelicz xG (i xA) dla tego uderzenia?\n\nModel: „${modelName}"\n\nAktualna wartość xG (${shot.xg || '—'}) zostanie nadpisana.\nxA podającego zostanie automatycznie zaktualizowane.`
    );
    if (!confirmed) return;
    const newXg = computeXg(shot.contextX, shot.contextY, shot.status).toFixed(2);
    shot.xg = newXg;
    const input = document.querySelector(`#xg-${index}`);
    if (input) input.value = newXg;
    return;
  }

  const passerEditBtn = event.target.closest('.shot-passer-edit-btn');
  if (passerEditBtn) {
    const shotItem = passerEditBtn.closest('.shot-item');
    const index = Number(shotItem.dataset.index);
    if (assistModeIndex === index) {
      cancelAssistMode();
    } else {
      enterAssistMode(index);
    }
    return;
  }

  const deleteButton = event.target.closest('.delete-shot-btn');
  if (!deleteButton) return;

  const index = Number(deleteButton.dataset.index);
  if (!window.confirm(`Usunąć uderzenie ${index + 1}?\n\nTej operacji nie można cofnąć.`)) return;

  if (assistModeIndex === index) {
    cancelAssistMode();
  } else if (assistModeIndex !== null && assistModeIndex > index) {
    assistModeIndex -= 1;
  }
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
      // Recalculate xG whenever status tags change (penalty / header affect it significantly)
      const newXg = computeXg(shots[index].contextX, shots[index].contextY, shots[index].status).toFixed(2);
      shots[index].xg = newXg;
      const xgInput = document.querySelector(`#xg-${index}`);
      if (xgInput) xgInput.value = newXg;
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
  // Arrow preview while dragging in assist mode
  if (assistModeIndex !== null && assistSubMode === 'arrow' && _arrowDrawing) {
    const { x, y } = getCanvasCoordinates(event);
    _arrowPreviewEnd = { displayX: x, displayY: y };
    drawPitch();
    return;
  }
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
  if (_arrowDrawing) {
    _arrowDrawing = false;
    _arrowStart = null;
    _arrowPreviewEnd = null;
    drawPitch();
  }
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
  const firstRow = (() => {
    const vals = parseCsvLine(lines[1]);
    const r = {};
    headers.forEach((h, idx) => { r[h] = vals[idx] ?? ''; });
    return r;
  })();
  if (firstRow.opponent) opponentNameInput.value = firstRow.opponent;
  if (firstRow.matchDate) matchDateInput.value = firstRow.matchDate;
  if (firstRow.venue) { venueSelect.value = firstRow.venue; _syncVenueDisplay(firstRow.venue); }
  if (firstRow.videoFragmentsCount) videoFragmentsCount.value = Math.max(1, parseInt(firstRow.videoFragmentsCount) || 1);
  validateStart();
  mainLayout.style.display = '';
  document.getElementById('noMatchPlaceholder').style.display = 'none';
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
