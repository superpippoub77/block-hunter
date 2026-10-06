// SpikeCode effects engine — shared by the game (screen runtime) and the screen editor.
// The effects themselves live in kit/effects/ (one file per family, custom.js for yours):
// this file only computes, for an item and a time t, the transform produced by its effects.
//
// Every effect is a pure function of time, so the editor can jump to any instant of the
// timeline and show exactly what the game will show (see kit/effects/README.md).

import { EASINGS } from '../effects/easings.js';
import { EFFECTS, ACTIONS } from '../effects/index.js';

export { EASINGS, EFFECTS, ACTIONS };

/** Library listing for the editor: [{ id, label, kind, params }] */
export function listEffects() {
    return [...Object.entries(EFFECTS), ...Object.entries(ACTIONS)]
        .map(([id, e]) => ({ id, label: e.label, kind: e.kind, params: e.params }));
}

/** Effect parameters with defaults filled in */
export function effectParams(fx) {
    const def = EFFECTS[fx.name] || ACTIONS[fx.name];
    const out = {};
    (def?.params || []).forEach((p) => { out[p.key] = p.default; });
    return Object.assign(out, fx.params || {}, fx.duration != null ? { duration: fx.duration } : {});
}

/**
 * Transform of an item at time t (ms since the screen started).
 * item: { x, y, scale, scaleX, scaleY, rotation, alpha, width, height, in, out, effects: [{ name, at, duration, params }] }
 * Returns null when the item is not visible at t.
 */
export function itemStateAt(item, t, design) {
    const tin = Number(item.in) || 0;
    const tout = (item.out == null || item.out === '') ? Infinity : Number(item.out);
    if (t < tin || t >= tout) return null;
    const sc = Number(item.scale ?? 1);
    const base = { x: Number(item.x) || 0, y: Number(item.y) || 0, width: Number(item.width) || 0, height: Number(item.height) || 0 };
    const s = {
        x: base.x, y: base.y, offsetX: 0, offsetY: 0,
        scaleX: sc * Number(item.scaleX ?? 1), scaleY: sc * Number(item.scaleY ?? 1),
        angle: Number(item.rotation) || 0, alpha: item.alpha == null ? 1 : Number(item.alpha),
        tint: null, visibleChars: 1
    };
    for (const fx of item.effects || []) {
        const def = EFFECTS[fx.name];
        if (!def) continue;
        const params = effectParams(fx);
        const at = tin + (Number(fx.at) || 0);
        const dur = Math.max(0, Number(params.duration) || 0);
        const ctx = { params, base, design };
        if (def.kind === 'loop') {
            const end = dur > 0 ? at + dur : Infinity;
            if (t >= at && t < end) def.apply(s, t - at, ctx);
            continue;
        }
        let p = dur > 0 ? (t - at) / dur : (t >= at ? 1 : 0);
        p = Math.max(0, Math.min(1, p));
        if (def.kind === 'in' && t < at) p = 0;
        const ease = EASINGS[params.ease] || EASINGS.linear;
        def.apply(s, ease(p), ctx);
    }
    s.x += s.offsetX; s.y += s.offsetY;
    return s;
}
