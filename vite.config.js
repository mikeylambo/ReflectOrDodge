import { defineConfig } from 'vite';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatRoom } from './src/sim/format.js';
import { validateRoom } from './src/sim/room.js';

const LEVELS = fileURLToPath(new URL('./src/content/rooms/', import.meta.url));

// Dev-only endpoint so the in-browser editor can save straight into src/content/rooms/.
//   GET  /__levels          → [room, …]
//   POST /__levels/<id>     → validate + write src/content/rooms/<id>.json
function levelsApi() {
  return {
    name: 'levels-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__levels', (req, res) => {
        const send = (code, body) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };
        if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
          const rooms = readdirSync(LEVELS).filter((f) => f.endsWith('.json') && f !== 'index.json').sort()
            .map((f) => JSON.parse(readFileSync(LEVELS + f, 'utf8')));
          return send(200, rooms);
        }
        const m = req.method === 'POST' && /^\/([a-z0-9-]+)$/.exec(req.url);
        if (!m) return send(404, { error: 'not found' });
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const room = JSON.parse(body);
            if (room.id !== m[1]) return send(400, { error: 'id mismatch' });
            const errs = validateRoom(room);
            if (errs.length) return send(400, { error: errs.join('; ') });
            writeFileSync(`${LEVELS}${room.id}.json`, formatRoom(room));
            send(200, { ok: true, path: `src/content/rooms/${room.id}.json` });
          } catch (e) { send(400, { error: String(e.message || e) }); }
        });
      });
    },
  };
}

// The demo build (`--mode demo`) bundles only its own rooms: Prologue and
// Chapter 1 with its mirrors and Examiner, so the full game's rooms never ship
// in it. Done here, not in src/sim/levels.js, because src/sim/ keys the solver
// cache (test/solve-cache.mjs) and any edit there makes CI re-solve every room.
const ALL_ROOMS = "['../content/rooms/*.json', '!../content/rooms/index.json']";
const DEMO_ROOMS = "['../content/rooms/p0-*.json', '../content/rooms/c1-*.json']";
function demoRooms(mode) {
  return {
    name: 'demo-rooms',
    enforce: 'pre', // before Vite expands import.meta.glob
    transform(code, id) {
      if (mode !== 'demo' || !id.endsWith('/src/sim/levels.js')) return null;
      if (!code.includes(ALL_ROOMS)) throw new Error('demo-rooms: the rooms glob in src/sim/levels.js changed; update vite.config.js');
      return code.replace(ALL_ROOMS, DEMO_ROOMS);
    },
  };
}

// base './' so the bundle works from file:// wrappers and itch subpaths.
export default defineConfig(({ mode }) => ({
  base: './',
  resolve: { alias: { '@slu/web-shell': fileURLToPath(new URL('./vendor/web-shell', import.meta.url)) } },
  server: { host: true },
  plugins: [levelsApi(), demoRooms(mode)],
}));
