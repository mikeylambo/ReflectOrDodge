// Browser smoke: build → preview → drive the real game in Chromium.
// Reads state through the window.__RD hook and the Web Shell's DOM screens.
import { build, preview } from 'vite';
import { chromium } from 'playwright';

export async function runBrowser(nodeHashes, hash) {
  const results = [];
  const check = (ok, label, detail = '') => results.push([!!ok, label, detail]);

  await build({ logLevel: 'error' });
  const server = await preview({ preview: { port: 4317, strictPort: false }, logLevel: 'error' });
  const url = server.resolvedUrls.local[0];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const screen = () => page.evaluate(() => { const el = document.querySelector('#ui:not([hidden]) .slu-screen'); return el ? el.dataset.screenId : null; });
    const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__RD.session.state)));
    const appState = () => page.evaluate(() => window.__RD.state);

    await page.goto(url);
    await page.waitForFunction(() => window.__RD && window.__RD.state === 'title');
    await page.waitForTimeout(500);
    check(await screen() === 'title', 'boots to the title screen (Web Shell UI)');
    const bright = await page.evaluate(() => {
      const c = document.getElementById('c');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 300) n++;
      return n;
    });
    check(bright > 200, 'title demo renders behind the menu', `${bright} bright pixels`);

    // first boot: Play goes straight into the prologue
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const s0state = await appState();
    check(s0state === 'intro' || s0state === 'play', 'Play on first boot enters the first room', s0state);
    await page.keyboard.press('k'); // skip intro (reflect key; swallowed)
    await page.waitForTimeout(150);
    check(await appState() === 'play', 'any button skips the room intro');

    const a = await st();
    check(a.player.grounded, 'gravity: player lands at spawn');
    await page.keyboard.down('d');
    await page.waitForTimeout(400);
    await page.keyboard.up('d');
    const b = await st();
    check(b.player.x - a.player.x > 40, 'input: holding D runs right', `${(b.player.x - a.player.x).toFixed(1)} px`);
    await page.keyboard.down(' ');
    await page.waitForTimeout(120);
    const c = await st();
    await page.keyboard.up(' ');
    check(c.player.vy < 0 || !c.player.grounded, 'input: Space jumps');
    await page.waitForTimeout(500);
    await page.keyboard.press('j');
    await page.waitForTimeout(30);
    const d = await st();
    check(d.reflect.window > 0 || d.reflect.cooldown > 0, 'input: J opens the reflect window');
    await page.keyboard.press('r');
    await page.waitForTimeout(50);
    check((await st()).tick < 30, 'R resets the room instantly');

    // pause menu and back
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    check(await screen() === 'pause', 'Esc opens the pause menu');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    check(await appState() === 'play' && await screen() === null, 'Esc again resumes');

    await page.waitForTimeout(1200);
    const fps = await page.evaluate(() => window.__RD.fps);
    check(fps >= 50, 'frame rate ≈ 60 in a room', `${fps} fps`);

    // cross-runtime determinism + each solution clears through the live session
    const ids = await page.evaluate(() => window.__RD.rooms);
    for (const id of ids) {
      if (!nodeHashes[id]) continue;
      const h = hash(await page.evaluate((i) => window.__RD.replay(i), id));
      check(h === nodeHashes[id], `${id}: Chromium replay == Node replay`, h);
    }
    let allClear = true;
    for (const id of ids) {
      const status = await page.evaluate((i) => { window.__RD.seek(i, 1e6); return window.__RD.session.state.status; }, id);
      if (status !== 'clear') { allClear = false; check(false, `${id}: solution clears through the live session`, status); }
    }
    check(allClear, `all ${ids.length} solutions clear through the live session`);

    // results screen appears after the clear hold, and the save records it
    const target = ids.find((i) => i.startsWith('c1-')) || ids[0];
    await page.evaluate((i) => window.__RD.seek(i, 1e6), target);
    await page.waitForTimeout(1100);
    check(await screen() === 'results', 'a clear leads to the results screen', await screen());
    const rec = await page.evaluate((i) => window.__RD.save.rooms[i], target);
    check(rec && rec.cleared && rec.medal >= 1, 'the clear is saved with a medal', JSON.stringify(rec));
    await page.screenshot({ path: 'test-results/results.png' }).catch(() => {});

    // watch solution from results → replay mode → back to results
    const choices = await page.evaluate(() => [...document.querySelectorAll('[data-choice-id]')].map((b) => b.dataset.choiceId));
    if (choices.includes('watch')) {
      await page.click('[data-choice-id="watch"]');
      await page.waitForTimeout(200);
      check(await appState() === 'replay', 'Watch solution replays the designer run');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      check(await screen() === 'results', 'leaving the replay returns to results');
    }

    // assists: pause → assists → toggle preview; speed assist slows the sim
    await page.evaluate((i) => window.__RD.enterRoom(i), target);
    await page.keyboard.press('k');
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await page.click('[data-choice-id="assists"]');
    await page.waitForTimeout(250); // past the 180 ms guard on a freshly opened screen
    check(await screen() === 'assists', 'pause → assists screen');
    await page.click('[data-choice-id="preview"]');
    await page.click('[data-choice-id="speed"]');
    await page.waitForTimeout(100);
    const as = await page.evaluate(() => window.__RD.save.assists);
    check(as.preview === true && as.speed === 0.75, 'assist toggles are saved', JSON.stringify(as));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const t0 = (await st()).tick;
    await page.waitForTimeout(1000);
    const t1 = (await st()).tick;
    check(t1 - t0 > 70 && t1 - t0 < 105, 'game speed 75% → ~90 sim steps per real second', `${t1 - t0} steps`);
    await page.evaluate(() => { const a = window.__RD.save.assists; a.speed = 1; a.preview = false; });

    // hint: unlocked after 10 deaths, plays a ghost
    await page.evaluate(() => { window.__RD.session.deaths = 10; });
    await page.keyboard.press('h');
    await page.waitForTimeout(100);
    const ghost = await page.evaluate(() => !!window.__RD.session.ghost);
    check(ghost, 'after 10 deaths, H plays the hint ghost');
    await page.screenshot({ path: 'test-results/hint.png' }).catch(() => {});

    // persistence survives a reload (SaveManager envelope in localStorage)
    await page.reload();
    await page.waitForFunction(() => window.__RD && window.__RD.state === 'title');
    const rec2 = await page.evaluate((i) => window.__RD.save.rooms[i], target);
    check(rec2 && rec2.cleared, 'save persists across reload', JSON.stringify(rec2));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    check(await screen() === 'chapters', 'returning players land on the chapter list', await screen());
    await page.screenshot({ path: 'test-results/chapters.png' }).catch(() => {});

    // chapter map: a node grid with 2D focus; Enter enters the focused room
    await page.keyboard.press('Enter'); // first chapter (Prologue)
    await page.waitForTimeout(250);
    const mapScreen = await page.evaluate(() => document.querySelector('.rd-map') ? 'map' : null);
    check(mapScreen === 'map', 'chapter list → node-grid map');
    const f0 = await page.evaluate(() => window.__RD.mapFocus);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(80);
    const f1 = await page.evaluate(() => window.__RD.mapFocus);
    check(f0 !== f1 && !!f1, 'map: arrow keys move focus between nodes', `${f0} → ${f1}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    check(await screen() === 'chapters', 'map: Back returns to the chapter list');
    await page.screenshot({ path: 'test-results/map.png' }).catch(() => {});

    // Examiner: clearing a phase goes straight into the next phase
    const ex = await page.evaluate(() => (window.__RD.chapters.find((c) => c.examiner) || {}).examiner || null);
    if (ex) {
      await page.evaluate(() => { const ci = window.__RD.chapters.findIndex((c) => c.examiner); window.__RD.enterEncounter(ci, 0); });
      const masks = await page.evaluate((id) => window.__RD.solutionOf(id), ex[0]);
      await page.evaluate((m) => { for (const x of m) window.__RD.session.tick(x); }, masks);
      await page.waitForTimeout(2000); // intro (0.8 s) + clear hold (0.6 s)
      const enc = await page.evaluate(() => window.__RD.encounter);
      check(enc && enc.phase === 1, 'Examiner: clearing phase 1 enters phase 2', JSON.stringify(enc));
    }

    // editor boots
    await page.goto(`${url}?edit=1`);
    await page.waitForFunction(() => window.__RD && window.__RD.editor);
    await page.waitForTimeout(300);
    const ed = await page.evaluate(() => ({ errors: window.__RD.errors, id: window.__RD.data.id }));
    check(ed.errors.length === 0, 'editor boots with a valid room', ed.id);
    await page.keyboard.press('p');
    await page.waitForTimeout(200);
    const playMode = await page.evaluate(() => window.__RD.mode);
    await page.keyboard.press('p');
    await page.waitForTimeout(50);
    check(playMode === 'play' && await page.evaluate(() => window.__RD.mode) === 'edit', 'editor: P toggles play-in-editor');

    check(errors.length === 0, 'zero console errors', errors.join(' | '));
  } finally {
    await browser.close();
    await new Promise((r) => server.httpServer.close(r));
  }
  return results;
}
