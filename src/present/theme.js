// Placeholder palette per GDD Art direction: dark field, luminous player,
// bright geometric projectiles. Gameplay colours are constant across chapters.
export const THEME = {
  bg0: '#07080d',
  bg1: '#0d1018',
  grid: 'rgba(120,140,200,0.04)',
  tile: '#161b28',
  tileEdge: '#2c3550',
  player: '#f3ece0',
  playerGlow: '#ffe6c8', // warm: the hero is off the ice blue (docs/ART.md: Character)
  hero: { skin: '#f3ece0', cloth: '#ddd4c3', limb: '#c9c0ae', beanie: '#5b5fae', cuff: '#8387cf', frame: '#1c2030', lens: 'rgba(191,240,255,0.28)' },
  zone: 'rgba(127,212,255,0.10)',
  arc: '#bff0ff',
  orb: '#ffb347',
  orbCore: '#fff3dc',
  orbGlow: '#ff9a1f',
  orbReflected: '#7fd4ff',
  ghost: 'rgba(255,179,71,0.35)',
  ghostReflected: 'rgba(127,212,255,0.4)',
  emitter: '#ff6b5a',
  emitterOff: '#4a4f60',
  emitterBody: '#20131a',
  switch: '#9dff8a',
  door: '#c49bff',
  doorFill: '#2a1f40',
  exit: '#f5f7ff',
  anchor: '#c9d2e8',
  anchorBody: '#2a3045',
  seed: '#7dffb6',
  seedPlatform: '#1f4d3a',
  splitter: '#ffd166', // placeholders until the art pass for chapters 5–7
  charge: '#b8a6ff',
  chargeHot: '#ff5ca8',
  twin: '#6ee7ff',
  examiner: '#ff8fd8',
  examinerBody: '#1b1222',
  examinerCore: '#ffe36e',
  examinerDim: '#4a3a55',
  spike: '#ff4d6d',
  spikeBase: '#3a1622',
  wall: '#2a2f3f',
  wallHeavy: '#343846',
  wallEdge: '#9aa6c8',
  hud: 'rgba(230,236,255,0.8)',
  hudDim: 'rgba(230,236,255,0.35)',
};

// High-contrast variant (assist): stronger edges, brighter hazards, no glow-only cues.
export const HIGH_CONTRAST = {
  ...THEME,
  bg0: '#000000',
  bg1: '#000000',
  grid: 'rgba(255,255,255,0.0)',
  tile: '#3a4260',
  tileEdge: '#ffffff',
  ghost: 'rgba(255,200,90,0.9)',
  ghostReflected: 'rgba(150,230,255,0.95)',
  wallEdge: '#ffffff',
};

// Chapter identity (GDD: Art direction): one accent hue and one background
// motif per chapter. Accents tint only the room's architecture — tile edges,
// grid, motif — never a gameplay colour, so every projectile and target reads
// the same in every chapter. See docs/ART.md.
export const CHAPTER_ART = {
  0: { accent: '#7fd4ff', motif: 'none' }, //            Prologue: bare diagram
  1: { accent: '#6fd3c1', motif: 'rings' }, //           Answer: concentric answers
  2: { accent: '#9aa6c8', motif: 'strata' }, //          Weight: heavy horizontal bands
  3: { accent: '#9be37a', motif: 'tendrils' }, //        Ground: growth lines
  4: { accent: '#d7a6ff', motif: 'none' },
};

const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function chapterTheme(ci, highContrast = false) {
  const base = highContrast ? HIGH_CONTRAST : THEME;
  const art = CHAPTER_ART[ci] || CHAPTER_ART[0];
  if (highContrast) return { ...base, motif: 'none', accent: '#ffffff' };
  return {
    ...base, accent: art.accent, motif: art.motif,
    tileEdge: hexA(art.accent, 0.38), tileTop: hexA(art.accent, 0.9), floorGlow: hexA(art.accent, 0.16),
    tileShade: 'rgba(0,0,0,0.3)', tile: '#121622', hatch: hexA(art.accent, 0.085),
    grid: hexA(art.accent, 0.03), motifInk: hexA(art.accent, 0.09), haze: hexA(art.accent, 0.10),
    mote: art.accent, lights: true, spikeLight: 'rgba(255,77,109,0.10)',
  };
}
