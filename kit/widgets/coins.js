// Widget "coins" — see kit/widgets/README.md
import { num, textStyle } from './_helpers.js';

export default {
    label: 'Gettoni / crediti',
    size: { width: 360, height: 40 },
    props: [
        { key: 'fontSize', label: 'Dimensione testo', type: 'number', default: 24 },
        { key: 'color', label: 'Colore', type: 'color', default: '#ffee00' },
        { key: 'showPlayers', label: 'Mostra 1P / 2P', type: 'checkbox', default: true },
        { key: 'playersSpread', label: 'Distanza 1P / 2P dal centro', type: 'number', default: 256 },
        { key: 'playersOffsetY', label: 'Distanza verticale 1P / 2P', type: 'number', default: 34 }
    ],
    create(scene, item, ctx) {
        const { GAME_STATE, CONFIG } = ctx.services;
        const c = scene.add.container(0, 0);
        const main = scene.add.text(0, 0, '', textStyle(item, ctx, 24, '#ffee00')).setOrigin(0.5);
        const spread = num(item.props?.playersSpread, 256), dy = num(item.props?.playersOffsetY, 34);
        const p1 = scene.add.text(-spread, dy, '', textStyle({ props: { ...item.props, fontSize: 16, color: '#bbbbbb' } }, ctx, 16, '#bbbbbb')).setOrigin(0.5);
        const p2 = scene.add.text(spread, dy, '', textStyle({ props: { ...item.props, fontSize: 16, color: '#bbbbbb' } }, ctx, 16, '#bbbbbb')).setOrigin(0.5);
        c.add([main, p1, p2]);
        const update = () => {
            const credits = Number(GAME_STATE.credits) || 0;
            const free = CONFIG.freeplay === true;
            main.setText(free ? ctx.tr('free_play', 'FREE PLAY')
                : (credits > 0 ? `${ctx.tr('credit', 'CREDIT')} ${credits}` : ctx.tr('insert_coin', 'INSERT COIN')));
            const show = item.props?.showPlayers !== false;
            p1.setText(show && (free || credits >= 1) ? '1P' : '');
            p2.setText(show && (free || credits >= 2) ? '2P' : '');
        };
        update();
        return { obj: c, update, refresh: update };
    }
};
