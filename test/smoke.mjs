// Browser smoke: build → preview → drive the real game in Chromium.
// Reads state through the window.__RD hook.
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

    await page.goto(url);
    await page.waitForFunction(() => window.__RD && window.__RD.session && window.__RD.session.state);
    await page.waitForTimeout(400);

    const bright = await page.evaluate(() => {
      const c = document.getElementById('c');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 300) n++;
      return n;
    });
    check(bright > 200, 'boots and renders', `${bright} bright pixels`);

    const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__RD.session.state)));
    const s0 = await st();
    check(s0.player.grounded, 'gravity: player lands at spawn');

    await page.keyboard.down('d');
    await page.waitForTimeout(400);
    await page.keyboard.up('d');
    const s1 = await st();
    check(s1.player.x - s0.player.x > 40, 'input: holding D runs right', `${(s1.player.x - s0.player.x).toFixed(1)} px`);

    await page.keyboard.down(' ');
    await page.waitForTimeout(120);
    const s2 = await st();
    await page.keyboard.up(' ');
    check(s2.player.vy < 0 || !s2.player.grounded, 'input: Space jumps');

    await page.waitForTimeout(500);
    await page.keyboard.press('j');
    await page.waitForTimeout(30);
    const s3 = await st();
    check(s3.reflect.window > 0 || s3.reflect.cooldown > 0, 'input: J opens the reflect window');

    await page.keyboard.press('r');
    await page.waitForTimeout(50);
    const s4 = await st();
    check(s4.tick < 30, 'R resets the room instantly', `tick ${s4.tick}`);

    await page.waitForTimeout(1500);
    const fps = await page.evaluate(() => window.__RD.fps);
    check(fps >= 50, 'frame rate ≈ 60', `${fps} fps`);

    // cross-runtime determinism: Chromium's replay must hash identically to Node's
    const ids = await page.evaluate(() => window.__RD.rooms);
    for (const id of ids) {
      if (!nodeHashes[id]) continue;
      const json = await page.evaluate((i) => window.__RD.replay(i), id);
      const h = hash(json);
      check(h === nodeHashes[id], `${id}: Chromium replay == Node replay`, h);
    }

    // each stored solution, fed through the live game session, clears its room
    for (const id of ids) {
      const status = await page.evaluate((i) => { window.__RD.seek(i, 1e6); return window.__RD.session.state.status; }, id);
      check(status === 'clear', `${id}: solution clears through the live session`, status);
    }
    await page.evaluate(() => window.__RD.go(0));
    await page.screenshot({ path: 'test-results/game.png' }).catch(() => {});

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
    const editMode = await page.evaluate(() => window.__RD.mode);
    check(playMode === 'play' && editMode === 'edit', 'editor: P toggles play-in-editor');
    await page.screenshot({ path: 'test-results/editor.png' }).catch(() => {});

    check(errors.length === 0, 'zero console errors', errors.join(' | '));
  } finally {
    await browser.close();
    await new Promise((r) => server.httpServer.close(r));
  }
  return results;
}
