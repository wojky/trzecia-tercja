import { renderShotsList } from '../match/shots.js';
import { state } from '../core/state.js';
import { parseTimeToSeconds } from '../core/time.js';

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

document.getElementById('videoFragmentsConfigBtn').addEventListener('click', _openVfd);
document.getElementById('vfdClose').addEventListener('click',  () => vfdDialog.close());
document.getElementById('vfdCancel').addEventListener('click', () => vfdDialog.close());
document.getElementById('vfdSave').addEventListener('click', _saveVfd);

vfdDialog.addEventListener('click', e => { if (e.target === vfdDialog) vfdDialog.close(); });

function _openVfd() {
  const count = Math.max(1, parseInt(videoFragmentsCount.value) || 1);
  vfdBody.innerHTML = `
    <div class="vfd-header-row">
      <span class="vfd-col-label">#</span>
      <span class="vfd-col-label">Nazwa fragmentu</span>
      <span class="vfd-col-label vfd-col-offset" title="Czas meczu w momencie startu fragmentu. Wartości ujemne dozwolone (np. -00:05).">Offset meczu <i class="bi bi-info-circle"></i></span>
    </div>` +
    Array.from({ length: count }, (_, i) => {
      const name   = (state.fragmentNames[i]  || '').replace(/"/g, '&quot;');
      const offset = _secondsToOffsetString(state.fragmentOffsets[i]);
      return `
        <div class="vfd-row">
          <span class="vfd-num">${i + 1}</span>
          <input type="text" class="vfd-name-input"   data-index="${i}" placeholder="Fragment ${i + 1}" value="${name}"   maxlength="40" />
          <input type="text" class="vfd-offset-input" data-index="${i}" placeholder="np. 19:54 lub -00:05" value="${offset}" />
        </div>`;
    }).join('');
  vfdDialog.showModal();
  vfdBody.querySelector('.vfd-name-input')?.focus();
}

function _saveVfd() {
  const rows    = vfdBody.querySelectorAll('.vfd-row');
  const names   = [];
  const offsets = [];
  rows.forEach(row => {
    const i      = parseInt(row.querySelector('.vfd-name-input').dataset.index);
    names[i]     = row.querySelector('.vfd-name-input').value.trim();
    const parsed = parseTimeToSeconds(row.querySelector('.vfd-offset-input').value.trim());
    offsets[i]   = parsed !== null ? parsed : (state.fragmentOffsets[i] ?? null);
  });
  state.fragmentNames   = names;
  state.fragmentOffsets = offsets;
  vfdDialog.close();
  renderShotsList();
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
