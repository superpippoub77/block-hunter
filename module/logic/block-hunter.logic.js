function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function createFullscreenButton() {
  const existing = document.getElementById('fullscreenBtn');
  if (existing) return;

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

export function createGameLogic() {
  return {
    stateKeys: [
      'credits',
      'language',
      'difficulty',
      'currentLevel',
      'score',
      'lives',
      'dynamiteCount',
      'keysCount',
      'woodenCount'
    ],

    sceneFactories: {},

    prepareConfig({ cfg, CONFIG, OBJECT_NATIVE_SIZE }) {
      const configIn = ensureObject(cfg);
      Object.assign(CONFIG, configIn);

      try {
        CONFIG.tokenMap = Object.assign({}, CONFIG.tokenMap || {}, configIn.tokenMap || {});
      } catch (_e) {
        CONFIG.tokenMap = CONFIG.tokenMap || {};
      }

      if (!Number.isFinite(Number(CONFIG.playerSize)) || Number(CONFIG.playerSize) <= 0) {
        CONFIG.playerSize = Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE;
      }
      if (!Number.isFinite(Number(CONFIG.dynamiteSize)) || Number(CONFIG.dynamiteSize) <= 0) {
        CONFIG.dynamiteSize = Math.max(8, Math.round((Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE) * 0.6));
      }
    },

    resolveScaleMode({ Phaser, CONFIG }) {
      const requestedScaleMode = String(CONFIG.scaleMode || 'FIT').toUpperCase();
      if (requestedScaleMode === 'ENVELOP' || requestedScaleMode === 'ENVELOPE') return Phaser.Scale.ENVELOP;
      if (requestedScaleMode === 'NONE') return Phaser.Scale.NONE;
      if (requestedScaleMode === 'RESIZE') return Phaser.Scale.RESIZE;
      return Phaser.Scale.FIT;
    },

    buildPhaserConfig({ Phaser, CONFIG, sceneOrder, scaleMode }) {
      return {
        type: Phaser.AUTO,
        scale: {
          mode: scaleMode,
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
        scene: sceneOrder
      };
    },

    applyInitialGameState({ cfg, GAME_STATE, STARTUP_SETTINGS, isFreePlayMode, stateKeys }) {
      stateKeys.forEach((key) => {
        if (cfg[key] !== undefined) GAME_STATE[key] = cfg[key];
      });

      if (isFreePlayMode()) {
        GAME_STATE.credits = Number.MAX_SAFE_INTEGER;
      } else {
        GAME_STATE.credits = Math.max(
          0,
          Math.floor(Number(STARTUP_SETTINGS.startup?.initialCredits) || Number(GAME_STATE.credits) || 0)
        );
      }
    },

    async resolveTopScores({ cfg, topScoresApiPath, topScoresPath }) {
      let serverTopScores = null;
      try {
        const resp = await fetch(topScoresApiPath, { cache: 'no-store' });
        if (resp && resp.ok) {
          serverTopScores = await resp.json();
        }
      } catch (_e) {
        serverTopScores = null;
      }

      if (Array.isArray(serverTopScores) && serverTopScores.length > 0) {
        return serverTopScores.slice(0, 10);
      }

      if (Array.isArray(cfg.topScores)) {
        return cfg.topScores.slice(0, 10);
      }

      try {
        const resp2 = await fetch(topScoresPath, { cache: 'no-store' });
        if (!resp2 || !resp2.ok) return [];
        const staticScores = await resp2.json();
        if (Array.isArray(staticScores) && staticScores.length > 0) {
          console.log(`Loaded top scores from static ${topScoresPath}`);
          return staticScores.slice(0, 10);
        }
      } catch (_e) {
        return [];
      }

      return [];
    },

    afterGameCreated({ CONFIG }) {
      if (CONFIG.enableFullscreen) {
        createFullscreenButton();
      }
    }
  };
}
