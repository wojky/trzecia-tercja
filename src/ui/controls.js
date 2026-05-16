import { state, shots } from '../core/state.js';
import { pitch } from '../core/config.js';
import { xgModels, xgState, computeXg } from '../core/xg.js';
import { enterAssistMode, cancelAssistMode } from '../match/assist.js';
import { drawPitch } from '../match/pitch.js';
import { renderShotsList, createShot, getVisibleShots } from '../match/shots.js';
import { exportShotsToCsv, importFromCsv } from '../match/csv.js';
import { parseTimeToSeconds, formatSecondsToMatchTime } from '../core/time.js';

// ─── Time offset helper ───────────────────────────────────────────────────────

/**
 * If the shot has a timestamp and its fragment has an offset configured,
 * compute matchTime = timestamp + offset and write it into both the shot
 * object and the corresponding DOM input.
 */
function _applyTimestampOffset(index) {
  const shot = shots[index];
  if (!shot) return;
  const fragmentIndex = (parseInt(shot.videoFragment) || 1) - 1;
  const offset = state.fragmentOffsets[fragmentIndex];
  if (offset === null || offset === undefined) return;
  const ts = parseTimeToSeconds(shot.timestamp);
  if (ts === null) return;
  const matchTimeSec = ts + offset;
  const formatted    = formatSecondsToMatchTime(matchTimeSec);
  shot.matchTime     = formatted;
  const matchTimeInput = document.querySelector(`#match-time-${index}`);
  if (matchTimeInput) matchTimeInput.value = formatted;
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const canvas          = document.getElementById('pitchCanvas');
const shotList        = document.getElementById('shotList');
const clearBtn        = document.getElementById('clearBtn');
const exportBtn       = document.getElementById('exportBtn');
const teamFilter      = document.getElementById('teamFilter');
const readModeBtn     = document.getElementById('readModeBtn');
const mirrorBtn       = document.getElementById('mirrorBtn');
const setupImportBtn  = document.getElementById('setupImportBtn');
const importFileInput = document.getElementById('importFileInput');

const shotListMenuBtn = document.getElementById('shotListMenuBtn');
const shotListMenu    = document.getElementById('shotListMenu');

// ─── Canvas utilities ─────────────────────────────────────────────────────────

function getCanvasCoordinates(event) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top)  * scaleY,
  };
}

function isInsidePitch(x, y) {
  return (
    x >= pitch.x &&
    x <= pitch.x + pitch.width &&
    y >= pitch.y &&
    y <= pitch.y + pitch.height
  );
}

// ─── Canvas events ────────────────────────────────────────────────────────────

canvas.addEventListener('click', (event) => {
  if (state.isReadMode) return;
  const { x, y } = getCanvasCoordinates(event);

  const pitchMidX  = pitch.x + pitch.width  / 2;
  const pitchMidY  = pitch.y + pitch.height / 2;
  const canonicalX = state.isMirrored ? (2 * pitchMidX - x) : x;
  const canonicalY = state.isMirrored ? (2 * pitchMidY - y) : y;

  if (!isInsidePitch(canonicalX, canonicalY)) return;

  if (state.assistModeIndex !== null) {
    if (state.assistSubMode === 'person') {
      shots[state.assistModeIndex].assistPos = { x: canonicalX, y: canonicalY };
      drawPitch();
    }
    return;
  }

  shots.push(createShot(canonicalX, canonicalY, 'ourTeam'));
  drawPitch();
  renderShotsList();
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (state.assistModeIndex !== null || state.isReadMode) return;
  const { x, y } = getCanvasCoordinates(event);

  const pitchMidX  = pitch.x + pitch.width  / 2;
  const pitchMidY  = pitch.y + pitch.height / 2;
  const canonicalX = state.isMirrored ? (2 * pitchMidX - x) : x;
  const canonicalY = state.isMirrored ? (2 * pitchMidY - y) : y;

  if (!isInsidePitch(canonicalX, canonicalY)) return;

  shots.push(createShot(canonicalX, canonicalY, 'opponent'));
  drawPitch();
  renderShotsList();
});

canvas.addEventListener('mousedown', (event) => {
  if (state.assistModeIndex === null || state.assistSubMode !== 'arrow') return;
  if (event.button !== 0) return;
  const { x, y } = getCanvasCoordinates(event);
  const pitchMidX  = pitch.x + pitch.width  / 2;
  const pitchMidY  = pitch.y + pitch.height / 2;
  const canonicalX = state.isMirrored ? (2 * pitchMidX - x) : x;
  const canonicalY = state.isMirrored ? (2 * pitchMidY - y) : y;
  if (!isInsidePitch(canonicalX, canonicalY)) return;
  state._arrowDrawing    = true;
  state._arrowStart      = { displayX: x, displayY: y, canonicalX, canonicalY };
  state._arrowPreviewEnd = { displayX: x, displayY: y };
});

