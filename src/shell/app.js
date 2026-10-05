// The game's flow, built on the Web Shell: its DOM UI (screens with
// keyboard / gamepad / pointer focus navigation), its UI input layer and its
// persistence. Gameplay runs on the canvas underneath; menus overlay it.
//
//   title → chapters → rooms → [intro] → play ⇄ pause (assists, settings)
//                                         → results → next / retry / watch / map
//
// Player-facing text is kept to what the player needs (constitution rule 8):
// names, numbers, medal glyphs and actions.
import { DOMGameUI } from '@slu/web-shell/ui-shell/DOMGameUI.js';
import { InputManager } from '@slu/web-shell/input/InputManager.js';
import { LatchedInputSource } from './input-source.js';
import { BrowserInputFamilyDetector } from '@slu/web-shell/platform/browser/InputFamilyDetector.js';

import { createLoop } from '../engine/loop.js';
import { createInput } from '../engine/input.js';
import { initAudio, setVolume } from '../engine/audio.js';
import { initHaptics, setHapticsEnabled } from '../engine/haptics.js';
import { createSession } from '../game/session.js';
import { render } from '../present/render.js';
import { THEME, HIGH_CONTRAST } from '../present/theme.js';
import { ROOMS, ROOM_BY_ID, CHAPTERS } from '../sim/levels.js';
import { compileRoom } from '../sim/room.js';
import { runLog } from '../sim/world.js';
import { decodeLog, BTN } from '../sim/input.js';
import { ROOM } from '../../config/tunables.js';
import { openSave, MEDAL, MEDAL_GLYPH, MEDAL_NAME } from './save.js';
import { createTelemetry } from './telemetry.js';
import { INTRO_TIME, ASSIST_STEPS, VOLUMES } from '../../config/ux.js';

const { SPEEDS, WINDOWS } = ASSIST_STEPS;
const WINDOW_LABEL = { 1: 'Normal', 1.5: 'Wide', 2: 'Very wide' };
const UNLOCK_ALL = new URLSearchParams(location.search).get('all') === '1';
const pct = (v) => `${Math.round(v * 100)}%`;
const onOff = (v) => (v ? 'On' : 'Off');

