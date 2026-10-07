// Stage scenery (docs/ART.md: Stages): the architecture behind a room, in the
// look of the chapter title cards (docs/art-ref/title-card-ch*.jpg). Two
// parallax layers, built once per room from a seed of the room id, so every
// room differs and always looks the same:
//   far  — the chapter's set piece and diagram, and a skyline, deep in fog
//          answer: a great target ring · weight: diagonal beams, a hanging cube
//          ground: vines on the skyline · echo: a central orb ring, thin pillars
//   mid  — stepped blocks rising at the room's edges, softly out of focus
// Guardrails (readability first): no arches or frames (they read as exits),
// no gameplay colours (accent only), and every line stays far dimmer than the
// room's own tile edges. Pure presentation; nothing here is collision.
import { ROOM } from '../../config/tunables.js';

export const MARGIN = 140; // px of layer beyond each room edge, for parallax travel
export const DEPTH = { far: 0.35, mid: 0.7 }; // 1 = moves with the room, 0 = fixed to the screen
const W = ROOM.W + 2 * MARGIN, H = ROOM.H + 2 * MARGIN;

function rng(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Per chapter: what the far layer carries and how the skyline is shaped.
const STAGE = {
  answer: { ring: [180, 240], rings: 2, sky: [0.25, 0.75], width: [40, 90], caps: 0.35, axes: [4, 6] },
  weight: { ring: [90, 120], rings: 1, sky: [0.14, 0.4], width: [80, 150], caps: 0.15, axes: [2, 3], beams: true },
  ground: { ring: [110, 180], rings: 1, sky: [0.22, 0.72], width: [40, 120], caps: 0.3, axes: [3, 5], vines: true },
  echo: { ring: [130, 160], rings: 0, sky: [0.3, 0.8], width: [18, 44], caps: 0.2, axes: [2, 4], orb: true },
};

// A block in the card style: dark body, a thin top face seen from just above,
// a lit rim, faint side edges and recessed panels.
function block(g, x, y, w, h, acc, k, r) {
  const body = g.createLinearGradient(0, y, 0, y + h);
  body.addColorStop(0, '#131a22'); body.addColorStop(1, '#090c12');
  g.fillStyle = body; g.fillRect(x, y, w, h);
  g.fillStyle = rgba(acc, 0.035 * k); g.fillRect(x, y, w, h); // faces tinted by the chapter light
  g.fillStyle = rgba(acc, 0.1 * k);
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y - 5); g.lineTo(x + w + 6, y - 5); g.lineTo(x + w, y); g.closePath(); g.fill();
  g.fillStyle = rgba(acc, 0.08 * k); g.fillRect(x + w, y, 6, h); // the side face catches a little light
  g.save(); g.shadowColor = acc; g.shadowBlur = 6 * k;
  g.fillStyle = rgba(acc, 0.36 * k); g.fillRect(x, y - 1, w, 1.5);
  g.restore();
  g.fillStyle = rgba(acc, 0.16 * k); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
  if (w > 50 && h > 70) {
    g.strokeStyle = rgba(acc, 0.05 * k); g.lineWidth = 1;
    const n = Math.max(1, Math.floor(w / 46));
    for (let i = 0; i < n; i++) {
      const pw = (w - 16) / n;
      g.strokeRect(x + 8 + i * pw + 3, y + 14 + r() * 10, pw - 6, Math.min(h - 40, 60 + r() * 120));
    }
  }
}

