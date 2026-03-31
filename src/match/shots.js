import { state, shots } from '../core/state.js';
import { pitch } from '../core/config.js';
import { computeXg } from '../core/xg.js';

const counter             = document.getElementById('counter');
const shotList            = document.getElementById('shotList');
const videoFragmentsCount = document.getElementById('videoFragmentsCount');

// ─── Filtering ────────────────────────────────────────────────────────────────

export function getVisibleShots() {
  if (state.activeTeamFilter === 'all') return shots;
  return shots.filter(s => s.team === state.activeTeamFilter);
}

// ─── Fragment custom select helpers ──────────────────────────────────────────

export function getFragmentOptions(selectedValue) {
  const count = Math.max(1, parseInt(videoFragmentsCount.value) || 1);
  let options = '';
  for (let i = 1; i <= count; i++) {
    options += `<option value="${i}" ${selectedValue == i ? 'selected' : ''}>${i}</option>`;
  }
  return options;
}

export function getFragmentCustomSelect(index, selectedValue) {
  const selVal = selectedValue || 1;
  const count  = Math.max(1, parseInt(videoFragmentsCount.value) || 1);
  let liItems  = '';
  for (let i = 1; i <= count; i++) {
    liItems += `<li class="custom-select-option frag-opt" data-value="${i}" data-index="${index}" role="option" aria-selected="${selVal == i ? 'true' : 'false'}">${i}</li>`;
  }
  return `<div class="custom-select-wrap shot-fragment-wrap">
      <select id="fragment-${index}" class="shot-fragment-select" data-index="${index}" data-field="videoFragment" style="display:none" aria-hidden="true">${getFragmentOptions(selectedValue)}</select>
      <button type="button" class="custom-select-trigger shot-frag-trigger" data-index="${index}" aria-haspopup="listbox" aria-expanded="false"><span class="shot-frag-label">${selVal}</span><i class="bi bi-chevron-down custom-select-chevron"></i></button>
      <ul class="custom-select-dropdown shot-frag-dropdown" hidden role="listbox">${liItems}</ul>
    </div>`;
}

// ─── Shot list renderer ───────────────────────────────────────────────────────

export function renderShotsList() {
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
                <button type="button" class="shot-passer-edit-btn${state.assistModeIndex === index ? ' assist-active' : ''}" title="Tryb rysowania asysty"><i class="bi bi-pencil"></i></button>
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

  if (state.isReadMode) {
    document.querySelectorAll('#shotList input, #shotList select, #shotList button:not(.shot-item-menu-btn)').forEach(el => {
      el.disabled = true;
    });
  }
}

// ─── Shot factory ─────────────────────────────────────────────────────────────

export function createShot(x, y, team = 'ourTeam') {
  const scaleX = pitch.width / 68;
  const scaleY = pitch.height / 35;
  const penaltyAreaLeftX = pitch.x + ((68 - 40.32) / 2) * scaleX;
  const originX = penaltyAreaLeftX;
  const originY = pitch.y;

  const last = shots.length > 0 ? shots[shots.length - 1] : null;

  const cxM = (x - originX) / scaleX;
  const cyM = (y - originY) / scaleY;
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
    timestamp:    last ? last.timestamp : '',
    matchTime:    last ? last.matchTime : '',
    playerNumber: '',
    passerNumber: '',
    xg:           computeXg(cxM, cyM, []).toFixed(2),
    videoFragment: last ? last.videoFragment : '',
    assistPos:    null,
    assistArrow:  null,
    team,
  };
}
