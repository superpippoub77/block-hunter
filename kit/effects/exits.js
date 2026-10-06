// Uscite (kind "out"): dopo la fine l'elemento resta nello stato p = 1.
// Each entry: id: { label, kind, params: [...], apply(state, p, ctx) } — see kit/effects/README.md
import { P, offscreen } from './_helpers.js';

export default {
    fadeOut: {
        label: 'Dissolvenza in uscita', kind: 'out', params: [P.duration(500), P.ease('linear')],
        apply(s, p) { s.alpha *= 1 - p; }
    },
    slideOut: {
        label: 'Esce scorrendo', kind: 'out', params: [P.duration(700), P.dir('right'), P.ease('cubicIn')],
        apply(s, p, { params, base, design }) {
            const o = offscreen(params.from, base, design);
            s.offsetX += o.x * p; s.offsetY += o.y * p;
        }
    },
    flyUp: {
        label: 'Vola via in alto', kind: 'out', params: [P.duration(450), P.ease('cubicIn')],
        apply(s, p, { base, design }) { s.offsetY += offscreen('top', base, design).y * p; s.alpha *= 1 - p; }
    },
    zoomOut: {
        label: 'Zoom in uscita', kind: 'out', params: [P.duration(400), P.ease('backIn')],
        apply(s, p) { s.scaleX *= 1 - p; s.scaleY *= 1 - p; }
    }
};
