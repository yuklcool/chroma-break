// Chroma Break: every tuning number, colour and level layout in one place.
// The playfield is a fixed 960x640 logical area; the renderer scales it to fit
// the window, so no rule below depends on the screen size.

/** The logical playfield the whole game is laid out in. */
export const FIELD = { width: 960, height: 640 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const LIVES = 3;
export const MAX_LIVES = 5;

/** The three spark colours, in the order the spark cycles through them. */
export const COLOUR_ORDER = ['cyan', 'magenta', 'amber'];

export const COLOURS = {
  cyan: '#22d3ee',
  magenta: '#f472b6',
  amber: '#fbbf24',
  steel: '#9ca3af',
  white: '#ffffff',
};

/** Letters used in the level maps below, one per prism. */
export const COLOUR_LETTER = { C: 'cyan', M: 'magenta', A: 'amber', S: 'steel' };

export const PADDLE = {
  width: 110,
  height: 16,
  y: 600,
  speed: 640,
  mouseSpeed: 980,
  wideScale: 1.6,
  wideSeconds: 8,
};

export const SPARK = {
  radius: 8,
  baseSpeed: 430,
  speedPerLevel: 18,
  maxSpeed: 620,
  slowScale: 0.62,
  slowSeconds: 8,
  trailLength: 12,
};

export const PRISM = {
  width: 64,
  height: 26,
  gapX: 8,
  gapY: 8,
  cols: 11,
  top: 88,
  points: 50,
  /** Seconds a prism stays flashed white after a wrong-colour hit. */
  flashSeconds: 0.18,
};

/** Combo: every 3 consecutive same-colour breaks raises the multiplier by 1. */
export const COMBO = { perStep: 3, maxMultiplier: 8 };

export const POWERUP = {
  size: 26,
  fallSpeed: 150,
  dropChance: 0.14,
  kinds: [
    { kind: 'wide', label: 'WIDE', colour: '#22d3ee', weight: 35 },
    { kind: 'multi', label: 'x3', colour: '#f472b6', weight: 30 },
    { kind: 'slow', label: 'SLOW', colour: '#fbbf24', weight: 25 },
    { kind: 'life', label: '+1', colour: '#4ade80', weight: 10 },
  ],
};

/** Points for clearing a level: 250 per level plus 100 per life left. */
export const CLEAR_BONUS = { perLevel: 250, perLife: 100 };

/** Five levels, each a map of letters (C/M/A prism, S steel, . empty). */
export const LEVELS = [
  {
    name: 'First Light',
    moving: false,
    rows: [
      'CCCCCCCCCCC',
      'MMMMMMMMMMM',
      'AAAAAAAAAAA',
      'CCCCCCCCCCC',
      'MMMMMMMMMMM',
    ],
  },
  {
    name: 'Checkerboard',
    moving: false,
    rows: [
      'SMACMACMAMS',
      'MACMACMACMA',
      'ACMACMACMAC',
      'CMACMACMACM',
      'MACMACMACMA',
      'SMACMACMAMS',
    ],
  },
  {
    name: 'Diamond',
    moving: false,
    rows: [
      '....CCC....',
      '...CCCCC...',
      '..MMMMMMM..',
      '.AAAAAAAAA.',
      '..MMMMMMM..',
      '...CCCCC...',
      '....CCC....',
    ],
  },
  {
    name: 'Fortress',
    moving: false,
    rows: [
      'SSSSSSSSSSS',
      'SCMACMACMAS',
      'SMACMACMACS',
      'SACMACMACAS',
      'SCMACMACMAS',
      'SSSSSSSSSSS',
    ],
  },
  {
    name: 'Drift',
    moving: true,
    rows: [
      'CMACMACMACM',
      'MACSMACMACA',
      'ACMACMACMAC',
      'MACMACMASMA',
      'CMACMACMACM',
    ],
  },
];

export const PALETTE = {
  backdrop: '#0b0f1a',
  panel: '#121829',
  panelEdge: '#2b3550',
  text: '#f1f5f9',
  muted: '#94a3b8',
  gold: '#fbbf24',
  green: '#4ade80',
  red: '#f87171',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'chroma-break.best';

/** Where the mute choice is kept between visits (this browser only). */
export const MUTE_KEY = 'chroma-break.muted';
