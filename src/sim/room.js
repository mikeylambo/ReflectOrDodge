// Room data → compiled room + schema validation (GDD: Core interfaces).
//
// Room JSON:
//   id        "p0-01"
//   name      optional display name
//   tiles     17 strings of 30 chars ('#' solid, '.' empty). A single string
//             with rows separated by '\n' is also accepted.
//   spawn     [tx, ty]   player stands on the bottom of this tile
//   exit      [tx, ty]
//   emitters  [{ type, at:[tx,ty], dir, period, phase, count? }]
//   objects   [{ kind:"switch", at, links:[doorId], mode?:"once"|"toggle" }
//              { kind:"door", id, at, h?:3, open?:false }]
//   par       minimal reflect count
//   solution  compact input log (see sim/input.js) or null
//   mirrorOf  room id or null
import { ROOM } from '../../config/tunables.js';
import { PROJECTILES } from '../projectiles/index.js';
import { OBJECTS } from '../objects/index.js';
import { decodeLog } from './input.js';
import { EMITTER } from '../../config/tunables.js';

const DIR_NAMES = ['up', 'down', 'left', 'right'];

export function tileRows(tiles) {
  return Array.isArray(tiles) ? tiles : String(tiles).split('\n');
}

const inBounds = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isInteger)
  && p[0] >= 0 && p[0] < ROOM.COLS && p[1] >= 0 && p[1] < ROOM.ROWS;

export function validateRoom(r) {
  const errs = [];
  const e = (m) => errs.push(m);
  if (!r || typeof r !== 'object') return ['room is not an object'];
  if (typeof r.id !== 'string' || !/^[a-z0-9-]+$/.test(r.id)) e('id must be a lowercase slug');

  const rows = r.tiles === undefined ? [] : tileRows(r.tiles);
  if (rows.length !== ROOM.ROWS) e(`tiles must have ${ROOM.ROWS} rows (got ${rows.length})`);
  rows.forEach((row, i) => {
    if (typeof row !== 'string' || row.length !== ROOM.COLS) e(`tiles row ${i} must be ${ROOM.COLS} chars`);
    else if (!/^[#.]+$/.test(row)) e(`tiles row ${i} has characters other than '#' and '.'`);
  });
  const solidAt = (tx, ty) => rows[ty] && rows[ty][tx] === '#';

  if (!inBounds(r.spawn)) e('spawn must be an in-bounds [tx, ty]');
  else if (solidAt(...r.spawn)) e('spawn is inside a solid tile');
  if (!inBounds(r.exit)) e('exit must be an in-bounds [tx, ty]');
  else if (solidAt(...r.exit)) e('exit is inside a solid tile');

  const occupied = new Map(); // "tx,ty" → what, so objects never overlap
  const claim = (at, what) => {
    const k = `${at[0]},${at[1]}`;
    if (occupied.has(k)) e(`${what} overlaps ${occupied.get(k)} at [${k}]`);
    occupied.set(k, what);
    if (solidAt(...at)) e(`${what} at [${k}] is inside a solid tile`);
  };

  if (!Array.isArray(r.emitters)) e('emitters must be an array');
  else r.emitters.forEach((m, i) => {
    const w = `emitters[${i}]`;
    if (!PROJECTILES[m.type]) e(`${w}.type "${m.type}" is not a registered projectile`);
    if (!inBounds(m.at)) e(`${w}.at out of bounds`); else claim(m.at, w);
    if (!DIR_NAMES.includes(m.dir)) e(`${w}.dir must be one of ${DIR_NAMES.join('/')}`);
    if (!(m.period > EMITTER.TELEGRAPH)) e(`${w}.period must exceed the ${EMITTER.TELEGRAPH}s telegraph`);
    const ph = m.phase || 0;
    if (!(ph >= 0 && ph < m.period)) e(`${w}.phase must be in [0, period)`);
    if (m.count !== undefined && !(Number.isInteger(m.count) && m.count >= 0)) e(`${w}.count must be a non-negative integer`);
  });

  const doorIds = new Set();
  if (!Array.isArray(r.objects)) e('objects must be an array');
  else {
    r.objects.forEach((o, i) => {
      const w = `objects[${i}]`;
      if (!OBJECTS[o.kind] || o.kind === 'emitter') { e(`${w}.kind "${o.kind}" is not a placeable object`); return; }
      if (!inBounds(o.at)) { e(`${w}.at out of bounds`); return; }
      if (o.kind === 'door') {
        if (typeof o.id !== 'string' || !o.id) e(`${w} door needs an id`);
        else if (doorIds.has(o.id)) e(`${w} duplicate door id "${o.id}"`);
        doorIds.add(o.id);
        const h = o.h === undefined ? 3 : o.h;
        if (!(Number.isInteger(h) && h >= 1 && o.at[1] + h <= ROOM.ROWS)) e(`${w}.h must fit inside the room`);
        else for (let k = 0; k < h; k++) claim([o.at[0], o.at[1] + k], w);
      } else {
        claim(o.at, w);
        if (o.mode !== undefined && !['once', 'toggle'].includes(o.mode)) e(`${w}.mode must be "once" or "toggle"`);
      }
    });
    r.objects.forEach((o, i) => {
      if (o.kind !== 'switch') return;
      if (!Array.isArray(o.links) || o.links.length === 0) e(`objects[${i}] switch has no links`);
      else for (const l of o.links) if (!doorIds.has(l)) e(`objects[${i}] links to unknown door "${l}"`);
    });
  }

  if (!(Number.isInteger(r.par) && r.par >= 0)) e('par must be a non-negative integer');
  if (r.solution !== null && r.solution !== undefined) {
    try { decodeLog(r.solution); } catch (err) { e(`solution: ${err.message}`); }
  }
  if (!(r.mirrorOf === null || r.mirrorOf === undefined || typeof r.mirrorOf === 'string')) e('mirrorOf must be a room id or null');
  return errs;
}

// Compiled room: static data the engine reads but never mutates.
export function compileRoom(r) {
  const errs = validateRoom(r);
  if (errs.length) throw new Error(`room ${r && r.id}: ${errs.join('; ')}`);
  const rows = tileRows(r.tiles);
  const solid = new Uint8Array(ROOM.COLS * ROOM.ROWS);
  for (let y = 0; y < ROOM.ROWS; y++) for (let x = 0; x < ROOM.COLS; x++) solid[y * ROOM.COLS + x] = rows[y][x] === '#' ? 1 : 0;
  return {
    id: r.id,
    name: r.name || r.id,
    solid,
    spawn: r.spawn,
    exit: r.exit,
    emitters: r.emitters,
    objects: r.objects,
    par: r.par,
    solution: r.solution || null,
  };
}

export const isSolid = (room, tx, ty) =>
  tx < 0 || ty < 0 || tx >= ROOM.COLS || ty >= ROOM.ROWS || room.solid[ty * ROOM.COLS + tx] === 1;

export const emptyTiles = () => {
  const rows = [];
  for (let y = 0; y < ROOM.ROWS; y++) {
    rows.push(y === 0 || y === ROOM.ROWS - 1 ? '#'.repeat(ROOM.COLS) : `#${'.'.repeat(ROOM.COLS - 2)}#`);
  }
  return rows;
};
