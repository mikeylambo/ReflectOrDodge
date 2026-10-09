// All rooms in src/content/rooms/*.json plus the chapter order in index.json.
// Vite inlines them at build time; Node tests read the folder directly
// (test/levels-node.mjs).
import INDEX from '../content/rooms/index.json';

// The demo build bundles only its own rooms (Prologue, Chapter 1 and its
// mirrors and Examiner), so the full game's rooms never ship in it.
const mods = import.meta.env.MODE === 'demo'
  ? import.meta.glob(['../content/rooms/p0-*.json', '../content/rooms/c1-*.json'], { eager: true, import: 'default' })
  : import.meta.glob(['../content/rooms/*.json', '!../content/rooms/index.json'], { eager: true, import: 'default' });
export const ROOMS = Object.values(mods).sort((a, b) => a.id.localeCompare(b.id));
export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
// The itch.io demo (`npm run build:demo`, GDD: Launch — "Demo: Prologue +
// Chapter 1 + its Examiner") ships only the first two chapters.
export const DEMO = import.meta.env && import.meta.env.MODE === 'demo';
export const CHAPTERS = DEMO ? INDEX.chapters.slice(0, 2) : INDEX.chapters;
