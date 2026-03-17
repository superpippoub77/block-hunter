import {
  CONFIG,
  GAME_STATE,
  STARTUP_SETTINGS,
  OBJECT_NATIVE_SIZE,
  buildSceneClasses,
  loadStartupSettings,
  loadFrontScenesSettings,
  loadFrameConstants,
  loadCustomEffectLibrary,
  isFreePlayMode
} from '../game.js';

const DEFAULT_CORE_PROFILE = {
  logicModule: 'module/logic/block-hunter.logic.js',
  paths: {
    config: 'data/config.json',
    startup: 'data/start.json',
    frontScenes: 'data/front-scenes.json',
    constants: 'data/constants.json',
    topScoresApi: '/api/top-scores',
    topScores: 'data/topScores.json',
    manifests: {
      imagesGameBackground: 'data/images/images-scenes-game-background.json',
      imagesGameForeground: 'data/images/images-scenes-game-foreground.json',
      imagesAttractMode: 'data/images/images-scenes-attractmode.json',
      musicGame: 'data/music/music-scenes-game.json',
      musicAttractMode: 'data/music/music-scenes-attractmode.json'
    }
  }
};

const DEFAULT_STATE_KEYS = [
  'credits',
  'language',
  'difficulty',
  'currentLevel',
  'score',
  'lives',
  'dynamiteCount',
  'keysCount',
  'woodenCount'
];

/**
 * Verifica se il valore e un oggetto plain (non array).
 * @param {unknown} value Valore da verificare.
 * @returns {boolean} true se object valido.
 */
function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Normalizza il profilo core del gioco applicando fallback sui path obbligatori.
 * @param {unknown} rawProfile Profilo grezzo caricato da JSON.
 * @returns {{logicModule:string,paths:object}} Profilo core normalizzato.
 */
function normalizeCoreProfile(rawProfile) {
  const raw = isObject(rawProfile) ? rawProfile : {};
  const rawPaths = isObject(raw.paths) ? raw.paths : {};
  const rawManifests = isObject(rawPaths.manifests) ? rawPaths.manifests : {};

  return {
    logicModule: String(raw.logicModule || DEFAULT_CORE_PROFILE.logicModule).trim() || DEFAULT_CORE_PROFILE.logicModule,
    paths: {
      config: String(rawPaths.config || DEFAULT_CORE_PROFILE.paths.config).trim() || DEFAULT_CORE_PROFILE.paths.config,
      startup: String(rawPaths.startup || DEFAULT_CORE_PROFILE.paths.startup).trim() || DEFAULT_CORE_PROFILE.paths.startup,
      frontScenes: String(rawPaths.frontScenes || DEFAULT_CORE_PROFILE.paths.frontScenes).trim() || DEFAULT_CORE_PROFILE.paths.frontScenes,
      constants: String(rawPaths.constants || DEFAULT_CORE_PROFILE.paths.constants).trim() || DEFAULT_CORE_PROFILE.paths.constants,
      topScoresApi: String(rawPaths.topScoresApi || DEFAULT_CORE_PROFILE.paths.topScoresApi).trim() || DEFAULT_CORE_PROFILE.paths.topScoresApi,
      topScores: String(rawPaths.topScores || DEFAULT_CORE_PROFILE.paths.topScores).trim() || DEFAULT_CORE_PROFILE.paths.topScores,
      manifests: {
        imagesGameBackground: String(rawManifests.imagesGameBackground || DEFAULT_CORE_PROFILE.paths.manifests.imagesGameBackground),
        imagesGameForeground: String(rawManifests.imagesGameForeground || DEFAULT_CORE_PROFILE.paths.manifests.imagesGameForeground),
        imagesAttractMode: String(rawManifests.imagesAttractMode || DEFAULT_CORE_PROFILE.paths.manifests.imagesAttractMode),
        musicGame: String(rawManifests.musicGame || DEFAULT_CORE_PROFILE.paths.manifests.musicGame),
        musicAttractMode: String(rawManifests.musicAttractMode || DEFAULT_CORE_PROFILE.paths.manifests.musicAttractMode)
      }
    }
  };
}

/**
 * Carica il profilo core da data/game-core.json con fallback ai default.
 * @returns {Promise<{logicModule:string,paths:object}>} Profilo core normalizzato.
 */
