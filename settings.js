// ─── xG Models registry ──────────────────────────────────────────────────────

const xgModels = {

  logistic: {
    key:         'logistic',
    name:        'Regresja logistyczna (dystans + kąt)',
    description: [
      'Model oparty na dwóch cechach geometrycznych:',
      '• Dystans od środka bramki (metry)',
      '• Kąt zawarty przez słupki bramki w miejscu uderzenia',
      '',
      'Specjalne reguły:',
      '• Rzut karny → xG = 0.79 (stała wartość empiryczna)',
      '• Uderzenie głową → obniżony intercept i współczynnik kąta',
      '',
      'Wzór: P = 1 / (1 + exp(−(β₀ + β₁·dystans + β₂·kąt)))',
      'Stopa (β₀=−3.0, β₁=−0.05, β₂=3.0)',
      'Głowa (β₀=−3.8, β₁=−0.05, β₂=2.5)',
    ],
    compute(cxM, cyM, statusArray) {
      const cx = parseFloat(cxM);
      const cy = parseFloat(cyM);
      const status = Array.isArray(statusArray) ? statusArray : [];

      if (status.includes('rzut-karny')) return 0.79;
      if (cy <= 0) return 0.01;

      const GOAL_X    = 20.16;
      const GOAL_HALF = 3.66;

      const dist = Math.sqrt((cx - GOAL_X) ** 2 + cy ** 2);

      const a1 = Math.atan2(-cy, GOAL_X - GOAL_HALF - cx);
      const a2 = Math.atan2(-cy, GOAL_X + GOAL_HALF - cx);
      let angle = Math.abs(a1 - a2);
      if (angle > Math.PI) angle = 2 * Math.PI - angle;

      const isHeader = status.includes('uderzenie-glowa');
      const logit = isHeader
        ? -3.8 + (-0.05 * dist) + (2.5 * angle)
        : -3.0 + (-0.05 * dist) + (3.0 * angle);

      return Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-logit))));
    },
  },

  distanceOnly: {
    key:         'distanceOnly',
    name:        'Tylko dystans (model uproszczony)',
    description: [
      'Prosty model oparty wyłącznie na dystansie od bramki.',
      '',
      '• Rzut karny → xG = 0.79',
      '• Uderzenie głową → mnożnik 0.5',
      '',
      'Wzór: P = 1 / (1 + exp(−(−2.0 + −0.09·dystans)))',
      'Najlepszy dla szybkiego szacowania bez analizy ustawienia.',
    ],
    compute(cxM, cyM, statusArray) {
      const cx = parseFloat(cxM);
      const cy = parseFloat(cyM);
      const status = Array.isArray(statusArray) ? statusArray : [];

      if (status.includes('rzut-karny')) return 0.79;
      if (cy <= 0) return 0.01;

      const GOAL_X = 20.16;
      const dist   = Math.sqrt((cx - GOAL_X) ** 2 + cy ** 2);

      const logit = -2.0 + (-0.09 * dist);
      const p = 1 / (1 + Math.exp(-logit));
      const base = Math.min(0.99, Math.max(0.01, p));

      return status.includes('uderzenie-glowa') ? Math.max(0.01, base * 0.5) : base;
    },
  },

  torvaneySimple: {
    key:         'torvaneySimple',
    name:        'Torvaney — Simple xG',
    description: [
      'Opublikowany model Bena Torvaney\'ego (statsandsnakeoil.com).',
      'Regresja logistyczna z interakcjami angle × distance × header.',
      '',
      'Cechy:',
      '• Kąt bramkowy θ (wzór cosinusów dla obu słupków)',
      '• Dystans d od środka bramki (metry)',
      '• Uderzenie głową h (0/1)',
      '• Interakcje: θ·d, θ·h, d·h, θ·d·h',
      '',
      'Współczynniki (oryginalne):',
      '  Intercept    −1.7456',
      '  θ (kąt)      +1.3387',
      '  d (dystans)  −0.1104',
      '  h (głowa)    +0.6467',
      '  θ·d          +0.1688',
      '  θ·h          −0.4249',
      '  d·h          −0.1342',
      '  θ·d·h        −0.0551',
      '',
      'Rzut karny → xG = 0.79 (stała wartość empiryczna).',
    ],
    compute(cxM, cyM, statusArray) {
      const cx = parseFloat(cxM);
      const cy = parseFloat(cyM);
      const status = Array.isArray(statusArray) ? statusArray : [];

      if (status.includes('rzut-karny')) return 0.79;
      if (cy <= 0) return 0.01;

      const GOAL_X    = 20.16; // goal centre x (metres)
      const GOAL_HALF = 3.66;  // half goal-width
      const GOAL_W    = 7.32;  // full goal width

      // Distance from shot to each post
      const dLeft  = Math.sqrt((cx - (GOAL_X - GOAL_HALF)) ** 2 + cy ** 2);
      const dRight = Math.sqrt((cx - (GOAL_X + GOAL_HALF)) ** 2 + cy ** 2);

      // Goal angle θ via law of cosines (angle at shot subtended by both posts)
      const cosA     = (dLeft ** 2 + dRight ** 2 - GOAL_W ** 2) / (2 * dLeft * dRight);
      const goalAngle = Math.acos(Math.min(1, Math.max(-1, cosA)));

      // Euclidean distance to goal centre
      const goalDistance = Math.sqrt((cx - GOAL_X) ** 2 + cy ** 2);

      const h = status.includes('uderzenie-glowa') ? 1 : 0;

      const logit =
        -1.745598
        + 1.338737 * goalAngle
        - 0.110384 * goalDistance
        + 0.646730 * h
        + 0.168798 * goalAngle * goalDistance
        - 0.424885 * goalAngle * h
        - 0.134178 * goalDistance * h
        - 0.055093 * goalAngle * goalDistance * h;

      return Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-logit))));
    },
  },

  caleyV1: {
    key:         'caleyV1',
    name:        'Caley v1 (eksponencjalny)',
    description: [
      'Model Michaela Caleya (wersja 1) — eksponencjalny zanik xG.',
      'Uwzględnia kąt poprzez „skorygowany dystans" (adjDist).',
      '',
      'Cechy:',
      '• Dystans od linii bramkowej (cyM)',
      '• Kąt względem kanału centralnego (22.5m od osi)',
      '• Uderzenie głową (status: uderzenie-głową)',
      '• Dośrodkowanie (status: dośrodkowanie)',
      '',
      'Wzory (eksponencjalne):',
      '  Stopa noga:         0.85 · exp(−0.13 · adjDist)',
      '  Głowa:              1.13 · exp(−0.27 · adjDist)',
      '  Dośrodkowanie noga: 0.97 · exp(−0.19 · adjDist)',
      '  Dośrodkowanie głową:0.65 · exp(−0.21 · adjDist)',
      '',
      'Rzut karny → xG = 0.79.',
      '',
      'Uwaga: model może dawać wartości > 1 dla uderzeń',
      'z bliskiej odległości pod ostrym kątem (znany błąd v1).',
      'Wartości są obcinane do 0.99.',
    ],
    compute(cxM, cyM, statusArray) {
      const cx = parseFloat(cxM);
      const cy = parseFloat(cyM);
      const status = Array.isArray(statusArray) ? statusArray : [];

      if (status.includes('rzut-karny')) return 0.79;
      if (cy <= 0) return 0.01;

      // In Caley's model coordinates:
      //   pitchX = distance from left touchline (metres, 0–68)
      //   pitchY = distance from goal line (metres) = our cyM
      //   centreX = 34 (centre of pitch)
      //   channelX = 22.5 * 68/380 ≈ 4.028m from centre
      // Our cxM is measured from penalty-area left edge (13.84m from touchline)
      const pitchX   = cx + 13.84;  // distance from left touchline
      const pitchY   = cy;           // distance from goal line

      const centreX  = 34;
      const channelX = 22.5 * 68 / 380; // ≈ 4.028m

      const relX = Math.abs(centreX - pitchX);

      // Relative angle: ratio to standard angle from central channel edge
      let relAngle;
      if (relX <= channelX) {
        relAngle = 1;
      } else {
        const shotAngle = Math.atan(pitchY / relX);
        const stdAngle  = Math.atan(pitchY / channelX);
        relAngle = stdAngle > 0 ? shotAngle / stdAngle : 0;
      }

      const adjDist = relAngle > 0 ? pitchY / Math.pow(relAngle, 1.32) : pitchY;

      const isHeader = status.includes('uderzenie-glowa');
      const isCross  = status.includes('dosrodkowanie');

      let xG;
      if (isCross && isHeader) {
        xG = 0.65 * Math.exp(-0.21 * adjDist);
      } else if (isCross) {
        xG = 0.97 * Math.exp(-0.19 * adjDist);
      } else if (isHeader) {
        xG = 1.13 * Math.exp(-0.27 * adjDist);
      } else {
        xG = 0.85 * Math.exp(-0.13 * adjDist);
      }

      return Math.min(0.99, Math.max(0.01, xG));
    },
  },

  caleyV2: {
    key:         'caleyV2',
    name:        'Caley v2 (regresja logistyczna)',
    description: [
      'Model Michaela Caleya wersja 2 (2015) — regresja logistyczna.',
      'Naprawia błąd v1 (xG > 1 pod ostrym kątem).',
      '',
      '4 typy uderzeń (na podstawie statusów):',
      '• Stopa bez dośrodkowania   → Regular Shots',
      '• Głowa z dośrodkowaniem    → Header + Cross',
      '• Głowa bez dośrodkowania   → Header, no Cross',
      '• Stopa z dośrodkowaniem    → Foot + Cross',
      '',
      'Zmienne geometryczne (uwzględnione):',
      '  d          — dystans do bramki (metry)',
      '  1/d        — odwrotność dystansu',
      '  relAngle   — względny kąt (1 = między słupkami)',
      '  1/relAngle — odwrotność kąta',
      '  goalAngle  — kąt kątowy słupków (dla dośrodkowań)',
      '',
      'Pominięte (brak danych w aplikacji):',
      '  throughball, counterattack, big_chance, rebound,',
      '  assist_distance, fast_break, game_state, league...',
      '',
      'Koeficjenty: oryginalne z publikacji Caleya 2015.',
      'Rzut karny → xG = 0.79.',
    ],
    compute(cxM, cyM, statusArray) {
      const cx = parseFloat(cxM);
      const cy = parseFloat(cyM);
      const status = Array.isArray(statusArray) ? statusArray : [];

      if (status.includes('rzut-karny')) return 0.79;
      if (cy <= 0) return 0.01;

      const GOAL_X    = 20.16;
      const GOAL_HALF = 3.66;

      const isHeader = status.includes('uderzenie-glowa');
      const isCross  = status.includes('dosrodkowanie');

      // Euclidean distance to goal centre
      const dist = Math.sqrt((cx - GOAL_X) ** 2 + cy ** 2);

      // Relative angle: 1 when between/on posts, decreases for wider shots
      // Based on the angle from perpendicular to the nearest post
      const horzOver = Math.max(0, Math.abs(cx - GOAL_X) - GOAL_HALF);
      const alpha    = Math.atan2(horzOver, cy);
      const relAngle = Math.max(0.01, 1 - alpha / (Math.PI / 2));

      // Goal angle θ (by cosine rule, for cross shots)
      const dLeft    = Math.sqrt((cx - (GOAL_X - GOAL_HALF)) ** 2 + cy ** 2);
      const dRight   = Math.sqrt((cx - (GOAL_X + GOAL_HALF)) ** 2 + cy ** 2);
      const cosA     = (dLeft ** 2 + dRight ** 2 - (2 * GOAL_HALF) ** 2) / (2 * dLeft * dRight);
      const goalAngle = Math.acos(Math.min(1, Math.max(-1, cosA)));

      let logit;
      if (isHeader && isCross) {
        // Headed Shots Assisted by Crosses — geometric terms only
        logit = -2.88
          + (-0.21) * dist
          +   2.13  * relAngle;
      } else if (isHeader) {
        // Headed Shots Not Assisted by Crosses — geometric terms only
        logit = -3.85
          + (-0.10) * dist
          +   2.56  * (1 / dist)
          +   1.94  * relAngle;
      } else if (isCross) {
        // Non-Headed Shots Assisted by Crosses — geometric terms only
        // (uses raw goalAngle, not relAngle, per Caley's formula)
        logit = -2.80
          + (-0.11) * dist
          +   3.52  * (1 / dist)
          +   1.14  * goalAngle;
      } else {
        // Regular Shots — geometric terms only
        logit = -3.19
          + (-0.095) * dist
          +   3.18   * (1 / dist)
          +   1.88   * relAngle
          +   0.24   * (1 / relAngle)
          + (-2.09)  * (1 / (dist * relAngle));
      }

      return Math.min(0.99, Math.max(0.01, 1 / (1 + Math.exp(-logit))));
    },
  },

};

