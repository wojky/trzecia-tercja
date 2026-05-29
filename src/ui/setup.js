import { renderShotsList } from '../match/shots.js';
import { state, shots } from '../core/state.js';
import { parseTimeToSeconds } from '../core/time.js';
import { isSignedIn } from '../drive/auth.js';
import { pickVideoFile } from '../drive/picker.js';
import { loadVideoFromDrive } from '../drive/drive.js';

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const opponentNameInput   = document.getElementById('opponentName');
const matchDateInput      = document.getElementById('matchDate');
const venueSelect         = document.getElementById('venueSelect');
const startBtn            = document.getElementById('startBtn');
const mainLayout          = document.getElementById('mainLayout');
const videoFragmentsCount = document.getElementById('videoFragmentsCount');

const _venueTrigger  = document.getElementById('venueSelectTrigger');
const _venueDropdown = document.getElementById('venueSelectDropdown');
const _venueLabel    = document.getElementById('venueSelectLabel');

const VENUE_LABELS = {
  '': '— wybierz —',
  dom: 'Dom',
  wyjazd: 'Wyjazd',
  neutralne: 'Neutralne',
};

// ─── Support dialog ───────────────────────────────────────────────────────────

const _supportDialog = document.getElementById('supportDialog');
document.getElementById('supportBtn').addEventListener('click', () => _supportDialog.showModal());
document.getElementById('supportDialogClose').addEventListener('click', () => _supportDialog.close());
_supportDialog.addEventListener('click', (e) => { if (e.target === _supportDialog) _supportDialog.close(); });

// ─── Sidebar toggle ───────────────────────────────────────────────────────────

const _sidebar = document.getElementById('sidebar');
const _shell   = document.querySelector('.app-shell');

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

// ─── Match form validation ────────────────────────────────────────────────────

export function validateStart() {
  const ready =
    opponentNameInput.value.trim() !== '' &&
    matchDateInput.value !== '' &&
    venueSelect.value !== '';
  startBtn.disabled = !ready;
}

opponentNameInput.addEventListener('input',  validateStart);
matchDateInput.addEventListener('change',    validateStart);
venueSelect.addEventListener('change',       validateStart);

// ─── Custom venue select ──────────────────────────────────────────────────────

