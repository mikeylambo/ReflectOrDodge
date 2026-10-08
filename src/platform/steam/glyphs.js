// Controller glyph switching. The Web Shell's detector reports keyboard /
// xbox / playstation / nintendo / generic-gamepad / touch from the browser
// Gamepad id; on Steam we refine it: Steam Input's reported controller wins,
// then USB vendor ids (Valve 28de = Steam Deck / Steam Controller, Sony 054c,
// Nintendo 057e, Microsoft 045e), then the shell's own answer.
const VENDORS = { '28de': 'steamdeck', '054c': 'playstation', '057e': 'nintendo', '045e': 'xbox' };

export function classifyGamepadId(id) {
  const s = String(id || '').toLowerCase();
  const m = s.match(/vendor:\s*([0-9a-f]{4})/) || s.match(/^([0-9a-f]{4})-[0-9a-f]{4}-/);
  if (m && VENDORS[m[1]]) return VENDORS[m[1]];
  if (/steam deck|valve|steam controller/.test(s)) return 'steamdeck';
  if (/dualsense|dualshock|playstation|sony/.test(s)) return 'playstation';
  if (/nintendo|joy-con|switch/.test(s)) return 'nintendo';
  if (/xbox|xinput|microsoft/.test(s)) return 'xbox';
  return null;
}

/**
 * @param shellFamily  the Web Shell's family ('keyboard-mouse', 'xbox', …)
 * @param gamepadId    the active Gamepad.id, if any
 * @param steamType    the Steam bridge's controllerType(), if any
 */
export function glyphFamily(shellFamily, gamepadId, steamType) {
  if (shellFamily === 'keyboard-mouse' || shellFamily === 'touch') return shellFamily;
  if (steamType === 'steam') return 'steamdeck';
  if (steamType) return steamType;
  return classifyGamepadId(gamepadId) || shellFamily;
}
