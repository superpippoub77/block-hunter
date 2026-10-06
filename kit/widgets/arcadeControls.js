// Widget "arcadeControls" — see kit/widgets/README.md
import { keyList, editorBox } from './_helpers.js';

export default {
    label: 'Comandi arcade (gettone, 1P/2P, tasti)',
    size: { width: 220, height: 50 },
    props: [
        { key: 'coinKeys', label: 'Tasti gettone', type: 'text', default: 'FIVE,SIX' },
        { key: 'start1', label: 'Tasto 1 giocatore', type: 'text', default: 'ONE' },
        { key: 'start2', label: 'Tasto 2 giocatori', type: 'text', default: 'TWO' },
        { key: 'startEvent', label: 'Evento di avvio', type: 'text', default: 'start' },
        { key: 'configKey', label: 'Tasto configurazione', type: 'text', default: 'T' },
        { key: 'configEvent', label: 'Evento configurazione', type: 'text', default: 'config' },
        { key: 'anyKeyEvent', label: 'Evento con qualsiasi altro tasto (vuoto = nessuno)', type: 'text', default: '' },
        { key: 'tapToStart', label: 'Tocco avvia (free play, touch)', type: 'checkbox', default: true }
    ],
    create(scene, item, ctx) {
        const c = scene.add.container(0, 0);
        if (ctx.editor) { c.add(editorBox(scene, 220, 50, '⌨ Comandi arcade')); return { obj: c }; }
        const { GAME_STATE, hasStartAccessForPlayers, consumeCreditsForPlayers, resetGameStateForNewRun, isFreeplayEnabled } = ctx.services;
        const p = item.props || {};
        const handled = new Set();
        const on = (key, fn) => { if (!key) return; handled.add(key); scene.input.keyboard.on(`keydown-${key}`, fn); };
        const insertCoin = () => {
            try { scene.sound.play('coin_sfx', { volume: 0.45 }); } catch (e) { }
            GAME_STATE.credits = (Number(GAME_STATE.credits) || 0) + 1;
            ctx.resetTimeout();
        };
        const start = (players) => {
            if (!hasStartAccessForPlayers(players)) return;
            consumeCreditsForPlayers(players);
            resetGameStateForNewRun(players);
            ctx.emit(p.startEvent || 'start');
        };
        keyList(p.coinKeys ?? 'FIVE,SIX').forEach((k) => on(k, insertCoin));
        on(String(p.start1 ?? 'ONE').toUpperCase(), () => start(1));
        on(String(p.start2 ?? 'TWO').toUpperCase(), () => start(2));
        if (p.configKey) on(String(p.configKey).toUpperCase(), () => ctx.emit(p.configEvent || 'config'));
        if (p.anyKeyEvent) {
            scene.input.keyboard.on('keydown', (ev) => {
                const name = String(ev.key || '').toUpperCase();
                const code = String(ev.code || '').replace(/^(Digit|Key)/, '').toUpperCase();
                const words = { '1': 'ONE', '2': 'TWO', '5': 'FIVE', '6': 'SIX' };
                if (handled.has(words[code] || code) || handled.has(name)) return;
                if (['ARROWLEFT', 'ARROWRIGHT'].includes(name)) return;
                ctx.emit(p.anyKeyEvent);
            });
        }
        scene.input.on('pointerdown', (pointer, over) => {
            ctx.resetTimeout();
            const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
            if (p.tapToStart !== false && touch && isFreeplayEnabled() && !(over && over.length)) start(1);
        });
        return { obj: c };
    }
};
