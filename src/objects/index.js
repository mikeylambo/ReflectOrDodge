// Room-object registry: one module per kind against _object.js.
import * as emitter from './emitter.js';
import * as sw from './switch.js';
import * as door from './door.js';
import * as wall from './wall.js';

export const OBJECTS = { emitter, switch: sw, door, wall };