canvas.addEventListener('mouseup', (event) => {
  if (!state._arrowDrawing) return;
  state._arrowDrawing = false;
  if (!state._arrowStart) { state._arrowStart = null; state._arrowPreviewEnd = null; return; }
  const { x, y } = getCanvasCoordinates(event);
  const pitchMidX  = pitch.x + pitch.width  / 2;
  const pitchMidY  = pitch.y + pitch.height / 2;
  const canonicalX = state.isMirrored ? (2 * pitchMidX - x) : x;
  const canonicalY = state.isMirrored ? (2 * pitchMidY - y) : y;
  const dx = x - state._arrowStart.displayX;
  const dy = y - state._arrowStart.displayY;
  if (Math.sqrt(dx * dx + dy * dy) > 5) {
    shots[state.assistModeIndex].assistArrow = {
      x1: state._arrowStart.canonicalX, y1: state._arrowStart.canonicalY,
      x2: canonicalX, y2: canonicalY,
    };
  }
  state._arrowStart      = null;
  state._arrowPreviewEnd = null;
  drawPitch();
});

canvas.addEventListener('mousemove', (event) => {
  if (state.assistModeIndex !== null && state.assistSubMode === 'arrow' && state._arrowDrawing) {
    const { x, y } = getCanvasCoordinates(event);
    state._arrowPreviewEnd = { displayX: x, displayY: y };
    drawPitch();
    return;
  }
  if (!state.isReadMode) return;
  const { x, y } = getCanvasCoordinates(event);
  const pitchMidX  = pitch.x + pitch.width  / 2;
  const pitchMidY  = pitch.y + pitch.height / 2;
  const visibleShots = getVisibleShots();
  let found = null;
  for (const shot of visibleShots) {
    const displayX = state.isMirrored ? (2 * pitchMidX - shot.x) : shot.x;
    const displayY = state.isMirrored ? (2 * pitchMidY - shot.y) : shot.y;
    const dist     = Math.sqrt((x - displayX) ** 2 + (y - displayY) ** 2);
    if (dist <= 10) { found = shots.indexOf(shot); break; }
  }
  if (found !== state.hoveredShotIndex) {
    state.hoveredShotIndex = found;
    drawPitch();
  }
});

canvas.addEventListener('mouseleave', () => {
  if (state._arrowDrawing) {
    state._arrowDrawing    = false;
    state._arrowStart      = null;
    state._arrowPreviewEnd = null;
    drawPitch();
  }
  if (!state.isReadMode) return;
  if (state.hoveredShotIndex !== null) {
    state.hoveredShotIndex = null;
    drawPitch();
  }
});

// ─── Shot list events ─────────────────────────────────────────────────────────

