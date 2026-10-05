// All rooms in levels/*.json, sorted by id. Vite inlines them at build time;
// Node tests read the folder directly (test/levels-node.mjs).
const mods = import.meta.glob('../../levels/*.json', { eager: true, import: 'default' });
export const ROOMS = Object.values(mods).sort((a, b) => a.id.localeCompare(b.id));