function ring(g, cx, cy, R, acc, k) {
  g.save();
  g.strokeStyle = rgba(acc, 0.17 * k); g.lineWidth = 1.2;
  for (const [f, dash, a] of [[0.25, null, 0.16], [0.55, null, 0.1], [1, null, 0.12], [1.28, [3, 6], 0.08]]) {
    g.globalAlpha = a / 0.12;
    g.setLineDash(dash || []);
    g.beginPath(); g.arc(cx, cy, R * f, 0, Math.PI * 2); g.stroke();
  }
  g.setLineDash([]);
  g.globalAlpha = 0.7;
  g.beginPath(); g.moveTo(cx - R * 1.45, cy); g.lineTo(cx + R * 1.45, cy); g.moveTo(cx, cy - R * 1.45); g.lineTo(cx, cy + R * 1.45); g.stroke();
  g.globalAlpha = 1;
  g.fillStyle = rgba(acc, 0.35 * k);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.arc(cx + dx * R, cy + dy * R, 2.6, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
  g.strokeStyle = rgba(acc, 0.3 * k);
  g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.stroke();
  g.restore();
}

function axis(g, x, y0, y1, acc, k, r) {
  g.save();
  g.strokeStyle = rgba(acc, 0.2 * k); g.lineWidth = 1; g.setLineDash([3, 5]);
  g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
  g.setLineDash([]);
  g.fillStyle = rgba(acc, 0.3 * k);
  for (let y = y0 + 30 + r() * 40; y < y1 - 20; y += 60 + r() * 70) { g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = rgba(acc, 0.28 * k); g.lineWidth = 1.2;
  g.beginPath(); g.arc(x, y1, 5, 0, Math.PI * 2); g.stroke();
  g.restore();
}

// A vine: one smooth, gently swaying stem with pointed leaves on alternating
// sides (the cards' vines are long easy curves, not zigzags).
export function vine(g, x, y, len, dir, acc, alpha, r) {
  const sway = (r() - 0.5) * Math.min(14, len * 0.35);
  const x1 = x + sway * 0.6, y1 = y + dir * len;
  const c1x = x + sway, c1y = y + dir * len * 0.35, c2x = x - sway * 0.5, c2y = y + dir * len * 0.7;
  const at = (t) => {
    const u = 1 - t;
    return [u * u * u * x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1, u * u * u * y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1];
  };
  g.save();
  g.strokeStyle = rgba(acc, alpha * 0.75); g.fillStyle = rgba(acc, alpha);
  g.shadowColor = acc; g.shadowBlur = 3; // leaves glow a little, as on the card
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(c1x, c1y, c2x, c2y, x1, y1); g.stroke();
  const n = Math.max(1, Math.floor(len / 9));
  for (let i = 1; i <= n; i++) {
    if (r() < 0.25) continue;
    const [lx, ly] = at(i / (n + 0.5)), side = i % 2 ? 1 : -1;
    g.save(); g.translate(lx, ly); g.rotate(side * 0.9 * dir);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(side * 2.5, -1.6, side * 5, 0); g.quadraticCurveTo(side * 2.5, 1.6, 0, 0); g.fill();
    g.restore();
  }
  g.restore();
}

// Weight: a great beam crossing the sky, lit along its top
function beam(g, y0, slope, t, acc) {
  g.save();
  const pts = [[-40, y0], [W + 40, y0 + slope * (W + 80)], [W + 40, y0 + slope * (W + 80) + t], [-40, y0 + t]];
  const body = g.createLinearGradient(0, y0, 0, y0 + t + slope * W);
  body.addColorStop(0, '#18202c'); body.addColorStop(1, '#0d121a');
  g.fillStyle = body;
  g.beginPath(); pts.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y)); g.closePath(); g.fill();
  g.fillStyle = rgba(acc, 0.05);
  g.beginPath(); g.moveTo(-40, y0); g.lineTo(W + 40, y0 + slope * (W + 80)); g.lineTo(W + 40, y0 + slope * (W + 80) - 10); g.lineTo(-40, y0 - 10); g.closePath(); g.fill();
  g.shadowColor = acc; g.shadowBlur = 6;
  g.strokeStyle = rgba(acc, 0.38); g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(-40, y0); g.lineTo(W + 40, y0 + slope * (W + 80)); g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = rgba(acc, 0.14); g.lineWidth = 1;
  g.beginPath(); g.moveTo(-40, y0 + t); g.lineTo(W + 40, y0 + t + slope * (W + 80)); g.stroke();
  g.restore();
}

// Weight: a heavy cube hanging on a line from the dark (far bigger than an
// Anchor, and in fog, so it never reads as one)
function cube(g, x, y, s, acc) {
  g.save();
  g.strokeStyle = rgba(acc, 0.22); g.lineWidth = 1;
  g.beginPath(); g.moveTo(x + s / 2, 0); g.lineTo(x + s / 2, y - s * 0.25); g.stroke();
  g.fillStyle = rgba(acc, 0.35); g.beginPath(); g.arc(x + s / 2, y - s * 0.6, 4, 0, Math.PI * 2); g.fill();
  const d = s * 0.32;
  g.fillStyle = '#2a3445'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + d, y - d * 0.75); g.lineTo(x + s + d, y - d * 0.75); g.lineTo(x + s, y); g.closePath(); g.fill();
  g.fillStyle = '#1a2230'; g.beginPath(); g.moveTo(x + s, y); g.lineTo(x + s + d, y - d * 0.75); g.lineTo(x + s + d, y + s - d * 0.75); g.lineTo(x + s, y + s); g.closePath(); g.fill();
  g.fillStyle = '#222b3a'; g.fillRect(x, y, s, s);
  g.shadowColor = acc; g.shadowBlur = 5;
  g.strokeStyle = rgba(acc, 0.4); g.lineWidth = 1.2;
  g.strokeRect(x, y, s, s);
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + d, y - d * 0.75); g.lineTo(x + s + d, y - d * 0.75); g.lineTo(x + s + d, y + s - d * 0.75); g.lineTo(x + s, y + s); g.moveTo(x + s, y); g.lineTo(x + s + d, y - d * 0.75); g.stroke();
  g.restore();
}

// Echo: a glowing orb held in rings at the centre, on a full-height axis
function orbRing(g, cx, cy, R, acc) {
  ring(g, cx, cy, R, acc, 1.2);
  g.save();
  g.strokeStyle = rgba(acc, 0.22); g.setLineDash([3, 5]);
  g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, H); g.stroke();
  g.setLineDash([]);
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, 34);
  glow.addColorStop(0, rgba(acc, 0.55)); glow.addColorStop(0.35, rgba(acc, 0.2)); glow.addColorStop(1, rgba(acc, 0));
  g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = rgba(acc, 0.6); g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fill();
  g.restore();
}

