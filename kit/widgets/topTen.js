// Widget "topTen" — see kit/widgets/README.md
import { num, color } from './_helpers.js';

export default {
    label: 'Tabella top ten',
    size: { width: 560, height: 360 },
    props: [
        { key: 'rows', label: 'Righe', type: 'number', default: 10 },
        { key: 'fontSize', label: 'Dimensione testo', type: 'number', default: 18 },
        { key: 'rowHeight', label: 'Altezza riga', type: 'number', default: 30 },
        { key: 'width', label: 'Larghezza', type: 'number', default: 560 },
        { key: 'color', label: 'Colore righe', type: 'color', default: '#ffffff' },
        { key: 'firstColor', label: 'Colore primo posto', type: 'color', default: '#ffd84a' },
        { key: 'headerColor', label: 'Colore intestazione', type: 'color', default: '#00ffff' },
        { key: 'showLevel', label: 'Mostra livello', type: 'checkbox', default: true }
    ],
    create(scene, item, ctx) {
        const { GAME_STATE } = ctx.services;
        const p = item.props || {};
        const c = scene.add.container(0, 0);
        const rows = num(p.rows, 10), rh = num(p.rowHeight, 30), w = num(p.width, 560), fs = num(p.fontSize, 18);
        const cols = p.showLevel !== false ? [-w / 2, -w / 2 + w * 0.14, w * 0.18, w / 2] : [-w / 2, -w / 2 + w * 0.16, w / 2, null];
        const top = -((rows + 1) * rh) / 2;
        const style = (fill) => ({ fontFamily: ctx.font, fontSize: `${fs}px`, color: fill, stroke: '#000000', strokeThickness: 3 });
        const texts = [];
        const build = () => {
            texts.forEach((t) => t.destroy()); texts.length = 0;
            const add = (x, y, s, fill, ox = 0) => { const t = scene.add.text(x, y, s, style(fill)).setOrigin(ox, 0.5); c.add(t); texts.push(t); };
            const hc = color(p.headerColor, '#00ffff');
            add(cols[0], top, '#', hc);
            add(cols[1], top, ctx.tr('name_label', ctx.tr('name', 'NAME')), hc);
            add(cols[2], top, ctx.tr('score_label', ctx.tr('scoreLabel', 'SCORE')), hc, 1);
            if (cols[3] != null) add(cols[3], top, ctx.tr('level_label', ctx.tr('levelLabel', 'LEVEL')), hc, 1);
            const list = Array.isArray(GAME_STATE.topScores) && GAME_STATE.topScores.length
                ? GAME_STATE.topScores
                : (ctx.editor ? Array.from({ length: rows }, (_, i) => ({ name: 'AAA', score: (rows - i) * 1000, level: 1 })) : []);
            list.slice(0, rows).forEach((e, i) => {
                const y = top + (i + 1) * rh;
                const fill = i === 0 ? color(p.firstColor, '#ffd84a') : color(p.color, '#ffffff');
                add(cols[0], y, `${i + 1}.`, fill);
                add(cols[1], y, String(e.name || '---'), fill);
                add(cols[2], y, String(e.score ?? 0), fill, 1);
                if (cols[3] != null) add(cols[3], y, String((Number(e.level) || 0) + 1), fill, 1);
            });
        };
        build();
        return { obj: c, refresh: build };
    }
};
