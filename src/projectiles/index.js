// Projectile registry. Adding a type = writing one module + one line here.
// The engine never changes (GDD law 6: composition before new mechanics).
import * as orb from './orb.js';
import * as anchor from './anchor.js';
import * as seed from './seed.js';
import * as splitter from './splitter.js';
import * as charge from './charge.js';
import * as twin from './twin.js';

export const PROJECTILES = { orb, anchor, seed, splitter, charge, twin };
