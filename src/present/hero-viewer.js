// ?hero=1 — the hero's poses on a loop, at game size and zoomed, for review
// without playing. Dev only; drives the same heroPose / drawHero as the game.
import { ROOM } from '../../config/tunables.js';
import { chapterTheme } from './theme.js';
import { heroPose, drawHero } from './hero.js';
import { f } from './brand.js';

export function startHeroViewer(ctx) {
  const theme = chapterTheme(1);
  const t0 = performance.now();
  const CLIPS = [
    ['idle', (t) => ({ p: { grounded: true, vy: 0 }, moving: false })],
    ['run', (t) => ({ p: { grounded: true, vy: 0 }, moving: true, stride: Math.sin(t * 9) })],
    ['rise', () => ({ p: { grounded: false, vy: -1 } })],
    ['fall', () => ({ p: { grounded: false, vy: 1 } })],
    ['reflect →', (t) => ({ p: { grounded: true, vy: 0 }, reflect: { dir: 'right', t: t % 0.6 } })],
    ['reflect ↑', (t) => ({ p: { grounded: true, vy: 0 }, reflect: { dir: 'up', t: t % 0.6 } })],
    ['reflect ↓', (t) => ({ p: { grounded: true, vy: 0 }, reflect: { dir: 'down', t: t % 0.6 } })],
    ['neutral', (t) => ({ p: { grounded: true, vy: 0 }, reflect: { dir: 'neutral', t: t % 0.6 } })],
  ];
  const frame = () => {
    const t = (performance.now() - t0) / 1000;
    ctx.fillStyle = '#090b11'; ctx.fillRect(0, 0, ROOM.W, ROOM.H);
    ctx.font = f('display', 600, 18); ctx.fillStyle = '#efe7d8'; ctx.textAlign = 'left';
    ctx.fillText('HERO · POSES', 24, 34);
    CLIPS.forEach(([name, fn], i) => {
      const c = fn(t), x = 40 + (i % 4) * 230, y = 70 + Math.floor(i / 4) * 230;
      const pose = heroPose(c.p, !!c.moving, c.stride || 0, c.reflect && c.reflect.t < 0.3 ? c.reflect : null);
      const dir = pose.dir === 'left' ? -1 : 1;
      ctx.save(); ctx.translate(x + 60, y + 30); ctx.scale(7, 7); drawHero(ctx, 0, 0, dir, pose, theme); ctx.restore();
      drawHero(ctx, x + 180, y + 168, dir, pose, theme); // true game size
      ctx.strokeStyle = 'rgba(111,211,193,.7)'; ctx.beginPath(); ctx.moveTo(x, y + 190); ctx.lineTo(x + 210, y + 190); ctx.stroke();
      ctx.font = f('ui', 700, 13); ctx.fillStyle = 'rgba(232,244,255,.7)'; ctx.fillText(name, x, y + 210);
    });
    requestAnimationFrame(frame);
  };
  frame();
}
