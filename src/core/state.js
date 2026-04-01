// ─── Shared mutable application state ────────────────────────────────────────

/** The canonical list of all shots. Mutate in-place (push/splice/length=0). */
export const shots = [];

/**
 * All other shared scalar state lives here so any module can read AND write
 * by mutating properties of this object (live binding via ESM object reference).
 */
export const state = {
  hoveredShotIndex:  null,
  hoveredFromList:   false,
  activeTeamFilter:  'all',
  isMirrored:        false,
  isReadMode:        false,
  assistModeIndex:   null,
  assistSubMode:     'person', // 'person' | 'arrow'
  _assistToastTimer: null,
  _arrowDrawing:     false,
  _arrowStart:       null,    // { displayX, displayY, canonicalX, canonicalY }
  _arrowPreviewEnd:  null,    // { displayX, displayY }
  fragmentNames:     [],      // string[] — custom label for each video fragment
  fragmentOffsets:   [],      // number[] — offset in seconds for each video fragment
};
