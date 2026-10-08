// Browser smoke on its own (npm run test:browser): the same Chromium checks as
// the end of `npm test`, without the solver gates in front of them.
import { createHash } from 'node:crypto';
import { loadRooms } from './levels-node.mjs';
import { compileRoom } from '../src/sim/room.js';
import { runLog } from '../src/sim/world.js';
import { decodeLog } from '../src/sim/input.js';
import { runBrowser } from './smoke.mjs';

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const nodeHashes = {};
for (const { room } of loadRooms()) {
  if (room.solution) nodeHashes[room.id] = hash(JSON.stringify(runLog(compileRoom(room), decodeLog(room.solution)).state));
}
let failures = 0;
for (const [ok, label, detail] of await runBrowser(nodeHashes, hash)) {
  if (!ok) { failures++; console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}
console.log(failures ? `\n${failures} FAILED` : '\nbrowser smoke: all passed');
process.exit(failures ? 1 : 0);
