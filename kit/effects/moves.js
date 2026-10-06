// Movimenti (kind "move"): cambiamenti nel tempo che mantengono lo stato finale.
// Each entry: id: { label, kind, params: [...], apply(state, p, ctx) } — see kit/effects/README.md
import { P } from './_helpers.js';

export default {
    moveBy: {
        label: 'Spostamento', kind: 'move', params: [P.duration(1000), P.ease('sineInOut'), P.amount('dx', 'Sposta X (px)', 200), P.amount('dy', 'Sposta Y (px)', 0)],
        apply(s, p, { params }) { s.offsetX += params.dx * p; s.offsetY += params.dy * p; }
    },
    scaleTo: {
        label: 'Cambia dimensione', kind: 'move', params: [P.duration(800), P.ease('sineInOut'), P.amount('to', 'Scala finale', 1.5, 0.1)],
        apply(s, p, { params }) { const k = 1 + (params.to - 1) * p; s.scaleX *= k; s.scaleY *= k; }
    },
    rotateTo: {
        label: 'Ruota', kind: 'move', params: [P.duration(800), P.ease('sineInOut'), P.amount('degrees', 'Gradi', 360, 15)],
        apply(s, p, { params }) { s.angle += params.degrees * p; }
    }
};
