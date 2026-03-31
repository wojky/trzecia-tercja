import { renderShotsList } from '../match/shots.js';

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
