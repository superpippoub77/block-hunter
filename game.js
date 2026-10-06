// ============================================================================
// BLOCKHUNTER - Arcade Game in Phaser 3
// ============================================================================

import { OBJECT_FRAMES, TILE_FRAMES, WALL_TILE_COLS } from './data/module/constants.js';
import { createPreloadScene } from './module/scenes/preloadScene.js';
import { createAttractScene } from './kit/blocks/attract/index.js';
import { createTopTenScene } from './kit/blocks/top-ten/index.js';
import { createCreditsScene } from './kit/blocks/credits/index.js';
import { createConfigScene } from './kit/blocks/config/index.js';
import { createLevelSelectScene } from './kit/blocks/level-select/index.js';
import { createGameScene } from './kit/gameplay/gameScene.js';
import { createBonusScene } from './module/scenes/bonusScene.js';
import { createGameOverScene } from './kit/blocks/game-over/index.js';
import { createLanguageCarousel } from './kit/blocks/language/index.js';
import { createCreditsManager, isFreeplayEnabled as isFreeplayEnabledBase, hasStartAccessForPlayers as hasStartAccessForPlayersBase, consumeCreditsForPlayers as consumeCreditsForPlayersBase } from './kit/core/coins.js';
import { configureKit, kitFlow, kitGame } from './kit/core/flow.js';
import { createNameEntry, isHighScore, insertTopScore, saveTopScores } from './kit/blocks/score-entry/index.js';
import { loadManifest, checkBlocks } from './kit/core/blocks.js';
import { createScreenScene } from './kit/blocks/screen/index.js';
import { loadTranslations as loadTranslationsBase } from './kit/core/i18n.js';
import { applyMappingFrameOverrides as applyMappingFrameOverridesBase, loadGameplayMappings as loadGameplayMappingsBase } from './module/mappingUtils.js';
import {
    clearRuntimeMatchStorage as clearRuntimeMatchStorageBase,
    resetGameStateForNewRun as resetGameStateForNewRunBase
} from './module/stateUtils.js';
import { LOG_LEVELS, LOG_LEVEL_NAMES, normalizeLogLevel, readInitialLogLevel, createLogger } from './module/loggingUtils.js';
import {
    inferPurposeFromName,
    getFunctionParamNames,
    inferOutputFromName,
    toDocEntry,
    buildTopLevelFunctionDocs as buildTopLevelFunctionDocsBase,
    buildSceneMethodsDocs as buildSceneMethodsDocsBase,
    chooseTraceLevel,
    instrumentSceneMethods as instrumentSceneMethodsBase
} from './module/docUtils.js';
import { queueLegacyPreloadAssets as queueLegacyPreloadAssetsBase, queueAssetsFromManifest as queueAssetsFromManifestBase } from './module/preloadUtils.js';
import { mergeLocalConfig as mergeLocalConfigBase } from './module/configUtils.js';
import {
    drawTextPanel as drawTextPanelBase,
    getTextureMaxNumericFrame as getTextureMaxNumericFrameBase,
    playLoopAudioSafely as playLoopAudioSafelyBase
} from './kit/core/ui.js';
import { resolveContactSpec as resolveContactSpecBase } from './module/contactUtils.js';
import {
    LEVEL_CONFIG,
    getLevelFileName as getLevelFileNameBase,
    getLevelMasterNumber as getLevelMasterNumberBase,
    parseExitTargetLevel as parseExitTargetLevelBase
} from './module/levelUtils.js';
import { addSpikeCredit as addSpikeCreditBase } from './kit/core/ui.js';
import { inizialization as inizializationBase } from './module/bootstrap.js';

try {
    window.BH_STARTUP_CONFIG = false;
    window.addEventListener('keydown', (ev) => {
        if (ev && typeof ev.key === 'string' && ev.key.toLowerCase() === 't') {
            window.BH_STARTUP_CONFIG = true;
        }
    });
    window.addEventListener('keyup', (ev) => {
        if (ev && typeof ev.key === 'string' && ev.key.toLowerCase() === 't') {
            window.BH_STARTUP_CONFIG = false;
        }
    });
} catch (e) { /* ignore */ }

// Global configuration (populated from /data/config.json)
const CONFIG = {};

// Game state (populated from /data/config.json)
const GAME_STATE = {};


