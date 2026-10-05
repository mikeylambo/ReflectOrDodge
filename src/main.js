import { ROOM } from '../config/tunables.js';
import { startGame } from './game/game.js';

const canvas = document.getElementById('c');
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = ROOM.W * dpr;
canvas.height = ROOM.H * dpr;
const ctx = canvas.getContext('2d');
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

if (new URLSearchParams(location.search).get('edit') === '1') {
  import('./editor/editor.js').then((m) => m.startEditor(canvas, ctx));
} else {
  startGame(canvas, ctx);
}
