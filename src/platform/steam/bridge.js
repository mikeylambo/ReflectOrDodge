// The game's only door to Steam. Everything Steam-specific goes through this
// small interface so the game never imports a Steam SDK directly:
//
//   available            bool
//   unlock(id)           Promise — set an achievement (idempotent)
//   cloudRead(key)       Promise<string|null>
//   cloudWrite(key, s)   Promise
//   controllerType()     'xbox' | 'playstation' | 'nintendo' | 'steamdeck' | 'steam' | null
//                        (Steam Input's reported device, for glyphs)
//
// createSteamBridge() picks an implementation:
//   - Tauri desktop build: invokes `steam_*` commands on the Rust side
//     (src-tauri). Those commands are NOT implemented yet (needs steamworks-rs
//     and an App ID); until then every call resolves to "not available".
//   - anything else: the null bridge (web, tests).
export const nullBridge = {
  available: false,
  unlock: async () => {},
  cloudRead: async () => null,
  cloudWrite: async () => {},
  controllerType: () => null,
};

export function createTauriBridge(invoke) {
  let ok = false, ctype = null;
  const call = async (cmd, args) => { try { return await invoke(cmd, args); } catch { return null; } };
  return {
    async init() { ok = (await call('steam_init')) === true; ctype = ok ? await call('steam_controller_type') : null; return ok; },
    get available() { return ok; },
    unlock: (id) => (ok ? call('steam_unlock', { id }) : Promise.resolve()),
    cloudRead: (key) => (ok ? call('steam_cloud_read', { key }) : Promise.resolve(null)),
    cloudWrite: (key, value) => (ok ? call('steam_cloud_write', { key, value }) : Promise.resolve()),
    controllerType: () => ctype,
  };
}

export async function createSteamBridge() {
  const tauri = typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.core;
  if (!tauri) return nullBridge;
  const b = createTauriBridge(tauri.invoke);
  await b.init();
  return b.available ? b : nullBridge;
}
