#!/usr/bin/env node
// Screenshots of rooms mid-solution, for reviewing visuals without playing.
//   node tools/screenshot.mjs '[["p0-02", 728, "p0-02-reflect"]]'   → test-results/p0-02-reflect.png
import { mkdirSync } from 'node:fs';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

await build({ logLevel: 'error' });
const server = await preview({ preview: { port: 4399 }, logLevel: 'error' });
const url = server.resolvedUrls.local[0];
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url);
await page.waitForFunction(() => window.__RD && window.__RD.session);
const shots = JSON.parse(process.argv[2] || '[]');
mkdirSync('test-results', { recursive: true });
for (const [id, f, name] of shots) {
  await page.evaluate(([i, fr]) => window.__RD.seek(i, fr), [id, f]);
  await page.waitForTimeout(30);
  await page.screenshot({ path: `test-results/${name}.png` });
}
await page.goto(url + '?edit=1'); await page.waitForTimeout(400);
await page.screenshot({ path: `test-results/editor.png` });
await b.close(); server.httpServer.close();
