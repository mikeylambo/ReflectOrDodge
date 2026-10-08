import { ROOM } from '../config/tunables.js';

const canvas = document.getElementById('c');
// capture mode (?capture=1) renders at 2× so screenshots are 1920×1080 on any screen
const dpr = new URLSearchParams(location.search).get('capture') === '1' ? 2 : Math.min(window.devicePixelRatio || 1, 2);
canvas.width = ROOM.W * dpr;
canvas.height = ROOM.H * dpr;
const ctx = canvas.getContext('2d');
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

// the editor is a dev/production tool; the demo build doesn't ship it
if (new URLSearchParams(location.search).get('hero') === '1' && import.meta.env.MODE !== 'demo') {
  import('./present/hero-viewer.js').then((m) => m.startHeroViewer(ctx));
} else if (new URLSearchParams(location.search).get('edit') === '1' && import.meta.env.MODE !== 'demo') {
  import('./editor/editor.js').then((m) => m.startEditor(canvas, ctx));
} else {
  import('./shell/app.js').then((m) => m.startApp(canvas, ctx));
}
