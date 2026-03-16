import {
    CONFIG,
    GAME_STATE,
    STARTUP_SETTINGS,
    OBJECT_NATIVE_SIZE,
    buildSceneClasses,
    loadStartupSettings,
    loadFrameConstants,
    loadCustomEffectLibrary,
    isFreePlayMode
} from '../game.js';

async function loadPressStartFont() {
    try {
        if (window.FontFace) {
            const font = new FontFace(
                'Press Start 2P',
                "url('assets/fonts/PressStart2P-Regular.woff2'), url('assets/fonts/PressStart2P-Regular.woff'), url('assets/fonts/PressStart2P-Regular.ttf')"
            );
            await font.load();
            document.fonts.add(font);
            await document.fonts.ready;
            return;
        }

        // Fallback for older browsers.
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
    } catch (e) {
        console.warn('Impossibile caricare il font personalizzato, si usera il fallback.', e);
    }
}

async function initialization() {
    try {
        const response = await fetch('data/config.json');
        const cfg = await response.json();

        // Load startup/front-end behavior from data/start.json (optional).
        await loadStartupSettings();

        // Copy all config keys to CONFIG
        Object.assign(CONFIG, cfg);

        // Load object/tile frame constants from JSON (linked from config.json).
        await loadFrameConstants(cfg);
        // tokenMap: allow mapping single-letter tokens (eg. 'X') to full tokens (eg. 'w00')
        // merge any tokenMap provided in config.json into CONFIG.tokenMap
        try {
            CONFIG.tokenMap = Object.assign({}, CONFIG.tokenMap || {}, cfg.tokenMap || {});
        } catch (e) {
            CONFIG.tokenMap = CONFIG.tokenMap || {};
        }
        if (!Number.isFinite(Number(CONFIG.playerSize)) || Number(CONFIG.playerSize) <= 0) {
            CONFIG.playerSize = Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE;
        }
        if (!Number.isFinite(Number(CONFIG.ghostSpeed)) || Number(CONFIG.ghostSpeed) <= 0) {
            CONFIG.ghostSpeed = 80;
        }
        if (!Number.isFinite(Number(CONFIG.dynamiteSize)) || Number(CONFIG.dynamiteSize) <= 0) {
            CONFIG.dynamiteSize = Math.max(8, Math.round((Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE) * 0.6));
        }

        // Optional plugin-like effect library from module/effects/*
        try {
            const lib = await loadCustomEffectLibrary();
            const loadedCount = Object.keys((lib && lib.effects) || {}).length;
            if (loadedCount > 0) {
                console.log(`[EffectLibrary] Loaded ${loadedCount} custom effects`);
            }
        } catch (e) {
            console.warn('[EffectLibrary] bootstrap warning:', e);
        }

        // Resolve Phaser scale mode from config (defaults to FIT)
        const requestedScaleMode = String(CONFIG.scaleMode || 'FIT').toUpperCase();
        let phaserScaleMode = Phaser.Scale.FIT;
        if (requestedScaleMode === 'ENVELOP' || requestedScaleMode === 'ENVELOPE') phaserScaleMode = Phaser.Scale.ENVELOP;
        else if (requestedScaleMode === 'NONE') phaserScaleMode = Phaser.Scale.NONE;
        else if (requestedScaleMode === 'RESIZE') phaserScaleMode = Phaser.Scale.RESIZE;

        const {
            PreloadScene,
            AttractScene,
            TopTenScene,
            CreditsScene,
            ConfigScene,
            LevelSelectScene,
            GameScene,
            BonusScene,
            GameOverScene
        } = buildSceneClasses();

        const config = {
            type: Phaser.AUTO,
            // Use Phaser Scale manager to display the original 800x600 game in the
            // available viewport according to the requested scale mode.
            scale: {
                mode: phaserScaleMode,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                parent: 'game-container',
                width: Number(CONFIG.width) || 800,
                height: Number(CONFIG.height) || 600
            },
            backgroundColor: '#000000',
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0 },
                    debug: false
                }
            },
            scene: [PreloadScene, AttractScene, TopTenScene, CreditsScene, ConfigScene, LevelSelectScene, GameScene, BonusScene, GameOverScene]
        };

        // Copy game state keys to GAME_STATE (topScores will be loaded from server if available)
        const stateKeys = [
            'credits', 'language', 'difficulty', 'currentLevel', 'score', 'lives', 'dynamiteCount', 'keysCount', 'woodenCount'
        ];
        stateKeys.forEach((k) => {
            if (cfg[k] !== undefined) GAME_STATE[k] = cfg[k];
        });

        if (isFreePlayMode()) {
            GAME_STATE.credits = Number.MAX_SAFE_INTEGER;
        } else {
            GAME_STATE.credits = Math.max(0, Math.floor(Number(STARTUP_SETTINGS.startup?.initialCredits) || Number(GAME_STATE.credits) || 0));
        }

        // Try to load top scores from server API; fallback to config.json topScores if API not available
        try {
            let serverTopScores = null;
            try {
                const resp = await fetch('/api/top-scores');
                if (resp && resp.ok) {
                    serverTopScores = await resp.json();
                }
            } catch (e) {
                serverTopScores = null;
            }

            if (Array.isArray(serverTopScores) && serverTopScores.length > 0) {
                GAME_STATE.topScores = serverTopScores.slice(0, 10);
            } else if (Array.isArray(cfg.topScores)) {
                // allow embedding topScores directly in data/config.json
                GAME_STATE.topScores = cfg.topScores.slice(0, 10);
            } else {
                // fallback: try to load a static data/topScores.json file (useful when
                // running the game as static files without the server API)
                try {
                    const resp2 = await fetch('data/topScores.json');
                    if (resp2 && resp2.ok) {
                        const staticScores = await resp2.json();
                        if (Array.isArray(staticScores) && staticScores.length > 0) {
                            GAME_STATE.topScores = staticScores.slice(0, 10);
                            console.log('Loaded top scores from static data/topScores.json');
                        } else {
                            GAME_STATE.topScores = [];
                        }
                    } else {
                        GAME_STATE.topScores = [];
                    }
                } catch (e) {
                    GAME_STATE.topScores = [];
                }
            }
        } catch (e) {
            GAME_STATE.topScores = Array.isArray(cfg.topScores) ? cfg.topScores.slice(0, 10) : [];
        }

        new Phaser.Game(config);

        // If the configuration asks for a fullscreen toggle, add a small DOM button.
        try {
            if (CONFIG.enableFullscreen) {
                const existing = document.getElementById('fullscreenBtn');
                if (!existing) {
                    const btn = document.createElement('button');
                    btn.id = 'fullscreenBtn';
                    btn.title = 'Toggle Fullscreen';
                    btn.innerText = '⤢';
                    Object.assign(btn.style, {
                        position: 'fixed',
                        right: '12px',
                        top: '12px',
                        zIndex: 9999,
                        padding: '6px 8px',
                        fontSize: '16px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'rgba(12,18,32,0.8)',
                        color: '#dbeeff',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                    });
                    btn.addEventListener('click', async () => {
                        try {
                            const container = document.getElementById('game-container') || document.documentElement;
                            if (document.fullscreenElement) {
                                await document.exitFullscreen();
                            } else if (container.requestFullscreen) {
                                await container.requestFullscreen();
                            } else if (container.webkitRequestFullscreen) {
                                // Safari
                                container.webkitRequestFullscreen();
                            }
                        } catch (e) {
                            console.warn('Fullscreen toggle failed', e);
                        }
                    });
                    // Keyboard shortcut: F toggles fullscreen
                    document.addEventListener('keydown', (ev) => {
                        if (ev && (ev.key === 'f' || ev.key === 'F')) {
                            ev.preventDefault?.();
                            btn.click();
                        }
                    });
                    // If device is touch-capable, make the button more prominent
                    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                        btn.style.padding = '10px 12px';
                        btn.style.fontSize = '20px';
                    }
                    document.body.appendChild(btn);
                }
            }
        } catch (e) {
            console.warn('Error creating fullscreen button', e);
        }

        return true;
    } catch (err) {
        console.error('Errore caricamento config.json:', err);
        alert('Impossibile caricare la configurazione del gioco.');
        return false;
    }
}

window.initialization = initialization;

window.addEventListener('load', async () => {
    await loadPressStartFont();

    if (await initialization()) {
        console.log('Gioco inizializzato con successo.');
    } else {
        console.error('Errore durante l\'inizializzazione del gioco.');
    }
});
