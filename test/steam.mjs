// Steam scaffolding (behind FLAGS.STEAM): achievements, cloud-save adapter,
// controller glyph switching, the bridge. No Steam SDK is involved: these test
// the game-side logic against a mock bridge.
import { FLAGS } from '../config/flags.js';
import { ACHIEVEMENTS, evaluateAchievements } from '../src/platform/steam/achievements.js';
import { SteamCloudStorage } from '../src/platform/steam/cloud-storage.js';
import { classifyGamepadId, glyphFamily } from '../src/platform/steam/glyphs.js';
import { createTauriBridge, nullBridge } from '../src/platform/steam/bridge.js';
import { loadRooms, loadIndex } from './levels-node.mjs';

class Mem { constructor() { this.m = new Map(); } async get(k) { return this.m.has(k) ? this.m.get(k) : null; } async set(k, v) { this.m.set(k, v); } async remove(k) { this.m.delete(k); } async clear() { this.m.clear(); } }
const mockBridge = () => {
  const cloud = new Map();
  return { available: true, cloud, unlock: async () => {}, cloudRead: async (k) => cloud.get(k) ?? null, cloudWrite: async (k, v) => { cloud.set(k, v); }, controllerType: () => null };
};
const blankSave = () => ({ rooms: {}, chapters: {}, stats: { totalDeaths: 0, totalReflects: 0, playTimeMs: 0 } });

export async function runSteamTests() {
  const out = [];
  const check = async (label, fn) => {
    try { const r = await fn(); out.push([r === true || (r && r.ok), label, r && r.detail ? r.detail : '']); } catch (e) { out.push([false, label, e.message]); }
  };
  const chapters = loadIndex().chapters;
  const byId = Object.fromEntries(loadRooms().map(({ room }) => [room.id, room]));

  await check('Steam is behind a flag that is off by default', () => FLAGS.STEAM === false);

  await check('achievement list covers the GDD set (8 clear, 8 Examiner, 8 Gold, under-par, no hints, 4 totals)', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    const n = (p) => ids.filter((i) => i.startsWith(p)).length;
    return { ok: ids.length === new Set(ids).size && n('CLEAR_') === 8 && n('EXAMINER_') === 8 && n('GOLD_') === 8 && ids.includes('UNDER_PAR') && ids.includes('NO_HINTS') && n('REFLECTS_') + n('DEATHS_') === 4, detail: `${ids.length} achievements` };
  });

  await check('achievements: a fresh save earns none; progress earns exactly what it should', () => {
    const none = evaluateAchievements(blankSave(), chapters, byId);
    const s = blankSave();
    const c1 = chapters.find((c) => c.id === 'c1');
    for (const id of c1.rooms) s.rooms[id] = { cleared: true, medal: 3, bestReflects: byId[id].par, hintsUsed: 0 };
    s.rooms['c1-01'].bestReflects = byId['c1-01'].par - 1; // an under-par clear
    s.chapters.c1 = { examinerDefeated: true };
    s.stats.totalReflects = 150;
    const got = evaluateAchievements(s, chapters, byId).sort();
    const want = ['CLEAR_C1', 'EXAMINER_C1', 'GOLD_C1', 'REFLECTS_100', 'UNDER_PAR'].sort();
    return { ok: none.length === 0 && JSON.stringify(got) === JSON.stringify(want), detail: got.join(',') };
  });

  await check('achievements: one uncleared room keeps the chapter locked', () => {
    const s = blankSave();
    const c2 = chapters.find((c) => c.id === 'c2');
    for (const id of c2.rooms.slice(1)) s.rooms[id] = { cleared: true, medal: 3, bestReflects: byId[id].par };
    return !evaluateAchievements(s, chapters, byId).includes('CLEAR_C2');
  });

  await check('cloud save: writes go to both; the newer copy wins on read', async () => {
    const local = new Mem(), b = mockBridge(), st = new SteamCloudStorage(local, b);
    await st.set('save', { savedAt: '2026-01-01T00:00:00Z', data: 1 });
    const both = (await local.get('save')).data === 1 && JSON.parse(b.cloud.get('reflect-dodge:save')).data === 1;
    b.cloud.set('reflect-dodge:save', JSON.stringify({ savedAt: '2026-02-01T00:00:00Z', data: 2 })); // newer on another machine
    const fromCloud = (await st.get('save')).data === 2 && (await local.get('save')).data === 2;
    await local.set('save', { savedAt: '2026-03-01T00:00:00Z', data: 3 }); // newer locally (played offline)
    const fromLocal = (await st.get('save')).data === 3;
    return { ok: both && fromCloud && fromLocal, detail: `both ${both} cloud ${fromCloud} local ${fromLocal}` };
  });

  await check('cloud save: without Steam (or with a corrupt cloud copy) local storage is used', async () => {
    const local = new Mem();
    await local.set('save', { savedAt: '2026-01-01T00:00:00Z', data: 1 });
    const off = (await new SteamCloudStorage(local, nullBridge).get('save')).data === 1;
    const b = mockBridge(); b.cloud.set('reflect-dodge:save', '{not json');
    const corrupt = (await new SteamCloudStorage(local, b).get('save')).data === 1;
    return { ok: off && corrupt };
  });

  await check('glyphs: Steam Deck and controllers by vendor id, Steam Input wins, keyboard untouched', () => {
    const cases = [
      [classifyGamepadId('Steam Deck (Vendor: 28de Product: 1205)'), 'steamdeck'],
      [classifyGamepadId('28de-1205-Steam Deck'), 'steamdeck'],
      [classifyGamepadId('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'playstation'],
      [classifyGamepadId('045e-028e-Xbox 360 Controller'), 'xbox'],
      [glyphFamily('generic-gamepad', 'Steam Deck (Vendor: 28de Product: 1205)', null), 'steamdeck'],
      [glyphFamily('xbox', 'xinput', 'playstation'), 'playstation'],
      [glyphFamily('keyboard-mouse', '28de-1205', 'steam'), 'keyboard-mouse'],
      [glyphFamily('generic-gamepad', 'unknown pad', null), 'generic-gamepad'],
    ];
    const bad = cases.filter(([a, b]) => a !== b);
    return { ok: bad.length === 0, detail: bad.map(([a, b]) => `${a}≠${b}`).join(', ') };
  });

  await check('bridge: Tauri commands are called only once Steam initialises', async () => {
    const calls = [];
    const up = createTauriBridge(async (cmd) => { calls.push(cmd); return cmd === 'steam_init' ? true : cmd === 'steam_controller_type' ? 'steamdeck' : null; });
    await up.init(); await up.unlock('CLEAR_C1');
    const down = createTauriBridge(async (cmd) => { calls.push(`x:${cmd}`); throw new Error('no such command'); });
    await down.init(); await down.unlock('CLEAR_C1');
    return { ok: up.available && up.controllerType() === 'steamdeck' && calls.includes('steam_unlock') && !down.available && !calls.includes('x:steam_unlock'), detail: calls.join(',') };
  });

  return out;
}