async function loadGameCoreProfile() {
  try {
    const resp = await fetch('data/game-core.json', { cache: 'no-store' });
    if (!resp || !resp.ok) return normalizeCoreProfile({});
    const parsed = await resp.json();
    return normalizeCoreProfile(parsed);
  } catch (_e) {
    return normalizeCoreProfile({});
  }
}

/**
 * Converte un path modulo in import path relativo al file utility.
 * @param {unknown} pathLike Path sorgente.
 * @returns {string} Path normalizzato per import dinamico.
 */
function toUtilityImportPath(pathLike) {
  const raw = String(pathLike || '').trim();
  if (!raw) return '';
  if (/^(https?:|blob:|data:)/i.test(raw)) return raw;
  if (raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('/')) return raw;
  return `../${raw.replace(/^\/+/, '')}`;
}

/**
 * Costruisce una logica fallback usata quando il modulo logico custom non e disponibile.
 * @returns {object} Oggetto logica completo con metodi base.
 */
function buildFallbackLogic() {
  return {
    stateKeys: DEFAULT_STATE_KEYS,
    sceneFactories: {},
    prepareConfig({ cfg, CONFIG, OBJECT_NATIVE_SIZE }) {
      Object.assign(CONFIG, cfg || {});
      try {
        CONFIG.tokenMap = Object.assign({}, CONFIG.tokenMap || {}, (cfg && cfg.tokenMap) || {});
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
      stateKeys.forEach((k) => {
        if (cfg[k] !== undefined) GAME_STATE[k] = cfg[k];
      });
      if (isFreePlayMode()) {
        GAME_STATE.credits = Number.MAX_SAFE_INTEGER;
      } else {
        GAME_STATE.credits = Math.max(0, Math.floor(Number(STARTUP_SETTINGS.startup?.initialCredits) || Number(GAME_STATE.credits) || 0));
      }
    },
    async resolveTopScores({ cfg, topScoresApiPath, topScoresPath }) {
      try {
        let serverTopScores = null;
        try {
          const resp = await fetch(topScoresApiPath, { cache: 'no-store' });
          if (resp && resp.ok) serverTopScores = await resp.json();
        } catch (_e) {
          serverTopScores = null;
        }

        if (Array.isArray(serverTopScores) && serverTopScores.length > 0) {
          return serverTopScores.slice(0, 10);
        }
        if (Array.isArray(cfg.topScores)) {
          return cfg.topScores.slice(0, 10);
        }
        const resp2 = await fetch(topScoresPath, { cache: 'no-store' });
        if (resp2 && resp2.ok) {
          const staticScores = await resp2.json();
          if (Array.isArray(staticScores) && staticScores.length > 0) {
            return staticScores.slice(0, 10);
          }
        }
      } catch (_e) {
        // ignore
      }
      return [];
    },
    afterGameCreated() {
      // No-op in fallback logic.
    }
  };
}

/**
 * Carica il modulo logico dichiarato nel core profile.
 * Se fallisce, ritorna la logica fallback.
 * @param {{logicModule:string}} coreProfile Profilo core normalizzato.
 * @returns {Promise<object>} Logica di gioco pronta all'uso.
 */
async function loadGameLogic(coreProfile) {
  const fallback = buildFallbackLogic();
  const importPath = toUtilityImportPath(coreProfile.logicModule);
  if (!importPath) return fallback;

  try {
    const moduleNs = await import(importPath);
    const createLogic = moduleNs.createGameLogic;
    if (typeof createLogic !== 'function') return fallback;

    const created = createLogic({ coreProfile });
    if (!isObject(created)) return fallback;

    return {
      ...fallback,
      ...created,
      stateKeys: Array.isArray(created.stateKeys) && created.stateKeys.length ? created.stateKeys : fallback.stateKeys,
      sceneFactories: isObject(created.sceneFactories) ? created.sceneFactories : fallback.sceneFactories
    };
  } catch (e) {
    console.warn('[GameCore] logic module fallback:', e);
    return fallback;
  }
}

/**
 * Carica il font principale del gioco (Press Start 2P) con fallback silenzioso.
 * @returns {Promise<void>}
 */
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

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  } catch (e) {
    console.warn('Impossibile caricare il font personalizzato, si usera il fallback.', e);
  }
}

/**
 * Bootstrap completo dell'applicazione: profilo core, config, startup,
 * costanti frame, libreria effetti, stato iniziale e istanza Phaser.
 * @returns {Promise<boolean>} true se inizializzazione completata, false in caso di errore.
 */