export function syncVenueDisplay(val) {
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
  syncVenueDisplay(val);
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

// ─── Start button ─────────────────────────────────────────────────────────────

startBtn.addEventListener('click', () => {
  mainLayout.style.display = '';
  document.getElementById('noMatchPlaceholder').style.display = 'none';
  startBtn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Aktywny';
  startBtn.classList.add('active');
  document.dispatchEvent(new CustomEvent('match:activated'));
});

// ─── Video fragments stepper ──────────────────────────────────────────────────

videoFragmentsCount.addEventListener('change', () => renderShotsList());

document.getElementById('videoFragmentsMinus').addEventListener('click', () => {
  const val = Math.max(1, parseInt(videoFragmentsCount.value) || 1);
  if (val > 1) { videoFragmentsCount.value = val - 1; renderShotsList(); }
});

document.getElementById('videoFragmentsPlus').addEventListener('click', () => {
  const val = parseInt(videoFragmentsCount.value) || 1;
  videoFragmentsCount.value = val + 1;
  renderShotsList();
});

// ─── Video fragments config dialog ───────────────────────────────────────────

const vfdDialog = document.getElementById('videoFragmentsDialog');
const vfdBody   = document.getElementById('vfdBody');

// cache of fileId → blob Object URL to avoid re-downloading
const _videoBlobCache = new Map();
// temporary per-row video state while dialog is open: index → { fileId, fileName }
const _vfdPendingVideo = new Map();
// temporary form values saved before closing the dialog to open the Picker
let _vfdTempNames   = null;
let _vfdTempOffsets = null;
let _vfdReopening   = false;

document.getElementById('videoFragmentsConfigBtn').addEventListener('click', _openVfd);
document.getElementById('vfdClose').addEventListener('click',  () => vfdDialog.close());
document.getElementById('vfdCancel').addEventListener('click', () => vfdDialog.close());
document.getElementById('vfdSave').addEventListener('click', _saveVfd);

vfdDialog.addEventListener('click', e => { if (e.target === vfdDialog) vfdDialog.close(); });

// ─── Event delegation for video buttons in VFD rows ──────────────────────────

vfdBody.addEventListener('click', async (e) => {
  const pickBtn  = e.target.closest('.vfd-video-pick-btn');
  const playBtn  = e.target.closest('.vfd-video-play-btn');
  const clearBtn = e.target.closest('.vfd-video-clear-btn');

  if (pickBtn) {
    const i = parseInt(pickBtn.dataset.index);
    // The vfdDialog uses showModal() (top-layer) which sits above the Google Picker
    // iframe. We must close it first, then reopen it after the pick is done.
    _captureFormTemp();
    vfdDialog.close();
    try {
      const picked = await pickVideoFile();
      if (picked) {
        _vfdPendingVideo.set(i, { fileId: picked.fileId, fileName: picked.fileName });
      }
    } finally {
      _vfdReopening = true;
      _openVfd();
      _vfdReopening = false;
      _vfdTempNames   = null;
      _vfdTempOffsets = null;
    }
  }

  if (playBtn) {
    const fileId   = playBtn.dataset.fileid;
    const fileName = playBtn.dataset.filename || 'Wideo';
    _openVideoPlayer(fileId, fileName);
  }

  if (clearBtn) {
    const i = parseInt(clearBtn.dataset.index);
    _vfdPendingVideo.set(i, { fileId: '', fileName: '' });
    _refreshVfdVideoCell(i);
  }
});

function _refreshVfdVideoCell(i) {
  const cell = vfdBody.querySelector(`.vfd-video-cell[data-index="${i}"]`);
  if (!cell) return;
  const pending = _vfdPendingVideo.get(i);
  const fileId   = pending?.fileId   ?? '';
  const fileName = pending?.fileName ?? '';
  if (fileId) {
    cell.innerHTML = `
      <span class="vfd-video-name" title="${_escHtml(fileName)}">${_escHtml(_truncate(fileName, 18))}</span>
      <button type="button" class="vfd-video-play-btn" data-index="${i}" data-fileid="${_escHtml(fileId)}" data-filename="${_escHtml(fileName)}" title="Odtwórz wideo"><i class="bi bi-play-fill"></i></button>
      <button type="button" class="vfd-video-clear-btn" data-index="${i}" title="Usuń wideo"><i class="bi bi-x-lg"></i></button>`;
  } else {
    cell.innerHTML = `
      <button type="button" class="vfd-video-pick-btn" data-index="${i}" title="Wybierz wideo z Drive"><i class="bi bi-camera-video-fill"></i> Wybierz</button>`;
  }
}

function _captureFormTemp() {
  _vfdTempNames   = [];
  _vfdTempOffsets = [];
  vfdBody.querySelectorAll('.vfd-row').forEach(row => {
    const i = parseInt(row.querySelector('.vfd-name-input').dataset.index);
    _vfdTempNames[i]   = row.querySelector('.vfd-name-input').value;
    _vfdTempOffsets[i] = row.querySelector('.vfd-offset-input').value;
  });
}

function _openVfd() {
  const count    = Math.max(1, parseInt(videoFragmentsCount.value) || 1);
  const signedIn = isSignedIn();

  if (!_vfdReopening) {
    // Fresh open — populate pending video from saved state
    _vfdPendingVideo.clear();
    for (let i = 0; i < count; i++) {
      _vfdPendingVideo.set(i, {
        fileId:   state.fragmentVideoIds?.[i]   ?? '',
        fileName: state.fragmentVideoNames?.[i] ?? '',
      });
    }
  }

  const videoHeader = signedIn
    ? `<span class="vfd-col-label vfd-col-video">Wideo (Drive)</span>`
    : '';

  vfdBody.innerHTML = `
    <div class="vfd-header-row">
      <span class="vfd-col-label">#</span>
      <span class="vfd-col-label">Nazwa fragmentu</span>
      <span class="vfd-col-label vfd-col-offset" title="Czas meczu w momencie startu fragmentu. Wartości ujemne dozwolone (np. -00:05).">Offset meczu <i class="bi bi-info-circle"></i></span>
      ${videoHeader}
    </div>` +
    Array.from({ length: count }, (_, i) => {
      // Use temp values when reopening after picker, otherwise fall back to state
      const name   = (_vfdTempNames?.[i] ?? state.fragmentNames[i] ?? '').replace(/"/g, '&quot;');
      const offset = _vfdTempOffsets?.[i] !== undefined
        ? _vfdTempOffsets[i].replace(/"/g, '&quot;')
        : _secondsToOffsetString(state.fragmentOffsets[i]);
      // Always read video from the pending map (kept in sync with state on fresh open)
      const pendingVid = _vfdPendingVideo.get(i) ?? {};
      const fileId   = pendingVid.fileId   ?? '';
      const fileName = pendingVid.fileName ?? '';

      const videoCell = signedIn ? `
        <div class="vfd-video-cell" data-index="${i}">
          ${fileId
            ? `<span class="vfd-video-name" title="${_escHtml(fileName)}">${_escHtml(_truncate(fileName, 18))}</span>
               <button type="button" class="vfd-video-play-btn" data-index="${i}" data-fileid="${_escHtml(fileId)}" data-filename="${_escHtml(fileName)}" title="Odtwórz wideo"><i class="bi bi-play-fill"></i></button>
               <button type="button" class="vfd-video-clear-btn" data-index="${i}" title="Usuń wideo"><i class="bi bi-x-lg"></i></button>`
            : `<button type="button" class="vfd-video-pick-btn" data-index="${i}" title="Wybierz wideo z Drive"><i class="bi bi-camera-video-fill"></i> Wybierz</button>`
          }
        </div>` : '';

      return `
        <div class="vfd-row">
          <span class="vfd-num">${i + 1}</span>
          <input type="text" class="vfd-name-input"   data-index="${i}" placeholder="Fragment ${i + 1}" value="${name}"   maxlength="40" />
          <input type="text" class="vfd-offset-input" data-index="${i}" placeholder="np. 19:54 lub -00:05" value="${offset}" />
          ${videoCell}
        </div>`;
    }).join('');

  vfdDialog.classList.toggle('vfd-with-video', signedIn);
  vfdDialog.showModal();
  vfdBody.querySelector('.vfd-name-input')?.focus();
}

function _saveVfd() {
  const rows    = vfdBody.querySelectorAll('.vfd-row');
  const names   = [];
  const offsets = [];
  const videoIds   = [];
  const videoNames = [];
  rows.forEach(row => {
    const i      = parseInt(row.querySelector('.vfd-name-input').dataset.index);
    names[i]     = row.querySelector('.vfd-name-input').value.trim();
    const parsed = parseTimeToSeconds(row.querySelector('.vfd-offset-input').value.trim());
    offsets[i]   = parsed !== null ? parsed : (state.fragmentOffsets[i] ?? null);
    const pending = _vfdPendingVideo.get(i);
    videoIds[i]   = pending?.fileId   ?? state.fragmentVideoIds?.[i]   ?? '';
    videoNames[i] = pending?.fileName ?? state.fragmentVideoNames?.[i] ?? '';
  });
  state.fragmentNames      = names;
  state.fragmentOffsets    = offsets;
  state.fragmentVideoIds   = videoIds;
  state.fragmentVideoNames = videoNames;
  vfdDialog.close();
  renderShotsList();
}

// ─── Video player modal ───────────────────────────────────────────────────────

const _vpdDialog = document.getElementById('videoPlayerDialog');
const _vpdVideo  = document.getElementById('vpdVideo');
const _vpdTitle  = document.getElementById('vpdTitleText');
let   _currentBlobUrl = null;

document.getElementById('vpdClose').addEventListener('click', _closeVideoPlayer);
_vpdDialog.addEventListener('click', e => {
  if (e.target === _vpdDialog) { _closeVideoPlayer(); return; }
  const seekBtn = e.target.closest('.vpd-ts-seek');
  if (seekBtn && _vpdVideo.readyState >= 1) {
    _vpdVideo.currentTime = parseFloat(seekBtn.dataset.seek) || 0;
    _vpdVideo.play();
  }
});

async function _openVideoPlayer(fileId, fileName, seekSec = 0, shotIndex = null) {
  const videoWrap = document.getElementById('vpdVideoWrap');
  // Show modal immediately with loading state
  _vpdTitle.textContent = fileName;
  _vpdVideo.src = '';
  _vpdVideo.poster = '';
  _vpdDialog.classList.toggle('vpd-no-info', shotIndex === null || shots[shotIndex] === undefined);
  _renderShotInfo(shotIndex);
  _vpdDialog.showModal();
  videoWrap.classList.add('vpd-loading');

  try {
    // Re-use cached blob URL if already downloaded
    if (!_videoBlobCache.has(fileId)) {
      const url = await loadVideoFromDrive(fileId);
      _videoBlobCache.set(fileId, url);
    }
    if (!_vpdDialog.open) return; // user closed while loading
    const blobUrl = _videoBlobCache.get(fileId);
    _currentBlobUrl = blobUrl;
    if (seekSec > 0) {
      _vpdVideo.addEventListener('loadedmetadata', () => {
        _vpdVideo.currentTime = seekSec;
      }, { once: true });
    }
    _vpdVideo.src = blobUrl;
  } catch (err) {
    console.error('[video] load error:', err);
    if (_vpdDialog.open) {
      videoWrap.innerHTML =
        '<p class="vpd-error"><i class="bi bi-exclamation-triangle-fill"></i> Nie udało się załadować wideo. Sprawdź połączenie lub uprawnienia.</p>';
    }
  } finally {
    document.getElementById('vpdVideoWrap')?.classList.remove('vpd-loading');
  }
}

// ─── Shot info panel ─────────────────────────────────────────────────────

const _STATUS_LABELS = {
  'gol':                      'GOL',
  'zablokowany':              'Zablokowany',
  'niecelny':                 'Niecelny',
  'dosrodkowanie':            'Dśrodk.',
  'uderzenie-glowa':          'Głową',
  'z-powietrza-noga':         'Z pow. nogą',
  '1-kontakt':                '1 kontakt',
  'zza-pk':                   'Zza PK',
  'rzut-karny':               'Rzut karny',
  'interwencja-bramkarza':    'Interw. bram.',
  'po-bledzie-indywidualnym': 'Po błędzie',
  'sfg-strzal':               'SFG strzał',
};

function _renderShotInfo(shotIndex) {
  const infoEl = document.getElementById('vpdInfo');
  if (!infoEl) return;
  const shot = (shotIndex !== null && shotIndex !== undefined) ? shots[shotIndex] : null;
  if (!shot) { infoEl.innerHTML = ''; return; }

  // Cumulative stats up to and including this shot
  const upto    = shots.slice(0, shotIndex + 1);
  const goalsOur = upto.filter(s => s.team === 'ourTeam'  && s.status.includes('gol')).length;
  const goalsOpp = upto.filter(s => s.team === 'opponent' && s.status.includes('gol')).length;
  const cumXg    = upto.filter(s => s.team === 'ourTeam') .reduce((sum, s) => sum + (parseFloat(s.xg) || 0), 0);
  const cumXga   = upto.filter(s => s.team === 'opponent').reduce((sum, s) => sum + (parseFloat(s.xg) || 0), 0);

  const isOur   = shot.team === 'ourTeam';
  const xgVal   = parseFloat(shot.xg) || 0;
  const xgPct   = Math.min(100, (xgVal / 0.5) * 100).toFixed(1);
  const xgColor = xgVal >= 0.3 ? '#4ade80' : xgVal >= 0.12 ? '#fbbf24' : '#94a3b8';

  const maxCum   = Math.max(cumXg, cumXga, 0.01);
  const ourBar   = Math.round((cumXg  / maxCum) * 100);
  const oppBar   = Math.round((cumXga / maxCum) * 100);

  const fragIdx  = (parseInt(shot.videoFragment) || 1) - 1;
  const fragName = state.fragmentNames[fragIdx] || `Fragment ${fragIdx + 1}`;

  // Seek target for the timestamp button
  const tsSec = parseTimeToSeconds(shot.timestamp);
  let seekToSec = null;
  if (tsSec !== null) {
    seekToSec = Math.max(0, tsSec - 5);
  } else {
    const mtSec   = parseTimeToSeconds(shot.matchTime);
    const offset  = state.fragmentOffsets[fragIdx];
    if (mtSec !== null && offset !== null && offset !== undefined) {
      seekToSec = Math.max(0, mtSec - offset - 5);
    }
  }

  const tags = (shot.status || []).map(s => {
    const label = _STATUS_LABELS[s] || s;
    return `<span class="vpd-tag${s === 'gol' ? ' vpd-tag-goal' : ''}">${label}</span>`;
  }).join('');

  infoEl.innerHTML = `
    <div class="vpd-shot-badge">
      <span class="vpd-shot-num">Uderzenie ${shotIndex + 1}</span>
      <span class="vpd-team-pill ${isOur ? 'our' : 'opp'}">${isOur ? 'Nasz zespół' : 'Przeciwnik'}</span>
    </div>

    <div class="vpd-scoreboard">
      <div class="vpd-score-numbers">
        <div class="vpd-score-block">
          <span class="vpd-score-label">Nasz</span>
          <span class="vpd-score-val our">${goalsOur}</span>
        </div>
        <span class="vpd-score-sep">:</span>
        <div class="vpd-score-block">
          <span class="vpd-score-val opp">${goalsOpp}</span>
          <span class="vpd-score-label">Prze.</span>
        </div>
      </div>
      <div class="vpd-xg-compare">
        <div class="vpd-xg-compare-row">
          <span class="vpd-xg-compare-label our">xG</span>
          <div class="vpd-xg-compare-track">
            <div class="vpd-xg-compare-fill our" style="width:${ourBar}%"></div>
          </div>
          <span class="vpd-xg-compare-val">${cumXg.toFixed(2)}</span>
        </div>
        <div class="vpd-xg-compare-row">
          <span class="vpd-xg-compare-label opp">xGA</span>
          <div class="vpd-xg-compare-track">
            <div class="vpd-xg-compare-fill opp" style="width:${oppBar}%"></div>
          </div>
          <span class="vpd-xg-compare-val">${cumXga.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="vpd-divider"></div>

    <dl class="vpd-dl">
      ${shot.matchTime ? `<dt>Czas meczu</dt><dd>${shot.matchTime}&prime;</dd>` : ''}
      ${shot.timestamp ? `
      <dt>Timestamp</dt>
      <dd class="vpd-ts-cell">
        <span>${shot.timestamp}</span>
        ${seekToSec !== null ? `<button type="button" class="vpd-ts-seek" data-seek="${seekToSec}" title="Przewi\u0144 do momentu uderzenia (\u22125s)"><i class="bi bi-skip-backward-fill"></i></button>` : ''}
      </dd>` : ''}
      <dt>xG</dt>
      <dd>
        <div class="vpd-xg-bar-row">
          <div class="vpd-xg-shot-track">
            <div class="vpd-xg-shot-fill" style="width:${xgPct}%;background:${xgColor}"></div>
          </div>
          <span class="vpd-xg-shot-val" style="color:${xgColor}">${xgVal.toFixed(3)}</span>
        </div>
      </dd>
      <dt>Zawodnik</dt><dd>${shot.playerNumber ? `#${_escHtml(shot.playerNumber)}` : '\u2014'}</dd>
      <dt>Asysta</dt><dd>${shot.passerNumber ? `#${_escHtml(shot.passerNumber)}` : '\u2014'}</dd>
    </dl>

    ${tags ? `<div class="vpd-tags">${tags}</div>` : ''}
    ${shot.comment ? `<blockquote class="vpd-comment">${_escHtml(shot.comment)}</blockquote>` : ''}
  `;
}

// ─── Shot list video play event ───────────────────────────────────────────────

document.addEventListener('shot:playvideo', (e) => {
  _openVideoPlayer(e.detail.fileId, e.detail.fileName, e.detail.seekSec, e.detail.shotIndex);
});

function _closeVideoPlayer() {
  _vpdVideo.pause();
  _vpdVideo.src = '';
  _vpdDialog.close();
}

/** Convert stored seconds (number | null | undefined) back to display string */
function _secondsToOffsetString(seconds) {
  if (seconds === null || seconds === undefined || seconds === '') return '';
  const neg = seconds < 0;
  const abs = Math.abs(seconds);
  const m   = Math.floor(abs / 60);
  const s   = abs % 60;
  const str = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return neg ? `-${str}` : str;
}

function _truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function _escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