const GAME_FONT = '"Press Start 2P"';
// Depth value for HUD elements so they always render above game world/foreground
const HUD_DEPTH = 10000;
// Translations
const TRANSLATIONS = {};
// Load configuration from /data/config.json
// Rimosso: la configurazione viene caricata solo tramite loadConfigAndStartGame

// Native asset sizes (used to compute scale when adapting to CONFIG)
const TILE_NATIVE_WIDTH = 64; // tiles spritesheet native width per tile frame
const TILE_NATIVE_HEIGHT = 48;
const OBJECT_NATIVE_SIZE = 64; // objects.png frames are 64x64

//Default frame dimension
const defaultFrame = { frameWidth: OBJECT_NATIVE_SIZE, frameHeight: OBJECT_NATIVE_SIZE };
const PRELOAD_ASSET_MANIFEST_KEY = 'preload_asset_manifest';
const PRELOAD_ASSET_MANIFEST_PATH = 'data/data.json';

const PRELOAD_SPRITESHEET_CONFIGS = {
    flags: { frameWidth: 64, frameHeight: 32 },
    tiles: defaultFrame,
    wall_tiles: defaultFrame,
    objects: defaultFrame,
    bat: defaultFrame,
    ghost: defaultFrame,
    spider: defaultFrame,
    snake: defaultFrame,
    player_front: { frameWidth: 64, frameHeight: 64 },
    player_back: { frameWidth: 64, frameHeight: 64 },
    player_right: { frameWidth: 64, frameHeight: 64 },
    player_back_right: { frameWidth: 64, frameHeight: 64 }
};
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
const resetGameStateForNewRun = (players = 1) => resetGameStateForNewRunBase(GAME_STATE, clearRuntimeMatchStorage, LOGGER, players);

const drawTextPanel = (graphics, textObj, opts = {}) => drawTextPanelBase(graphics, textObj, opts, LOGGER);
const getTextureMaxNumericFrame = (scene, textureKey, fallback = 0) => getTextureMaxNumericFrameBase(scene, textureKey, fallback, LOGGER);
const playLoopAudioSafely = (scene, key, volume = 0.3) => playLoopAudioSafelyBase(scene, key, volume, LOGGER);

const resolveContactSpec = (typename) => resolveContactSpecBase(CONFIG, typename, LOGGER);
const getLevelFileName = (levelIndex) => getLevelFileNameBase(levelIndex, LOGGER);
const getLevelMasterNumber = (levelIndex) => getLevelMasterNumberBase(levelIndex, LOGGER);
const parseExitTargetLevel = (rawTarget) => parseExitTargetLevelBase(rawTarget, LEVEL_CONFIG, LOGGER);
const addSpikeCredit = (scene, opts = {}) => addSpikeCreditBase(scene, CONFIG, GAME_FONT, LOGGER, opts);

const buildTopLevelFunctionDocs = () => buildTopLevelFunctionDocsBase(toDocEntry, {
    queueLegacyPreloadAssets,
    queueAssetsFromManifest,
    mergeLocalConfig,
    loadTranslations,
    clearRuntimeMatchStorage,
    resetGameStateForNewRun,
    drawTextPanel,
    getTextureMaxNumericFrame,
    playLoopAudioSafely,
    resolveContactSpec,
    getLevelFileName,
    getLevelMasterNumber,
    parseExitTargetLevel,
    addSpikeCredit,
    inizialization
});
const buildSceneMethodsDocs = (sceneClasses) => buildSceneMethodsDocsBase(sceneClasses, toDocEntry);
const instrumentSceneMethods = (sceneClasses) => instrumentSceneMethodsBase(sceneClasses, LOGGER, chooseTraceLevel);

