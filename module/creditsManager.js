// Credits manager: creates credit UI and exposes insertCoin()/helpers
export function createCreditsManager(scene, opts = {}) {
    const GAME_STATE = opts.gameState || {};
    const CONFIG = opts.config || {};
    const hudDepth = (typeof opts.hudDepth === 'number') ? opts.hudDepth : 10000;
    const font = opts.font || '"Press Start 2P"';
    const x = (typeof opts.x === 'number') ? opts.x : 400;

    // coin text in middle
    try {
        scene.coinText = scene.add.text(x, 520, '', {
            fontSize: '24px',
            fill: '#ffee00ff',
            fontFamily: font
        }).setOrigin(0.5).setDepth(hudDepth).setScrollFactor(0);
    } catch (e) { scene.coinText = null; }
    scene.coinPanel = null;

    try {
        scene.player1Text = scene.add.text(150, 550, '', { fontSize: '18px', fill: '#666666', fontFamily: font }).setOrigin(0.5).setDepth(hudDepth).setScrollFactor(0);
    } catch (e) { scene.player1Text = null; }
    scene.player1Panel = null;
    try {
        scene.player2Text = scene.add.text(650, 550, '', { fontSize: '18px', fill: '#666666', fontFamily: font }).setOrigin(0.5).setDepth(hudDepth).setScrollFactor(0);
    } catch (e) { scene.player2Text = null; }
    scene.player2Panel = null;

    const updateTexts = () => {
        try {
            const t = (typeof window !== 'undefined' && window.TRANSLATIONS && window.TRANSLATIONS[GAME_STATE.language]) ? window.TRANSLATIONS[GAME_STATE.language] : null;
            const insertCoin = (t && t.insert_coin) ? t.insert_coin : 'INSERT COIN';
            const credit = (t && t.credit) ? t.credit : 'CREDIT';
            if (scene.coinText) {
                if ((Number(GAME_STATE.credits) || 0) <= 0) scene.coinText.setText(insertCoin);
                else scene.coinText.setText(credit + ' ' + (Number(GAME_STATE.credits) || 0));
            }
            if (scene.player1Text) scene.player1Text.setText((Number(GAME_STATE.credits) || 0) >= 1 ? '1P' : '');
            if (scene.player2Text) scene.player2Text.setText((Number(GAME_STATE.credits) || 0) >= 2 ? '2P' : '');
        } catch (e) { }
    };

    const insertCoin = ({ volume = 0.45, onChange } = {}) => {
        try {
            if (scene.sound && scene.sound.play) scene.sound.play('coin_sfx', { volume });
        } catch (e) { }
        try {
            GAME_STATE.credits = (Number(GAME_STATE.credits) || 0) + 1;
            updateTexts();
            if (typeof onChange === 'function') {
                try { onChange(GAME_STATE.credits); } catch (e) { }
            }
            if (scene && typeof scene.updateUI === 'function') {
                try { scene.updateUI(); } catch (e) { }
            }
            if (scene && typeof scene.resetTimeout === 'function') {
                try { scene.resetTimeout(); } catch (e) { }
            }
        } catch (e) { }
    };

    // expose helper to set credits programmatically
    const setCredits = (n) => {
        try { GAME_STATE.credits = Number(n) || 0; updateTexts(); } catch (e) {}
    };

    // initialize texts
    updateTexts();

    return {
        insertCoin,
        setCredits,
        updateTexts
    };
}
