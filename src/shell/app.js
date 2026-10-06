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
import { initAudio, setVolume, setKeyRatio, setCalibrationOffset, getCalibrationOffset, playPredicted } from '../engine/audio.js';
import { initMusic, setMusicLayers, setMusicChapter, setMusicVolume, CHAPTER_KEYS } from '../engine/music.js';
import { untilNext } from '../objects/emitter.js';
import { TIMESTEP } from '../../config/tunables.js';
import { initHaptics, setHapticsEnabled } from '../engine/haptics.js';
import { createSession } from '../game/session.js';
import { createRun, addSegment, runFrames, formatTime } from '../game/speedrun.js';
import { render } from '../present/render.js';
import { chapterTheme } from '../present/theme.js';
import { FONT, f, wordmarkSVG } from '../present/brand.js';
import { ROOMS, ROOM_BY_ID, CHAPTERS } from '../sim/levels.js';
import { compileRoom } from '../sim/room.js';
import { runLog } from '../sim/world.js';
import { decodeLog, BTN } from '../sim/input.js';
import { ROOM } from '../../config/tunables.js';
import { openSave, MEDAL, MEDAL_GLYPH, MEDAL_NAME } from './save.js';
import { createTelemetry } from './telemetry.js';
import { FLAGS } from '../../config/flags.js';
import { createSteamBridge, nullBridge } from '../platform/steam/bridge.js';
import { SteamCloudStorage } from '../platform/steam/cloud-storage.js';
import { evaluateAchievements } from '../platform/steam/achievements.js';
import { glyphFamily } from '../platform/steam/glyphs.js';
import { BrowserStorage } from '@slu/web-shell/platform/browser/BrowserStorage.js';
import { createMap } from './map.js';
import { drawPrompts, ROOM_PROMPTS } from '../present/prompts.js';
import { INTRO_TIME, RESET_PROMPT_DEATHS, ASSIST_STEPS, VOLUMES, SLOWMO, COLLAPSE_TIME, OFFSET } from '../../config/ux.js';

const { SPEEDS, WINDOWS } = ASSIST_STEPS;
const WINDOW_LABEL = { 1: 'Normal', 1.5: 'Wide', 2: 'Very wide' };
const UNLOCK_ALL = new URLSearchParams(location.search).get('all') === '1';
const pct = (v) => `${Math.round(v * 100)}%`;
const onOff = (v) => (v ? 'On' : 'Off');

