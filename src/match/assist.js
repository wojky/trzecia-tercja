import { state } from '../core/state.js';

export function showAssistToast(msg) {
  document.getElementById('assistToastMsg').textContent = msg;
  const toast = document.getElementById('assistToast');
  clearTimeout(state._assistToastTimer);
  toast.classList.add('visible');
  state._assistToastTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
}

export function enterAssistMode(index) {
  state.assistModeIndex = index;
  state.assistSubMode = 'person';
  state._arrowDrawing = false;
  state._arrowStart = null;
  state._arrowPreviewEnd = null;
  document.querySelectorAll('.shot-passer-edit-btn').forEach(b => b.classList.remove('assist-active'));
  const btn = document.querySelector(`.shot-item[data-index="${index}"] .shot-passer-edit-btn`);
  if (btn) btn.classList.add('assist-active');
  document.getElementById('assistModeBar').style.display = 'flex';
  document.getElementById('assistModePersonBtn').classList.add('selected');
  document.getElementById('assistModeArrowBtn').classList.remove('selected');
  showAssistToast('Tryb rysowania asysty');
}

export function cancelAssistMode() {
  document.querySelectorAll('.shot-passer-edit-btn').forEach(b => b.classList.remove('assist-active'));
  state.assistModeIndex = null;
  state.assistSubMode = 'person';
  state._arrowDrawing = false;
  state._arrowStart = null;
  state._arrowPreviewEnd = null;
  document.getElementById('assistModeBar').style.display = 'none';
  document.getElementById('assistModePersonBtn').classList.remove('selected');
  document.getElementById('assistModeArrowBtn').classList.remove('selected');
}
