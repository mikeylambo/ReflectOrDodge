// Wordless onboarding prompts (GDD: Onboarding): device glyphs only, never
// words; each fades for good after its first use; they follow the active
// device family (keyboard / gamepad / touch) reported by the Web Shell.
import { PLAYER } from '../../config/tunables.js';

// glyph sets per device family, per prompt
const GLYPHS = {
  'keyboard-mouse': { move: ['A', 'D'], jump: ['␣'], reflect: ['W', '+', 'J'] },
  xbox: { move: ['◀', '▶'], jump: ['Ⓐ'], reflect: ['▲', '+', 'Ⓧ'] },
  playstation: { move: ['◀', '▶'], jump: ['✕'], reflect: ['▲', '+', '□'] },
  nintendo: { move: ['◀', '▶'], jump: ['Ⓑ'], reflect: ['▲', '+', 'Ⓨ'] },
  steamdeck: { move: ['◀', '▶'], jump: ['A'], reflect: ['▲', '+', 'X'] }, // Steam Deck / Steam Controller (Steam builds)
  'generic-gamepad': { move: ['◀', '▶'], jump: ['Ⓐ'], reflect: ['▲', '+', 'Ⓧ'] },
  touch: { move: ['◀', '▶'], jump: ['⤒'], reflect: ['▲', '+', '◇'] },
};

// which prompts each room teaches (wordless prologue)
export const ROOM_PROMPTS = { 'p0-01': ['move', 'jump'], 'p0-02': ['reflect'] };

export function drawPrompts(ctx, prompts, family, player, alpha, theme) {
  if (!prompts.length) return;
  const set = GLYPHS[family] || GLYPHS['keyboard-mouse'];
  const cx = player.x + PLAYER.W / 2;
  let y = player.y - 18;
  ctx.save();
  ctx.font = '600 13px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of prompts) {
    const keys = set[p.id];
    if (!keys || p.alpha <= 0) continue;
    const w = keys.reduce((a, k) => a + (k === '+' ? 12 : 24), 0) - 4;
    let x = cx - w / 2;
    ctx.globalAlpha = alpha * p.alpha;
    for (const k of keys) {
      if (k === '+') { ctx.fillStyle = theme.hudDim; ctx.fillText('+', x + 4, y); x += 12; continue; }
      ctx.strokeStyle = theme.hud;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + 0.5, y - 10.5, 20, 20);
      ctx.fillStyle = theme.hud;
      ctx.fillText(k, x + 10.5, y + 0.5);
      x += 24;
    }
    y -= 26;
  }
  ctx.restore();
}
