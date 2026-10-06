// Registro dei comportamenti delle entità: un file per comportamento.
import still from './still.js';
import wander from './wander.js';
import patrol from './patrol.js';
import chase from './chase.js';
import fly from './fly.js';
import custom from './custom.js';

export const BEHAVIOURS = { still, wander, patrol, chase, fly };
if (custom && custom.update) BEHAVIOURS.custom = custom;

/** Parameters of a behaviour with defaults filled in */
export function behaviourParams(def) {
    const b = BEHAVIOURS[def?.type] || BEHAVIOURS.wander;
    const out = {};
    (b.params || []).forEach((p) => { out[p.key] = p.default; });
    return Object.assign(out, def || {});
}
