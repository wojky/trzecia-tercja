// ─── Centrum danych — beta ────────────────────────────────────────────────────

import { requestAccessToken } from '../drive/auth.js';
import { initPicker } from '../drive/picker.js';
import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID } from '../google-config.js';

// ─── State ────────────────────────────────────────────────────────────────────

const _matches = [];   // { id, fileName, opponent, matchDate, venue, xg, xga }
let _nextId = 1;

// ─── CSV parsing ──────────────────────────────────────────────────────────────

function _parseCsvLine(line) {
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

function _parseMatchCsv(text, fileName) {
  const lines = text.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return null;

  const headers  = _parseCsvLine(lines[0]).map(h => h.trim());
  const firstRow = {};
  _parseCsvLine(lines[1]).forEach((v, i) => { firstRow[headers[i]] = v ?? ''; });

  let xg = 0, xga = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = {};
    _parseCsvLine(lines[i]).forEach((v, idx) => { row[headers[idx]] = v ?? ''; });
    const val = parseFloat(row.xg) || 0;
    if (row.team === 'opponent') xga += val;
    else xg += val;
  }

  const venueMap = { dom: 'Dom', wyjazd: 'Wyjazd', neutralne: 'Neutralne' };

  return {
    id:        _nextId++,
    fileName,
    opponent:  firstRow.opponent  || fileName,
    matchDate: firstRow.matchDate || '—',
    venue:     venueMap[firstRow.venue] ?? firstRow.venue ?? '—',
    xg:        parseFloat(xg.toFixed(3)),
    xga:       parseFloat(xga.toFixed(3)),
  };
}

function _addMatch(text, fileName) {
  const match = _parseMatchCsv(text, fileName);
  if (match) _matches.push(match);
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const navDataCenter   = document.getElementById('navDataCenter');
const dataCenterPanel = document.getElementById('dataCenterPanel');
const navMecz         = document.getElementById('navMecz');
const navDocs         = document.getElementById('navDocs');
const contentInner    = document.querySelector('.content-inner');
const docsPanel       = document.getElementById('docsPanel');

// ─── Navigation ───────────────────────────────────────────────────────────────

navDataCenter.addEventListener('click', e => {
  e.preventDefault();
  _showDataCenter();
});

// Hide this panel when switching to other top-level views
navMecz.addEventListener('click', () => _hideDataCenter());
navDocs.addEventListener('click', () => _hideDataCenter());

function _showDataCenter() {
  contentInner.style.display    = 'none';
  docsPanel.style.display       = 'none';
  dataCenterPanel.style.display = 'block';
  navMecz.classList.remove('active');
  navDocs.classList.remove('active');
  navDataCenter.classList.add('active');
  _render();
}

function _hideDataCenter() {
  dataCenterPanel.style.display = 'none';
  navDataCenter.classList.remove('active');
}

// ─── Render ───────────────────────────────────────────────────────────────────

function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _render() {
  dataCenterPanel.innerHTML = `
    <div class="dc-beta-notice">
      <i class="bi bi-cone-striped"></i>
      <span><strong>Centrum danych — beta.</strong> Funkcja jest w budowie. Dane mają charakter poglądowy i mogą się zmienić.</span>
    </div>

    <div class="dc-container">
      <div class="dc-header">
        <h2 class="dc-title">xG vs xGA — zestawienie meczów</h2>
        <div class="dc-actions">
          <button type="button" id="dcImportFileBtn" class="dc-btn">
            <i class="bi bi-file-earmark-arrow-up"></i> Wgraj CSV z dysku
          </button>
          <button type="button" id="dcImportDriveBtn" class="dc-btn dc-btn-drive">
            <i class="bi bi-cloud-arrow-up"></i> Wgraj z Google Drive
          </button>
          ${_matches.length > 0
            ? `<button type="button" id="dcClearBtn" class="dc-btn dc-btn-danger">
                <i class="bi bi-trash3"></i> Wyczyść
               </button>`
            : ''}
        </div>
      </div>
      <input type="file" id="dcFileInput" accept=".csv" multiple style="display:none" />

      ${_matches.length === 0 ? _renderEmpty() : _renderTable()}
    </div>
  `;

  dataCenterPanel.querySelector('#dcImportFileBtn').addEventListener('click', () => {
    dataCenterPanel.querySelector('#dcFileInput').click();
  });
  dataCenterPanel.querySelector('#dcFileInput').addEventListener('change', _onLocalFiles);
  dataCenterPanel.querySelector('#dcImportDriveBtn').addEventListener('click', _onDriveImport);
  dataCenterPanel.querySelector('#dcClearBtn')?.addEventListener('click', () => {
    _matches.length = 0;
    _nextId = 1;
    _render();
  });

  dataCenterPanel.querySelectorAll('.dc-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id  = Number(btn.dataset.id);
      const idx = _matches.findIndex(m => m.id === id);
      if (idx !== -1) { _matches.splice(idx, 1); _render(); }
    });
  });
}

