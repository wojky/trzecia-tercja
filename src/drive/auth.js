// ─── Google Auth (GIS — Google Identity Services) ────────────────────────────
// Handles OAuth 2.0 token flow entirely in the browser (implicit/token flow).
// Access tokens expire after 1 hour; re-login is required automatically via
// a silent prompt when the user still has an active Google session.

import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from '../google-config.js';

// ─── State ────────────────────────────────────────────────────────────────────

let _accessToken  = null;
let _tokenExpiry  = 0;      // Date.now() ms
let _userProfile  = null;   // { name, email, picture }
let _tokenClient  = null;
let _tokenResolve = null;   // resolve fn for pending token promise
let _tokenReject  = null;   // reject fn for pending token promise

// ─── Public API ───────────────────────────────────────────────────────────────

export function isSignedIn() {
  return _accessToken !== null && Date.now() < _tokenExpiry;
}

export function getAccessToken() {
  return _accessToken;
}

export function getUserProfile() {
  return _userProfile;
}

/**
 * Requests a fresh access token. Shows the Google account picker if needed.
 * Returns a Promise that resolves with the token string.
 */
export function requestAccessToken(prompt = 'select_account') {
  return new Promise((resolve, reject) => {
    if (isSignedIn()) { resolve(_accessToken); return; }

    _ensureTokenClient();
    _tokenResolve = resolve;
    _tokenReject  = reject;

    _tokenClient.requestAccessToken({ prompt });
  });
}

/**
 * Sign in — shows account picker, fetches profile from People API.
 */
export async function signIn() {
  const token = await requestAccessToken('select_account');
  await _fetchProfile(token);
  _renderSignedIn();
  return token;
}

/**
 * Silent re-auth — tries without showing UI. Rejects if Google session expired.
 */
export function silentSignIn() {
  return requestAccessToken('');
}

export function signOut() {
  if (_accessToken) {
    window.google?.accounts.oauth2.revoke(_accessToken, () => {});
  }
  _accessToken = null;
  _tokenExpiry = 0;
  _userProfile = null;
  _clearStoredProfile();
  _renderSignedOut();
}

// ─── GIS token client bootstrap ──────────────────────────────────────────────

function _ensureTokenClient() {
  if (_tokenClient) return;
  _tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope:     GOOGLE_SCOPES,
    callback:  _handleTokenResponse,
    error_callback: (err) => {
      console.error('[auth] token error', err);
      const fn = _tokenReject;
      _tokenResolve = null;
      _tokenReject  = null;
      fn?.(new Error(err?.type || 'token_error'));
    },
  });
}

function _handleTokenResponse(response) {
  if (response.error) {
    console.error('[auth] token error:', response.error);
    const fn = _tokenReject;
    _tokenResolve = null;
    _tokenReject  = null;
    fn?.(new Error(response.error));
    return;
  }
  _accessToken = response.access_token;
  // GIS does not return expires_in reliably in all browsers; default 1h
  const expiresIn = (parseInt(response.expires_in) || 3600) * 1000;
  _tokenExpiry = Date.now() + expiresIn - 60_000; // 1 min buffer

  const fn = _tokenResolve;
  _tokenResolve = null;
  _tokenReject  = null;
  fn?.(_accessToken);
}

// ─── Profile fetch (Google People API) ───────────────────────────────────────

async function _fetchProfile(token) {
  try {
    const res = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return;
    const data = await res.json();
    _userProfile = {
      name:    data.name    || data.email,
      email:   data.email   || '',
      picture: data.picture || '',
    };
  } catch (e) {
    console.warn('[auth] could not fetch profile:', e);
  }
}

// ─── UI rendering ─────────────────────────────────────────────────────────────

function _renderSignedIn() {
  const btn = document.getElementById('googleSignInBtn');
  if (!btn) return;

  const p = _userProfile;
  const avatarHtml = p?.picture
    ? `<img src="${p.picture}" class="gauth-avatar" alt="" referrerpolicy="no-referrer" />`
    : `<span class="gauth-avatar gauth-avatar-fallback"><i class="bi bi-person-fill"></i></span>`;

  btn.outerHTML = `
    <div class="gauth-user" id="gauthUser">
      ${avatarHtml}
      <span class="gauth-name">${_escHtml(p?.name || 'Zalogowany')}</span>
      <button class="gauth-drive-save-btn" id="driveSaveBtn" type="button" title="Zapisz mecz na Google Drive">
        <i class="bi bi-cloud-upload"></i>
      </button>
      <button class="gauth-drive-load-btn" id="driveLoadBtn" type="button" title="Wczytaj mecz z Google Drive">
        <i class="bi bi-cloud-download"></i>
      </button>
      <button class="gauth-signout-btn" id="gauthSignOutBtn" type="button" title="Wyloguj się">
        <i class="bi bi-box-arrow-right"></i>
      </button>
    </div>`;

  document.getElementById('gauthSignOutBtn')?.addEventListener('click', signOut);

  _saveStoredProfile(_userProfile);

  // Drive buttons wired in drive.js after it initialises
  document.dispatchEvent(new CustomEvent('gauth:signedin'));
}

function _renderSignedOut() {
  const user = document.getElementById('gauthUser');
  if (!user) return;
  user.outerHTML = `<button class="btn-auth btn-login" type="button" id="googleSignInBtn">Zaloguj się przez Google</button>`;
  const btn = document.getElementById('googleSignInBtn');
  btn?.addEventListener('click', () => signIn());
  document.dispatchEvent(new CustomEvent('gauth:signedout'));
}

function _escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Session persistence (localStorage) ──────────────────────────────────────

const _PROFILE_KEY = 'gauth_profile';

function _saveStoredProfile(profile) {
  try { localStorage.setItem(_PROFILE_KEY, JSON.stringify(profile)); } catch {}
}

function _loadStoredProfile() {
  try { return JSON.parse(localStorage.getItem(_PROFILE_KEY) || 'null'); } catch { return null; }
}

function _clearStoredProfile() {
  try { localStorage.removeItem(_PROFILE_KEY); } catch {}
}



// ─── Init on module load ──────────────────────────────────────────────────────

export function initAuth() {
  // Wire sign-in button
  const btn = document.getElementById('googleSignInBtn');
  btn?.addEventListener('click', () => signIn());

  // If user was previously signed in, restore UI from localStorage immediately.
  // Token is acquired lazily on first save/load action (GIS has no true silent
  // flow — any requestAccessToken call opens a popup, which browsers block on
  // page load without a user gesture).
  const stored = _loadStoredProfile();
  if (!stored) return;

  _userProfile = stored;
  _renderSignedIn();
}
