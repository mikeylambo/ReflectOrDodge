// All rooms in src/content/rooms/*.json plus the chapter order in index.json.
// Vite inlines them at build time; Node tests read the folder directly
// (test/levels-node.mjs).
import INDEX from '../content/rooms/index.json';

const mods = import.meta.glob(['../content/rooms/*.json', '!../content/rooms/index.json'], { eager: true, import: 'default' });
export const ROOMS = Object.values(mods).sort((a, b) => a.id.localeCompare(b.id));
export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
export const CHAPTERS = INDEX.chapters;
