// Save schema v1 (GDD: Save schema), persisted through the Web Shell's
// SaveManager: versioned envelope, integrity checksum, staged writes with a
// last-known-good backup, and a migration table.
//
// Room records are keyed by stable room id, never list position. Medals only
// ever go up. Mirror unlocks are a cache derived from Gold medals.
import { SaveManager } from '@slu/web-shell/persistence/SaveManager.js';
import { BrowserStorage } from '@slu/web-shell/platform/browser/BrowserStorage.js';
import { MemoryStorage } from '@slu/web-shell/persistence/StorageAdapter.js';

export const SCHEMA_VERSION = 1;

export const MEDAL = { NONE: 0, BRONZE: 1, SILVER: 2, GOLD: 3 };
export const MEDAL_GLYPH = ['·', '●', '◆', '★']; // shape, not just colour (law 7)
export const MEDAL_NAME = ['', 'Bronze', 'Silver', 'Gold'];

export function defaultSave() {
  return {
    version: SCHEMA_VERSION,
    rooms: {},
    chapters: {},
    mirrorsUnlocked: [],
    assists: { speed: 1.0, window: 1.0, preview: false, invincible: false },
    settings: {
      audioOffsetMs: 0, musicVol: 0.8, sfxVol: 1.0, highContrast: false, shake: true,
      reducedFlashing: false, telemetry: false,
    },
    stats: { totalDeaths: 0, totalReflects: 0, playTimeMs: 0 },
  };
}

// Migration table: key N migrates a version-N save to N+1. v0 is the
// pre-release localStorage shape that never shipped; the stub keeps the chain
// honest so the first real schema change only has to add an entry.
const MIGRATIONS = {
  0: (data) => ({ ...defaultSave(), ...(data && typeof data === 'object' ? data : {}), version: 1 }),
};

// Fill any field a save is missing (new settings keys etc.) without touching
// the ones it has — compatible fallback for additive changes (constitution 20).
function withDefaults(data) {
  const d = defaultSave();
  if (!data || typeof data !== 'object') return d;
  return {
    ...d,
    ...data,
    assists: { ...d.assists, ...(data.assists || {}) },
    settings: { ...d.settings, ...(data.settings || {}) },
    stats: { ...d.stats, ...(data.stats || {}) },
    rooms: { ...(data.rooms || {}) },
    chapters: { ...(data.chapters || {}) },
    mirrorsUnlocked: [...(data.mirrorsUnlocked || [])],
  };
}

export async function openSave({ memory = false } = {}) {
  let storage;
  try {
    storage = memory ? new MemoryStorage() : new BrowserStorage('reflect-dodge');
    if (!memory) localStorage.getItem('__probe'); // private mode can throw on access
  } catch {
    storage = new MemoryStorage();
  }
  const manager = new SaveManager(storage, 'save', SCHEMA_VERSION, MIGRATIONS);
  let data;
  try {
    const r = await manager.loadWithRecovery();
    data = withDefaults(r.data);
  } catch {
    data = defaultSave();
  }

  let pending = null;
  const store = {
    data,
    // coalesce bursts of changes into one write
    save() {
      if (pending) return pending;
      pending = Promise.resolve().then(async () => {
        pending = null;
        try { await manager.save(store.data); } catch { /* storage full / blocked: keep playing */ }
      });
      return pending;
    },
    room(id) { return store.data.rooms[id] || null; },
    medal(id) { return (store.data.rooms[id] && store.data.rooms[id].medal) || MEDAL.NONE; },

    // A clear. Returns what changed so results can celebrate it.
    recordClear(id, { reflects, par, deaths, timeMs, medal }) {
      const prev = store.data.rooms[id];
      const rec = {
        cleared: true,
        bestReflects: prev && prev.bestReflects != null ? Math.min(prev.bestReflects, reflects) : reflects,
        medal: Math.max(prev ? prev.medal || 0 : 0, medal),
        deaths: (prev ? prev.deaths || 0 : 0),
        hintsUsed: prev ? prev.hintsUsed || 0 : 0, // counted as they're used (recordHint)
        bestTimeMs: prev && prev.bestTimeMs != null ? Math.min(prev.bestTimeMs, timeMs) : timeMs,
      };
      store.data.rooms[id] = rec;
      store.data.stats.totalReflects += reflects;
      if (rec.medal === MEDAL.GOLD && !store.data.mirrorsUnlocked.includes(id)) store.data.mirrorsUnlocked.push(id);
      store.save();
      return {
        firstClear: !prev || !prev.cleared,
        medalUp: rec.medal > (prev ? prev.medal || 0 : 0),
        newBestReflects: !prev || prev.bestReflects == null || reflects < prev.bestReflects,
        underPar: reflects < par,
        record: rec,
        deaths,
      };
    },
    recordDeath(id) {
      const rec = store.data.rooms[id] || { cleared: false, bestReflects: null, medal: 0, deaths: 0, hintsUsed: 0, bestTimeMs: null };
      rec.deaths = (rec.deaths || 0) + 1;
      store.data.rooms[id] = rec;
      store.data.stats.totalDeaths++;
      store.save();
    },
    recordHint(id) {
      const rec = store.data.rooms[id] || { cleared: false, bestReflects: null, medal: 0, deaths: 0, hintsUsed: 0, bestTimeMs: null };
      rec.hintsUsed = (rec.hintsUsed || 0) + 1;
      store.data.rooms[id] = rec;
      store.save();
    },
    addPlayTime(ms) { store.data.stats.playTimeMs += ms; },
  };
  return store;
}
