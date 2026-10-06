// Chapter map (GDD: World map): a clean node diagram, not a walkable world.
// Room nodes on a grid with medal glyphs, an Examiner node, and a mirror flip.
// Navigation in 2D with the shell's UI actions (keyboard / gamepad) and taps.
//
// The shell's DOMGameUI is list-only (1D focus), so this screen runs its own
// focus model over the same InputManager the rest of the UI uses.

const COLS = 5;

const STYLE = `
.rd-map { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  background: radial-gradient(circle at 50% 30%, rgba(20,26,44,.35), rgba(4,5,8,.86)); color: #e8f4ff; }
.rd-map-panel { --acc: #7fd4ff; width: min(94vw, 720px); max-height: 100vh; overflow-y: auto; padding: 22px 26px; box-sizing: border-box; background: rgba(9,11,18,.9); border: 1px solid rgba(127,212,255,.18); border-radius: 6px; }
.rd-map-head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 10px; flex-wrap: wrap; }
.rd-map-head h1 { margin: 0; font-size: clamp(20px, 3.4vw, 30px); letter-spacing: .04em; }
.rd-map-head .rd-tally { margin-left: auto; font-size: 15px; display: flex; gap: 14px; }
.rd-bar { position: relative; height: 6px; margin: 4px 0 30px; border-radius: 3px; background: rgba(255,255,255,.08); }
.rd-bar .fill { position: absolute; inset: 0 auto 0 0; border-radius: 3px; background: var(--acc); }
.rd-bar .notch { position: absolute; top: -7px; width: 2px; height: 20px; background: rgba(255,255,255,.55); }
.rd-bar .notch::after { content: "⬢"; position: absolute; top: 19px; left: 50%; transform: translateX(-50%); font-size: 13px; opacity: .8; }
.rd-bar .notch.open { background: var(--acc); }
.rd-bar .notch.open::after { color: var(--acc); opacity: 1; }
.rd-grid { display: grid; grid-template-columns: repeat(${COLS}, minmax(0, 1fr)); gap: 10px; }
.m3 { color: #ffd166; } .m2 { color: #d6e2f0; } .m1 { color: #d9905f; }
.rd-node { position: relative; aspect-ratio: 1.6; border-radius: 4px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.03);
  color: #e8f4ff; font: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 44px; padding: 0; }
.rd-node .n { font-size: 13px; opacity: .8; }
.rd-node .g { font-size: 24px; line-height: 1; opacity: .35; }
.rd-node.medal-1 .g, .rd-node.medal-2 .g, .rd-node.medal-3 .g { opacity: 1; }
.rd-node.medal-1 .g { color: #d9905f; } .rd-node.medal-2 .g { color: #d6e2f0; } .rd-node.medal-3 .g { color: #ffd166; text-shadow: 0 0 10px rgba(255,209,102,.45); }
.rd-node.medal-1, .rd-node.medal-2, .rd-node.medal-3 { background: rgba(255,255,255,.06); }
.rd-node.medal-3 { border-color: rgba(255,209,102,.35); }
.rd-node.next { border: 1px solid var(--acc); box-shadow: 0 0 0 1px var(--acc) inset; }
.rd-node.next .g { opacity: 1; color: var(--acc); }
@media (prefers-reduced-motion: no-preference) { .rd-node.next { animation: rd-pulse 1.6s ease-in-out infinite; } }
@keyframes rd-pulse { 50% { box-shadow: 0 0 0 1px var(--acc) inset, 0 0 14px color-mix(in srgb, var(--acc) 45%, transparent); } }
.rd-node.locked { opacity: .35; cursor: default; }
.rd-node.mirror { border-style: dashed; }
.rd-node[data-focus="true"] { border-color: #fff; background: rgba(255,255,255,.14); outline: 2px solid rgba(255,255,255,.85); outline-offset: 2px; transform: translateY(-2px); }
.rd-row2 { display: flex; gap: 10px; margin-top: 12px; }
.rd-ex { flex: 1; aspect-ratio: auto; min-height: 56px; flex-direction: row; gap: 12px; }
.rd-ex .g { font-size: 26px; }
.rd-flip { width: 92px; aspect-ratio: auto; min-height: 56px; }
.rd-foot { margin-top: 14px; min-height: 26px; display: flex; align-items: baseline; gap: 16px; font-size: 15px; white-space: pre; }
.rd-foot .name { font-weight: 700; font-size: 19px; }
@media (max-width: 520px) { .rd-map-panel { padding: 16px; } .rd-grid { gap: 6px; } .rd-row2 { gap: 6px; } .rd-node .g { font-size: 20px; } .rd-flip { width: 64px; } }
.rd-back { margin-top: 14px; background: none; border: 1px solid rgba(255,255,255,.12); color: #cfd6ea; font: inherit; padding: 8px 14px; border-radius: 4px; cursor: pointer; min-height: 44px; }
`;

