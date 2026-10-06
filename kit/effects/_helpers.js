// Helpers shared by the effect files (parameter templates, easing names, geometry).
import { EASINGS } from './easings.js';

export const P = {
    duration: (d = 600) => ({ key: 'duration', label: 'Durata (ms)', type: 'number', default: d, min: 0, step: 50 }),
    ease: (d = 'cubicOut') => ({ key: 'ease', label: 'Andamento', type: 'select', default: d, options: Object.keys(EASINGS) }),
    dir: (d = 'left') => ({ key: 'from', label: 'Da', type: 'select', default: d, options: ['left', 'right', 'top', 'bottom'] }),
    period: (d = 1000) => ({ key: 'period', label: 'Periodo (ms)', type: 'number', default: d, min: 50, step: 50 }),
    amount: (key, label, d, step = 1) => ({ key, label, type: 'number', default: d, step })
};

// distance needed to bring an item fully outside the design area from its base position
export function offscreen(dir, base, design, margin = 80) {
    const w = (base.width || 0) / 2 + margin, h = (base.height || 0) / 2 + margin;
    if (dir === 'left') return { x: -(base.x + w), y: 0 };
    if (dir === 'right') return { x: design.width - base.x + w, y: 0 };
    if (dir === 'top') return { x: 0, y: -(base.y + h) };
    return { x: 0, y: design.height - base.y + h };
}

export const wave = (t, period) => Math.sin((t / Math.max(1, period)) * Math.PI * 2);

