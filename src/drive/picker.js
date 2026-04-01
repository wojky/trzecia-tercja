// ─── Google Drive Picker ──────────────────────────────────────────────────────
// Opens the Google Picker UI for selecting a file (load) or a folder (save).
// Requires the GAPI picker library loaded via <script> in index.html.

import { GOOGLE_CLIENT_ID, GOOGLE_API_KEY } from '../google-config.js';
import { getAccessToken, requestAccessToken } from './auth.js';

let _gapiReady = false;

// ─── Bootstrap gapi picker library ───────────────────────────────────────────

export function initPicker() {
  return new Promise((resolve) => {
    if (_gapiReady) { resolve(); return; }
    window.gapi.load('picker', () => {
      _gapiReady = true;
      resolve();
    });
  });
}

// ─── Open picker to SELECT a CSV file (Load from Drive) ──────────────────────

/**
 * Returns a Promise that resolves with { fileId, fileName } when user picks
 * a file, or resolves with null if user cancels.
 */
export async function pickFileToLoad() {
  await initPicker();
  const token = await requestAccessToken('');   // silent if possible

  return new Promise((resolve) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
      .setMimeTypes('text/csv,text/plain,application/octet-stream')
      .setMode(window.google.picker.DocsViewMode.LIST)
      .setIncludeFolders(false);

    const picker = new window.google.picker.PickerBuilder()
      .setAppId(GOOGLE_CLIENT_ID.split('-')[0])   // numeric project ID prefix
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setTitle('Wybierz plik CSV z meczem')
      .addView(view)
      .addView(new window.google.picker.DocsView()
        .setMimeTypes('text/csv,text/plain,application/octet-stream')
        .setLabel('Moje pliki'))
      .setCallback((data) => _handlePickerCallback(data, resolve, 'file'))
      .build();

    picker.setVisible(true);
  });
}

// ─── Open picker to SELECT a FOLDER (Save to Drive) ─────────────────────────

/**
 * Returns a Promise that resolves with { folderId, folderName } when user
 * picks a folder, or null if cancelled.
 */
export async function pickFolderToSave() {
  await initPicker();
  const token = await requestAccessToken('');

  return new Promise((resolve) => {
    const folderView = new window.google.picker.DocsView()
      .setMimeTypes('application/vnd.google-apps.folder')
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true);

    const picker = new window.google.picker.PickerBuilder()
      .setAppId(GOOGLE_CLIENT_ID.split('-')[0])
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setTitle('Wybierz folder do zapisu')
      .addView(folderView)
      .setCallback((data) => _handlePickerCallback(data, resolve, 'folder'))
      .build();

    picker.setVisible(true);
  });
}

// ─── Shared callback ──────────────────────────────────────────────────────────

function _handlePickerCallback(data, resolve, type) {
  const action = data.action;
  if (action === window.google.picker.Action.PICKED) {
    const doc = data.docs?.[0];
    if (!doc) { resolve(null); return; }
    if (type === 'folder') {
      resolve({ folderId: doc.id, folderName: doc.name });
    } else {
      resolve({ fileId: doc.id, fileName: doc.name });
    }
  } else if (action === window.google.picker.Action.CANCEL) {
    resolve(null);
  }
}
