// Widget "menu" — see kit/widgets/README.md
import { num, color } from './_helpers.js';

export default {
    label: 'Menu di scelta (difficoltà, opzioni)',
    size: { width: 360, height: 180 },
    props: [
        {
            key: 'options', label: 'Voci (una per riga: testo o @chiave | valore | evento)', type: 'textarea',
            default: '@beginner | 0.8 | start\n@medium | 1.0 | start\n@hard | 1.3 | start'
        },
        { key: 'stateKey', label: 'Salva il valore in GAME_STATE.', type: 'text', default: 'difficulty' },
        { key: 'fontSize', label: 'Dimensione testo', type: 'number', default: 28 },
        { key: 'spacing', label: 'Spazio tra le voci', type: 'number', default: 56 },
        { key: 'color', label: 'Colore', type: 'color', default: '#ffffff' },
        { key: 'selectedColor', label: 'Colore selezionato', type: 'color', default: '#ffee00' }
    ],
    create(scene, item, ctx) {
        const { GAME_STATE } = ctx.services;
        const p = item.props || {};
        const c = scene.add.container(0, 0);
        const options = String(p.options || '').split('\n').map((line) => {
            const [label, value, event] = line.split('|').map((s) => (s || '').trim());
            return label ? { label, value, event: event || 'start' } : null;
        }).filter(Boolean);
        const spacing = num(p.spacing, 56);
        let selected = 0;
        const style = { fontFamily: ctx.font, fontSize: `${num(p.fontSize, 28)}px`, color: '#ffffff', stroke: '#000000', strokeThickness: 4 };
        const label = (o) => (o.label.startsWith('@') ? ctx.tr(o.label.slice(1), o.label.slice(1).toUpperCase()) : o.label);
        const texts = options.map((o, i) => {
            const t = scene.add.text(0, (i - (options.length - 1) / 2) * spacing, label(o), style).setOrigin(0.5);
            c.add(t);
            return t;
        });
        const paint = () => texts.forEach((t, i) => {
            t.setColor(i === selected ? color(p.selectedColor, '#ffee00') : color(p.color, '#ffffff'));
            t.setText((i === selected ? '▶ ' : '') + label(options[i]));
        });
        paint();
        if (ctx.editor) return { obj: c, refresh: paint };
        const choose = (i) => {
            const o = options[i];
            if (!o) return;
            try { scene.sound.play('select_sfx', { volume: 0.4 }); } catch (e) { }
            if (p.stateKey && o.value !== '') {
                const v = Number(o.value);
                GAME_STATE[p.stateKey] = Number.isFinite(v) ? v : o.value;
            }
            ctx.emit(o.event || 'start');
        };
        const move = (d) => { selected = (selected + d + options.length) % options.length; paint(); ctx.resetTimeout(); try { scene.sound.play('select_sfx', { volume: 0.25 }); } catch (e) { } };
        scene.input.keyboard.on('keydown-UP', () => move(-1));
        scene.input.keyboard.on('keydown-DOWN', () => move(1));
        scene.input.keyboard.on('keydown-ENTER', () => choose(selected));
        scene.input.keyboard.on('keydown-SPACE', () => choose(selected));
        options.forEach((o, i) => { if (/^\d$/.test(String(i + 1))) scene.input.keyboard.on(`keydown-${['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'][i]}`, () => { selected = i; paint(); choose(i); }); });
        texts.forEach((t, i) => t.setInteractive({ useHandCursor: true })
            .on('pointerover', () => { selected = i; paint(); })
            .on('pointerdown', () => choose(i)));
        return { obj: c, refresh: paint };
    }
};
