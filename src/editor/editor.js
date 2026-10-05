// Level editor (?edit=1). The production pipeline from day one (GDD: Level editor).
//
//   Paint tiles, place spawn / exit / emitters / switches / doors, edit their
//   params, play-in-editor (P) and back with the room untouched, save/load
//   JSON to src/content/rooms/, scrub the room's clocks with the timeline, and keep the
//   last clear's input log as the room's solution.
import { createLoop } from '../engine/loop.js';
import { createInput } from '../engine/input.js';
import { initAudio } from '../engine/audio.js';
import { createSession } from '../game/session.js';
import { render, invalidateTiles } from '../present/render.js';
import { ROOMS } from '../sim/levels.js';
import { ROOM, TIMESTEP } from '../../config/tunables.js';
import { compileRoom, validateRoom, emptyTiles, tileRows } from '../sim/room.js';
import { createState, step } from '../sim/world.js';
import { PROJECTILES } from '../projectiles/index.js';
import { formatRoom } from '../sim/format.js';
import { THEME } from '../present/theme.js';

const T = ROOM.TILE;
const TOOLS = [
  ['tile', 'Tile', '1'], ['erase', 'Erase', '2'], ['spawn', 'Spawn', '3'], ['exit', 'Exit', '4'],
  ['emitter', 'Emitter', '5'], ['switch', 'Switch', '6'], ['door', 'Door', '7'], ['select', 'Select', '8'],
];
const SCRUB_MAX = 30; // seconds

const clone = (o) => JSON.parse(JSON.stringify(o));

function blankRoom(id = 'new-room') {
  return { id, name: 'New Room', tiles: emptyTiles(), spawn: [3, 15], exit: [26, 15], emitters: [], objects: [], par: 0, solution: null, mirrorOf: null };
}