export async function startApp(canvas, ctx) {
  // Steam (behind FLAGS.STEAM, off for web builds): cloud saves, achievements, glyphs
  const steam = FLAGS.STEAM ? await createSteamBridge() : nullBridge;
  const save = await openSave(steam.available ? { storage: new SteamCloudStorage(new BrowserStorage('reflect-dodge'), steam) } : {});
  const syncAchievements = () => {
    if (!steam.available) return;
    for (const id of evaluateAchievements(save.data, CHAPTERS, ROOM_BY_ID)) steam.unlock(id);
  };
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
    { action: 'ui_left', keyboard: ['ArrowLeft', 'KeyA'], gamepadButtons: [14], gamepadAxes: [{ axis: 0, direction: -1, threshold: 0.5 }] },
    { action: 'ui_right', keyboard: ['ArrowRight', 'KeyD'], gamepadButtons: [15], gamepadAxes: [{ axis: 0, direction: 1, threshold: 0.5 }] },
    { action: 'ui_flip', keyboard: ['KeyM', 'Tab'], gamepadButtons: [3] },
  ];
  uiInput.setBindings(bindings);
  const uiSource = new LatchedInputSource(bindings);
  uiSource.attach();
  const activePadId = () => { const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : []; return pads.length ? pads[0].id : null; };
  const setFamily = (f) => { document.body.dataset.input = FLAGS.STEAM ? glyphFamily(f, activePadId(), steam.controllerType()) : f; };
  const family = new BrowserInputFamilyDetector({ onChange: setFamily });
  family.attach();
  setFamily(family.activeFamily);

  let shownAt = -Infinity; // a keypress that opens a screen must not also act on it
  const fresh = () => performance.now() - shownAt < 180;
  const ui = new DOMGameUI({
    root: uiRoot,
    input: uiInput,
    theme: { fontFamily: FONT.ui, radius: 0, panelOpacity: 0.82, maxWidth: 560 },
    onActivate: (screen, choice) => { if (!fresh()) onActivate(screen, choice); },
    onBack: (screen) => { if (!fresh()) onBack(screen); },
  });
  // DOMGameUI focuses real <button>s, so Enter/Space would ALSO fire a native
  // click on top of the shell's ui_accept — a double activation. Keyboard
  // activation goes through the shell only; pointer clicks still work.
  uiRoot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault(); });
  const SCREENS = ['title', 'chapters', 'credits', 'pause', 'assists', 'settings', 'results'];
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
    if (map.active) { map.hide(); current = null; }
    const same = current === id && !uiRoot.hidden;
    ui.updateScreen(id, model);
    if (same) { current = id; return; } // updateScreen re-rendered it in place, keeping focus
    ui.show(id);
    current = id;
    shownAt = guard ? performance.now() : -Infinity;
    uiRoot.hidden = false;
    if (!uiPolling) { uiPolling = true; requestAnimationFrame(pollUI); }
    ui.startInputLoop();
  }
  function hideUI() {
    map.hide();
    current = null;
    uiRoot.hidden = true;
    uiRoot.innerHTML = '';
    ui.stopInputLoop();
    uiPolling = false;
    input.clear();
  }

  // the chapter map: its own 2D focus model over the same UI input
  const map = createMap({
    root: uiRoot,
    input: uiInput,
    onPick: (it) => { startAudio(); if (it.kind === 'examiner') enterEncounter(mapChapter); else enterRoom(it.id); },
    onBack: () => showChapters(),
    onFlip: () => { mirrorView = !mirrorView; showMap(mapChapter, { guard: false }); },
  });
  let mapChapter = 0;
  let mirrorView = false;
  // Speedrun (off by default): a run spans the rooms played back to back and
  // ends at the map or title; the finished run can be exported from results.
  let run = null, runTotal = 0, lastRun = null;
  function endRun() { if (run && run.segments.length) lastRun = run; run = null; runTotal = 0; }
  function downloadRun(r) {
    const blob = new Blob([JSON.stringify({ game: 'reflect-dodge', ...r }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reflect-dodge-run-${formatTime(runFrames(r)).replace(/[:.]/g, '-')}.json`;
    a.click();
  }
  function showMap(ci, { guard = true, focusId = null } = {}) {
    endRun();
    state = 'menu';
    menuBehind = 'title';
    mapChapter = chapterIdx = ci;
    ui.stopInputLoop();
    current = 'map';
    uiRoot.hidden = false;
    if (!uiPolling) { uiPolling = true; requestAnimationFrame(pollUI); }
    map.show(mapModel(ci), { guard, focusId: focusId || roomId });
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
  let prompts = []; // [{ id, alpha, used }]
  let encounter = null; // { ci, phase } while fighting an Examiner
  let collapseUntil = 0; // real-time ms: slow-motion + collapse after the final core

  const session = createSession({
    onClear: (r) => onRoomClear(r),
    onEvent: (e) => {
      if (state !== 'play') return;
      if (e.type === 'room.clear' && encounter && encounter.phase === CHAPTERS[encounter.ci].examiner.length - 1) {
        session.fx.collapse = { k: 0, dur: COLLAPSE_TIME, paths: session.reflectPaths.slice() };
        loop.setSpeed(SLOWMO.SPEED);
        collapseUntil = performance.now() + SLOWMO.TIME * 1000;
      }
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
    setMusicVolume(save.data.settings.musicVol);
    setCalibrationOffset(save.data.settings.audioOffsetMs);
  };
  const startAudio = () => { initAudio(); initMusic(); applySettings(); };
  // the room's key: ambient bed and event sounds move together
  const setChapterAudio = (ci) => { setMusicChapter(ci); setKeyRatio((CHAPTER_KEYS[ci] || CHAPTER_KEYS[1]) / CHAPTER_KEYS[1]); };
  // calibration: emitter shots are on fixed clocks, so with a positive offset
  // they're scheduled that far ahead (the reactive copy is skipped)
  const predicted = new Set();
  function schedulePredictedShots() {
    const off = getCalibrationOffset();
    if (off <= 0 || !session.state) return;
    const st = session.state;
    st.objects.forEach((o, i) => {
      if (o.kind !== 'emitter' || !o.on || (o.count && o.fired >= o.count)) return;
      const inSec = untilNext(o, st.frame) / TIMESTEP.HZ / save.data.assists.speed;
      const key = `${roomId}:${session.attempt}:${i}:${o.fired}`;
      if (inSec * 1000 <= off && !predicted.has(key)) { predicted.add(key); playPredicted({ type: 'emitter.fire' }, inSec); }
    });
    if (predicted.size > 500) predicted.clear();
  }

  const chapterOf = (id) => CHAPTERS.findIndex((c) => c.rooms.includes(id));
  // chapter of any room id, mirrors and Examiner phases included (for art)
  const chapterOfAny = (id) => {
    const base = id.endsWith('-m') ? id.slice(0, -2) : id;
    const i = CHAPTERS.findIndex((c) => c.rooms.includes(base) || (c.examiner || []).includes(base));
    return i < 0 ? 0 : i;
  };
  const scored = (ci) => CHAPTERS[ci] && CHAPTERS[ci].scored !== false;
  const clearedIn = (ci) => CHAPTERS[ci].rooms.filter((id) => save.room(id) && save.room(id).cleared).length;
  // Unlocks (GDD: World map): the Prologue opens Chapter 1 when it's done; a
  // chapter's Examiner opens on 15 of its rooms (75%, so a chapter shorter
  // than 20 can't strand the player); beating it opens the next chapter.
  // ?all=1 unlocks everything for playtests.
  const examinerNeed = (ci) => Math.min(15, Math.ceil(CHAPTERS[ci].rooms.length * 0.75));
  const examinerOpen = (ci) => UNLOCK_ALL || clearedIn(ci) >= examinerNeed(ci);
  const examinerDefeated = (ci) => !!(save.data.chapters[CHAPTERS[ci].id] && save.data.chapters[CHAPTERS[ci].id].examinerDefeated);
  const chapterOpen = (ci) => {
    if (UNLOCK_ALL || ci === 0) return true;
    const prev = CHAPTERS[ci - 1];
    if (!scored(ci - 1)) return clearedIn(ci - 1) >= prev.rooms.length;
    return prev.examiner ? examinerDefeated(ci - 1) : clearedIn(ci - 1) >= examinerNeed(ci - 1);
  };
  const mirrorOf = (id) => ROOM_BY_ID[`${id}-m`] ? `${id}-m` : null;
  const mirrorOpen = (id) => UNLOCK_ALL || save.data.mirrorsUnlocked.includes(id);

  function mapModel(ci) {
    const c = CHAPTERS[ci];
    const sc = c.scored !== false;
    const hasMirrors = sc && c.rooms.some(mirrorOf);
    const flipped = mirrorView && hasMirrors;
    // "next up": the first open room not yet cleared, marked on the grid
    const nextUp = c.rooms.map((b) => (flipped ? mirrorOf(b) && mirrorOpen(b) && mirrorOf(b) : b))
      .find((id) => id && !(save.room(id) && save.room(id).cleared));
    const nodes = c.rooms.map((baseId, k) => {
      const id = flipped ? mirrorOf(baseId) || `${baseId}-m` : baseId;
      const r = ROOM_BY_ID[id];
      const locked = flipped ? !(r && mirrorOpen(baseId)) : false;
      const rec = save.room(id);
      const glyph = locked ? '·' : id === nextUp ? '▸' : !sc ? (rec && rec.cleared ? '●' : '·') : MEDAL_GLYPH[rec ? rec.medal || 0 : 0];
      const best = r && sc ? `◇ ${rec && rec.bestReflects != null ? rec.bestReflects : '–'} / ${r.par}` : '';
      const medal = locked || !rec ? 0 : !sc ? (rec.cleared ? 1 : 0) : rec.medal || 0;
      return {
        id, locked, mirror: flipped, medal, next: id === nextUp,
        html: `<span class="n">${String(k + 1).padStart(2, '0')}</span><span class="g">${locked ? '🔒' : glyph}</span>`,
        foot: locked ? (r ? '★ → ⇋' : '') : `<span class="name">${(r && r.name) || id}</span>  ${best}`,
      };
    });
    const done = clearedIn(ci);
    const count = (m) => nodes.filter((n) => !n.locked && n.medal === m).length;
    const model = {
      title: ci === 0 ? c.name : `${ci} · ${c.name}${flipped ? '  ⇋' : ''}`,
      // medal counts in their own shapes and colours: ★ gold ◆ silver ● bronze
      tally: sc
        ? `<span class="m3">★ ${count(MEDAL.GOLD)}</span><span class="m2">◆ ${count(MEDAL.SILVER)}</span><span class="m1">● ${count(MEDAL.BRONZE)}</span>`
        : '',
      accent: chapterTheme(ci, save.data.settings.highContrast).accent,
      // the bar fills with cleared rooms; a notch marks where the Examiner opens
      progress: { done, total: c.rooms.length, need: c.examiner && c.examiner.length ? examinerNeed(ci) : null, beaten: examinerDefeated(ci) },
      nodes,
    };
    if (c.examiner && c.examiner.length) {
      const open = examinerOpen(ci), beaten = examinerDefeated(ci);
      model.examiner = {
        id: 'examiner', locked: !open,
        html: `<span class="g">⬢</span><span>${beaten ? '✓' : open ? '' : `● ${done}/${examinerNeed(ci)}`}</span>`,
        foot: open ? '<span class="name">⬢</span>' : `● ${done}/${examinerNeed(ci)}`,
      };
    }
    if (hasMirrors) {
      const any = UNLOCK_ALL || c.rooms.some((id) => mirrorOf(id) && mirrorOpen(id));
      model.flip = { id: 'flip', locked: !any, html: `<span class="g">⇋</span>`, foot: any ? '⇋' : '★ → ⇋' };
    }
    return model;
  }

  function enterEncounter(ci, phase = 0) {
    encounter = { ci, phase };
    enterRoom(CHAPTERS[ci].examiner[phase], { encounter: true });
  }

  function enterRoom(id, { replay = false, encounter: isEncounter = false } = {}) {
    if (!isEncounter) encounter = null;
    roomId = id;
    chapterIdx = encounter ? encounter.ci : chapterOf(id) >= 0 ? chapterOf(id) : chapterIdx;
    const data = ROOM_BY_ID[id];
    hideUI();
    applyAssists();
    session.load(data, { mode: replay ? 'replay' : 'play' });
    setChapterAudio(chapterIdx);
    const seen = save.data.seenPrompts || (save.data.seenPrompts = []);
    prompts = (ROOM_PROMPTS[id] || []).filter((k) => !seen.includes(k)).map((k) => ({ id: k, alpha: 1, used: false }));
    msInRoom = 0;
    if (replay) { state = 'replay'; return; }
    if (save.data.settings.speedrunTimer && !run) run = createRun('chapter', id.endsWith('-m') ? 'mirror' : 'core');
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
    if (run) { addSegment(run, roomId, r.attempts, r.assisted); runTotal = runFrames(run); }
    if (encounter) {
      const ex = CHAPTERS[encounter.ci].examiner;
      telemetry.clear(roomId, msInRoom);
      if (encounter.phase < ex.length - 1) { enterEncounter(encounter.ci, encounter.phase + 1); return; }
      const cid = CHAPTERS[encounter.ci].id;
      save.data.chapters[cid] = { ...(save.data.chapters[cid] || {}), examinerDefeated: true };
      save.save();
      syncAchievements();
      showExaminerResults(encounter.ci);
      return;
    }
    const sc = scored(chapterIdx);
    const change = save.recordClear(roomId, { ...r, medal: sc ? r.medal : MEDAL.BRONZE });
    syncAchievements();
    telemetry.clear(roomId, msInRoom);
    resultsFor = { ...r, change, scored: sc };
    showResults(resultsFor);
  }

  // ── screens ──
  function showTitle() {
    endRun();
    state = 'title';
    menuBehind = 'title';
    showScreen('title', { title: 'REFLECT / DODGE', choices: [{ id: 'play', label: 'Play' }, { id: 'settings', label: 'Settings' }, { id: 'credits', label: 'Credits' }] }, { guard: false });
    // the wordmark replaces the plain title text (the label stays for screen readers)
    const h = uiRoot.querySelector('[data-screen-id="title"] .slu-header h1, .slu-header h1');
    if (h && !h.querySelector('.rd-wordmark')) h.innerHTML = wordmarkSVG();
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
        description: open ? `${done}/${n}${c.scored === false ? '' : `  ★ ${gold}`}${c.examiner ? `  ⬢${examinerDefeated(i) ? '✓' : ''}` : ''}` : undefined,
        disabled: !open,
      };
    });
    showScreen('chapters', { title: 'REFLECT / DODGE', choices, backTarget: 'title' });
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
        { id: 'music', label: `Music: ${pct(s.musicVol)}` },
        { id: 'offset-up', label: `Audio offset: ${s.audioOffsetMs > 0 ? '+' : ''}${s.audioOffsetMs} ms`, description: 'Sounds earlier' },
        { id: 'offset-down', label: 'Audio offset −', description: 'Sounds later' },
        { id: 'contrast', label: `High contrast: ${onOff(s.highContrast)}` },
        { id: 'flashing', label: `Reduced flashing: ${onOff(s.reducedFlashing)}` },
        { id: 'shake', label: `Screen shake: ${onOff(s.shake)}` },
        { id: 'fullscreen', label: 'Fullscreen' },
        { id: 'speedrun', label: `Speedrun timer: ${onOff(s.speedrunTimer)}` },
        { id: 'telemetry', label: `Share playtest data: ${onOff(s.telemetry)}`, description: s.telemetry ? 'Stays on this device until you export it' : undefined },
        ...(s.telemetry ? [{ id: 'export', label: 'Export playtest data' }] : []),
      ],
      backTarget: settingsBack,
    });
  }

  // guard: true when a keypress (leaving a replay) opened it, so that same
  // press doesn't also act as Back on the results screen
  // where Next goes after a clear: the next room in map order; mirror rooms
  // follow the next open mirror. At a chapter's end: its Examiner if open and
  // unbeaten, else the first room still uncleared, else the next chapter.
  // Returns { room } | { examiner } | null (null = the map).
  function nextAfter(id) {
    const c = CHAPTERS[chapterIdx];
    const mirror = id.endsWith('-m');
    const i = c.rooms.indexOf(mirror ? id.slice(0, -2) : id);
    if (i < 0) return null;
    if (mirror) {
      const n = c.rooms.slice(i + 1).find((r) => mirrorOf(r) && mirrorOpen(r));
      return n ? { room: mirrorOf(n) } : null;
    }
    if (c.rooms[i + 1]) return { room: c.rooms[i + 1] };
    if (c.examiner && c.examiner.length && examinerOpen(chapterIdx) && !examinerDefeated(chapterIdx)) return { examiner: chapterIdx };
    const gap = c.rooms.find((r) => r !== id && !(save.room(r) && save.room(r).cleared));
    if (gap) return { room: gap };
    const nc = CHAPTERS[chapterIdx + 1];
    return nc && chapterOpen(chapterIdx + 1) ? { room: nc.rooms[0] } : null;
  }
  function goNext(next) {
    if (!next) showMap(chapterIdx);
    else if (next.examiner !== undefined) enterEncounter(next.examiner);
    else enterRoom(next.room);
  }

  function showResults(r, { guard = false } = {}) {
    state = 'menu';
    menuBehind = 'room';
    const next = nextAfter(roomId);
    const subtitle = r.scored
      ? `◇ ${r.reflects} / ${r.par}   ✕ ${r.deaths}${r.underPar ? '   ★ under par' : ''}${r.change.medalUp && !r.change.firstClear ? '   ▲' : ''}`
      : undefined;
    showScreen('results', {
      title: r.scored ? `${MEDAL_GLYPH[r.medal]} ${MEDAL_NAME[r.medal]}` : '✓',
      subtitle,
      choices: [
        { id: 'next', label: !next ? 'Map' : next.examiner !== undefined ? 'Next  ⬢' : 'Next' },
        { id: 'retry', label: 'Retry' },
        ...(ROOM_BY_ID[roomId].solution && r.scored ? [{ id: 'watch', label: 'Watch solution' }] : []),
        ...(next ? [{ id: 'map', label: 'Map' }] : []),
        ...(run && run.segments.length ? [{ id: 'export-run', label: `Export run ${formatTime(runTotal)}` }] : []),
      ],
    }, { guard });
  }

  function showExaminerResults(ci) {
    state = 'menu';
    menuBehind = 'room';
    const next = CHAPTERS[ci + 1] && chapterOpen(ci + 1) ? CHAPTERS[ci + 1] : null;
    showScreen('results', {
      title: '⬢',
      subtitle: undefined,
      choices: [
        ...(next ? [{ id: 'next-chapter', label: next.name }] : []),
        { id: 'map', label: 'Map' },
      ],
    }, { guard: false });
  }

  // ── UI handlers ──
  async function onActivate(screen, choice) {
    startAudio();
    const s = save.data.settings, a = save.data.assists;
    if (screen === 'title') {
      if (choice === 'play') {
        if (!save.room(CHAPTERS[0].rooms[0])) enterRoom(CHAPTERS[0].rooms[0]); // first boot: straight into the prologue
        else showChapters();
      } else if (choice === 'settings') showSettings('title');
      else if (choice === 'credits') showScreen('credits', {
        title: 'REFLECT / DODGE',
        subtitle: 'Mike · built with Claude Code · SLU Web Shell · Living Loop engine',
        choices: [],
        backTarget: 'title',
      });
    } else if (screen === 'chapters') {
      showMap(CHAPTERS.findIndex((c) => c.id === choice));
    } else if (screen === 'pause') {
      if (choice === 'resume') resume();
      else if (choice === 'reset') { resetRoom(); resume(); }
      else if (choice === 'hint') { if (session.useHint()) { save.recordHint(roomId); telemetry.hint(roomId); } resume(); }
      else if (choice === 'assists') showAssists();
      else if (choice === 'settings') showSettings('pause');
      else if (choice === 'map') { leaveRoom(); showMap(chapterIdx); }
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
      else if (choice === 'music') s.musicVol = VOLUMES[(VOLUMES.indexOf(s.musicVol) + 1) % VOLUMES.length] ?? 1;
      else if (choice === 'offset-up') s.audioOffsetMs = Math.min(OFFSET.MAX, s.audioOffsetMs + OFFSET.STEP);
      else if (choice === 'offset-down') s.audioOffsetMs = Math.max(OFFSET.MIN, s.audioOffsetMs - OFFSET.STEP);
      else if (choice === 'contrast') s.highContrast = !s.highContrast;
      else if (choice === 'flashing') s.reducedFlashing = !s.reducedFlashing;
      else if (choice === 'shake') s.shake = !s.shake;
      else if (choice === 'telemetry') s.telemetry = !s.telemetry;
      else if (choice === 'speedrun') { s.speedrunTimer = !s.speedrunTimer; if (!s.speedrunTimer) endRun(); }
      else if (choice === 'export') telemetry.export();
      else if (choice === 'fullscreen') {
        try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* unsupported */ }
      }
      save.save();
      applySettings();
      showSettings();
    } else if (screen === 'results') {
      if (choice === 'next') goNext(nextAfter(roomId));
      else if (choice === 'next-chapter') showMap(chapterIdx + 1, { guard: false });
      else if (choice === 'retry') enterRoom(roomId);
      else if (choice === 'watch') { endRun(); enterRoom(roomId, { replay: true }); }
      else if (choice === 'export-run') downloadRun(run || lastRun);
      else if (choice === 'map') showMap(chapterIdx);
    }
  }

  function onBack(screen) {
    if (screen === 'chapters') showTitle();
        else if (screen === 'pause') resume();
    else if (screen === 'credits') showTitle();
    else if (screen === 'assists') showPause2();
    else if (screen === 'settings') { if (settingsBack === 'pause') showPause2(); else showTitle(); }
    else if (screen === 'results') showMap(chapterIdx);
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
      startAudio();
      if (state === 'intro') { state = 'play'; return; }
      if (state === 'replay') {
        if (k === 'escape' || k === 'enter' || k === 'r') showResults(resultsFor, { guard: true });
        return;
      }
      // quick reset from the menus over a room: R on pause resets and resumes,
      // R on results retries
      if (state === 'menu' && k === 'r') {
        if (current === 'pause' && pauseFrom === 'play') { resetRoom(); resume(); }
        else if (current === 'results' && !encounter) enterRoom(roomId);
        return;
      }
      if (state !== 'play') return;
      // a clear is final: during the clear glow, reset / pause can't undo it
      if (session.state.status === 'clear') return;
      if (k === 'escape' || k === 'p') showPause();
      else if (k === 'r') resetRoom();
      else if (k === 'h' && session.hintAvailable(msInRoom)) { if (session.useHint()) { save.recordHint(roomId); telemetry.hint(roomId); } }
    },
  });
  addEventListener('pointerdown', () => startAudio(), { once: true });

  function resetRoom() {
    session.reset();
    telemetry.attempt(roomId);
    const pr = prompts.find((q) => q.id === 'reset');
    if (pr) pr.used = true;
    markPromptSeen('reset');
  }
  function markPromptSeen(id) {
    const seen = save.data.seenPrompts || (save.data.seenPrompts = []);
    if (!seen.includes(id)) { seen.push(id); save.save(); }
  }

  // ── loop ──
  const loop = createLoop({
    update: (dt, real) => {
      time += dt;
      if (collapseUntil && performance.now() > collapseUntil) { collapseUntil = 0; applyAssists(); }
      if (state === 'title' || (state === 'menu' && menuBehind === 'title')) { demo.tick(0); setMusicLayers(0); return; }
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
      for (const pr of prompts) {
        const hit = pr.id === 'move' ? mask & (BTN.L | BTN.R) : pr.id === 'jump' ? mask & BTN.JUMP : pr.id === 'reflect' ? session.state.stats.reflects > 0 : 0;
        if (hit && !pr.used) { pr.used = true; markPromptSeen(pr.id); }
        if (pr.used) pr.alpha = Math.max(0, pr.alpha - real * 1.5);
      }
      if (state === 'play') { msInRoom += real * 1000; save.addPlayTime(real * 1000); }
      session.tick(mask);
      // the reset prompt: shown once a room has cost a few deaths, until reset is first used
      if (state === 'play' && session.deaths >= RESET_PROMPT_DEATHS && !prompts.some((q) => q.id === 'reset')
        && !(save.data.seenPrompts || []).includes('reset')) prompts.push({ id: 'reset', alpha: 1, used: false });
      setMusicLayers(session.state.objects.filter((o) => o.kind === 'emitter' && o.on && !(o.count && o.fired >= o.count)).length);
      schedulePredictedShots();
    },
    render: (alpha) => {
      // a menu over a room shows a frozen frame: draw it once, not every frame
      if (state === 'menu' && menuBehind === 'room') { if (frozenDrawn) return; frozenDrawn = true; } else frozenDrawn = false;
      const s = save.data.settings;
      const ci = state === 'title' || (state === 'menu' && menuBehind === 'title') ? (demo.room ? chapterOfAny(demo.room.id) : 0) : chapterIdx;
      const view = {
        theme: chapterTheme(ci, s.highContrast),
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
        hud: state === 'menu' ? false : {
          par: sc && !encounter ? session.room.par : null,
          hint: state === 'play' && session.hintAvailable(msInRoom),
          phase: encounter ? { i: encounter.phase, n: CHAPTERS[encounter.ci].examiner.length } : null,
          timer: s.speedrunTimer && state !== 'replay' ? speedrunHud() : null,
        },
        preview: state === 'play' && save.data.assists.preview && (lastMask & BTN.REFLECT) ? { mask: lastMask } : null,
        ghost: session.ghost ? session.ghost.state : null,
        ...view,
      });
      if (prompts.length && (state === 'play' || state === 'intro')) {
        const p = session.state.player;
        drawPrompts(ctx, prompts, document.body.dataset.input, { x: p.x, y: p.y }, 1, view.theme);
      }
      if (state === 'intro') drawIntro(ctx, ROOM_BY_ID[roomId], sc, introT);
      if (state === 'replay') drawReplayBadge(ctx, time);
    },
  });

  // room time this visit (every attempt) and the run so far, in sim frames
  function speedrunHud() {
    let roomF = session.log.length;
    for (const a of session.attempts) roomF += decodeLog(a).length;
    return { room: formatTime(roomF), run: run ? formatTime(runTotal + (session.state.status === 'clear' ? 0 : roomF)) : null };
  }

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
    enterEncounter,
    showTitle,
    get encounter() { return encounter; },
    solutionOf: (id) => decodeLog(ROOM_BY_ID[id].solution),
    get run() { return run || lastRun; },
    get mapFocus() { return map.active ? map.focused && map.focused.id : null; },
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
  ctx.font = f('display', 600, 28);
  ctx.fillText((data.name || data.id).toUpperCase(), ROOM.W / 2, ROOM.H / 2 - (scored ? 10 : 0));
  if (scored) {
    ctx.font = f('mono', 800, 18);
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
