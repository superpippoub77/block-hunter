// Widget "textCycle" — see kit/widgets/README.md
import { num, textStyle } from './_helpers.js';

export default {
    label: 'Testi a rotazione (istruzioni, storia)',
    size: { width: 640, height: 120 },
    props: [
        { key: 'texts', label: 'Testi (uno per riga: testo o @chiave)', type: 'textarea', default: '@instructions\n@story' },
        { key: 'period', label: 'Ogni (ms)', type: 'number', default: 5000 },
        { key: 'fontSize', label: 'Dimensione testo', type: 'number', default: 18 },
        { key: 'color', label: 'Colore', type: 'color', default: '#ffffff' },
        { key: 'wrap', label: 'Larghezza massima', type: 'number', default: 640 }
    ],
    create(scene, item, ctx) {
        const p = item.props || {};
        const c = scene.add.container(0, 0);
        const lines = String(p.texts || '').split('\n').map((s) => s.trim()).filter(Boolean);
        const style = { ...textStyle(item, ctx, 18, '#ffffff'), wordWrap: { width: num(p.wrap, 640) } };
        const t = scene.add.text(0, 0, '', style).setOrigin(0.5);
        c.add(t);
        const resolve = (s) => (s.startsWith('@') ? ctx.tr(s.slice(1), '') : s);
        let last = -1;
        const update = (time) => {
            if (!lines.length) return;
            const i = Math.floor((Number(time) || 0) / Math.max(500, num(p.period, 5000))) % lines.length;
            if (i !== last) { last = i; t.setText(resolve(lines[i])); }
        };
        update(0);
        return { obj: c, update, refresh: () => { last = -1; } };
    }
};
