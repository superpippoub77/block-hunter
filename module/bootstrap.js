export async function inizialization(deps) {
    const {
        Phaser,
        configStore,
        gameState,
        objectNativeSize,
        preloadScene,
        attractScene,
        topTenScene,
        creditsScene,
        configScene,
        levelSelectScene,
        gameScene,
        bonusScene,
        gameOverScene,
        blockHunterSceneClasses,
        instrumentSceneMethods,
        loadGameplayMappings,
        logger
    } = deps;

    try {
        instrumentSceneMethods(blockHunterSceneClasses);
        logger.info('BOOT', 'Tracing scene methods attivato.', `level=${logger.getLevel()}`);

        const mappings = await loadGameplayMappings();
        logger.debug('BOOT', 'Mapping gameplay caricati', `entities=${Object.keys(mappings.entities?.entities || {}).length}, tiles=${Object.keys(mappings.tiles?.tiles || {}).length}, effects=${Object.keys(mappings.effects?.effectProfiles || {}).length}`);

        const response = await fetch('data/config.json');
        const cfg = await response.json();
        logger.debug('BOOT', 'Config caricata da data/config.json');
        Object.assign(configStore, cfg);

        try {
            configStore.tokenMap = Object.assign({}, configStore.tokenMap || {}, cfg.tokenMap || {});
        } catch (e) {
            configStore.tokenMap = configStore.tokenMap || {};
        }

        if (!Number.isFinite(Number(configStore.playerSize)) || Number(configStore.playerSize) <= 0) {
            configStore.playerSize = Number(configStore.objectSize) || objectNativeSize;
        }
        if (!Number.isFinite(Number(configStore.ghostSpeed)) || Number(configStore.ghostSpeed) <= 0) {
            configStore.ghostSpeed = 80;
        }
        if (!Number.isFinite(Number(configStore.dynamiteSize)) || Number(configStore.dynamiteSize) <= 0) {
            configStore.dynamiteSize = Math.max(8, Math.round((Number(configStore.objectSize) || objectNativeSize) * 0.6));
        }

        const isTouchDevice = (() => {
            try {
                return ('ontouchstart' in window)
                    || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
                    || /Mobi|Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent || '');
            } catch (e) {
                return false;
            }
        })();

        const baseScaleMode = String(configStore.scaleMode || 'FIT').toUpperCase();
        const mobileScaleMode = String(configStore.mobileScaleMode || baseScaleMode).toUpperCase();
        const requestedScaleMode = isTouchDevice ? mobileScaleMode : baseScaleMode;
        let phaserScaleMode = Phaser.Scale.FIT;
        if (requestedScaleMode === 'ENVELOP' || requestedScaleMode === 'ENVELOPE') phaserScaleMode = Phaser.Scale.ENVELOP;
        else if (requestedScaleMode === 'NONE') phaserScaleMode = Phaser.Scale.NONE;
        else if (requestedScaleMode === 'RESIZE') phaserScaleMode = Phaser.Scale.RESIZE;

        const gameWidth = Number(configStore.width) || 800;
        const gameHeight = Number(configStore.height) || 600;
        let effectiveScaleMode = phaserScaleMode;
        if (configStore.responsiveMode && effectiveScaleMode === Phaser.Scale.RESIZE) {
            logger.warn('BOOT', 'responsiveMode + RESIZE can break fixed-coordinate scenes; using FIT.');
            effectiveScaleMode = Phaser.Scale.FIT;
        }

        const config = {
            type: Phaser.AUTO,
            scale: {
                mode: effectiveScaleMode,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                parent: 'game-container',
                width: gameWidth,
                height: gameHeight
            },
            backgroundColor: '#000000',
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0 },
                    debug: false
                }
            },
            scene: [preloadScene, attractScene, topTenScene, creditsScene, configScene, levelSelectScene, gameScene, bonusScene, gameOverScene]
        };

        const stateKeys = [
            'credits', 'language', 'difficulty', 'currentLevel', 'score', 'lives', 'dynamiteCount', 'keysCount', 'woodenCount'
        ];
        stateKeys.forEach((k) => {
            if (cfg[k] !== undefined) gameState[k] = cfg[k];
        });

        try {
            let serverTopScores = null;
            try {
                const resp = await fetch('/api/top-scores');
                if (resp && resp.ok) {
                    serverTopScores = await resp.json();
                }
            } catch (e) { serverTopScores = null; }

            if (Array.isArray(serverTopScores) && serverTopScores.length > 0) {
                gameState.topScores = serverTopScores.slice(0, 10);
            } else if (Array.isArray(cfg.topScores)) {
                gameState.topScores = cfg.topScores.slice(0, 10);
            } else {
                try {
                    const resp2 = await fetch('data/topScores.json');
                    if (resp2 && resp2.ok) {
                        const staticScores = await resp2.json();
                        if (Array.isArray(staticScores) && staticScores.length > 0) {
                            gameState.topScores = staticScores.slice(0, 10);
                            console.log('Loaded top scores from static data/topScores.json');
                        } else {
                            gameState.topScores = [];
                        }
                    } else {
                        gameState.topScores = [];
                    }
                } catch (e) {
                    gameState.topScores = [];
                }
            }
        } catch (e) {
            gameState.topScores = Array.isArray(cfg.topScores) ? cfg.topScores.slice(0, 10) : [];
        }

        const game = new Phaser.Game(config);
        logger.info('BOOT', 'Istanza Phaser.Game creata con successo.');

        if (configStore.responsiveMode) {
            const updateOrientationClass = () => {
                try {
                    const isPortrait = window.innerHeight >= window.innerWidth;
                    if (document && document.body) {
                        document.body.classList.toggle('portrait', isPortrait);
                        document.body.classList.toggle('landscape', !isPortrait);
                    }
                } catch (e) { }
            };

            const refreshScale = () => {
                if (game && game.scale) {
                    game.scale.refresh();
                }
                updateOrientationClass();
                logger.debug('BOOT', 'Window resize handled', `viewport=${window.innerWidth}x${window.innerHeight}`);
            };

            window.addEventListener('resize', refreshScale);
            window.addEventListener('orientationchange', () => {
                // iOS/Safari can report stale dimensions briefly right after rotation
                setTimeout(refreshScale, 60);
                setTimeout(refreshScale, 240);
            });
            try {
                if (window.visualViewport) {
                    window.visualViewport.addEventListener('resize', refreshScale);
                }
            } catch (e) { }

            updateOrientationClass();
        }

        try {
            if (configStore.enableFullscreen) {
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
                                container.webkitRequestFullscreen();
                            }
                        } catch (e) {
                            console.warn('Fullscreen toggle failed', e);
                        }
                    });

                    document.addEventListener('keydown', (ev) => {
                        if (ev && (ev.key === 'f' || ev.key === 'F')) {
                            ev.preventDefault?.();
                            btn.click();
                        }
                    });

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
        logger.error('BOOT', 'Errore durante inizializzazione gioco', err);
        console.error('Errore caricamento config.json:', err);
        alert('Impossibile caricare la configurazione del gioco.');
        return false;
    }
}
