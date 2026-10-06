// Effetti continui (kind "loop"): p sono i millisecondi da quando l'effetto è iniziato.
// Each entry: id: { label, kind, params: [...], apply(state, p, ctx) } — see kit/effects/README.md
import { P, wave } from './_helpers.js';

export default {
    blink: {
        label: 'Lampeggia', kind: 'loop', params: [P.period(900), P.amount('min', 'Opacità minima', 0.3, 0.05)],
        apply(s, t, { params }) { s.alpha *= params.min + (1 - params.min) * (0.5 + 0.5 * Math.cos((t / params.period) * Math.PI * 2)); }
    },
    pulse: {
        label: 'Pulsa', kind: 'loop', params: [P.period(800), P.amount('amount', 'Ampiezza', 0.08, 0.01)],
        apply(s, t, { params }) { const k = 1 + params.amount * wave(t, params.period); s.scaleX *= k; s.scaleY *= k; }
    },
    float: {
        label: 'Fluttua', kind: 'loop', params: [P.period(2000), P.amount('amount', 'Ampiezza (px)', 8)],
        apply(s, t, { params }) { s.offsetY += params.amount * wave(t, params.period); }
    },
    vibrate: {
        label: 'Vibra', kind: 'loop', params: [P.period(140), P.amount('amount', 'Ampiezza (px)', 6)],
        apply(s, t, { params }) { s.offsetX += params.amount * wave(t, params.period); }
    },
    wobble: {
        label: 'Oscilla', kind: 'loop', params: [P.period(1000), P.amount('degrees', 'Gradi', 2, 0.5)],
        apply(s, t, { params }) { s.angle += params.degrees * wave(t, params.period); }
    },
    spin: {
        label: 'Gira continuamente', kind: 'loop', params: [P.period(2000)],
        apply(s, t, { params }) { s.angle += (t / params.period) * 360; }
    },
    rainbow: {
        label: 'Arcobaleno', kind: 'loop', params: [P.period(2000)],
        apply(s, t, { params }) {
            const h = ((t / params.period) % 1 + 1) % 1;
            const f = (n) => { const k = (n + h * 12) % 12; return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
            s.tint = (f(0) << 16) | (f(8) << 8) | f(4);
        }
    },
    heartbeat: {
        label: 'Battito', kind: 'loop', params: [P.period(1200), P.amount('amount', 'Ampiezza', 0.15, 0.01)],
        apply(s, t, { params }) {
            const ph = ((t / params.period) % 1 + 1) % 1;
            const beat = Math.max(0, Math.sin(ph * Math.PI * 4)) * (ph < 0.5 ? 1 : 0);
            const k = 1 + params.amount * beat; s.scaleX *= k; s.scaleY *= k;
        }
    }
};
