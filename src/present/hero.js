// The hero (docs/ART.md: Character): cuffed beanie, round glasses, pale warm
// body, drawn in code on the 14×22 collision box. Pure presentation — the
// collision stays the box.
//
// Poses are limb polylines in box units (facing right; mirrored for left),
// blended for the run cycle. The reflect is a frame-grab: the far hand
// touches the glasses at the temple, the lenses flash, and the near hand
// parries toward the aimed direction while the lenses glint that way.
// No pose ever crosses the face (the right half of the head).

// [hip→knee→foot] ×2 (back, front), [shoulder→elbow→hand] ×2 (back, front)
const P = {
  idle: { legs: [[6.4, 15.4, 6, 18.5, 5.8, 21.8], [7.6, 15.4, 8, 18.5, 8.2, 21.8]], arms: [[7, 9.8, 5.6, 12, 5.4, 14.2], [7, 9.8, 8.4, 12, 8.6, 14.2]], lean: 0 },
  runA: { legs: [[6.6, 15.4, 5, 18.2, 3.2, 20.6], [7.4, 15.4, 9.6, 17.4, 10.4, 21.8]], arms: [[7, 9.8, 5.2, 12.2, 4.2, 11], [7, 9.8, 9.2, 11.8, 10.6, 10.6]], lean: 8 },
  runB: { legs: [[6.6, 15.4, 8.6, 17.6, 9.6, 21.8], [7.4, 15.4, 6, 18.2, 4, 20.4]], arms: [[7, 9.8, 9, 11.8, 10.2, 10.8], [7, 9.8, 5.4, 12.2, 4.4, 11.2]], lean: 8 },
  rise: { legs: [[6.6, 15.4, 5.2, 17.6, 6.2, 19.8], [7.4, 15.4, 9.2, 17, 8.8, 19.6]], arms: [[7, 9.8, 4.2, 9.4, 2.6, 7.4], [7, 9.8, 10, 9.4, 11.6, 7.4]], lean: 0 },
  fall: { legs: [[6.6, 15.4, 5.6, 18.4, 5, 21.4], [7.4, 15.4, 8.6, 18, 9.4, 20.8]], arms: [[7, 9.8, 4, 10.6, 2.6, 9.6], [7, 9.8, 10, 10.6, 11.4, 9.6]], lean: -3 },
  grab: { legs: [[6.6, 15.4, 5.8, 18.4, 5.2, 21.8], [7.4, 15.4, 8.4, 18.4, 8.8, 21.8]], arms: [null, [7, 9.8, 9.2, 11.6, 10.4, 12.2]], lean: 0 },
  fwd: { legs: [[6.6, 15.4, 5.4, 18.4, 4.4, 21.8], [7.4, 15.4, 9, 18.4, 9.8, 21.8]], arms: [null, [7, 9.8, 9.8, 9.6, 12.2, 9.2]], lean: 4 },
  up: { legs: [[6.6, 15.4, 5.8, 18.4, 5.2, 21.8], [7.4, 15.4, 8.4, 18.4, 8.8, 21.8]], arms: [null, [8.2, 9.6, 11.2, 7.2, 11.8, 3.4]], lean: 0 },
  down: { legs: [[6.6, 15.4, 5.2, 17.8, 4.6, 21.8], [7.4, 15.4, 9.4, 17.4, 9.6, 21.8]], arms: [null, [7, 9.8, 9.6, 12.4, 11.6, 14.6]], lean: 6 },
};
const GRAB_ARM = [5.6, 10, 3.4, 9, 3.6, 7]; // far hand up to the temple, outside the face

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function blend(a, b, t) {
  return {
    legs: [mix(a.legs[0], b.legs[0], t), mix(a.legs[1], b.legs[1], t)],
    arms: [a.arms[0] && b.arms[0] ? mix(a.arms[0], b.arms[0], t) : b.arms[0], a.arms[1] && b.arms[1] ? mix(a.arms[1], b.arms[1], t) : b.arms[1]],
    lean: a.lean + (b.lean - a.lean) * t,
  };
}

