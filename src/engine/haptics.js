// Haptics (from Living Loop engine/haptics.js) + gamepad rumble.
//
// Native (Capacitor): @capacitor/haptics, imported dynamically and only on the
// native shell so the web bundle never ships it. Web: navigator.vibrate as a
// coarse fallback (no-op on iOS Safari). Gamepads: the standard
// vibrationActuator "dual-rumble" effect where the browser supports it.
// Fire-and-forget; never throws; the sim never touches this.

let enabled = true;
let impact = null;
let Style = null;

export async function initHaptics() {
  const C = typeof window !== 'undefined' ? window.Capacitor : null;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  try {
    const name = '@capacitor/haptics'; // variable specifier: not bundled for web
    const m = await import(/* @vite-ignore */ name);
    impact = (opts) => m.Haptics.impact(opts);
    Style = m.ImpactStyle;
  } catch { impact = null; }
}

export function setHapticsEnabled(v) { enabled = !!v; }

const RUMBLE = {
  light: { duration: 60, weakMagnitude: 0.35, strongMagnitude: 0.05 },
  medium: { duration: 90, weakMagnitude: 0.5, strongMagnitude: 0.3 },
  heavy: { duration: 140, weakMagnitude: 0.7, strongMagnitude: 0.6 },
};

// kind: 'light' (reflect) · 'medium' (death, clear) · 'heavy' (medal up)
export function haptic(kind = 'light') {
  if (!enabled) return;
  try {
    for (const pad of navigator.getGamepads ? navigator.getGamepads() : []) {
      if (pad && pad.vibrationActuator && pad.vibrationActuator.playEffect) {
        pad.vibrationActuator.playEffect('dual-rumble', RUMBLE[kind]).catch(() => {});
      }
    }
  } catch { /* no gamepad API */ }
  if (impact && Style) {
    const style = kind === 'heavy' ? Style.Heavy : kind === 'medium' ? Style.Medium : Style.Light;
    impact({ style }).catch(() => {});
  } else if (typeof navigator !== 'undefined' && navigator.vibrate && navigator.maxTouchPoints > 0) {
    navigator.vibrate(kind === 'heavy' ? 22 : kind === 'medium' ? 13 : 7);
  }
}
