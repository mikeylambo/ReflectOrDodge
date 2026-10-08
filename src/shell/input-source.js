// The Web Shell's BrowserInputSource reports keys held at poll time, so a tap
// whose keydown and keyup both land between two polls is never seen (and
// automated input taps in well under a frame). This subclass latches every
// keydown until the next poll. Same bindings, same output shape.
import { BrowserInputSource } from '@slu/web-shell/platform/browser/BrowserInputSource.js';

export class LatchedInputSource extends BrowserInputSource {
  constructor(bindings) {
    super(bindings);
    this.latchBindings = bindings;
    this.tapped = new Set();
  }

  attach(target = window) {
    const detach = super.attach(target);
    const down = (e) => this.tapped.add(e.code);
    target.addEventListener('keydown', down);
    return () => { target.removeEventListener('keydown', down); detach(); };
  }

  poll() {
    const values = super.poll();
    for (const b of this.latchBindings) {
      if (b.keyboard && b.keyboard.some((code) => this.tapped.has(code))) values.set(b.action, Math.max(values.get(b.action) || 0, 1));
    }
    this.tapped.clear();
    return values;
  }
}