function farLayer(room, acc, stage) {
  const S = STAGE[stage];
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = rng(`${room.id}:far`);
  const span = ([a, b]) => a + r() * (b - a);
  // the diagram: ring clusters, dashed axes from the top
  if (S.orb) orbRing(g, W / 2, H * 0.36, span(S.ring), acc);
  for (let i = 0; i < S.rings; i++) ring(g, W * (0.2 + r() * 0.6), H * (0.24 + r() * 0.2), span(S.ring) * (i ? 0.55 : 1), acc, 1);
  for (let i = 0, n = Math.round(span(S.axes)); i < n; i++) axis(g, MARGIN + r() * ROOM.W, 0, H * (0.3 + r() * 0.4), acc, 1, r);
  if (S.beams) {
    beam(g, H * (0.12 + r() * 0.1), 0.32 + r() * 0.1, 70 + r() * 30, acc);
    beam(g, H * (0.02 + r() * 0.06), 0.36 + r() * 0.08, 50 + r() * 20, acc);
    cube(g, W * (0.45 + r() * 0.25), H * (0.18 + r() * 0.08), 72 + r() * 20, acc);
  }
  // skyline (echo: thin pillars in near-mirrored pairs about the centre axis)
  if (S.orb) {
    for (let i = 0; i < 7; i++) {
      const w = span(S.width), h = H * span(S.sky), dx = 80 + i * (60 + r() * 50);
      for (const sgn of [-1, 1]) block(g, W / 2 + sgn * dx - w / 2, H - h * (0.92 + r() * 0.16), w, h, acc, 0.75, r);
    }
  } else {
    for (let x = -20; x < W;) {
      const w = span(S.width), h = H * span(S.sky);
      block(g, x, H - h, w, h, acc, 0.75, r);
      if (r() < S.caps) block(g, x - 6, H - h - 12, w + 12, 12, acc, 0.75, r); // a capped pillar
      if (S.vines && r() < 0.5) for (let v = 0; v < 2; v++) vine(g, x + 4 + r() * (w - 8), H - h, 20 + r() * 60, 1, acc, 0.3, r);
      x += w + (r() < 0.4 ? r() * 30 : 0);
    }
  }
  // fog: the far layer sinks into the dark
  const fog = g.createLinearGradient(0, H * 0.35, 0, H);
  fog.addColorStop(0, 'rgba(7,8,13,0.2)'); fog.addColorStop(1, rgba(acc, 0.08));
  g.fillStyle = fog; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(7,8,13,0.22)'; g.fillRect(0, 0, W, H);
  return c;
}

function midLayer(room, acc, stage) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const r = rng(`${room.id}:mid`);
  if ('filter' in g) g.filter = 'blur(0.8px)'; // out of focus: depth, and never mistaken for a ledge
  // stepped blocks rising toward each edge, like the cards' stairs
  for (const side of [-1, 1]) {
    let x = side < 0 ? 0 : W, h = H * (0.42 + r() * 0.12);
    for (let i = 0, n = 2 + Math.floor(r() * 3); i < n; i++) {
      const w = (stage === 'weight' ? 90 : 60) + r() * 70;
      const bx = side < 0 ? x : x - w;
      block(g, bx, H - h, w, h, acc, 1, r);
      if (STAGE[stage].vines) {
        for (let v = 0; v < 3; v++) vine(g, bx + 4 + r() * (w - 8), H - h, 14 + r() * 50, 1, acc, 0.42, r);
        if (r() < 0.6) vine(g, bx + (r() < 0.5 ? 3 : w - 3), H - 4, 30 + r() * 70, -1, acc, 0.38, r);
      }
      x += side * w;
      h *= 0.62 + r() * 0.2;
      if (h < 60) break;
    }
  }
  g.filter = 'none';
  const fog = g.createLinearGradient(0, H * 0.6, 0, H);
  fog.addColorStop(0, 'rgba(0,0,0,0)'); fog.addColorStop(0.6, rgba(acc, 0.05)); fog.addColorStop(1, rgba(acc, 0.16));
  g.fillStyle = fog; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(7,8,13,0.08)'; g.fillRect(0, 0, W, H);
  return c;
}

let cache = null;
export function scenery(room, theme) {
  if (!theme.stage || !STAGE[theme.stage]) return null;
  if (!cache || cache.room !== room || cache.theme !== theme) {
    cache = { room, theme, far: farLayer(room, theme.accent, theme.stage), mid: midLayer(room, theme.accent, theme.stage) };
  }
  return cache;
}

// Draw a layer in room space, shifted against the camera by its depth.
export function drawLayer(ctx, layer, depth, camera) {
  const ox = camera ? (camera.x - ROOM.W / 2) * (1 - depth) : 0;
  const oy = camera ? (camera.y - ROOM.H / 2) * (1 - depth) : 0;
  ctx.drawImage(layer, -MARGIN + ox, -MARGIN + oy);
}
