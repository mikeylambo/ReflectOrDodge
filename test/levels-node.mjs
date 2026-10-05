import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const LEVELS_DIR = fileURLToPath(new URL('../levels/', import.meta.url));
export function loadRooms() {
  return readdirSync(LEVELS_DIR).filter((f) => f.endsWith('.json')).sort()
    .map((f) => ({ file: f, room: JSON.parse(readFileSync(LEVELS_DIR + f, 'utf8')) }));
}
