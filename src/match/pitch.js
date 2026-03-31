import { state, shots } from '../core/state.js';
import { pitch } from '../core/config.js';
import { getVisibleShots } from './shots.js';

const canvas = document.getElementById('pitchCanvas');
const ctx    = canvas.getContext('2d');

// ─── Public ───────────────────────────────────────────────────────────────────

export function drawPitch() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scaleX = pitch.width / 68;
  const scaleY = pitch.height / 35;

  ctx.fillStyle = '#2d8f45';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  if (state.isMirrored) {
    const pitchMidX = pitch.x + pitch.width / 2;
    const pitchMidY = pitch.y + pitch.height / 2;
    ctx.translate(2 * pitchMidX, 2 * pitchMidY);
    ctx.scale(-1, -1);
  }

  // Stripes
  const stripesM    = [0, 5.5, 11, 16.5, 22, 28.5, 35];
  const stripeColors = ['#2e9148', '#39a856'];
  for (let s = 0; s < stripesM.length - 1; s++) {
    const sy = pitch.y + stripesM[s] * scaleY;
    const sh = (stripesM[s + 1] - stripesM[s]) * scaleY;
    ctx.fillStyle = stripeColors[s % 2];
    ctx.fillRect(pitch.x, sy, pitch.width, sh);
  }

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;

  ctx.strokeRect(pitch.x, pitch.y, pitch.width, pitch.height);

  ctx.beginPath();
  ctx.moveTo(pitch.x, pitch.y);
  ctx.lineTo(pitch.x + pitch.width, pitch.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pitch.x, pitch.y + pitch.height);
  ctx.lineTo(pitch.x + pitch.width, pitch.y + pitch.height);
  ctx.stroke();

  const penaltyAreaWidth = 40.32 * scaleX;
  const penaltyAreaDepth = 16.5 * scaleY;
  const penaltyAreaX = pitch.x + (pitch.width - penaltyAreaWidth) / 2;
  ctx.strokeRect(penaltyAreaX, pitch.y, penaltyAreaWidth, penaltyAreaDepth);

  const goalAreaWidth = 18.32 * scaleX;
  const goalAreaDepth = 5.5 * scaleY;
  const goalAreaX = pitch.x + (pitch.width - goalAreaWidth) / 2;
  ctx.strokeRect(goalAreaX, pitch.y, goalAreaWidth, goalAreaDepth);

  const goalWidth = 7.32 * scaleX;
  const goalDepth = 2.2 * scaleY;
  const goalX = pitch.x + (pitch.width - goalWidth) / 2;
  ctx.strokeRect(goalX, pitch.y - goalDepth, goalWidth, goalDepth);

  const penaltySpotX = pitch.x + pitch.width / 2;
  const penaltySpotY = pitch.y + 11 * scaleY;
  ctx.beginPath();
  ctx.arc(penaltySpotX, penaltySpotY, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(penaltySpotX, penaltySpotY, 9.15 * scaleY, 0.23 * Math.PI, 0.77 * Math.PI, false);
  ctx.stroke();

  ctx.restore();

  // Shots drawn after restore() with explicitly computed display coords
  const pitchMidX = pitch.x + pitch.width / 2;
  const pitchMidY = pitch.y + pitch.height / 2;
  const visibleShots = state.assistModeIndex !== null
    ? shots.filter((_, i) => i === state.assistModeIndex)
    : getVisibleShots();

  visibleShots.forEach((shot) => {
    const originalIndex = shots.indexOf(shot);
    const isHovered     = originalIndex === state.hoveredShotIndex;
    const isAssistTarget = originalIndex === state.assistModeIndex;
    const showOverlay   = isAssistTarget || (isHovered && (state.isReadMode || state.hoveredFromList));
    const displayX = state.isMirrored ? (2 * pitchMidX - shot.x) : shot.x;
    const displayY = state.isMirrored ? (2 * pitchMidY - shot.y) : shot.y;
    if (showOverlay) _drawAssistOverlay(shot, isAssistTarget, displayX, displayY);
    _drawShot(displayX, displayY, originalIndex + 1, isHovered, shot.team, shot);
  });
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _drawArrow(x1, y1, x2, y2, isPreview) {
  const dx  = x2 - x1;
  const dy  = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 5) return;
  ctx.save();
  ctx.strokeStyle = isPreview ? 'rgba(251,191,36,0.7)' : '#fbbf24';
  ctx.fillStyle   = isPreview ? 'rgba(251,191,36,0.7)' : '#fbbf24';
  ctx.lineWidth = 2.5;
  if (isPreview) ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const angle     = Math.atan2(dy, dx);
  const headLen   = 12;
  const headAngle = Math.PI / 7;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - headAngle), y2 - headLen * Math.sin(angle - headAngle));
  ctx.lineTo(x2 - headLen * Math.cos(angle + headAngle), y2 - headLen * Math.sin(angle + headAngle));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function _drawAssistOverlay(shot, isAssistTarget, shotDisplayX, shotDisplayY) {
  const pitchMidX = pitch.x + pitch.width / 2;
  const pitchMidY = pitch.y + pitch.height / 2;

  if (shot.assistPos) {
    const px = state.isMirrored ? (2 * pitchMidX - shot.assistPos.x) : shot.assistPos.x;
    const py = state.isMirrored ? (2 * pitchMidY - shot.assistPos.y) : shot.assistPos.y;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251,191,36,0.9)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', px, py + 0.5);
  }

  if (shot.assistArrow) {
    const x1 = state.isMirrored ? (2 * pitchMidX - shot.assistArrow.x1) : shot.assistArrow.x1;
    const y1 = state.isMirrored ? (2 * pitchMidY - shot.assistArrow.y1) : shot.assistArrow.y1;
    const x2 = state.isMirrored ? (2 * pitchMidX - shot.assistArrow.x2) : shot.assistArrow.x2;
    const y2 = state.isMirrored ? (2 * pitchMidY - shot.assistArrow.y2) : shot.assistArrow.y2;
    _drawArrow(x1, y1, x2, y2, false);
  }

  if (isAssistTarget && state.assistSubMode === 'arrow' && state._arrowDrawing && state._arrowStart && state._arrowPreviewEnd) {
    _drawArrow(state._arrowStart.displayX, state._arrowStart.displayY, state._arrowPreviewEnd.displayX, state._arrowPreviewEnd.displayY, true);
  }
}