export function startEditor(canvas, ctx) {
  document.body.classList.add('editing');
  let data = clone(ROOMS[0] || blankRoom());
  data.tiles = tileRows(data.tiles);
  let library = ROOMS.map(clone);
  let tool = 'tile';
  let selected = null; // { list: 'emitters'|'objects', i }
  let mode = 'edit'; // 'edit' | 'play'
  let scrub = 0; // seconds
  let preview = null; // { room, state } at scrub time
  let errors = [];
  let time = 0;
  let painting = null; // '#' | '.' while dragging
  let hover = null;
  let dirty = false;

  const session = createSession({ onClear: (r) => { lastClear = r; updatePanel(); session.reset(); } });
  let lastClear = null;

  // ── panel ──
  const panel = document.createElement('div');
  panel.id = 'editor';
  panel.innerHTML = `
    <style>
      #editor { position: fixed; top: 0; right: 0; width: 280px; height: 100vh; overflow-y: auto; box-sizing: border-box;
        padding: 12px; background: #0b0d14; border-left: 1px solid #222a3d; font: 12px ui-monospace, Menlo, monospace; color: #cfd6ea; }
      #editor h3 { margin: 14px 0 6px; font-size: 11px; letter-spacing: .12em; color: #7f8bab; text-transform: uppercase; }
      #editor .row { display: flex; gap: 6px; align-items: center; margin: 4px 0; }
      #editor .row label { width: 64px; color: #8d97b5; }
      #editor input, #editor select { flex: 1; min-width: 0; background: #131826; color: #e6ebff; border: 1px solid #262f47; border-radius: 4px; padding: 4px 6px; font: inherit; }
      #editor button { background: #182036; color: #dfe6ff; border: 1px solid #2b3656; border-radius: 4px; padding: 5px 8px; font: inherit; cursor: pointer; }
      #editor button:hover { border-color: #4b5d93; }
      #editor button.on { background: #2b3f75; border-color: #7fd4ff; }
      #editor .tools { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
      #editor .err { color: #ff8a7a; white-space: pre-wrap; }
      #editor .ok { color: #9dff8a; }
      #editor .dim { color: #69728f; }
      #editor .mode { font-size: 13px; font-weight: 700; }
    </style>
    <div class="row"><span class="mode" id="ed-mode"></span><span style="flex:1"></span><button id="ed-play" title="P">▶ Play (P)</button></div>
    <h3>Room</h3>
    <div class="row"><label>load</label><select id="ed-load"></select></div>
    <div class="row"><label>id</label><input id="ed-id"></div>
    <div class="row"><label>name</label><input id="ed-name"></div>
    <div class="row"><label>par</label><input id="ed-par" type="number" min="0" step="1"></div>
    <div class="row"><label>mirrorOf</label><input id="ed-mirror" placeholder="null"></div>
    <div class="row"><button id="ed-save">Save</button><button id="ed-new">New</button><button id="ed-mirror-btn">Mirror</button></div>
    <div class="row"><button id="ed-export">Download</button><button id="ed-import">Open file…</button><input id="ed-file" type="file" accept=".json" hidden></div>
    <div id="ed-status" class="dim"></div>
    <h3>Tools</h3>
    <div class="tools" id="ed-tools"></div>
    <div class="dim" style="margin-top:4px">Left-click place · right-click erase/delete<br>Select tool: click an object to edit it</div>
    <h3>Selected</h3>
    <div id="ed-sel" class="dim">nothing</div>
    <h3>Timeline</h3>
    <div class="row"><input id="ed-scrub" type="range" min="0" max="${SCRUB_MAX * TIMESTEP.HZ}" step="1" value="0"></div>
    <div class="row"><button data-scrub="-12">−0.1s</button><button data-scrub="-1">−1f</button><button data-scrub="1">+1f</button><button data-scrub="12">+0.1s</button><span id="ed-time" class="dim"></span></div>
    <h3>Solution</h3>
    <div id="ed-sol" class="dim"></div>
    <h3>Validation</h3>
    <div id="ed-val"></div>
  `;
  document.body.appendChild(panel);
  const $ = (id) => panel.querySelector(`#${id}`);

  const toolsEl = $('ed-tools');
  for (const [k, label, key] of TOOLS) {
    const b = document.createElement('button');
    b.textContent = `${key} ${label}`;
    b.dataset.tool = k;
    b.onclick = () => { tool = k; updatePanel(); };
    toolsEl.appendChild(b);
  }

  // ── state changes ──
  function changed() {
    dirty = true;
    errors = validateRoom(data);
    invalidateTiles();
    rebuildPreview();
    updatePanel();
  }

  function rebuildPreview() {
    if (errors.length) { preview = null; return; }
    const room = compileRoom(data);
    // scrub preview: the room's clocks run with an inert, invincible player
    const state = createState(room, { invincible: true });
    const target = Math.round(scrub * TIMESTEP.HZ);
    for (let f = 0; f < target; f++) step(state, room, 0);
    preview = { room, state };
  }

  function setRoom(r) {
    data = clone(r);
    data.tiles = tileRows(data.tiles);
    selected = null;
    lastClear = null;
    dirty = false;
    if (mode === 'play') togglePlay();
    changed();
    dirty = false;
    updatePanel();
  }

  function togglePlay() {
    if (mode === 'edit') {
      if (errors.length) { status('fix validation errors before playing', true); return; }
      initAudio();
      session.load(clone(data)); // play a copy: editing data is never touched
      mode = 'play';
    } else {
      mode = 'edit';
      input.clear();
    }
    updatePanel();
  }

  function status(msg, bad = false) {
    const el = $('ed-status');
    el.textContent = msg;
    el.className = bad ? 'err' : 'ok';
  }

  // ── panel sync ──
  function refreshLoadList() {
    const sel = $('ed-load');
    sel.innerHTML = '';
    for (const r of library) {
      const o = document.createElement('option');
      o.value = r.id; o.textContent = `${r.id}${r.name ? ` — ${r.name}` : ''}`;
      if (r.id === data.id) o.selected = true;
      sel.appendChild(o);
    }
  }

  function field(label, value, onInput, type = 'text', opts = null) {
    const row = document.createElement('div');
    row.className = 'row';
    const l = document.createElement('label');
    l.textContent = label;
    row.appendChild(l);
    let el;
    if (opts) {
      el = document.createElement('select');
      for (const v of opts) { const o = document.createElement('option'); o.value = v; o.textContent = v; if (v === value) o.selected = true; el.appendChild(o); }
      el.onchange = () => onInput(el.value);
    } else {
      el = document.createElement('input');
      el.type = type;
      if (type === 'number') el.step = 'any';
      if (type === 'checkbox') { el.checked = !!value; el.style.flex = '0'; el.onchange = () => onInput(el.checked); } else { el.value = value ?? ''; el.onchange = () => onInput(el.value); }
    }
    row.appendChild(el);
    return row;
  }

  function updateSelected() {
    const box = $('ed-sel');
    box.innerHTML = '';
    if (!selected) { box.className = 'dim'; box.textContent = 'nothing'; return; }
    box.className = '';
    const o = data[selected.list][selected.i];
    if (!o) { selected = null; updateSelected(); return; }
    const set = (k, v) => { o[k] = v; changed(); };
    const num = (k) => (v) => set(k, v === '' ? undefined : Number(v));
    const title = document.createElement('div');
    title.textContent = `${selected.list === 'emitters' ? 'emitter' : o.kind} @ [${o.at}]`;
    box.appendChild(title);
    if (selected.list === 'emitters') {
      box.appendChild(field('type', o.type, (v) => set('type', v), 'text', Object.keys(PROJECTILES)));
      box.appendChild(field('dir', o.dir, (v) => set('dir', v), 'text', ['left', 'right', 'up', 'down']));
      box.appendChild(field('period', o.period, num('period'), 'number'));
      box.appendChild(field('phase', o.phase ?? 0, num('phase'), 'number'));
      box.appendChild(field('count', o.count ?? '', (v) => set('count', v === '' || Number(v) === 0 ? undefined : Number(v)), 'number'));
    } else if (o.kind === 'switch') {
      box.appendChild(field('links', (o.links || []).join(','), (v) => set('links', v.split(',').map((s) => s.trim()).filter(Boolean))));
      box.appendChild(field('mode', o.mode || 'once', (v) => set('mode', v), 'text', ['once', 'toggle']));
    } else if (o.kind === 'door') {
      box.appendChild(field('id', o.id, (v) => set('id', v.trim())));
      box.appendChild(field('h', o.h ?? 3, num('h'), 'number'));
      box.appendChild(field('open', o.open, (v) => set('open', v || undefined), 'checkbox'));
    }
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = () => { data[selected.list].splice(selected.i, 1); selected = null; changed(); };
    box.appendChild(del);
  }

  function updatePanel() {
    $('ed-mode').textContent = mode === 'play' ? '● PLAYING' : '✎ EDITING';
    $('ed-mode').style.color = mode === 'play' ? '#9dff8a' : '#7fd4ff';
    $('ed-play').textContent = mode === 'play' ? '■ Edit (P)' : '▶ Play (P)';
    const active = document.activeElement;
    for (const [id, v] of [['ed-id', data.id], ['ed-name', data.name || ''], ['ed-par', data.par], ['ed-mirror', data.mirrorOf || '']]) {
      if ($(id) !== active) $(id).value = v;
    }
    for (const b of toolsEl.children) b.classList.toggle('on', b.dataset.tool === tool);
    $('ed-scrub').value = Math.round(scrub * TIMESTEP.HZ);
    $('ed-time').textContent = `${scrub.toFixed(3)}s`;
    const val = $('ed-val');
    val.className = errors.length ? 'err' : 'ok';
    val.textContent = errors.length ? errors.join('\n') : `valid${dirty ? ' · unsaved' : ''}`;
    const sol = $('ed-sol');
    sol.innerHTML = '';
    const has = document.createElement('div');
    has.className = 'dim';
    has.textContent = data.solution ? `stored: ${data.solution.length} chars` : 'stored: none';
    sol.appendChild(has);
    if (lastClear) {
      const d = document.createElement('div');
      d.textContent = `last clear: ◇${lastClear.reflects} · ${(lastClear.frames / TIMESTEP.HZ).toFixed(2)}s · ✕${lastClear.deaths}`;
      sol.appendChild(d);
      const b = document.createElement('button');
      b.textContent = 'Use as solution';
      b.onclick = () => {
        data.solution = lastClear.log;
        // par is the designer's minimal solution: it must be achievable by the stored one
        if (lastClear.reflects > data.par) data.par = lastClear.reflects;
        changed();
      };
      sol.appendChild(b);
    } else {
      const d = document.createElement('div');
      d.className = 'dim';
      d.textContent = 'play (P) and reach the exit to record one';
      sol.appendChild(d);
    }
    updateSelected();
  }

  // ── panel events ──
  $('ed-play').onclick = togglePlay;
  $('ed-load').onchange = () => { const r = library.find((x) => x.id === $('ed-load').value); if (r) setRoom(r); };
  $('ed-id').onchange = () => { data.id = $('ed-id').value.trim(); changed(); };
  $('ed-name').onchange = () => { data.name = $('ed-name').value; changed(); };
  $('ed-par').onchange = () => { data.par = Number($('ed-par').value); changed(); };
  $('ed-mirror').onchange = () => { data.mirrorOf = $('ed-mirror').value.trim() || null; changed(); };
  $('ed-new').onclick = () => setRoom(blankRoom());
  $('ed-mirror-btn').onclick = () => {
    const src = data.id;
    data = { ...clone(data), id: `${src}-m`, name: `${data.name || src} (mirror)`, mirrorOf: src, solution: null };
    changed();
    status(`mirror of ${src} — change exactly one property`);
  };
  $('ed-save').onclick = async () => {
    if (errors.length) { status('not saved: room is invalid', true); return; }
    try {
      const res = await fetch(`/__levels/${data.id}`, { method: 'POST', body: JSON.stringify(data) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      dirty = false;
      status(`saved ${body.path}`);
      const i = library.findIndex((r) => r.id === data.id);
      if (i >= 0) library[i] = clone(data); else library.push(clone(data));
      library.sort((a, b) => a.id.localeCompare(b.id));
      refreshLoadList();
      updatePanel();
    } catch (e) {
      status(`dev save unavailable (${e.message}) — use Download`, true);
    }
  };
  $('ed-export').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([formatRoom(data)], { type: 'application/json' }));
    a.download = `${data.id}.json`;
    a.click();
  };
  $('ed-import').onclick = () => $('ed-file').click();
  $('ed-file').onchange = async () => {
    const f = $('ed-file').files[0];
    if (!f) return;
    try { setRoom(JSON.parse(await f.text())); status(`opened ${f.name}`); } catch (e) { status(`bad file: ${e.message}`, true); }
  };
  $('ed-scrub').oninput = () => { scrub = Number($('ed-scrub').value) / TIMESTEP.HZ; rebuildPreview(); updatePanel(); };
  for (const b of panel.querySelectorAll('[data-scrub]')) {
    b.onclick = () => {
      const f = Math.max(0, Math.min(SCRUB_MAX * TIMESTEP.HZ, Math.round(scrub * TIMESTEP.HZ) + Number(b.dataset.scrub)));
      scrub = f / TIMESTEP.HZ; rebuildPreview(); updatePanel();
    };
  }

  // refresh the library from disk when the dev server is available
  fetch('/__levels').then((r) => (r.ok ? r.json() : null)).then((rooms) => {
    if (Array.isArray(rooms) && rooms.length) { library = rooms; refreshLoadList(); }
  }).catch(() => {});

  // ── canvas editing ──
  const toTile = (e) => {
    const r = canvas.getBoundingClientRect();
    const tx = Math.floor(((e.clientX - r.left) / r.width) * ROOM.COLS);
    const ty = Math.floor(((e.clientY - r.top) / r.height) * (ROOM.H / T));
    return tx >= 0 && ty >= 0 && tx < ROOM.COLS && ty < ROOM.ROWS ? [tx, ty] : null;
  };
  const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
  function findAt(at) {
    let i = data.emitters.findIndex((m) => same(m.at, at));
    if (i >= 0) return { list: 'emitters', i };
    i = data.objects.findIndex((o) => same(o.at, at) || (o.kind === 'door' && o.at[0] === at[0] && at[1] >= o.at[1] && at[1] < o.at[1] + (o.h ?? 3)));
    return i >= 0 ? { list: 'objects', i } : null;
  }
  const setTile = (tx, ty, ch) => {
    const row = data.tiles[ty];
    if (row[tx] === ch) return false;
    data.tiles[ty] = row.slice(0, tx) + ch + row.slice(tx + 1);
    return true;
  };
  const nextDoorId = () => { let n = 1; while (data.objects.some((o) => o.id === `d${n}`)) n++; return `d${n}`; };

  function apply(at, erase) {
    if (!at) return;
    const [tx, ty] = at;
    if (erase) {
      const f = findAt(at);
      if (f) { data[f.list].splice(f.i, 1); selected = null; changed(); return; }
      if (setTile(tx, ty, '.')) changed();
      return;
    }
    switch (tool) {
      case 'tile': if (setTile(tx, ty, '#')) changed(); break;
      case 'erase': if (setTile(tx, ty, '.')) changed(); break;
      case 'spawn': data.spawn = at; changed(); break;
      case 'exit': data.exit = at; changed(); break;
      case 'emitter':
        if (!findAt(at)) { data.emitters.push({ type: 'orb', at, dir: tx > ROOM.COLS / 2 ? 'left' : 'right', period: 2.4, phase: 0 }); selected = { list: 'emitters', i: data.emitters.length - 1 }; changed(); }
        break;
      case 'switch': {
        if (findAt(at)) break;
        const door = data.objects.find((o) => o.kind === 'door');
        data.objects.push({ kind: 'switch', at, links: door ? [door.id] : [] });
        selected = { list: 'objects', i: data.objects.length - 1 };
        changed();
        break;
      }
      case 'door':
        if (findAt(at)) break;
        data.objects.push({ kind: 'door', id: nextDoorId(), at, h: 3 });
        selected = { list: 'objects', i: data.objects.length - 1 };
        changed();
        break;
      case 'select': selected = findAt(at); updatePanel(); break;
      default:
    }
  }

  canvas.addEventListener('contextmenu', (e) => { if (mode === 'edit') e.preventDefault(); });
  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'edit') return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const at = toTile(e);
    const erase = e.button === 2;
    apply(at, erase);
    if (tool === 'tile' || tool === 'erase' || erase) painting = { erase };
  });
  canvas.addEventListener('pointermove', (e) => {
    hover = toTile(e);
    if (mode === 'edit' && painting && hover) {
      const [tx, ty] = hover;
      if (painting.erase && findAt(hover)) return;
      if (setTile(tx, ty, painting.erase || tool === 'erase' ? '.' : '#')) changed();
    }
  });
  canvas.addEventListener('pointerup', () => { painting = null; });
  canvas.addEventListener('pointerleave', () => { hover = null; });

  const input = createInput({
    onMeta: (k, e) => {
      if (k === 'p') { togglePlay(); return; }
      if (mode === 'play') { if (k === 'r') session.reset(); return; }
      const t = TOOLS.find((x) => x[2] === k);
      if (t) { tool = t[0]; updatePanel(); }
      if ((k === 'delete' || k === 'backspace') && selected) { data[selected.list].splice(selected.i, 1); selected = null; changed(); }
      if (k === 's' && e && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('ed-save').click(); }
    },
  });

  // ── overlay ──
  function overlay(g) {
    if (mode !== 'edit') return;
    g.save();
    // switch → door link lines
    g.strokeStyle = 'rgba(196,155,255,0.5)';
    g.setLineDash([2, 4]);
    for (const o of data.objects) {
      if (o.kind !== 'switch') continue;
      for (const id of o.links || []) {
        const d = data.objects.find((x) => x.kind === 'door' && x.id === id);
        if (!d) continue;
        g.beginPath();
        g.moveTo((o.at[0] + 0.5) * T, (o.at[1] + 0.5) * T);
        g.lineTo((d.at[0] + 0.5) * T, (d.at[1] + (d.h ?? 3) / 2) * T);
        g.stroke();
      }
    }
    g.setLineDash([]);
    // spawn marker
    g.strokeStyle = THEME.playerGlow;
    g.strokeRect(data.spawn[0] * T + 2.5, data.spawn[1] * T + 2.5, T - 5, T - 5);
    g.fillStyle = THEME.playerGlow;
    g.font = '10px ui-monospace, monospace';
    g.fillText('SPAWN', data.spawn[0] * T + 1, data.spawn[1] * T - 3);
    if (selected) {
      const o = data[selected.list][selected.i];
      if (o) {
        const h = o.kind === 'door' ? (o.h ?? 3) : 1;
        g.strokeStyle = '#fff';
        g.lineWidth = 2;
        g.strokeRect(o.at[0] * T + 1, o.at[1] * T + 1, T - 2, h * T - 2);
      }
    }
    if (hover) {
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1;
      g.strokeRect(hover[0] * T + 0.5, hover[1] * T + 0.5, T - 1, T - 1);
    }
    if (scrub > 0) {
      g.fillStyle = THEME.hud;
      g.font = '600 13px ui-monospace, monospace';
      g.fillText(`t = ${scrub.toFixed(2)}s`, 12, ROOM.H - 10);
    }
    g.restore();
  }

  // ── loop ──
  const loop = createLoop({
    update: (dt) => {
      time += dt;
      const mask = input.sample();
      if (mode === 'play') session.tick(mask);
    },
    render: (alpha) => {
      if (mode === 'play') {
        render(ctx, { state: session.state, room: session.room, alpha, fx: session.fx, time });
      } else if (preview) {
        render(ctx, { state: preview.state, room: preview.room, alpha: 1, fx: null, time, hud: false, editorOverlay: overlay });
      } else {
        ctx.fillStyle = THEME.bg0;
        ctx.fillRect(0, 0, ROOM.W, ROOM.H);
        ctx.fillStyle = '#ff8a7a';
        ctx.font = '14px ui-monospace, monospace';
        ctx.fillText('room invalid — see Validation', 20, 30);
      }
    },
  });

  refreshLoadList();
  changed();
  dirty = false;
  updatePanel();
  loop.start();

  window.__RD = {
    editor: true,
    get data() { return data; },
    get mode() { return mode; },
    get errors() { return errors; },
    get session() { return session; },
    togglePlay,
    get fps() { return loop.fps; },
  };
}
