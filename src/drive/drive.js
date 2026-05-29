// ─── Google Drive API v3 — upload / download ──────────────────────────────────

import { getAccessToken, requestAccessToken } from './auth.js';
import { pickFileToLoad, pickFolderToSave } from './picker.js';
import { buildCsvData, importFromCsv } from '../match/csv.js';

const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_FILES_URL  = 'https://www.googleapis.com/drive/v3/files';

// ─── Save to Drive ────────────────────────────────────────────────────────────

export async function saveToDrive() {
  try {
    _setLoading('driveSaveBtn', true);

    // 1. User picks a folder via Picker (no loader yet — Picker is the foreground UI)
    const folder = await pickFolderToSave();
    if (!folder) return;

    _showLoader('Zapisywanie na Drive…');

    // 2. Build CSV content
    const { csvContent, filename } = buildCsvData();
    if (!csvContent) { _toast('Brak uderzeń do zapisania.', true); return; }

    // 3. Check for existing file with the same name in the folder
    const token = await requestAccessToken('');
    const existingId = await _findFile(token, filename, folder.folderId);

    if (existingId) {
      const confirmed = await _confirmOverwrite(filename);
      if (!confirmed) return;
    }

    // 4. Upload (overwrite if exists, create otherwise)
    const fileId = existingId
      ? await _patchFile(token, existingId, csvContent)
      : await _uploadFile(token, filename, csvContent, folder.folderId);

    const action = existingId ? 'Nadpisano' : 'Zapisano';
    _toast(`✓ ${action} „${filename}" w „${folder.folderName}"`);
    console.log('[drive] saved fileId:', fileId);

  } catch (err) {
    console.error('[drive] save error:', err);
    _toast('Błąd zapisu na Drive. Sprawdź konsolę.', true);
  } finally {
    _setLoading('driveSaveBtn', false);
    _hideLoader();
  }
}

// ─── Load from Drive ──────────────────────────────────────────────────────────

export async function loadFromDrive() {
  try {
    _setLoading('driveLoadBtn', true);

    // 1. User picks a CSV file via Picker (no loader yet)
    const picked = await pickFileToLoad();
    if (!picked) return;

    _showLoader('Wczytywanie z Drive…');

    // 2. Download file content
    const token = await requestAccessToken('');
    const text  = await _downloadFile(token, picked.fileId);

    // 3. Import via existing CSV import logic
    importFromCsv(text);
    _toast(`✓ Wczytano „${picked.fileName}"`);

  } catch (err) {
    console.error('[drive] load error:', err);
    _toast('Błąd wczytywania z Drive. Sprawdź konsolę.', true);
  } finally {
    _setLoading('driveLoadBtn', false);
    _hideLoader();
  }
}

// ─── Load video from Drive (returns a blob Object URL) ───────────────────────

/**
 * Downloads a video file from Drive by fileId and returns a blob Object URL
 * that can be set as the `src` of a <video> element.
 * Caller is responsible for revoking the returned URL via URL.revokeObjectURL().
 */
export async function loadVideoFromDrive(fileId) {
  _showLoader('Pobieranie wideo z Drive…');
  try {
    const token = await requestAccessToken('');
    const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } finally {
    _hideLoader();
  }
}

// ─── Drive API helpers ────────────────────────────────────────────────────────

async function _uploadFile(token, filename, csvText, folderId) {
  const csvWithBom = '\uFEFF' + csvText;
  const boundary   = '-------314159265358979323846';
  const delimiter  = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadata = JSON.stringify({ name: filename, parents: [folderId] });

  const body = delimiter
    + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
    + metadata
    + delimiter
    + 'Content-Type: text/csv\r\n\r\n'
    + csvWithBom
    + closeDelim;

  const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.id;
}

async function _downloadFile(token, fileId) {
  const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

/** Returns the fileId of an existing file with `filename` in `folderId`, or null. */
async function _findFile(token, filename, folderId) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and name = '${filename.replace(/'/g, "\\'")}' and trashed = false`
  );
  const res = await fetch(
    `${DRIVE_FILES_URL}?q=${q}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

/** Updates file content in-place (no new file, keeps same Drive URL). */
async function _patchFile(token, fileId, csvText) {
  const csvWithBom = '\uFEFF' + csvText;
  const res = await fetch(`${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'text/csv',
    },
    body: csvWithBom,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.id;
}

/** Shows a native-style confirm dialog. Returns Promise<boolean>. */
function _confirmOverwrite(filename) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'drive-confirm-overlay';
    overlay.innerHTML = `
      <div class="drive-confirm-dialog">
        <p class="drive-confirm-msg">Plik <strong>${_escHtml(filename)}</strong> już istnieje w wybranym folderze.<br>Czy chcesz go nadpisać?</p>
        <div class="drive-confirm-actions">
          <button class="drive-confirm-cancel" type="button">Anuluj</button>
          <button class="drive-confirm-ok" type="button">Nadpisz</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const cleanup = (result) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector('.drive-confirm-ok').addEventListener('click',     () => cleanup(true));
    overlay.querySelector('.drive-confirm-cancel').addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
  });
}

function _escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function _showLoader(label = 'Ładowanie…') {
  let el = document.getElementById('driveLoader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'driveLoader';
    el.innerHTML = `
      <div class="drive-loader-spinner"></div>
      <span class="drive-loader-label"></span>`;
    document.body.appendChild(el);
  }
  el.querySelector('.drive-loader-label').textContent = label;
  // Picker renders on top of the overlay — hide loader while picker is open,
  // re-show when we continue processing (label passed only at start).
  el.classList.add('drive-loader-visible');
}

function _hideLoader() {
  document.getElementById('driveLoader')?.classList.remove('drive-loader-visible');
}

function _setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) btn.classList.add('drive-btn-loading');
  else         btn.classList.remove('drive-btn-loading');
}

function _toast(msg, isError = false) {
  let el = document.getElementById('driveToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'driveToast';
    el.className = 'drive-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('drive-toast-error', isError);
  el.classList.add('drive-toast-visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('drive-toast-visible'), 3500);
}

// ─── Wire Drive buttons once user is signed in ────────────────────────────────

export function initDrive() {
  // Wire buttons that already exist in DOM (restored from localStorage by initAuth)
  _wireDriveButtons();
  // Also wire on future sign-in events
  document.addEventListener('gauth:signedin', _wireDriveButtons);
  // Enable save button when a match becomes active
  document.addEventListener('match:activated', () => {
    const saveBtn = document.getElementById('driveSaveBtn');
    if (!saveBtn) return;
    saveBtn.disabled = false;
    saveBtn.title = 'Zapisz mecz na Google Drive';
  });
}

function _wireDriveButtons() {
  const saveBtn = document.getElementById('driveSaveBtn');
  const loadBtn = document.getElementById('driveLoadBtn');
  // Guard against double-binding (replaceWith would drop old listeners, but be safe)
  if (saveBtn && !saveBtn.dataset.driveWired) {
    saveBtn.dataset.driveWired = '1';
    saveBtn.addEventListener('click', saveToDrive);
    // Disabled until a match is active
    const matchActive = document.getElementById('mainLayout')?.style.display !== 'none';
    saveBtn.disabled = !matchActive;
    saveBtn.title = matchActive ? 'Zapisz mecz na Google Drive' : 'Uruchom mecz, aby zapisać na Drive';
  }
  if (loadBtn && !loadBtn.dataset.driveWired) {
    loadBtn.dataset.driveWired = '1';
    loadBtn.addEventListener('click', loadFromDrive);
  }
}
