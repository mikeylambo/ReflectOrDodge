// Opt-in, local-first, anonymous playtest telemetry (GDD: Telemetry).
// Per room: attempts, deaths, time to first clear, hints used, quits while
// in the room. Nothing leaves the device; Settings can export it as JSON for a
// playtester to send. No third-party SDK. Off unless the player turns it on.

const KEY = 'reflect-dodge:telemetry';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { rooms: {} }; } catch { return { rooms: {} }; }
}
function write(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* blocked storage */ }
}

export function createTelemetry(isEnabled) {
  let data = read();
  const room = (id) => (data.rooms[id] ||= { attempts: 0, deaths: 0, firstClearMs: null, hints: 0, quits: 0, clears: 0 });
  const rec = (fn) => { if (!isEnabled()) return; fn(); write(data); };
  return {
    attempt: (id) => rec(() => { room(id).attempts++; }),
    death: (id) => rec(() => { room(id).deaths++; }),
    hint: (id) => rec(() => { room(id).hints++; }),
    quit: (id) => rec(() => { room(id).quits++; }),
    clear: (id, msInRoom) => rec(() => {
      const r = room(id);
      r.clears++;
      if (r.firstClearMs == null) r.firstClearMs = Math.round(msInRoom);
    }),
    export() {
      const blob = new Blob([JSON.stringify({ game: 'reflect-dodge', exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'reflect-dodge-telemetry.json';
      a.click();
    },
    wipe() { data = { rooms: {} }; write(data); },
    get data() { return data; },
  };
}
