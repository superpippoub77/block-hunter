// Easing curves: t (0..1) -> eased progress. Add new ones here; they appear in the editor.
export const EASINGS = {
    linear: (t) => t,
    quadIn: (t) => t * t,
    quadOut: (t) => 1 - (1 - t) * (1 - t),
    cubicOut: (t) => 1 - Math.pow(1 - t, 3),
    cubicIn: (t) => t * t * t,
    sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    backOut: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    backIn: (t) => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
    bounceOut: (t) => {
        const n1 = 7.5625, d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
    elasticOut: (t) => {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
    }
};