// Pick the pose from the player's motion and the latest reflect press.
// reflect: { dir, t } (seconds since the press) or null.
export function heroPose(p, moving, stride, reflect) {
  if (reflect && reflect.t < 0.24) {
    if (reflect.t < 0.05 || reflect.dir === 'neutral') return { ...P.grab, glint: 'flash', dir: reflect.dir };
    const d = reflect.dir;
    const base = d === 'up' ? P.up : d === 'down' ? P.down : P.fwd;
    return { ...base, glint: d, dir: d };
  }
  if (!p.grounded) return p.vy < 0 ? P.rise : P.fall;
  if (!moving) return P.idle;
  return stride >= 0 ? blend(P.idle, P.runA, stride) : blend(P.idle, P.runB, -stride);
}

function line(ctx, pts, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}

// Draw at box origin (x, y), facing f (1 right, −1 left). sq = squash (−stretch).
export function drawHero(ctx, x, y, f, pose, theme, { sq = 0, ghost = false } = {}) {
  const H = theme.hero;
  ctx.save();
  ctx.translate(x + 7, y + 22);
  ctx.scale(f * (1 + sq), 1 - sq);
  ctx.translate(-7, -22);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (ghost) ctx.globalAlpha *= 0.4;
  else { ctx.shadowColor = theme.playerGlow; ctx.shadowBlur = 6; }

  // reflect: lenses lit, and on a directional reflect, rays toward the aim
  const lit = !!pose.glint;
  // back limbs
  line(ctx, pose.legs[0], 1.9, H.limb);
  if (pose.arms[0]) line(ctx, pose.arms[0], 1.4, H.limb);
  ctx.save();
  ctx.translate(7, 15.4); ctx.rotate((pose.lean * Math.PI) / 180); ctx.translate(-7, -15.4);
  // torso
  ctx.fillStyle = H.cloth;
  ctx.beginPath(); ctx.moveTo(5.1, 8.7); ctx.lineTo(8.9, 8.7); ctx.lineTo(9.5, 15.6); ctx.lineTo(4.5, 15.6); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  // head + beanie (dome, cuff)
  ctx.fillStyle = H.skin;
  ctx.beginPath(); ctx.arc(7, 5.9, 2.9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = H.beanie;
  ctx.beginPath(); ctx.moveTo(3.85, 5); ctx.quadraticCurveTo(3.9, 0.9, 7.1, 0.8); ctx.quadraticCurveTo(10.3, 0.9, 10.15, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = H.cuff;
  ctx.fillRect(3.6, 4.1, 6.8, 1.6);
  // round glasses, 3/4 view
  ctx.fillStyle = lit ? '#ffffff' : H.lens;
  ctx.strokeStyle = H.frame;
  ctx.lineWidth = 0.42;
  ctx.beginPath(); ctx.arc(6.75, 6.5, 0.98, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(9.1, 6.5, 0.92, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7.73, 6.4); ctx.lineTo(8.18, 6.4); ctx.moveTo(5.77, 6.3); ctx.lineTo(4.4, 5.9); ctx.stroke();
  if (lit && !ghost) {
    ctx.strokeStyle = theme.arc;
    ctx.lineWidth = 0.38;
    ctx.beginPath();
    const d = pose.glint;
    if (d === 'up') { ctx.moveTo(9.1, 2.4); ctx.lineTo(9.1, 0.4); ctx.moveTo(8, 2.6); ctx.lineTo(7.2, 1); ctx.moveTo(10.2, 2.6); ctx.lineTo(11, 1); }
    else if (d === 'down') { ctx.moveTo(10.4, 7.6); ctx.lineTo(11.8, 9); ctx.moveTo(10.7, 6.8); ctx.lineTo(12.6, 7.6); }
    else if (d !== 'flash' && d !== 'neutral') { ctx.moveTo(10.6, 6.5); ctx.lineTo(12.8, 6.5); ctx.moveTo(10.5, 5.6); ctx.lineTo(12, 4.6); ctx.moveTo(10.5, 7.4); ctx.lineTo(12, 8.4); }
    ctx.stroke();
  }
  // frame-grab: far hand at the temple
  if (!pose.arms[0]) {
    line(ctx, GRAB_ARM, 1.4, H.limb);
    ctx.fillStyle = H.skin;
    ctx.fillRect(3.2, 5.5, 1.5, 1.7);
  }
  ctx.restore();
  // front limbs
  if (!ghost) { ctx.shadowColor = theme.playerGlow; ctx.shadowBlur = 4; }
  line(ctx, pose.legs[1], 1.9, H.cloth);
  line(ctx, pose.arms[1], 1.4, H.cloth);
  ctx.restore();
}