const inizialization = () => inizializationBase({
    Phaser,
    configStore: CONFIG,
    gameState: GAME_STATE,
    objectNativeSize: OBJECT_NATIVE_SIZE,
    preloadScene: PreloadScene,
    attractScene: AttractScene,
    topTenScene: TopTenScene,
    creditsScene: CreditsScene,
    configScene: ConfigScene,
    levelSelectScene: LevelSelectScene,
    gameScene: GameScene,
    bonusScene: BonusScene,
    gameOverScene: GameOverScene,
    blockHunterSceneClasses: BLOCKHUNTER_SCENE_CLASSES,
    instrumentSceneMethods,
    loadGameplayMappings,
    loadKit: async () => {
        // game.manifest.json: game identity, blocks used and scene flow (see kit/README.md)
        const manifest = await loadManifest('game.manifest.json');
        configureKit(manifest);
        const screenScenes = {};
        if (manifest) {
            const report = await checkBlocks(manifest, sceneDeps, LOGGER);
            Object.entries(manifest.screens || {}).forEach(([key, sc]) => {
                screenScenes[key] = createScreenScene(sceneDeps, { key, id: sc.id, src: sc.src });
            });
            try { window.SPIKE_KIT = { manifest, blocks: report, screens: Object.keys(screenScenes) }; } catch (e) { }
        }
        return { manifest, screenScenes };
    },
    logger: LOGGER
});

// ============================================================================
// EXTRACTED SCENES (modularized under module/scenes)
// ============================================================================
const sceneDeps = {
    Phaser,
    CONFIG,
    GAME_STATE,
    GAME_FONT,
    HUD_DEPTH,
    TRANSLATIONS,
    LOGGER,
    OBJECT_FRAMES,
    TILE_FRAMES,
    WALL_TILE_COLS,
    applyMappingFrameOverrides,
    isFreeplayEnabled,
    hasStartAccessForPlayers,
    consumeCreditsForPlayers,
    TILE_NATIVE_WIDTH,
    TILE_NATIVE_HEIGHT,
    OBJECT_NATIVE_SIZE,
    defaultFrame,
    PRELOAD_ASSET_MANIFEST_KEY,
    PRELOAD_ASSET_MANIFEST_PATH,
    PRELOAD_SPRITESHEET_CONFIGS,
    LOG_LEVELS,
    LOG_LEVEL_NAMES,
    normalizeLogLevel,
    readInitialLogLevel,
    inferPurposeFromName,
    getFunctionParamNames,
    inferOutputFromName,
    toDocEntry,
    buildTopLevelFunctionDocs,
    buildSceneMethodsDocs,
    chooseTraceLevel,
    instrumentSceneMethods,
    queueLegacyPreloadAssets,
    queueAssetsFromManifest,
    mergeLocalConfig,
    loadTranslations,
    clearRuntimeMatchStorage,
    resetGameStateForNewRun,
    drawTextPanel,
    getTextureMaxNumericFrame,
    playLoopAudioSafely,
    resolveContactSpec,
    LEVEL_CONFIG,
    getLevelFileName,
    getLevelMasterNumber,
    parseExitTargetLevel,
    addSpikeCredit,
    createCreditsManager,
    createLanguageCarousel,
    createNameEntry,
    isHighScore,
    insertTopScore,
    saveTopScores,
    kitFlow,
    kitGame
};

const PreloadScene = createPreloadScene(sceneDeps);
const AttractScene = createAttractScene(sceneDeps);
const TopTenScene = createTopTenScene(sceneDeps);
const CreditsScene = createCreditsScene(sceneDeps);
const ConfigScene = createConfigScene(sceneDeps);
const LevelSelectScene = createLevelSelectScene(sceneDeps);
const GameScene = createGameScene(sceneDeps);
const BonusScene = createBonusScene(sceneDeps);
const GameOverScene = createGameOverScene(sceneDeps);
// GAME INITIALIZATION
// Caricamento della configurazione da file JSON e avvio del gioco con Phaser
// ============================================================================
const BLOCKHUNTER_SCENE_CLASSES = [
    PreloadScene,
    AttractScene,
    TopTenScene,
    CreditsScene,
    ConfigScene,
    LevelSelectScene,
    GameScene,
    BonusScene,
    GameOverScene
];

const FUNCTION_DOCS = Object.freeze({
    generatedAt: new Date().toISOString(),
    logLevels: Object.keys(LOG_LEVELS),
    topLevel: buildTopLevelFunctionDocs(),
    methods: buildSceneMethodsDocs(BLOCKHUNTER_SCENE_CLASSES)
});

try {
    window.BH_LOG = LOGGER;
    window.BLOCKHUNTER_FUNCTION_DOCS = FUNCTION_DOCS;
    window.getBlockHunterFunctionDocs = () => FUNCTION_DOCS;
    LOGGER.info('BOOT', 'Documentazione funzioni pronta. Usa window.getBlockHunterFunctionDocs() in console.');
} catch (e) { /* ignore */ }

window.inizialization = inizialization;