async function initialization() {
  try {
    const coreProfile = await loadGameCoreProfile();
    const logic = await loadGameLogic(coreProfile);
    const paths = coreProfile.paths;

    window.__BLOCKHUNTER_GAME_CORE__ = coreProfile;

    const response = await fetch(paths.config, { cache: 'no-store' });
    if (!response || !response.ok) {
      throw new Error(`Impossibile caricare ${paths.config} (HTTP ${response?.status ?? 'n/a'})`);
    }
    const cfg = await response.json();

    await loadStartupSettings(paths.startup);
    await loadFrontScenesSettings(paths.frontScenes);
    await loadFrameConstants(cfg, paths.constants);

    if (typeof logic.prepareConfig === 'function') {
      logic.prepareConfig({
        cfg,
        CONFIG,
        OBJECT_NATIVE_SIZE,
        coreProfile,
        manifestPaths: paths.manifests
      });
    }

    try {
      const lib = await loadCustomEffectLibrary();
      const loadedCount = Object.keys((lib && lib.effects) || {}).length;
      if (loadedCount > 0) {
        console.log(`[EffectLibrary] Loaded ${loadedCount} custom effects`);
      }
    } catch (e) {
      console.warn('[EffectLibrary] bootstrap warning:', e);
    }

    const sceneBundle = buildSceneClasses(logic.sceneFactories || {});
    const baseSceneOrder = [
      sceneBundle.PreloadScene,
      sceneBundle.AttractScene,
      sceneBundle.TopTenScene,
      sceneBundle.CreditsScene,
      sceneBundle.ConfigScene,
      sceneBundle.LevelSelectScene,
      sceneBundle.GameScene,
      sceneBundle.BonusScene,
      sceneBundle.GameOverScene
    ];
    const baseKeys = new Set([
      'PreloadScene',
      'AttractScene',
      'TopTenScene',
      'CreditsScene',
      'ConfigScene',
      'LevelSelectScene',
      'GameScene',
      'BonusScene',
      'GameOverScene'
    ]);
    const dynamicSceneOrder = Object.entries(sceneBundle)
      .filter(([key, ctor]) => !baseKeys.has(key) && typeof ctor === 'function')
      .map(([, ctor]) => ctor);
    const sceneOrder = [...baseSceneOrder, ...dynamicSceneOrder];

    const scaleMode = (typeof logic.resolveScaleMode === 'function')
      ? logic.resolveScaleMode({ Phaser, CONFIG, cfg, coreProfile })
      : Phaser.Scale.FIT;

    const phaserConfig = (typeof logic.buildPhaserConfig === 'function')
      ? logic.buildPhaserConfig({ Phaser, CONFIG, cfg, sceneBundle, sceneOrder, scaleMode, coreProfile })
      : null;

    if (!phaserConfig || typeof phaserConfig !== 'object') {
      throw new Error('La logica di gioco non ha prodotto una configurazione Phaser valida.');
    }

    if (typeof logic.applyInitialGameState === 'function') {
      logic.applyInitialGameState({
        cfg,
        GAME_STATE,
        STARTUP_SETTINGS,
        isFreePlayMode,
        stateKeys: logic.stateKeys || DEFAULT_STATE_KEYS,
        coreProfile
      });
    }

    if (typeof logic.resolveTopScores === 'function') {
      GAME_STATE.topScores = await logic.resolveTopScores({
        cfg,
        GAME_STATE,
        topScoresApiPath: paths.topScoresApi,
        topScoresPath: paths.topScores,
        coreProfile
      });
    }

    if (!Array.isArray(GAME_STATE.topScores)) {
      GAME_STATE.topScores = [];
    }

    const gameInstance = new Phaser.Game(phaserConfig);

    if (typeof logic.afterGameCreated === 'function') {
      logic.afterGameCreated({ gameInstance, CONFIG, GAME_STATE, coreProfile, sceneBundle });
    }

    return true;
  } catch (err) {
    console.error('Errore durante initialization:', err);
    alert('Impossibile inizializzare il gioco. Controlla i JSON del core e la logica di gioco.');
    return false;
  }
}

window.initialization = initialization;

window.addEventListener('load', async () => {
  await loadPressStartFont();

  if (await initialization()) {
    console.log('Gioco inizializzato con successo.');
  } else {
    console.error('Errore durante initialization.');
  }
});