// ─── Active model key (persisted in localStorage) ────────────────────────────

let activeXgModelKey = localStorage.getItem('xgModel') || 'logistic';
if (!xgModels[activeXgModelKey]) activeXgModelKey = 'logistic';

// ─── Settings panel renderer ─────────────────────────────────────────────────

function renderSettings() {
  const panel = document.getElementById('settingsPanel');
  const model = xgModels[activeXgModelKey];

  panel.innerHTML = `
    <div style="max-width:640px">
      <div class="pdg-section-title" style="margin-top:0">Model xG</div>

      <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px">
        <label for="xgModelSelect" style="font-size:13px;color:#4b5563">Aktywny algorytm</label>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="xgModelSelect" style="border:1px solid #d1d5db;border-radius:10px;padding:10px 12px;font-size:14px;background:#fff;color:#111827;max-width:400px">
            ${Object.values(xgModels).map(m => `
              <option value="${m.key}"${m.key === activeXgModelKey ? ' selected' : ''}>${m.name}</option>
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
    activeXgModelKey = key;
    localStorage.setItem('xgModel', key);
    renderSettings();
  });

  document.getElementById('recalcXgBtn').addEventListener('click', () => {
    const count = (typeof shots !== 'undefined') ? shots.length : 0;
    const confirmed = window.confirm(
      `Przelicz xG (i xA) dla wszystkich ${count} uderzeń?\n\nAktualny model: „${xgModels[activeXgModelKey].name}"\n\nIstniejące wartości xG zostaną nadpisane, a xA zawodników zostanie automatycznie zaktualizowane. Tej operacji nie można cofnąć.`
    );
    if (!confirmed) return;

    const model = xgModels[activeXgModelKey];
    shots.forEach(shot => {
      shot.xg = model.compute(shot.contextX, shot.contextY, shot.status).toFixed(2);
    });
    renderShotsList();
  });
}