export async function startApp(canvas, ctx) {
  const save = await openSave();
  const telemetry = createTelemetry(() => save.data.settings.telemetry);
  initHaptics();

  // ── shell UI ──
  const uiRoot = document.getElementById('ui');
  const uiInput = new InputManager();
  const bindings = [
    { action: 'ui_up', keyboard: ['ArrowUp', 'KeyW'], gamepadButtons: [12], gamepadAxes: [{ axis: 1, direction: -1, threshold: 0.5 }] },
    { action: 'ui_down', keyboard: ['ArrowDown', 'KeyS'], gamepadButtons: [13], gamepadAxes: [{ axis: 1, direction: 1, threshold: 0.5 }] },
    { action: 'ui_accept', keyboard: ['Enter', 'Space', 'KeyJ'], gamepadButtons: [0] },
    { action: 'ui_back', keyboard: ['Escape', 'Backspace'], gamepadButtons: [1, 9] },
  ];
  uiInput.setBindings(bindings);
  const uiSource = new LatchedInputSource(bindings);
  uiSource.attach();
  const family = new BrowserInputFamilyDetector({ onChange: (f) => document.body.dataset.input = f });
  family.attach();
  document.body.dataset.input = family.activeFamily;

  let shownAt = -Infinity; // a keypress that opens a screen must not also act on it
  const fresh = () => performance.now() - shownAt < 180;
  const ui = new DOMGameUI({
    root: uiRoot,
    input: uiInput,
    theme: { fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace', radius: 6, panelOpacity: 0.82, maxWidth: 560 },
    onActivate: (screen, choice) => { if (!fresh()) onActivate(screen, choice); },
    onBack: (screen) => { if (!fresh()) onBack(screen); },
  });
  // DOMGameUI focuses real <button>s, so Enter/Space would ALSO fire a native
  // click on top of the shell's ui_accept — a double activation. Keyboard
  // activation goes through the shell only; pointer clicks still work.
  uiRoot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault(); });
  const SCREENS = ['title', 'chapters', 'rooms', 'pause', 'assists', 'settings', 'results'];
  ui.register(SCREENS.map((id) => ({ id, title: '', choices: [] })));

  let uiPolling = false;
  const pollUI = () => {
    uiInput.update(uiSource.poll());
    family.sampleGamepads();
    if (uiPolling) requestAnimationFrame(pollUI);
  };
  // guard: the screen was opened by a keypress, which must not also act on it
  // (re-rendering the screen already showing — a toggle — never re-arms it)
  let current = null;
  function showScreen(id, model, { guard = true } = {}) {
    const same = current === id && !uiRoot.hidden;
    ui.updateScreen(id, model);
    if (same) { current = id; return; } // updateScreen re-rendered it in place, keeping focus
    ui.show(id);
    current = id;
    shownAt = guard ? performance.now() : -Infinity;
    uiRoot.hidden = false;
    if (!uiPolling) { uiPolling = true; requestAnimationFrame(pollUI); ui.startInputLoop(); }
  }
  function hideUI() {
    current = null;
    uiRoot.hidden = true;
    uiRoot.innerHTML = '';
    ui.stopInputLoop();
    uiPolling = false;
    input.clear();
  }

  // ── game ──
  let state = 'title'; // title | menu | intro | play | replay
  let menuBehind = 'title'; // what the canvas shows under a menu: 'title' | 'room'
  let chapterIdx = 0;
  let roomId = null;
  let introT = 0;
  let msInRoom = 0;
  let lastMask = 0;
  let time = 0;
  let resultsFor = null;
  let pauseFrom = 'play';
  let swallow = 0;
  let frozenDrawn = false;

  const session = createSession({
    onClear: (r) => onRoomClear(r),
    onEvent: (e) => {
      if (state !== 'play') return;
      if (e.type === 'player.death') { save.recordDeath(roomId); telemetry.death(roomId); telemetry.attempt(roomId); }
    },
  });
  const demo = createSession({ opts: { silent: true }, onClear: () => startDemo() });
  const DEMO_ROOMS = ['c1-01', 'p0-02', 'p0-03'].filter((id) => ROOM_BY_ID[id] && ROOM_BY_ID[id].solution);
  let demoIdx = 0;
  function startDemo() {
    if (!DEMO_ROOMS.length) return;
    demo.load(ROOM_BY_ID[DEMO_ROOMS[demoIdx++ % DEMO_ROOMS.length]], { mode: 'replay' });
  }
  startDemo();

  const applyAssists = () => {
    const a = save.data.assists;
    loop.setSpeed(a.speed);
    session.setOpts({ invincible: a.invincible, windowMult: a.window });
  };
  const applySettings = () => {
    setVolume(save.data.settings.sfxVol);
  };

  const chapterOf = (id) => CHAPTERS.findIndex((c) => c.rooms.includes(id));
  const scored = (ci) => CHAPTERS[ci] && CHAPTERS[ci].scored !== false;
  const clearedIn = (ci) => CHAPTERS[ci].rooms.filter((id) => save.room(id) && save.room(id).cleared).length;
  // Prologue → Chapter 1 opens when the prologue is done. Later chapters open
  // on 15 of 20 (their Examiners arrive in M2). ?all=1 unlocks everything.
  const chapterOpen = (ci) => UNLOCK_ALL || ci === 0
    || (scored(ci - 1) ? clearedIn(ci - 1) >= 15 : clearedIn(ci - 1) >= CHAPTERS[ci - 1].rooms.length);

  function enterRoom(id, { replay = false } = {}) {
    roomId = id;
    chapterIdx = chapterOf(id);
    const data = ROOM_BY_ID[id];
    hideUI();
    applyAssists();
    session.load(data, { mode: replay ? 'replay' : 'play' });
    msInRoom = 0;
    if (replay) { state = 'replay'; return; }
    telemetry.attempt(id);
    const firstVisit = !save.room(id);
    state = firstVisit ? 'intro' : 'play';
    introT = 0;
    if (firstVisit) {
      save.data.rooms[id] = { cleared: false, bestReflects: null, medal: 0, deaths: 0, hintsUsed: 0, bestTimeMs: null };
      save.save();
    }
  }

  function leaveRoom() {
    if (roomId && state !== 'replay' && !(save.room(roomId) && save.room(roomId).cleared) && session.state && session.state.status !== 'clear') telemetry.quit(roomId);
  }

  function onRoomClear(r) {
    if (r.replay) { showResults(resultsFor); return; }
    const sc = scored(chapterIdx);
    const change = save.recordClear(roomId, { ...r, medal: sc ? r.medal : MEDAL.BRONZE });
    telemetry.clear(roomId, msInRoom);
    resultsFor = { ...r, change, scored: sc };
    showResults(resultsFor);
  }

  // ── screens ──
  function showTitle() {
    state = 'title';
    menuBehind = 'title';
    showScreen('title', { title: 'REFLECT / DODGE', choices: [{ id: 'play', label: 'Play' }, { id: 'settings', label: 'Settings' }] }, { guard: false });
  }

  function showChapters() {
    state = 'menu';
    menuBehind = 'title';
    const choices = CHAPTERS.map((c, i) => {
      const open = chapterOpen(i);
      const n = c.rooms.length;
      const done = clearedIn(i);
      const gold = c.rooms.filter((id) => save.medal(id) === MEDAL.GOLD).length;
      return {
        id: c.id,
        label: `${open ? '' : '🔒 '}${i === 0 ? c.name : `${i} · ${c.name}`}`,
        description: open ? `${done}/${n}${c.scored === false ? '' : `  ★ ${gold}`}` : undefined,
        disabled: !open,
      };
    });
    showScreen('chapters', { title: 'REFLECT / DODGE', choices, backTarget: 'title' });
  }

  function showRooms(ci) {
    state = 'menu';
    menuBehind = 'title';
    chapterIdx = ci;
    const c = CHAPTERS[ci];
    const choices = c.rooms.map((id, k) => {
      const r = ROOM_BY_ID[id];
      const rec = save.room(id);
      const glyph = c.scored === false ? (rec && rec.cleared ? '●' : '·') : MEDAL_GLYPH[rec ? rec.medal || 0 : 0];
      const best = rec && rec.bestReflects != null && c.scored !== false ? `◇ ${rec.bestReflects} / ${r.par}` : c.scored !== false ? `◇ – / ${r.par}` : undefined;
      return { id, label: `${glyph}  ${String(k + 1).padStart(2, '0')}  ${r.name || id}`, description: best };
    });
    showScreen('rooms', { title: ci === 0 ? c.name : `${ci} · ${c.name}`, choices, backTarget: 'chapters' });
    // cursor remembers the last room
    if (roomId && c.rooms.includes(roomId)) {
      const k = c.rooms.indexOf(roomId);
      for (let i = 0; i < k; i++) ui.move(1);
    }
  }

  function showPause() {
    pauseFrom = state;
    state = 'menu';
    menuBehind = 'room';
    const hint = session.hintAvailable(msInRoom);
    showScreen('pause', {
      title: (ROOM_BY_ID[roomId].name || roomId),
      choices: [
        { id: 'resume', label: 'Resume' },
        { id: 'reset', label: 'Reset' },
        { id: 'hint', label: 'Hint', disabled: !hint || pauseFrom === 'replay' },
        { id: 'assists', label: 'Assists' },
        { id: 'settings', label: 'Settings' },
        { id: 'map', label: 'Map' },
      ],
      backTarget: 'resume',
    });
  }

  function showAssists() {
    const a = save.data.assists;
    showScreen('assists', {
      title: 'Assists',
      choices: [
        { id: 'speed', label: `Game speed: ${pct(a.speed)}` },
        { id: 'window', label: `Reflect window: ${WINDOW_LABEL[a.window] || 'Normal'}` },
        { id: 'preview', label: `Reflect preview: ${onOff(a.preview)}`, description: a.preview ? 'Hold Reflect to see each direction' : undefined },
        { id: 'invincible', label: `Invincibility: ${onOff(a.invincible)}` },
      ],
      backTarget: 'pause',
    });
  }

  let settingsBack = 'title';
  function showSettings(back) {
    if (back) settingsBack = back;
    const s = save.data.settings;
    showScreen('settings', {
      title: 'Settings',
      choices: [
        { id: 'sfx', label: `Sound: ${pct(s.sfxVol)}` },
        { id: 'contrast', label: `High contrast: ${onOff(s.highContrast)}` },
        { id: 'flashing', label: `Reduced flashing: ${onOff(s.reducedFlashing)}` },
        { id: 'shake', label: `Screen shake: ${onOff(s.shake)}` },
        { id: 'fullscreen', label: 'Fullscreen' },
        { id: 'telemetry', label: `Share playtest data: ${onOff(s.telemetry)}`, description: s.telemetry ? 'Stays on this device until you export it' : undefined },
        ...(s.telemetry ? [{ id: 'export', label: 'Export playtest data' }] : []),
      ],
      backTarget: settingsBack,
    });
  }

  // guard: true when a keypress (leaving a replay) opened it, so that same
  // press doesn't also act as Back on the results screen
  function showResults(r, { guard = false } = {}) {
    state = 'menu';
    menuBehind = 'room';
    const c = CHAPTERS[chapterIdx];
    const next = c.rooms[c.rooms.indexOf(roomId) + 1];
    const subtitle = r.scored
      ? `◇ ${r.reflects} / ${r.par}   ✕ ${r.deaths}${r.underPar ? '   ★ under par' : ''}${r.change.medalUp && !r.change.firstClear ? '   ▲' : ''}`
      : undefined;
    showScreen('results', {
      title: r.scored ? `${MEDAL_GLYPH[r.medal]} ${MEDAL_NAME[r.medal]}` : '✓',
      subtitle,
      choices: [
        { id: 'next', label: next ? 'Next' : 'Map' },
        { id: 'retry', label: 'Retry' },
        ...(ROOM_BY_ID[roomId].solution && r.scored ? [{ id: 'watch', label: 'Watch solution' }] : []),
        ...(next ? [{ id: 'map', label: 'Map' }] : []),
      ],
    }, { guard });
  }

  // ── UI handlers ──
  async function onActivate(screen, choice) {
    initAudio();
    const s = save.data.settings, a = save.data.assists;
    if (screen === 'title') {
      if (choice === 'play') {
        if (!save.room(CHAPTERS[0].rooms[0])) enterRoom(CHAPTERS[0].rooms[0]); // first boot: straight into the prologue
        else showChapters();
      } else if (choice === 'settings') showSettings('title');
    } else if (screen === 'chapters') {
      showRooms(CHAPTERS.findIndex((c) => c.id === choice));
    } else if (screen === 'rooms') {
      enterRoom(choice);
    } else if (screen === 'pause') {
      if (choice === 'resume') resume();
      else if (choice === 'reset') { session.reset(); telemetry.attempt(roomId); resume(); }
      else if (choice === 'hint') { if (session.useHint()) { save.recordHint(roomId); telemetry.hint(roomId); } resume(); }
      else if (choice === 'assists') showAssists();
      else if (choice === 'settings') showSettings('pause');
      else if (choice === 'map') { leaveRoom(); showRooms(chapterIdx); }
    } else if (screen === 'assists') {
      if (choice === 'speed') a.speed = SPEEDS[(SPEEDS.indexOf(a.speed) + 1) % SPEEDS.length];
      else if (choice === 'window') a.window = WINDOWS[(WINDOWS.indexOf(a.window) + 1) % WINDOWS.length];
      else if (choice === 'preview') a.preview = !a.preview;
      else if (choice === 'invincible') a.invincible = !a.invincible;
      save.save();
      applyAssists();
      // the window/invincibility opts take effect from the next attempt: reset
      // now so a run never mixes assist states mid-attempt
      if (choice === 'window' || choice === 'invincible') session.reset();
      showAssists();
    } else if (screen === 'settings') {
      if (choice === 'sfx') s.sfxVol = VOLUMES[(VOLUMES.indexOf(s.sfxVol) + 1) % VOLUMES.length];
      else if (choice === 'contrast') s.highContrast = !s.highContrast;
      else if (choice === 'flashing') s.reducedFlashing = !s.reducedFlashing;
      else if (choice === 'shake') s.shake = !s.shake;
      else if (choice === 'telemetry') s.telemetry = !s.telemetry;
      else if (choice === 'export') telemetry.export();
      else if (choice === 'fullscreen') {
        try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* unsupported */ }
      }
      save.save();
      applySettings();
      showSettings();
    } else if (screen === 'results') {
      const c = CHAPTERS[chapterIdx];
      const next = c.rooms[c.rooms.indexOf(roomId) + 1];
      if (choice === 'next') { if (next) enterRoom(next); else showRooms(chapterIdx); }
      else if (choice === 'retry') enterRoom(roomId);
      else if (choice === 'watch') enterRoom(roomId, { replay: true });
      else if (choice === 'map') showRooms(chapterIdx);
    }
  }

  function onBack(screen) {
    if (screen === 'chapters') showTitle();
    else if (screen === 'rooms') showChapters();
    else if (screen === 'pause') resume();
    else if (screen === 'assists') showPause2();
    else if (screen === 'settings') { if (settingsBack === 'pause') showPause2(); else showTitle(); }
    else if (screen === 'results') showRooms(chapterIdx);
  }
  // back to the pause menu without re-recording where we paused from
  function showPause2() { const from = pauseFrom; showPause(); pauseFrom = from; }

  function resume() {
    hideUI();
    state = pauseFrom === 'replay' ? 'replay' : 'play';
  }

  // ── gameplay input ──
  const input = createInput({
    touchRoot: document.getElementById('touch'),
    onMeta: (k) => {
      initAudio();
      if (state === 'intro') { state = 'play'; return; }
      if (state === 'replay') {
        if (k === 'escape' || k === 'enter' || k === 'r') showResults(resultsFor, { guard: true });
        return;
      }
      if (state !== 'play') return;
      if (k === 'escape' || k === 'p') showPause();
      else if (k === 'r') { session.reset(); telemetry.attempt(roomId); }
      else if (k === 'h' && session.hintAvailable(msInRoom)) { if (session.useHint()) { save.recordHint(roomId); telemetry.hint(roomId); } }
    },
  });
  addEventListener('pointerdown', () => initAudio(), { once: true });

  // ── loop ──
  const loop = createLoop({
    update: (dt, real) => {
      time += dt;
      if (state === 'title' || (state === 'menu' && menuBehind === 'title')) { demo.tick(0); return; }
      if (state === 'intro') {
        introT += real;
        const m = input.sample();
        // any button skips; that press is swallowed until released so it
        // doesn't leak a jump or reflect into the room's first frame
        if (m) { swallow = m; state = 'play'; } else if (introT >= INTRO_TIME) state = 'play';
        return;
      }
      if (state !== 'play' && state !== 'replay') return;
      let mask = input.sample();
      if (swallow) { swallow &= mask; mask &= ~swallow; }
      lastMask = mask;
      if (state === 'play') { msInRoom += real * 1000; save.addPlayTime(real * 1000); }
      session.tick(mask);
    },
    render: (alpha) => {
      // a menu over a room shows a frozen frame: draw it once, not every frame
      if (state === 'menu' && menuBehind === 'room') { if (frozenDrawn) return; frozenDrawn = true; } else frozenDrawn = false;
      const s = save.data.settings;
      const view = {
        theme: s.highContrast ? HIGH_CONTRAST : THEME,
        shake: s.shake,
        flashes: !s.reducedFlashing,
      };
      if (state === 'title' || (state === 'menu' && menuBehind === 'title')) {
        if (demo.state) render(ctx, { state: demo.state, room: demo.room, alpha, fx: demo.fx, time, hud: false, ...view });
        return;
      }
      if (!session.state) return;
      const sc = scored(chapterIdx);
      render(ctx, {
        state: session.state, room: session.room, alpha: state === 'menu' ? 1 : alpha, fx: session.fx, time,
        hud: state === 'menu' ? false : { par: sc ? session.room.par : null, hint: state === 'play' && session.hintAvailable(msInRoom) },
        preview: state === 'play' && save.data.assists.preview && (lastMask & BTN.REFLECT) ? { mask: lastMask } : null,
        ghost: session.ghost ? session.ghost.state : null,
        ...view,
      });
      if (state === 'intro') drawIntro(ctx, ROOM_BY_ID[roomId], sc, introT);
      if (state === 'replay') drawReplayBadge(ctx, time);
    },
  });

  applyAssists();
  applySettings();
  loop.start();
  showTitle();

  // test / dev hook
  window.__RD = {
    get state() { return state; },
    get session() { return session; },
    get save() { return save.data; },
    get fps() { return loop.fps; },
    rooms: ROOMS.map((r) => r.id),
    chapters: CHAPTERS,
    enterRoom,
    showTitle,
    replay(id) {
      const data = ROOM_BY_ID[id];
      const { state: st } = runLog(compileRoom(data), decodeLog(data.solution));
      return JSON.stringify(st);
    },
    // play a room's stored solution through the live session (dev/screenshots)
    seek(id, frame) {
      enterRoom(id);
      state = 'play';
      const masks = decodeLog(ROOM_BY_ID[id].solution);
      for (let i = 0; i < Math.min(frame, masks.length); i++) session.tick(masks[i]);
    },
  };
}

