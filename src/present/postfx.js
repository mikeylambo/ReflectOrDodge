// Post FX (docs/ART.md: Post FX): a WebGL pass over the finished 2D frame.
// Presentation only — the sim never sees it, and the 2D canvas underneath
// stays the source of truth (tests read it).
//
//   bloom      bright-pass at ½ res, separable blur at ¼ res, added back
//   ripple     a ring of refraction from each reflect (up to 4 at once)
//   split      a short chromatic split on death
//   grade      per-chapter tint and saturation
//   grain      light film grain
//
// Off when WebGL is missing or software-rendered, when the player turns it
// off, and in high contrast. Reduced flashing halves bloom and drops the split.
const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const BRIGHT = `precision mediump float; varying vec2 uv; uniform sampler2D t; uniform float th;
void main(){ vec3 c = texture2D(t, uv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(th, th + .25, l), 1.); }`;
const BLUR = `precision mediump float; varying vec2 uv; uniform sampler2D t; uniform vec2 d;
void main(){ vec3 c = texture2D(t, uv).rgb * .227;
  c += (texture2D(t, uv + d * 1.385).rgb + texture2D(t, uv - d * 1.385).rgb) * .316;
  c += (texture2D(t, uv + d * 3.231).rgb + texture2D(t, uv - d * 3.231).rgb) * .07;
  gl_FragColor = vec4(c, 1.); }`;
const COMP = `precision mediump float; varying vec2 uv; uniform sampler2D scene, bloom; uniform float bloomK, split, grain, time, sat, aspect;
uniform vec3 tint; uniform vec4 rip[4];
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 13.7) * 43758.5453); }
void main(){
  vec2 q = uv;
  for (int i = 0; i < 4; i++) {
    vec4 r = rip[i]; if (r.w <= 0.) continue;
    vec2 dv = (q - r.xy) * vec2(aspect, 1.); float dist = length(dv);
    float band = exp(-pow((dist - r.z) * 40., 2.)) * r.w;
    q -= normalize(dv + 1e-5) / vec2(aspect, 1.) * band * .012;
  }
  vec3 c;
  if (split > 0.) { vec2 o = (q - .5) * split * .012; c = vec3(texture2D(scene, q + o).r, texture2D(scene, q).g, texture2D(scene, q - o).b); }
  else c = texture2D(scene, q).rgb;
  c += texture2D(bloom, q).rgb * bloomK;
  float l = dot(c, vec3(.299, .587, .114));
  c = mix(vec3(l), c, sat) * tint;
  c += (hash(uv * 977.) - .5) * grain;
  gl_FragColor = vec4(c, 1.);
}`;

export function createPostFX(src) {
  const out = document.createElement('canvas');
  out.id = 'gl';
  out.width = src.width; out.height = src.height;
  out.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  const gl = out.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl) return null;
  // software GL (SwiftShader, llvmpipe…) can't afford six full-screen passes a
  // frame: the game would drop far below 60 fps, so post FX stays off there
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  const force = typeof location !== 'undefined' && new URLSearchParams(location.search).get('postfx') === 'force'; // screenshots in headless runs
  if (!force && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) return null;
  src.parentNode.insertBefore(out, src.nextSibling);

  const sh = (type, code) => { const s = gl.createShader(type); gl.shaderSource(s, code); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = (fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  };
  let P;
  try { P = { bright: prog(BRIGHT), blur: prog(BLUR), comp: prog(COMP) }; } catch (e) { out.remove(); return null; }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const tex = (w, h) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  };
  const target = (w, h) => { const t = tex(w, h), f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h }; };
  const scene = tex();
  const hw = Math.max(1, src.width >> 1), hh = Math.max(1, src.height >> 1), qw = Math.max(1, src.width >> 2), qh = Math.max(1, src.height >> 2);
  const half = target(hw, hh), qa = target(qw, qh), qb = target(qw, qh);

  const ripples = []; // { x, y (uv), t (s), life }
  let split = 0, last = 0, enabled = true;
  const dbg = { bloom: 1, grain: 1, grade: 1 };

  function pass(pr, to, bindings, set) {
    gl.useProgram(pr.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, to ? to.f : null);
    gl.viewport(0, 0, to ? to.w : out.width, to ? to.h : out.height);
    bindings.forEach(([name, t], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(pr.u[name], i); });
    if (set) set(pr.u);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  return {
    canvas: out,
    dbg,
    // room-space event → effect (room px; W×H is the room size)
    event(e, W, H) {
      if (e.type === 'projectile.reflect') { ripples.push({ x: e.x / W, y: 1 - e.y / H, t: 0, life: 0.45 }); if (ripples.length > 4) ripples.shift(); }
      else if (e.type === 'player.death') split = 1;
    },
    setEnabled(v) { enabled = v; out.style.display = v ? '' : 'none'; src.style.opacity = v ? '0' : ''; },
    get enabled() { return enabled; },
    // grade: { tint: [r,g,b], sat }
    render(now, { grade = { tint: [1, 1, 1], sat: 1 }, flashes = true } = {}) {
      if (!enabled) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      for (const r of ripples) r.t += dt;
      while (ripples.length && ripples[0].t > ripples[0].life) ripples.shift();
      split = Math.max(0, split - dt * 5);
      gl.bindTexture(gl.TEXTURE_2D, scene);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      pass(P.bright, half, [['t', scene]], (u) => gl.uniform1f(u.th, 0.55));
      pass(P.blur, qa, [['t', half.t]], (u) => gl.uniform2f(u.d, 1 / hw, 0));
      pass(P.blur, qb, [['t', qa.t]], (u) => gl.uniform2f(u.d, 0, 1 / qh));
      pass(P.blur, qa, [['t', qb.t]], (u) => gl.uniform2f(u.d, 2 / qw, 0));
      pass(P.blur, qb, [['t', qa.t]], (u) => gl.uniform2f(u.d, 0, 2 / qh));
      pass(P.comp, null, [['scene', scene], ['bloom', qb.t]], (u) => {
        gl.uniform1f(u.bloomK, (flashes ? 0.9 : 0.45) * dbg.bloom);
        gl.uniform1f(u.split, flashes ? split : 0);
        gl.uniform1f(u.grain, 0.035 * dbg.grain);
        gl.uniform1f(u.time, (now / 1000) % 100);
        gl.uniform1f(u.aspect, out.width / out.height);
        gl.uniform1f(u.sat, grade.sat);
        gl.uniform3f(u.tint, grade.tint[0], grade.tint[1], grade.tint[2]);
        const R = new Float32Array(16);
        ripples.forEach((r, i) => { const k = r.t / r.life; R.set([r.x, r.y, 0.02 + k * 0.16, (1 - k) * (flashes ? 1 : 0.5)], i * 4); });
        gl.uniform4fv(u.rip, R);
      });
    },
  };
}