function _drawShot(x, y, number, isHovered = false, team = 'ourTeam', shot = null) {
  const radius    = isHovered ? 6 : 4;
  const fontSize  = isHovered ? 7 : 5.5;
  const lineWidth = isHovered ? 1.5 : 1;
  const fillColor = team === 'opponent' ? '#2563eb' : '#e11d48';

  if (isHovered && shot && (state.isReadMode || state.hoveredFromList)) {
    const scaleX = pitch.width / 68;
    const scaleY = pitch.height / 35;
    const goalHalfWidth   = 7.32 / 2;
    const goalCentreCanvasX = pitch.x + pitch.width / 2;
    const goalCentreCanvasY = pitch.y;
    const postLCanvasX = goalCentreCanvasX - goalHalfWidth * scaleX;
    const postRCanvasX = goalCentreCanvasX + goalHalfWidth * scaleX;

    const pitchMidX = pitch.x + pitch.width / 2;
    const pitchMidY = pitch.y + pitch.height / 2;
    const gCX = state.isMirrored ? 2 * pitchMidX - goalCentreCanvasX : goalCentreCanvasX;
    const gCY = state.isMirrored ? 2 * pitchMidY - goalCentreCanvasY : goalCentreCanvasY;
    const gLX = state.isMirrored ? 2 * pitchMidX - postLCanvasX : postLCanvasX;
    const gRX = state.isMirrored ? 2 * pitchMidX - postRCanvasX : postRCanvasX;
    const gPostY = gCY;

    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(gLX, gPostY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(gRX, gPostY); ctx.stroke();
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(gCX, gCY); ctx.stroke();
    ctx.restore();

    const cxM = parseFloat(shot.contextX);
    const cyM = parseFloat(shot.contextY);
    const goalCxM = 20.16;
    const goalCyM = 0;
    const dx = cxM - goalCxM;
    const dy = cyM - goalCyM;
    const distM = Math.sqrt(dx * dx + dy * dy);

    const postLM  = goalCxM - 7.32 / 2;
    const postRM  = goalCxM + 7.32 / 2;
    const dL      = Math.sqrt((cxM - postLM) ** 2 + cyM ** 2);
    const dR      = Math.sqrt((cxM - postRM) ** 2 + cyM ** 2);
    const cosAngle = (dL * dL + dR * dR - 7.32 * 7.32) / (2 * dL * dR);
    const angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;

    const pad    = 4;
    const lh     = 9;
    const label1 = `${distM.toFixed(1)} m`;
    const label2 = `${angleDeg.toFixed(1)}\u00b0`;
    const xgVal  = shot.xg && shot.xg !== '' ? shot.xg : 'n/a';
    const label3 = `xG: ${xgVal}`;
    ctx.font = 'bold 8px Arial';
    const w = Math.max(ctx.measureText(label1).width, ctx.measureText(label2).width, ctx.measureText(label3).width) + pad * 2;
    const h = lh * 3 + pad * 2;
    let tx = x + 8;
    let ty = y - h / 2;
    if (tx + w > canvas.width - 4)  tx = x - w - 8;
    if (ty < 4)                      ty = 4;
    if (ty + h > canvas.height - 4) ty = canvas.height - h - 4;

    ctx.fillStyle   = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(tx, ty, w, h, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle     = '#111827';
    ctx.textAlign     = 'left';
    ctx.textBaseline  = 'top';
    ctx.fillText(label1, tx + pad, ty + pad);
    ctx.fillText(label2, tx + pad, ty + pad + lh);
    ctx.fillText(label3, tx + pad, ty + pad + lh * 2);
  }

  ctx.beginPath();
  ctx.fillStyle = fillColor;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth   = lineWidth;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.fillStyle     = '#ffffff';
  ctx.font          = `bold ${fontSize}px Arial`;
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillText(String(number), x, y + 0.5);
}
