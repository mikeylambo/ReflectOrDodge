// Achievement definitions (GDD: Launch requirements — Achievements):
//   one per chapter cleared, one per Examiner, Gold-all per chapter, find an
//   under-par solution, finish with zero hints, and a few for total reflects
//   and deaths.
// Definitions cover all eight chapters; a chapter not in the index yet simply
// can't unlock. Evaluation is a pure function of the save, so it can run after
// any save write and is safe to repeat (Steam ignores re-unlocks).
const CHAPTERS = [
  ['c1', 'Answer'], ['c2', 'Weight'], ['c3', 'Ground'], ['c4', 'Echo'],
  ['c5', 'Fracture'], ['c6', 'Momentum'], ['c7', 'Bond'], ['c8', 'Mastery'],
];

export const ACHIEVEMENTS = [
  ...CHAPTERS.map(([id, name]) => ({ id: `CLEAR_${id.toUpperCase()}`, name: `${name}`, description: `Clear every room in chapter ${id.slice(1)}.`, test: (c) => c.chapterCleared(id) })),
  ...CHAPTERS.map(([id, name]) => ({ id: `EXAMINER_${id.toUpperCase()}`, name: `${name}: Examined`, description: `Defeat the chapter ${id.slice(1)} Examiner.`, test: (c) => c.examinerDefeated(id) })),
  ...CHAPTERS.map(([id, name]) => ({ id: `GOLD_${id.toUpperCase()}`, name: `${name}: Gold`, description: `Earn Gold on every room in chapter ${id.slice(1)}.`, test: (c) => c.chapterGold(id) })),
  { id: 'UNDER_PAR', name: 'Better Than Par', description: 'Clear a room with fewer reflects than par.', test: (c) => c.anyUnderPar() },
  { id: 'NO_HINTS', name: 'Unaided', description: 'Finish the game without using a hint.', test: (c) => c.examinerDefeated('c8') && c.totalHints() === 0 },
  { id: 'REFLECTS_100', name: 'Answering Back', description: 'Reflect 100 projectiles.', test: (c) => c.stats.totalReflects >= 100 },
  { id: 'REFLECTS_1000', name: 'Conversation', description: 'Reflect 1,000 projectiles.', test: (c) => c.stats.totalReflects >= 1000 },
  { id: 'DEATHS_100', name: 'Persistence', description: 'Try again 100 times.', test: (c) => c.stats.totalDeaths >= 100 },
  { id: 'DEATHS_1000', name: 'Devotion', description: 'Try again 1,000 times.', test: (c) => c.stats.totalDeaths >= 1000 },
];

/**
 * @param save      save data (schema v1)
 * @param chapters  index chapters [{ id, rooms: [...] }]
 * @param roomsById room JSON by id (for par)
 * @returns ids of every achievement the save has earned
 */
export function evaluateAchievements(save, chapters, roomsById) {
  const byId = Object.fromEntries(chapters.map((c) => [c.id, c]));
  const rec = (id) => save.rooms[id] || null;
  const ctx = {
    stats: save.stats,
    chapterCleared: (id) => !!byId[id] && byId[id].rooms.length > 0 && byId[id].rooms.every((r) => rec(r) && rec(r).cleared),
    chapterGold: (id) => !!byId[id] && byId[id].rooms.length > 0 && byId[id].rooms.every((r) => rec(r) && rec(r).medal >= 3),
    examinerDefeated: (id) => !!(save.chapters[id] && save.chapters[id].examinerDefeated),
    anyUnderPar: () => Object.entries(save.rooms).some(([id, r]) => r.cleared && r.bestReflects != null && roomsById[id] && r.bestReflects < roomsById[id].par),
    totalHints: () => Object.values(save.rooms).reduce((n, r) => n + (r.hintsUsed || 0), 0),
  };
  return ACHIEVEMENTS.filter((a) => a.test(ctx)).map((a) => a.id);
}