shotList.addEventListener('click', (event) => {
  // Comment button
  const commentBtn = event.target.closest('.shot-comment-btn');
  if (commentBtn) {
    const index = Number(commentBtn.dataset.index);
    openCommentDialog(index);
    return;
  }

  // Fragment custom select – trigger
  const fragTrigger = event.target.closest('.shot-frag-trigger');
  if (fragTrigger) {
    event.stopPropagation();
    const wrap = fragTrigger.closest('.custom-select-wrap');
    const dd   = wrap.querySelector('.shot-frag-dropdown');
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

  // Fragment custom select – option
  const fragOpt = event.target.closest('.frag-opt');
  if (fragOpt) {
    event.stopPropagation();
    const val    = fragOpt.dataset.value;
    const wrap   = fragOpt.closest('.custom-select-wrap');
    const select = wrap.querySelector('.shot-fragment-select');
    select.value = val;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const label = state.fragmentNames[parseInt(val) - 1] || val;
    wrap.querySelector('.shot-frag-label').textContent = label;
    wrap.querySelectorAll('.frag-opt').forEach(o => o.setAttribute('aria-selected', o.dataset.value === val ? 'true' : 'false'));
    wrap.querySelector('.shot-frag-trigger').setAttribute('aria-expanded', 'false');
    wrap.querySelector('.shot-frag-dropdown').hidden = true;
    return;
  }

  // Shot item kebab menu toggle
  const shotMenuBtn = event.target.closest('.shot-item-menu-btn');
  if (shotMenuBtn) {
    event.stopPropagation();
    const wrap     = shotMenuBtn.closest('.shot-item-menu-wrap');
    const dropdown = wrap.querySelector('.shot-item-dropdown');
    document.querySelectorAll('.shot-item-dropdown:not([hidden])').forEach(d => {
      if (d !== dropdown) d.hidden = true;
    });
    dropdown.hidden = !dropdown.hidden;
    return;
  }

  // Prevent click inside a shot dropdown from bubbling to document
  const shotDropdown = event.target.closest('.shot-item-dropdown');
  if (shotDropdown) { event.stopPropagation(); }

  // xG recalc button
  const xgRecalcBtn = event.target.closest('.shot-xg-recalc-btn');
  if (xgRecalcBtn) {
    const index = Number(xgRecalcBtn.dataset.index);
    const shot  = shots[index];
    if (!shot) return;
    const modelName = xgModels[xgState.key].name;
    if (!window.confirm(
      `Przelicz xG (i xA) dla tego uderzenia?\n\nModel: „${modelName}"\n\nAktualna wartość xG (${shot.xg || '—'}) zostanie nadpisana.\nxA podającego zostanie automatycznie zaktualizowane.`
    )) return;
    const newXg = computeXg(shot.contextX, shot.contextY, shot.status).toFixed(2);
    shot.xg = newXg;
    const input = document.querySelector(`#xg-${index}`);
    if (input) input.value = newXg;
    return;
  }

  // Passer edit (assist mode) button
  const passerEditBtn = event.target.closest('.shot-passer-edit-btn');
  if (passerEditBtn) {
    const shotItem = passerEditBtn.closest('.shot-item');
    const index    = Number(shotItem.dataset.index);
    if (state.assistModeIndex === index) cancelAssistMode();
    else enterAssistMode(index);
    return;
  }

  // Delete shot
  const deleteButton = event.target.closest('.delete-shot-btn');
  if (!deleteButton) return;

  const index = Number(deleteButton.dataset.index);
  if (!window.confirm(`Usunąć uderzenie ${index + 1}?\n\nTej operacji nie można cofnąć.`)) return;

  if (state.assistModeIndex === index) {
    cancelAssistMode();
  } else if (state.assistModeIndex !== null && state.assistModeIndex > index) {
    state.assistModeIndex -= 1;
  }
  shots.splice(index, 1);

  if (state.hoveredShotIndex === index) {
    state.hoveredShotIndex = null;
  } else if (state.hoveredShotIndex !== null && state.hoveredShotIndex > index) {
    state.hoveredShotIndex -= 1;
  }

  drawPitch();
  renderShotsList();
});

shotList.addEventListener('change', async (event) => {
  const select = event.target.closest('.shot-status-select');
  if (select) {
    const index = Number(select.dataset.index);
    if (shots[index]) {
      shots[index].status = Array.from(select.selectedOptions).map(o => o.value);
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
      _applyTimestampOffset(index);
    }
    return;
  }

  const checkbox = event.target.closest('.shot-team-checkbox');
  if (checkbox) {
    const index = Number(checkbox.dataset.index);
    const team  = checkbox.dataset.team;
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
  if (shots[index]) shots[index][field] = input.value;
});

shotList.addEventListener('input', (event) => {
  const input = event.target.closest('.shot-text-input');
  if (!input) return;
  const index = Number(input.dataset.index);
  const field = input.dataset.field;
  if (shots[index]) {
    shots[index][field] = input.value;
    if (field === 'timestamp') _applyTimestampOffset(index);
  }
});

shotList.addEventListener('mouseover', (event) => {
  const shotItem = event.target.closest('.shot-item');
  if (!shotItem) return;
  state.hoveredFromList  = true;
  state.hoveredShotIndex = Number(shotItem.dataset.index);
  drawPitch();
});

shotList.addEventListener('mouseout', (event) => {
  const shotItem = event.target.closest('.shot-item');
  if (!shotItem) return;
  const relatedTarget = event.relatedTarget;
  if (relatedTarget && shotItem.contains(relatedTarget)) return;
  state.hoveredFromList  = false;
  state.hoveredShotIndex = null;
  drawPitch();
});

// ─── Toolbar buttons ──────────────────────────────────────────────────────────

clearBtn.addEventListener('click', () => {
  if (!window.confirm(`Usunąć wszystkie uderzenia (${shots.length})?\n\nTej operacji nie można cofnąć.`)) return;
  cancelAssistMode();
  shots.length = 0;
  state.hoveredShotIndex = null;
  drawPitch();
  renderShotsList();
  shotListMenu.hidden = true;
});

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
  state.isReadMode = !state.isReadMode;
  readModeBtn.classList.toggle('active', state.isReadMode);
  readModeBtn.innerHTML = state.isReadMode
    ? '<i class="bi bi-cursor-fill"></i> Tryb odczytu'
    : '<i class="bi bi-cursor"></i> Tryb odczytu';
  canvas.style.cursor = state.isReadMode ? 'crosshair' : 'default';

  document.querySelectorAll('#shotList input, #shotList select, #shotList button:not(.shot-item-menu-btn)').forEach(el => {
    el.disabled = state.isReadMode;
  });
  document.querySelectorAll('.match-setup input, .match-setup select').forEach(el => {
    el.disabled = state.isReadMode;
  });

  if (!state.isReadMode) {
    state.hoveredShotIndex = null;
    drawPitch();
  }
});