function _renderEmpty() {
  return `
    <div class="dc-empty">
      <i class="bi bi-inbox dc-empty-icon"></i>
      <span>Brak danych. Wgraj pliki CSV z meczami.</span>
    </div>`;
}

function _renderTable() {
  const totXg  = _matches.reduce((s, m) => s + m.xg,  0);
  const totXga = _matches.reduce((s, m) => s + m.xga, 0);
  const totDiff = totXg - totXga;

  const rows = _matches.map(m => {
    const diff     = parseFloat((m.xg - m.xga).toFixed(2));
    const diffStr  = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
    const xgWins   = m.xg > m.xga;
    const xgaWins  = m.xga > m.xg;

    return `
      <tr class="dc-tr">
        <td class="dc-td dc-td-match">
          <span class="dc-opponent">${_esc(m.opponent)}</span>
          <span class="dc-meta">${_esc(m.matchDate)}${m.venue && m.venue !== '—' ? ' · ' + _esc(m.venue) : ''}</span>
        </td>
        <td class="dc-td dc-td-num ${xgWins ? 'dc-win' : xgaWins ? 'dc-lose' : ''}">${m.xg.toFixed(2)}</td>
        <td class="dc-td dc-td-num ${xgaWins ? 'dc-win' : xgWins ? 'dc-lose' : ''}">${m.xga.toFixed(2)}</td>
        <td class="dc-td dc-td-diff ${diff > 0 ? 'dc-diff-pos' : diff < 0 ? 'dc-diff-neg' : ''}">${diffStr}</td>
        <td class="dc-td dc-td-actions">
          <button type="button" class="dc-remove-btn" data-id="${m.id}" title="Usuń mecz"><i class="bi bi-x"></i></button>
        </td>
      </tr>`;
  }).join('');

  const totDiffStr  = totDiff > 0 ? `+${totDiff.toFixed(2)}` : totDiff.toFixed(2);
  const totDiffCls  = totDiff > 0 ? 'dc-diff-pos' : totDiff < 0 ? 'dc-diff-neg' : '';

  return `
    <div class="dc-table-wrap">
      <table class="dc-table">
        <thead>
          <tr>
            <th class="dc-th">Mecz</th>
            <th class="dc-th dc-th-num">xG</th>
            <th class="dc-th dc-th-num">xGA</th>
            <th class="dc-th dc-th-num">Różnica</th>
            <th class="dc-th"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="dc-tfoot-row">
            <td class="dc-td dc-td-match dc-tfoot-label">Suma (${_matches.length} meczów)</td>
            <td class="dc-td dc-td-num dc-tfoot-val">${totXg.toFixed(2)}</td>
            <td class="dc-td dc-td-num dc-tfoot-val">${totXga.toFixed(2)}</td>
            <td class="dc-td dc-td-diff dc-tfoot-val ${totDiffCls}">${totDiffStr}</td>
            <td class="dc-td"></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

// ─── Local file import ────────────────────────────────────────────────────────

async function _onLocalFiles(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;

  for (const file of files) {
    const text = await file.text();
    _addMatch(text, file.name.replace(/\.csv$/i, ''));
  }
  event.target.value = '';
  _render();
}

// ─── Google Drive multi-file import ──────────────────────────────────────────

async function _onDriveImport() {
  try {
    const btn = dataCenterPanel.querySelector('#dcImportDriveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Otwieranie Pickera…'; }

    await initPicker();
    const token = await requestAccessToken('');

    const picked = await _pickMultipleFiles(token);
    if (!picked || picked.length === 0) return;

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Pobieranie…'; }

    const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
    const downloads = picked.map(f =>
      fetch(`${DRIVE_FILES_URL}/${f.fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} — ${f.fileName}`);
        return r.text().then(text => ({ text, name: f.fileName.replace(/\.csv$/i, '') }));
      })
    );

    const results = await Promise.allSettled(downloads);
    results.forEach(r => {
      if (r.status === 'fulfilled') _addMatch(r.value.text, r.value.name);
    });

    _render();
  } catch (err) {
    console.error('[datacenter] Drive import error:', err);
    _render();
  }
}

function _pickMultipleFiles(token) {
  return new Promise((resolve) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
      .setMimeTypes('text/csv,text/plain,application/octet-stream')
      .setMode(window.google.picker.DocsViewMode.LIST)
      .setIncludeFolders(false);

    const picker = new window.google.picker.PickerBuilder()
      .setAppId(GOOGLE_CLIENT_ID.split('-')[0])
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setTitle('Wybierz pliki CSV z meczami (można zaznaczyć kilka)')
      .addView(view)
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .setCallback((data) => {
        const action = data.action;
        if (action === window.google.picker.Action.PICKED) {
          resolve((data.docs ?? []).map(d => ({ fileId: d.id, fileName: d.name })));
        } else if (action === window.google.picker.Action.CANCEL) {
          resolve([]);
        }
      })
      .build();

    picker.setVisible(true);
  });
}
