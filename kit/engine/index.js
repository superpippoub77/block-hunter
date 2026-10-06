// ============================================================================
// SpikeCode engine — avvio di un gioco
// ============================================================================
// Un gioco fatto con il motore ha solo:
//   game.js              startSpikeGame({ ... }) con quello che è suo (vedi sotto)
//   game.manifest.json   identità, blocchi, schermate e flusso tra le scene
//   game/                codice proprio del gioco (frame degli sprite, regole dei livelli, scene extra)
//   data/ assets/        configurazione, livelli, mapping, schermate, dizionari, immagini, suoni
//
//   import { startSpikeGame } from './kit/engine/index.js';
//   startSpikeGame({
//       identity: { id: 'my-game', title: 'My Game', storagePrefix: 'myGame' },
//       frames:   { OBJECT_FRAMES, TILE_FRAMES, WALL_TILE_COLS },   // spritesheet del gioco
//       levels:   LEVEL_CONFIG,                                     // regole dei livelli (facoltative)
//       scenes:   [{ key: 'BonusScene', factory: createBonusScene, after: 'GameScene' }],
//       newRun:   { lives: 5, dynamiteCount: 20 }
//   });
//
// Il motore crea le scene standard (preload, attract, top ten, crediti, config, scelta livello,
// gioco, game over), legge game.manifest.json, sostituisce le scene disegnate con l'editor delle
// schermate e avvia Phaser con data/config.json quando la pagina chiama window.inizialization()
// (index.html, dopo aver caricato il font). Restituisce { CONFIG, GAME_STATE, start, ... }.

import { createPreloadScene } from './preloadScene.js';
import { createAttractScene } from '../blocks/attract/index.js';
import { createTopTenScene } from '../blocks/top-ten/index.js';
import { createCreditsScene } from '../blocks/credits/index.js';
import { createConfigScene } from '../blocks/config/index.js';
import { createLevelSelectScene } from '../blocks/level-select/index.js';
import { createGameScene } from '../gameplay/gameScene.js';
import { createGameOverScene } from '../blocks/game-over/index.js';
import { createLanguageCarousel } from '../blocks/language/index.js';
import { createScreenScene } from '../blocks/screen/index.js';
import { createNameEntry, isHighScore, insertTopScore, saveTopScores } from '../blocks/score-entry/index.js';
import { createCreditsManager, isFreeplayEnabled as isFreeplayEnabledBase, hasStartAccessForPlayers as hasStartAccessForPlayersBase, consumeCreditsForPlayers as consumeCreditsForPlayersBase } from '../core/coins.js';
import { configureKit, kitFlow, kitGame } from '../core/flow.js';
import { loadManifest, checkBlocks } from '../core/blocks.js';
import { loadTranslations as loadTranslationsBase } from '../core/i18n.js';
import {
    drawTextPanel as drawTextPanelBase,
    getTextureMaxNumericFrame as getTextureMaxNumericFrameBase,
    playLoopAudioSafely as playLoopAudioSafelyBase,
    addSpikeCredit as addSpikeCreditBase
} from '../core/ui.js';
import { applyMappingFrameOverrides as applyMappingFrameOverridesBase, loadGameplayMappings as loadGameplayMappingsBase } from './mappings.js';
import { clearRuntimeMatchStorage as clearRuntimeMatchStorageBase, resetGameStateForNewRun as resetGameStateForNewRunBase } from './state.js';
import { LOG_LEVELS, LOG_LEVEL_NAMES, normalizeLogLevel, readInitialLogLevel, createLogger } from './logging.js';
import {
    inferPurposeFromName,
    getFunctionParamNames,
    inferOutputFromName,
    toDocEntry,
    buildTopLevelFunctionDocs as buildTopLevelFunctionDocsBase,
    buildSceneMethodsDocs as buildSceneMethodsDocsBase,
    chooseTraceLevel,
    instrumentSceneMethods as instrumentSceneMethodsBase
} from './docs.js';
import { queueLegacyPreloadAssets as queueLegacyPreloadAssetsBase, queueAssetsFromManifest as queueAssetsFromManifestBase } from './preload.js';
import { mergeLocalConfig as mergeLocalConfigBase } from './config.js';
import { resolveContactSpec as resolveContactSpecBase } from './contact.js';
import { getLevelFileName as getLevelFileNameBase, getLevelMasterNumber as getLevelMasterNumberBase, parseExitTargetLevel as parseExitTargetLevelBase } from './levels.js';
import { inizialization } from './bootstrap.js';

