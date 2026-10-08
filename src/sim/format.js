// Stable, diff-friendly room JSON: one tile row per line, small arrays and
// objects inline. Used by the editor's save and by tools/.
export function formatRoom(r) {
  const inline = (v) => JSON.stringify(v);
  const order = ['id', 'name', 'tiles', 'spawn', 'exit', 'emitters', 'objects', 'par', 'solution', 'mirrorOf'];
  const keys = [...order.filter((k) => k in r), ...Object.keys(r).filter((k) => !order.includes(k))];
  const lines = keys.map((k) => {
    const v = r[k];
    if (k === 'tiles' && Array.isArray(v)) return `  "tiles": [\n${v.map((row) => `    ${inline(row)}`).join(',\n')}\n  ]`;
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') return `  ${inline(k)}: [\n${v.map((o) => `    ${inline(o)}`).join(',\n')}\n  ]`;
    return `  ${inline(k)}: ${inline(v === undefined ? null : v)}`;
  });
  return `{\n${lines.join(',\n')}\n}\n`;
}