function drawIntro(ctx, data, scored, t) {
  const a = Math.min(1, t / 0.12) * Math.min(1, (INTRO_TIME - t) / 0.2);
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.fillStyle = 'rgba(7,8,13,0.7)';
  ctx.fillRect(0, ROOM.H / 2 - 40, ROOM.W, 80);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f5f7ff';
  ctx.font = '700 26px ui-monospace, Menlo, monospace';
  ctx.fillText((data.name || data.id).toUpperCase(), ROOM.W / 2, ROOM.H / 2 - (scored ? 10 : 0));
  if (scored) {
    ctx.font = '500 15px ui-monospace, Menlo, monospace';
    ctx.fillStyle = 'rgba(230,236,255,0.75)';
    ctx.fillText(`◇ ${data.par}`, ROOM.W / 2, ROOM.H / 2 + 20);
  }
  ctx.restore();
}

function drawReplayBadge(ctx, time) {
  ctx.save();
  ctx.globalAlpha = 0.6 + 0.3 * Math.sin(time * 3);
  ctx.fillStyle = '#f5f7ff';
  ctx.beginPath();
  ctx.moveTo(ROOM.W / 2 - 7, 8); ctx.lineTo(ROOM.W / 2 + 8, 16); ctx.lineTo(ROOM.W / 2 - 7, 24); ctx.closePath();
  ctx.fill();
  ctx.restore();
}