export const ENGINE_VERSION = '1.0.0';


/** Standard scenes in start order; a game can add its own with `scenes` (inserted after `after`) */
const STANDARD_SCENES = [
    ['PreloadScene', createPreloadScene],
    ['AttractScene', createAttractScene],
    ['TopTenScene', createTopTenScene],
    ['CreditsScene', createCreditsScene],
    ['ConfigScene', createConfigScene],
    ['LevelSelectScene', createLevelSelectScene],
    ['GameScene', createGameScene],
    ['GameOverScene', createGameOverScene]
];

export function startSpikeGame(game = {}) {
    const Phaser = game.Phaser || window.Phaser;
    const identity = Object.assign({ id: 'game', title: 'Game', storagePrefix: 'spikeGame' }, game.identity || {});
    // identity first: storage keys (config, log level, test level…) depend on it
    configureKit({ game: identity });

    // "T" held during boot opens the configuration (PreloadScene)
    try {
        window.SPIKE_STARTUP_CONFIG = false;
        window.addEventListener('keydown', (ev) => { if (ev && typeof ev.key === 'string' && ev.key.toLowerCase() === 't') window.SPIKE_STARTUP_CONFIG = true; });
        window.addEventListener('keyup', (ev) => { if (ev && typeof ev.key === 'string' && ev.key.toLowerCase() === 't') window.SPIKE_STARTUP_CONFIG = false; });
    } catch (e) { /* ignore */ }

    const CONFIG = {};      // data/config.json + saved preferences
    const GAME_STATE = {};  // state of the current run
    const TRANSLATIONS = {};
    const GAME_FONT = game.font || '"Press Start 2P"';
    const HUD_DEPTH = Number(game.hudDepth) || 10000;

    const frames = game.frames || {};
    const OBJECT_FRAMES = frames.OBJECT_FRAMES || {};
    const TILE_FRAMES = frames.TILE_FRAMES || {};
    const WALL_TILE_COLS = Number(frames.WALL_TILE_COLS) || 6;
    const native = game.native || {};
    const TILE_NATIVE_WIDTH = Number(native.tileWidth) || 64;
    const TILE_NATIVE_HEIGHT = Number(native.tileHeight) || 48;
    const OBJECT_NATIVE_SIZE = Number(native.objectSize) || 64;
    const defaultFrame = { frameWidth: OBJECT_NATIVE_SIZE, frameHeight: OBJECT_NATIVE_SIZE };
    const PRELOAD_ASSET_MANIFEST_KEY = 'preload_asset_manifest';
    const PRELOAD_ASSET_MANIFEST_PATH = game.assetManifest || 'data/data.json';
    const PRELOAD_SPRITESHEET_CONFIGS = game.spritesheets || {};
    const LEVEL_CONFIG = game.levels || { globalRules: {}, levels: [] };
    const newRun = game.newRun || {};

    const LOGGER = createLogger();

    const applyMappingFrameOverrides = (mappings) => applyMappingFrameOverridesBase(mappings, OBJECT_FRAMES, TILE_FRAMES);
    const loadGameplayMappings = () => loadGameplayMappingsBase(applyMappingFrameOverrides);
    const isFreeplayEnabled = () => isFreeplayEnabledBase(CONFIG);
    const hasStartAccessForPlayers = (players) => hasStartAccessForPlayersBase(CONFIG, GAME_STATE, players);
    const consumeCreditsForPlayers = (players) => consumeCreditsForPlayersBase(CONFIG, GAME_STATE, players);
    const queueLegacyPreloadAssets = (scene) => queueLegacyPreloadAssetsBase(scene, LOGGER, PRELOAD_SPRITESHEET_CONFIGS);
    const queueAssetsFromManifest = (scene, manifest) => queueAssetsFromManifestBase(scene, manifest, LOGGER, PRELOAD_SPRITESHEET_CONFIGS);
    const mergeLocalConfig = () => mergeLocalConfigBase(CONFIG, OBJECT_NATIVE_SIZE, LOGGER);
    const loadTranslations = (lang, callback) => loadTranslationsBase(lang, TRANSLATIONS, LOGGER, callback);
    const clearRuntimeMatchStorage = () => clearRuntimeMatchStorageBase(LOGGER);
    const resetGameStateForNewRun = (players = 1) => resetGameStateForNewRunBase(GAME_STATE, clearRuntimeMatchStorage, LOGGER, players, newRun);
    const drawTextPanel = (graphics, textObj, opts = {}) => drawTextPanelBase(graphics, textObj, opts, LOGGER);
    const getTextureMaxNumericFrame = (scene, textureKey, fallback = 0) => getTextureMaxNumericFrameBase(scene, textureKey, fallback, LOGGER);
    const playLoopAudioSafely = (scene, key, volume = 0.3) => playLoopAudioSafelyBase(scene, key, volume, LOGGER);
    const resolveContactSpec = (typename) => resolveContactSpecBase(CONFIG, typename, LOGGER);
    const getLevelFileName = (levelIndex) => getLevelFileNameBase(levelIndex, LOGGER);
    const getLevelMasterNumber = (levelIndex) => getLevelMasterNumberBase(levelIndex, LOGGER);
    const parseExitTargetLevel = (rawTarget) => parseExitTargetLevelBase(rawTarget, LEVEL_CONFIG, LOGGER);
    const addSpikeCredit = (scene, opts = {}) => addSpikeCreditBase(scene, CONFIG, GAME_FONT, LOGGER, opts);
    const buildSceneMethodsDocs = (sceneClasses) => buildSceneMethodsDocsBase(sceneClasses, toDocEntry);
    const instrumentSceneMethods = (sceneClasses) => instrumentSceneMethodsBase(sceneClasses, LOGGER, chooseTraceLevel);

    // Services passed to every scene factory (blocks, gameplay, the game's own scenes)
    const services = {
        Phaser, CONFIG, GAME_STATE, GAME_FONT, HUD_DEPTH, TRANSLATIONS, LOGGER,
        OBJECT_FRAMES, TILE_FRAMES, WALL_TILE_COLS,
        TILE_NATIVE_WIDTH, TILE_NATIVE_HEIGHT, OBJECT_NATIVE_SIZE, defaultFrame,
        PRELOAD_ASSET_MANIFEST_KEY, PRELOAD_ASSET_MANIFEST_PATH, PRELOAD_SPRITESHEET_CONFIGS,
        LOG_LEVELS, LOG_LEVEL_NAMES, normalizeLogLevel, readInitialLogLevel,
        inferPurposeFromName, getFunctionParamNames, inferOutputFromName, toDocEntry,
        buildSceneMethodsDocs, chooseTraceLevel, instrumentSceneMethods,
        applyMappingFrameOverrides, isFreeplayEnabled, hasStartAccessForPlayers, consumeCreditsForPlayers,
        queueLegacyPreloadAssets, queueAssetsFromManifest, mergeLocalConfig, loadTranslations,
        clearRuntimeMatchStorage, resetGameStateForNewRun,
        drawTextPanel, getTextureMaxNumericFrame, playLoopAudioSafely, resolveContactSpec,
        LEVEL_CONFIG, getLevelFileName, getLevelMasterNumber, parseExitTargetLevel, addSpikeCredit,
        createCreditsManager, createLanguageCarousel,
        createNameEntry, isHighScore, insertTopScore, saveTopScores,
        kitFlow, kitGame,
        ...(game.services || {})
    };

    // standard scenes + the game's own scenes
    const order = STANDARD_SCENES.map(([key, factory]) => ({ key, factory }));
    (game.scenes || []).forEach((sc) => {
        if (!sc || !sc.key || typeof sc.factory !== 'function') return;
        const existing = order.findIndex((o) => o.key === sc.key);
        if (existing >= 0) { order[existing] = { key: sc.key, factory: sc.factory }; return; }
        const at = sc.after ? order.findIndex((o) => o.key === sc.after) : -1;
        if (at >= 0) order.splice(at + 1, 0, { key: sc.key, factory: sc.factory });
        else order.splice(Math.max(1, order.length - 1), 0, { key: sc.key, factory: sc.factory });
    });
    const scenes = order.map(({ key, factory }) => [key, factory(services)]);
    const sceneClasses = scenes.map(([, cls]) => cls);

    const buildTopLevelFunctionDocs = () => buildTopLevelFunctionDocsBase(toDocEntry, {
        queueLegacyPreloadAssets, queueAssetsFromManifest, mergeLocalConfig, loadTranslations,
        clearRuntimeMatchStorage, resetGameStateForNewRun, drawTextPanel, getTextureMaxNumericFrame,
        playLoopAudioSafely, resolveContactSpec, getLevelFileName, getLevelMasterNumber,
        parseExitTargetLevel, addSpikeCredit, inizialization
    });
    services.buildTopLevelFunctionDocs = buildTopLevelFunctionDocs;

    // index.html calls window.inizialization() once the font is loaded
    const start = () => inizialization({
        Phaser,
        configStore: CONFIG,
        gameState: GAME_STATE,
        objectNativeSize: OBJECT_NATIVE_SIZE,
        scenes,
        sceneClasses,
        instrumentSceneMethods,
        loadGameplayMappings,
        loadKit: async () => {
            // game.manifest.json: game identity, blocks used and scene flow (see kit/README.md)
            const manifest = await loadManifest(game.manifest || 'game.manifest.json');
            if (manifest) manifest.game = Object.assign({}, identity, manifest.game || {});
            configureKit(manifest);
            const screenScenes = {};
            if (manifest) {
                const report = await checkBlocks(manifest, services, LOGGER);
                Object.entries(manifest.screens || {}).forEach(([key, sc]) => {
                    screenScenes[key] = createScreenScene(services, { key, id: sc.id, src: sc.src });
                });
                try { window.SPIKE_KIT = { engine: ENGINE_VERSION, manifest, blocks: report, screens: Object.keys(screenScenes) }; } catch (e) { }
            }
            return { manifest, screenScenes };
        },
        logger: LOGGER
    });
    try { window.inizialization = start; } catch (e) { /* ignore */ }

    const FUNCTION_DOCS = Object.freeze({
        generatedAt: new Date().toISOString(),
        logLevels: Object.keys(LOG_LEVELS),
        topLevel: buildTopLevelFunctionDocs(),
        methods: buildSceneMethodsDocs(sceneClasses)
    });
    try {
        window.SPIKE_LOG = LOGGER;
        window.SPIKE_FUNCTION_DOCS = FUNCTION_DOCS;
        window.getSpikeFunctionDocs = () => FUNCTION_DOCS;
        LOGGER.info('BOOT', `SpikeCode engine ${ENGINE_VERSION} · ${identity.title}. Documentazione funzioni: window.getSpikeFunctionDocs()`);
    } catch (e) { /* ignore */ }

    return { CONFIG, GAME_STATE, TRANSLATIONS, LOGGER, services, scenes, start };
}
