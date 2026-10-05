// Every timing/physics knob lives here — never inline (GDD: Player).
// Simulation reads seconds and converts to whole 120 Hz frames via `frames()`
// so timers are integer counters and replays stay bit-exact.

export const TIMESTEP = {
  HZ: 120,
  STEP: 1 / 120, // fixed simulation step (s)
  MAX_FRAME: 0.1, // clamp per-frame accumulated time (tab-switch protection)
};

export const frames = (sec) => Math.round(sec * TIMESTEP.HZ);

// Logical canvas: 30×17 tiles of 32 px. 17 rows = 544 px; the canvas is 540,
// so the bottom 4 px of the floor row are cropped (GDD: Rooms).
export const ROOM = { COLS: 30, ROWS: 17, TILE: 32, W: 960, H: 540 };

export const PLAYER = {
  W: 14,
  H: 22,
  RUN: 180, // px/s
  GRAVITY: 1500, // px/s²
  JUMP_APEX: 64, // px; launch speed is derived: sqrt(2·g·h)
  JUMP_CUT: 0.45, // vy multiplier when jump is released while rising
  MAX_FALL: 600, // px/s terminal velocity (keeps per-step travel < 1 tile)
  COYOTE: 0.08, // s
  JUMP_BUFFER: 0.1, // s
};

export const REFLECT = {
  RADIUS: 28, // px from player centre
  WINDOW: 0.2, // s the zone stays open after a press
  COOLDOWN: 0.25, // s after the window closes
  HITSTOP: 0.06, // s of frozen simulation on a successful reflect
  // After a reflect the projectile can't hurt the player until it has left the
  // zone once — otherwise "hold right" on an orb from the left would kill you.
  // It CAN kill if it comes back later (GDD: Reflect rules).
  GRACE_MARGIN: 4, // px beyond RADIUS before grace ends
};

export const PROJECTILE = {
  BASE_SPEED: 140, // px/s
  GHOST_LEN: 220, // px of dashed upcoming path drawn ahead of each projectile
};

// Spike tiles: only the pointed lower part of the tile is lethal, so brushing
// the tips while jumping over reads as fair.
export const SPIKES = {
  INSET_X: 4, // px trimmed from each side of the tile
  TOP: 14, // px from the tile top where the lethal region starts
};

// Anchor (Chapter 2): heavy square. Not reflectable; slower; unstoppable —
// it smashes through breakable walls (heavy ones included) and switches.
export const ANCHOR = {
  SPEED: 90, // px/s
  HALF: 9, // px half-size (collision uses the inscribed circle)
};

// Seed (Chapter 3): diamond. Reflectable. Where it hits a surface it sticks and
// becomes a one-way platform for LIFE seconds.
export const SEED = {
  SPEED: 140, // px/s
  RADIUS: 6,
  LIFE: 4.0, // s a platform lasts
  PLATFORM_W: 32, // px
  PLATFORM_H: 6, // px (drawn thickness; only the top surface matters)
  BLINK: 1.0, // s of warning blink before it expires (presentation)
};

export const EMITTER = {
  TELEGRAPH: 0.5, // s charge-up glow before each shot
};

export const AUDIO = {
  MASTER_GAIN: 0.5,
  OFFSET_MIN: -200, // ms
  OFFSET_MAX: 200, // ms
  VOICE_CAP: 6,
  DENSITY_ATTEN: 0.55,
};

// Presentation-only feel values (never read by the simulation).
export const FEEL = {
  ARC_TIME: 0.1, // s the reflect arc stays visible
  DEATH_FLASH: 0.15, // s reset wipe
  SHAKE_PX: 2,
  SHAKE_TIME: 0.08,
  AFTERIMAGE: 0.12, // s jump afterimage life
};
