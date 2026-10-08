// Build-time feature flags. Everything behind a flag is off unless the build
// turns it on (Vite env), so web builds never ship platform code paths live.
//   VITE_STEAM=1 npm run build   → Steam achievements, cloud saves, Steam glyphs
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const FLAGS = {
  STEAM: env.VITE_STEAM === '1',
};
