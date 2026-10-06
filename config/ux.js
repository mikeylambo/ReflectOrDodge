// UX numbers: menus, hints, intros. Not gameplay, so they live apart from
// tunables.js (whose hash keys the solver cache, which should not be dropped
// just because a hint threshold changed).

export const HINT = {
  AFTER_DEATHS: 10, // GDD: Stuck-player system
  AFTER_MS: 3 * 60 * 1000,
  TAIL: 0.6, // s the hint ghost keeps going after its first reflect
};

export const RESET_PROMPT_DEATHS = 2; // deaths in a room before the reset glyph first shows

export const INTRO_TIME = 0.8; // s (GDD: Room intro)
export const CLEAR_HOLD = 0.6; // s of room-clear glow before results (GDD: Game feel)

export const ASSIST_STEPS = {
  SPEEDS: [1, 0.75, 0.5],
  WINDOWS: [1, 1.5, 2],
};
export const VOLUMES = [1, 0.75, 0.5, 0.25, 0];

// Examiner defeated (GDD: Game feel): slow motion while it collapses along
// the paths of your reflections.
export const SLOWMO = { SPEED: 0.35, TIME: 0.5 }; // sim speed, real seconds
export const COLLAPSE_TIME = 1.2; // s the collapse lines take to sweep out

// Audio calibration slider (Settings): ms, positive = sounds earlier.
export const OFFSET = { MIN: -200, MAX: 200, STEP: 20 };
