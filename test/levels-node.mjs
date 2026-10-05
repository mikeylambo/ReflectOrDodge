import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const LEVELS_DIR = fileURLToPath(new URL('../src/content/rooms/', import.meta.url));
export function loadRooms() {
  return readdirSync(LEVELS_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json').sort()
    .map((f) => ({ file: f, room: JSON.parse(readFileSync(LEVELS_DIR + f, 'utf8')) }));
}
export const loadIndex = () => JSON.parse(readFileSync(`${LEVELS_DIR}index.json`, 'utf8'));