export function createMap({ root, input, onPick, onBack, onFlip }) {
  if (!document.getElementById('rd-map-style')) {
    const st = document.createElement('style');
    st.id = 'rd-map-style';
    st.textContent = STYLE;
    document.head.appendChild(st);
  }
  let model = null;
  let focus = 0; // index into the flat focus list: rooms…, examiner, flip
  let raf = 0;
  let shownAt = 0;

  const items = () => {
    if (!model) return [];
    const list = model.nodes.map((n) => ({ kind: 'room', ...n }));
    if (model.examiner) list.push({ kind: 'examiner', ...model.examiner });
    if (model.flip) list.push({ kind: 'flip', ...model.flip });
    return list;
  };

  function render() {
    const its = items();
    focus = Math.max(0, Math.min(focus, its.length - 1));
    const node = (it, i, extra = '') => `<button class="rd-node ${extra} ${it.locked ? 'locked' : ''} ${it.mirror ? 'mirror' : ''} ${it.medal ? `medal-${it.medal}` : ''} ${it.next ? 'next' : ''}" data-i="${i}" data-focus="${i === focus}">${it.html}</button>`;
    const p = model.progress;
    const bar = p ? `<div class="rd-bar"><div class="fill" style="width:${(100 * p.done) / p.total}%"></div>${p.need ? `<div class="notch ${p.done >= p.need || p.beaten ? 'open' : ''}" style="left:calc(${(100 * p.need) / p.total}% - 1px)"></div>` : ''}</div>` : '';
    const grid = its.map((it, i) => (it.kind === 'room' ? node(it, i) : '')).join('');
    const exI = its.findIndex((it) => it.kind === 'examiner');
    const flipI = its.findIndex((it) => it.kind === 'flip');
    const cur = its[focus];
    root.innerHTML = `<section class="rd-map" data-screen-id="map"><div class="rd-map-panel" style="--acc:${model.accent || '#7fd4ff'}">
      <div class="rd-map-head"><h1>${model.title}</h1><span class="rd-tally">${model.tally || ''}</span></div>
      ${bar}
      <div class="rd-grid">${grid}</div>
      ${exI >= 0 || flipI >= 0 ? `<div class="rd-row2">${exI >= 0 ? node(its[exI], exI, 'rd-ex') : ''}${flipI >= 0 ? node(its[flipI], flipI, 'rd-flip') : ''}</div>` : ''}
      <div class="rd-foot">${cur && cur.foot ? cur.foot : ''}</div>
      <button class="rd-back" data-back>Back</button>
    </div></section>`;
    root.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { focus = Number(b.dataset.i); activate(); }));
    root.querySelector('[data-back]').addEventListener('click', () => onBack());
  }

  function activate() {
    const it = items()[focus];
    if (!it || it.locked) return;
    if (it.kind === 'flip') onFlip();
    else onPick(it);
  }

  // 2D movement across the grid; the bottom row (examiner, flip) sits under it
  function move(dx, dy) {
    const its = items();
    const nRooms = model.nodes.length;
    const bottom = its.map((it, i) => (it.kind !== 'room' ? i : -1)).filter((i) => i >= 0);
    if (focus < nRooms) {
      const r = Math.floor(focus / COLS), c = focus % COLS;
      if (dx) { const nc = c + dx; if (nc >= 0 && nc < COLS && r * COLS + nc < nRooms) focus = r * COLS + nc; }
      if (dy) {
        const nr = r + dy, ni = nr * COLS + c;
        if (nr >= 0 && ni < nRooms) focus = ni;
        else if (dy > 0 && bottom.length) focus = c >= COLS - 1 && bottom.length > 1 ? bottom[1] : bottom[0];
      }
    } else {
      const k = bottom.indexOf(focus);
      if (dx && bottom[k + dx] !== undefined) focus = bottom[k + dx];
      if (dy < 0) focus = Math.min(nRooms - 1, (Math.ceil(nRooms / COLS) - 1) * COLS + (k > 0 ? COLS - 1 : 0));
    }
    render();
  }

  function tick() {
    if (performance.now() - shownAt > 160) {
      if (input.wasPressed('ui_left')) move(-1, 0);
      if (input.wasPressed('ui_right')) move(1, 0);
      if (input.wasPressed('ui_up')) move(0, -1);
      if (input.wasPressed('ui_down')) move(0, 1);
      if (input.wasPressed('ui_accept')) activate();
      else if (input.wasPressed('ui_flip') && model.flip && !model.flip.locked) onFlip();
      else if (input.wasPressed('ui_back')) onBack();
    }
    raf = requestAnimationFrame(tick);
  }

  return {
    show(m, { focusId = null, guard = true } = {}) {
      model = m;
      if (focusId) { const i = items().findIndex((it) => it.id === focusId); if (i >= 0) focus = i; }
      shownAt = guard ? performance.now() : -Infinity;
      render();
      if (!raf) raf = requestAnimationFrame(tick);
    },
    hide() { if (raf) cancelAnimationFrame(raf); raf = 0; },
    get active() { return !!raf; },
    get focused() { return items()[focus]; },
  };
}