mirrorBtn.addEventListener('click', () => {
  state.isMirrored = !state.isMirrored;
  mirrorBtn.classList.toggle('active', state.isMirrored);
  mirrorBtn.innerHTML = state.isMirrored
    ? '<i class="bi bi-arrow-down-circle-fill"></i> Kierunek ataku: dół'
    : '<i class="bi bi-arrow-up-circle-fill"></i> Kierunek ataku: góra';
  drawPitch();
});

teamFilter.addEventListener('change', (event) => {
  state.activeTeamFilter = event.target.value;
  state.hoveredShotIndex = null;
  drawPitch();
  renderShotsList();
});

document.getElementById('goalsOnlyFilter').addEventListener('change', (event) => {
  state.goalsOnly = event.target.checked;
  state.hoveredShotIndex = null;
  drawPitch();
  renderShotsList();
});

// ─── Assist mode buttons ──────────────────────────────────────────────────────

document.getElementById('assistModeCancelBtn').addEventListener('click', cancelAssistMode);

document.getElementById('assistModeClearBtn').addEventListener('click', () => {
  if (state.assistModeIndex === null) return;
  shots[state.assistModeIndex].assistPos   = null;
  shots[state.assistModeIndex].assistArrow = null;
  drawPitch();
});

document.getElementById('assistModePersonBtn').addEventListener('click', () => {
  state.assistSubMode = 'person';
  document.getElementById('assistModePersonBtn').classList.add('selected');
  document.getElementById('assistModeArrowBtn').classList.remove('selected');
});

document.getElementById('assistModeArrowBtn').addEventListener('click', () => {
  state.assistSubMode = 'arrow';
  document.getElementById('assistModeArrowBtn').classList.add('selected');
  document.getElementById('assistModePersonBtn').classList.remove('selected');
});

// ─── CSV import ───────────────────────────────────────────────────────────────

setupImportBtn.addEventListener('click', () => {
  importFileInput.value = '';
  importFileInput.click();
});

importFileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload  = (e) => importFromCsv(e.target.result);
  reader.readAsText(file, 'UTF-8');
});

// ─── Comment dialog ───────────────────────────────────────────────────────────

const commentDialog       = document.getElementById('commentDialog');
const commentDialogSave   = document.getElementById('commentDialogSave');
const commentDialogCancel = document.getElementById('commentDialogCancel');
const commentDialogClose  = document.getElementById('commentDialogClose');

function openCommentDialog(index) {
  const textarea = document.getElementById('commentDialogTextarea');
  textarea.value = shots[index]?.comment || '';
  commentDialog.dataset.shotIndex = index;
  commentDialog.showModal();
  textarea.focus();
}

commentDialogSave.addEventListener('click', () => {
  const index    = Number(commentDialog.dataset.shotIndex);
  const textarea = document.getElementById('commentDialogTextarea');
  if (shots[index] !== undefined) {
    shots[index].comment = textarea.value;
    const btn = document.querySelector(`.shot-comment-btn[data-index="${index}"]`);
    if (btn) {
      btn.classList.toggle('has-comment', !!textarea.value);
      btn.title = textarea.value ? 'Edytuj komentarz' : 'Dodaj komentarz';
      btn.querySelector('i').className = textarea.value ? 'bi bi-chat-text-fill' : 'bi bi-chat-text';
    }
  }
  commentDialog.close();
});

commentDialogCancel.addEventListener('click', () => commentDialog.close());
commentDialogClose.addEventListener('click',  () => commentDialog.close());
commentDialog.addEventListener('click', (e) => {
  if (e.target === commentDialog) commentDialog.close();
});
