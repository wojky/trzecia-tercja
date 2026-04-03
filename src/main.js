import { drawPitch } from './match/pitch.js';
import { renderShotsList } from './match/shots.js';

import './ui/setup.js';
import './ui/controls.js';
import './tabs/stats.js';
import './tabs/players.js';
import './tabs/docs.js';
import { initAuth } from './drive/auth.js';
import { initDrive } from './drive/drive.js';
import { testLnpConnection } from './pzpn.js';

drawPitch();
renderShotsList();
initAuth();
initDrive();

// ─── Tymczasowy test API LączyNasPiłka ────────────────────────────────────────
testLnpConnection();
