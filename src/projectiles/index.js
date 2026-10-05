// Projectile registry. Adding a type = writing one module + one line here.
// The engine never changes (GDD law 6: composition before new mechanics).
import * as orb from './orb.js';
import * as anchor from './anchor.js';
import * as seed from './seed.js';

export const PROJECTILES = { orb, anchor, seed };
