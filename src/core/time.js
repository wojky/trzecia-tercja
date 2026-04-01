// ─── Time helpers ─────────────────────────────────────────────────────────────

/**
 * Parse a time string into total seconds.
 * Accepted formats: "MM:SS", "HH:MM:SS", "-MM:SS", "-HH:MM:SS".
 * Returns null if unparseable.
 */
export function parseTimeToSeconds(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  const negative = trimmed.startsWith('-');
  const abs = negative ? trimmed.slice(1) : trimmed;
  const parts = abs.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  let seconds;
  if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else {
    return null;
  }
  return negative ? -seconds : seconds;
}

/**
 * Format total seconds into "MM:SS" string (no hours).
 * Negative values produce e.g. "-01:05".
 */
export function formatSecondsToMatchTime(totalSeconds) {
  const neg = totalSeconds < 0;
  const abs = Math.abs(Math.round(totalSeconds));
  const m   = Math.floor(abs / 60);
  const s   = abs % 60;
  const str = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return neg ? `-${str}` : str;
}
