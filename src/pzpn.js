// ─── LączyNasPiłka API — test połączenia ──────────────────────────────────────
// Plik tymczasowy — tylko test. Nie integruje się z resztą aplikacji.

import { LNP_BEARER_TOKEN, LNP_API_BASE } from './pzpn-config.js';

const LNP_TEST_ENDPOINT = `${LNP_API_BASE}/Seasons/dictionaries`;

export async function testLnpConnection() {
  console.group('[LNP] Test połączenia z API LączyNasPiłka');
  console.log('Endpoint:', LNP_TEST_ENDPOINT);

  try {
    const response = await fetch(LNP_TEST_ENDPOINT, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${LNP_BEARER_TOKEN}`,
        'Accept':        'application/json',
      },
    });

    console.log('Status:', response.status, response.statusText);

    if (!response.ok) {
      console.warn('[LNP] Odpowiedź nieudana — status:', response.status);
      const text = await response.text();
      console.warn('[LNP] Treść odpowiedzi:', text);
    } else {
      const data = await response.json();
      console.log('[LNP] Dane:', data);
    }
  } catch (err) {
    console.error('[LNP] Błąd połączenia:', err);
  }

  console.groupEnd();
}
