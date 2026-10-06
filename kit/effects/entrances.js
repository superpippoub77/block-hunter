// Entrate (kind "in"): prima di iniziare l'elemento aspetta nello stato p = 0.
// Each entry: id: { label, kind, params: [...], apply(state, p, ctx) } — see kit/effects/README.md
import { P, offscreen } from './_helpers.js';

export default {
    fadeIn: {
        label: 'Dissolvenza in entrata', kind: 'in', params: [P.duration(600), P.ease('linear')],
        apply(s, p) { s.alpha *= p; }
    },
    slideIn: {
        label: 'Entra scorrendo', kind: 'in', params: [P.duration(800), P.dir('left'), P.ease('cubicOut')],
        apply(s, p, { params, base, design }) {
            const o = offscreen(params.from, base, design);
            s.offsetX += o.x * (1 - p); s.offsetY += o.y * (1 - p);
        }
    },
    dropBounce: {
        label: 'Cade rimbalzando', kind: 'in', params: [P.duration(800), P.ease('bounceOut')],
        apply(s, p, { base, design }) { s.offsetY += offscreen('top', base, design).y * (1 - p); }
    },
    zoomIn: {
        label: 'Zoom in entrata', kind: 'in', params: [P.duration(500), P.ease('backOut'), P.amount('from', 'Scala iniziale', 0, 0.1)],
        apply(s, p, { params }) { const k = params.from + (1 - params.from) * p; s.scaleX *= k; s.scaleY *= k; s.alpha *= Math.min(1, p * 2); }
    },
    spinIn: {
        label: 'Entra ruotando', kind: 'in', params: [P.duration(700), P.ease('cubicOut'), P.amount('turns', 'Giri', 1, 0.5)],
        apply(s, p, { params }) { s.angle += -360 * params.turns * (1 - p); s.scaleX *= p; s.scaleY *= p; }
    },
    typewriter: {
        label: 'Macchina da scrivere (testi)', kind: 'in', params: [P.duration(1200), P.ease('linear')],
        apply(s, p) { s.visibleChars = Math.min(s.visibleChars, p); }
    }
};
