import { shots } from '../core/state.js';
import { xgModels, xgState } from '../core/xg.js';
import { renderShotsList } from '../match/shots.js';

export function renderSettings() {
  const panel = document.getElementById('settingsPanel');
  const model = xgModels[xgState.key];

  panel.innerHTML = `
    <div style="max-width:640px">
      <div class="pdg-section-title" style="margin-top:0">Model xG</div>

      <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px">
        <label for="xgModelSelect" style="font-size:13px;color:#4b5563">Aktywny algorytm</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="xgModelSelect" style="border:1px solid #d1d5db;border-radius:10px;padding:10px 12px;font-size:14px;background:#fff;color:#111827;max-width:400px">
            ${Object.values(xgModels).map(m => `
              <option value="${m.key}"${m.key === xgState.key ? ' selected' : ''}>${m.name}</option>
            `).join('')}
          </select>
          <button id="recalcXgBtn" type="button" style="background:#111827;color:#fff;border:none;border-radius:10px;padding:10px 14px;font-size:14px;cursor:pointer;white-space:nowrap">
            <i class="bi bi-arrow-repeat"></i> Przelicz xG
          </button>
        </div>
      </div>

      <div id="xgModelCard" style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px">
        <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:10px">${model.name}</div>
        <div style="font-size:13px;color:#374151;line-height:1.7;white-space:pre-wrap">${model.description.join('\n')}</div>
      </div>

      <div style="margin-top:16px;padding:12px 14px;background:#fef9c3;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#92400e">
        <strong>Uwaga:</strong> zmiana modelu wpływa tylko na nowo dodawane uderzenia.<br>
        Uderzenia już zapisane zachowują dotychczasowe wartości xG (można je ręcznie edytować).
      </div>
    </div>
  `;

  document.getElementById('xgModelSelect').addEventListener('change', e => {
    const key = e.target.value;
    if (!xgModels[key]) return;
    xgState.key = key;
    localStorage.setItem('xgModel', key);
    renderSettings();
  });

  document.getElementById('recalcXgBtn').addEventListener('click', () => {
    const confirmed = window.confirm(
      `Przelicz xG (i xA) dla wszystkich ${shots.length} uderzeń?\n\nAktualny model: „${xgModels[xgState.key].name}"\n\nIstniejące wartości xG zostaną nadpisane, a xA zawodników zostanie automatycznie zaktualizowane. Tej operacji nie można cofnąć.`
    );
    if (!confirmed) return;

    const m = xgModels[xgState.key];
    shots.forEach(shot => {
      shot.xg = m.compute(shot.contextX, shot.contextY, shot.status).toFixed(2);
    });
    renderShotsList();
  });
}
