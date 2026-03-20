// ============================================================================
// BLOCKHUNTER - Arcade Game in Phaser 3
// ============================================================================

import { OBJECT_FRAMES, TILE_FRAMES, WALL_TILE_COLS } from './data/module/constants.js';
import { createPreloadScene } from './module/scenes/preloadScene.js';
import { createAttractScene } from './module/scenes/attractScene.js';
import { createTopTenScene } from './module/scenes/topTenScene.js';
import { createCreditsScene } from './module/scenes/creditsScene.js';
import { createConfigScene } from './module/scenes/configScene.js';
import { createLevelSelectScene } from './module/scenes/levelSelectScene.js';
import { createGameScene } from './module/scenes/gameScene.js';
import { createBonusScene } from './module/scenes/bonusScene.js';
import { createGameOverScene } from './module/scenes/gameOverScene.js';

async function fetchJsonOptional(path) {
    try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) return null;
        return await response.json();
    } catch (_e) {
        return null;
    }
}

function applyMappingFrameOverrides(mappings) {
    const entities = mappings?.entities?.entities;
    const tiles = mappings?.tiles?.tiles;

    if (entities && typeof entities === 'object') {
        Object.entries(entities).forEach(([key, value]) => {
            const sprite = value?.sprite;
            if (!sprite || sprite.texture !== 'objects') return;
            if (typeof sprite.frame === 'number') {
                OBJECT_FRAMES[key] = sprite.frame;
            }
        });
    }

    if (tiles && typeof tiles === 'object') {
        Object.entries(tiles).forEach(([key, value]) => {
            const sprite = value?.sprite;
            if (!sprite || sprite.texture !== 'tiles') return;
            if (typeof sprite.frame === 'number') {
                TILE_FRAMES[key] = sprite.frame;
            }
        });
    }
}

async function loadGameplayMappings() {
    const [entitiesMapping, effectsMapping, tilesMapping] = await Promise.all([
        fetchJsonOptional('data/game-entities-mapping.json'),
        fetchJsonOptional('data/game-effects-mapping.json'),
        fetchJsonOptional('data/game-tiles-mapping.json')
    ]);

    const mappings = {
        entities: entitiesMapping || {},
        effects: effectsMapping || {},
        tiles: tilesMapping || {}
    };

    try {
        window.GAME_MAPPINGS = mappings;
    } catch (_e) { /* ignore */ }

    applyMappingFrameOverrides(mappings);
    return mappings;
}
import { createLanguageCarousel } from './module/languageCarousel.js';
import { createCreditsManager } from './module/creditsManager.js';

// Global configuration (populated from /data/config.json)
const CONFIG = {};

// Game state (populated from /data/config.json)
const GAME_STATE = {};

function isFreeplayEnabled() {
    return Boolean(CONFIG && CONFIG.freeplay === true);
}

function hasStartAccessForPlayers(players) {
    if (isFreeplayEnabled()) return true;
    return (Number(GAME_STATE.credits) || 0) >= players;
}

function consumeCreditsForPlayers(players) {
    if (isFreeplayEnabled()) return;
    GAME_STATE.credits = Math.max(0, (Number(GAME_STATE.credits) || 0) - players);
}


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
    player_front: { frameWidth: 139, frameHeight: 135 },
    player_back: { frameWidth: 139, frameHeight: 135 },
    player_right: { frameWidth: 139, frameHeight: 135 },
    player_back_right: { frameWidth: 139, frameHeight: 135 }
};

// ============================================================================
// LOGGING & FUNCTION DOCUMENTATION
// TRACE/DEBUG/INFO are filtered by active level.
// WARNING/ERROR are always printed.
// ============================================================================
const LOG_LEVELS = Object.freeze({
    TRACE: 10,
    DEBUG: 20,
    INFO: 30,
    WARN: 40,
    ERROR: 50
});

const LOG_LEVEL_NAMES = Object.freeze({
    10: 'TRACE',
    20: 'DEBUG',
    30: 'INFO',
    40: 'WARN',
    50: 'ERROR'
});

function normalizeLogLevel(rawLevel) {
    const upper = String(rawLevel || '').trim().toUpperCase();
    if (LOG_LEVELS[upper]) return LOG_LEVELS[upper];
    const numeric = Number(rawLevel);
    if (Number.isFinite(numeric) && LOG_LEVEL_NAMES[numeric]) return numeric;
    return LOG_LEVELS.INFO;
}

function readInitialLogLevel() {
    try {
        const qs = new URLSearchParams(window.location.search || '');
        const fromQuery = qs.get('logLevel');
        if (fromQuery) return normalizeLogLevel(fromQuery);
    } catch (e) { /* ignore */ }

    try {
        const fromStorage = localStorage.getItem('blockHunterLogLevel');
        if (fromStorage) return normalizeLogLevel(fromStorage);
    } catch (e) { /* ignore */ }

    return LOG_LEVELS.INFO;
}

const LOGGER = (() => {
    let activeLevel = readInitialLogLevel();

    const alwaysVisible = new Set([LOG_LEVELS.WARN, LOG_LEVELS.ERROR]);

    const canLog = (level) => alwaysVisible.has(level) || level >= activeLevel;

    const summarizeArg = (arg) => {
        if (arg == null) return arg;
        if (typeof arg === 'string') return arg.length > 120 ? `${arg.slice(0, 117)}...` : arg;
        if (typeof arg === 'number' || typeof arg === 'boolean') return arg;
        if (Array.isArray(arg)) return `[array:${arg.length}]`;
        if (arg && typeof arg === 'object') {
            const ctor = arg.constructor && arg.constructor.name ? arg.constructor.name : 'Object';
            return `[${ctor}]`;
        }
        return typeof arg;
    };

    const write = (level, scope, message, ...meta) => {
        if (!canLog(level)) return;

        const levelName = LOG_LEVEL_NAMES[level] || 'INFO';
        const prefix = `[${levelName}][${scope}] ${message}`;
        const reducedMeta = (meta || []).map(summarizeArg);

        if (level === LOG_LEVELS.ERROR) {
            console.error(prefix, ...reducedMeta);
            return;
        }
        if (level === LOG_LEVELS.WARN) {
            console.warn(prefix, ...reducedMeta);
            return;
        }
        console.log(prefix, ...reducedMeta);
    };

    return {
        getLevel() {
            return LOG_LEVEL_NAMES[activeLevel] || 'INFO';
        },
        setLevel(nextLevel) {
            activeLevel = normalizeLogLevel(nextLevel);
            try { localStorage.setItem('blockHunterLogLevel', LOG_LEVEL_NAMES[activeLevel]); } catch (e) { /* ignore */ }
            write(LOG_LEVELS.INFO, 'LOGGER', `Log level impostato a ${LOG_LEVEL_NAMES[activeLevel]}`);
        },
        trace(scope, message, ...meta) {
            write(LOG_LEVELS.TRACE, scope, message, ...meta);
        },
        debug(scope, message, ...meta) {
            write(LOG_LEVELS.DEBUG, scope, message, ...meta);
        },
        info(scope, message, ...meta) {
            write(LOG_LEVELS.INFO, scope, message, ...meta);
        },
        warn(scope, message, ...meta) {
            write(LOG_LEVELS.WARN, scope, message, ...meta);
        },
        error(scope, message, ...meta) {
            write(LOG_LEVELS.ERROR, scope, message, ...meta);
        }
    };
})();

function inferPurposeFromName(name) {
    const n = String(name || '').toLowerCase();
    if (n.startsWith('load') || n.startsWith('queue') || n.startsWith('preload')) return 'Carica o prepara risorse.';
    if (n.startsWith('create') || n.startsWith('build') || n.startsWith('spawn')) return 'Crea elementi di scena o stato runtime.';
    if (n.startsWith('update') || n.startsWith('render') || n.startsWith('draw')) return 'Aggiorna stato o rendering durante il frame.';
    if (n.startsWith('handle') || n.startsWith('on') || n.startsWith('input')) return 'Gestisce eventi o input utente.';
    if (n.startsWith('reset') || n.startsWith('clear')) return 'Resetta dati runtime o stato di gioco.';
    if (n.startsWith('save')) return 'Salva dati persistenti o progressi.';
    if (n.startsWith('parse') || n.startsWith('resolve') || n.startsWith('get')) return 'Legge/trasforma dati e restituisce un valore.';
    if (n.startsWith('is') || n.startsWith('has') || n.startsWith('can') || n.startsWith('should')) return 'Esegue un controllo logico.';
    return 'Metodo di supporto del flusso di gioco.';
}

function getFunctionParamNames(fn) {
    try {
        const src = String(fn || '');
        const regularMatch = src.match(/^[\s\w]*\(([^)]*)\)/);
        const arrowMatch = src.match(/^\s*([^=()]+?)\s*=>/);
        const raw = regularMatch ? regularMatch[1] : (arrowMatch ? arrowMatch[1] : '');
        if (!raw) return [];
        return raw
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => p.replace(/=.*$/g, '').replace(/^\.\.\./, '').trim())
            .filter(Boolean);
    } catch (e) {
        return [];
    }
}

function inferOutputFromName(name, fn) {
    const n = String(name || '').toLowerCase();
    const isAsync = fn && fn.constructor && fn.constructor.name === 'AsyncFunction';
    if (isAsync) return 'Promise<misto>';
    if (n.startsWith('is') || n.startsWith('has') || n.startsWith('can') || n.startsWith('should')) return 'boolean';
    if (n.startsWith('get') || n.startsWith('parse') || n.startsWith('resolve') || n.startsWith('format')) return 'misto';
    return 'void/misto';
}

function toDocEntry(owner, methodName, fn, purposeOverride) {
    const params = getFunctionParamNames(fn).map((p) => ({ name: p, type: 'misto', description: `Parametro ${p}` }));
    return {
        owner,
        name: methodName,
        purpose: purposeOverride || inferPurposeFromName(methodName),
        input: params,
        output: inferOutputFromName(methodName, fn)
    };
}

function buildTopLevelFunctionDocs() {
    return [
        toDocEntry('global', 'queueLegacyPreloadAssets', queueLegacyPreloadAssets, 'Carica il pacchetto asset base usato dal preload legacy.'),
        toDocEntry('global', 'queueAssetsFromManifest', queueAssetsFromManifest, 'Carica asset dal manifest data/data.json e restituisce il conteggio enqueue.'),
        toDocEntry('global', 'mergeLocalConfig', mergeLocalConfig, 'Applica override della configurazione salvata in locale.'),
        toDocEntry('global', 'loadTranslations', loadTranslations, 'Carica il dizionario lingua e invoca callback con i dati.'),
        toDocEntry('global', 'clearRuntimeMatchStorage', clearRuntimeMatchStorage, 'Pulisce storage runtime/sessione per evitare leak tra partite.'),
        toDocEntry('global', 'resetGameStateForNewRun', resetGameStateForNewRun, 'Reinizializza lo stato partita per 1P/2P.'),
        toDocEntry('global', 'drawTextPanel', drawTextPanel, 'Disegna pannello grafico dietro un testo HUD.'),
        toDocEntry('global', 'getTextureMaxNumericFrame', getTextureMaxNumericFrame, 'Trova il frame numerico massimo disponibile in una texture.'),
        toDocEntry('global', 'playLoopAudioSafely', playLoopAudioSafely, 'Avvia audio loop in sicurezza evitando eccezioni hard.'),
        toDocEntry('global', 'resolveContactSpec', resolveContactSpec, 'Normalizza la spec di contatto da tipo stringa a oggetto.'),
        toDocEntry('global', 'getLevelFileName', getLevelFileName, 'Calcola il nome file JSON del livello richiesto.'),
        toDocEntry('global', 'getLevelMasterNumber', getLevelMasterNumber, 'Converte indice livello in numero master da usare nei percorsi.'),
        toDocEntry('global', 'parseExitTargetLevel', parseExitTargetLevel, 'Interpreta target livello dall\'uscita.'),
        toDocEntry('global', 'addSpikeCredit', addSpikeCredit, 'Aggiunge firma/credit in overlay di scena.'),
        toDocEntry('global', 'inizialization', inizialization, 'Bootstrap del gioco: carica config, top score e avvia Phaser.')
    ];
}

function buildSceneMethodsDocs(sceneClasses) {
    const docs = [];
    (sceneClasses || []).forEach((SceneClass) => {
        if (!SceneClass || !SceneClass.prototype) return;
        const owner = SceneClass.name || 'UnknownScene';
        const methods = Object.getOwnPropertyNames(SceneClass.prototype)
            .filter((name) => name !== 'constructor')
            .filter((name) => typeof SceneClass.prototype[name] === 'function')
            .sort((a, b) => a.localeCompare(b));

        methods.forEach((name) => {
            docs.push(toDocEntry(owner, name, SceneClass.prototype[name]));
        });
    });
    return docs;
}

function chooseTraceLevel(methodName) {
    const n = String(methodName || '').toLowerCase();
    if (n === 'preload' || n === 'create' || n === 'update' || n === 'save' || n.startsWith('start')) return 'info';
    if (n.startsWith('set') || n.startsWith('load') || n.startsWith('reset') || n.startsWith('handle')) return 'debug';
    return 'trace';
}

function instrumentSceneMethods(sceneClasses) {
    (sceneClasses || []).forEach((SceneClass) => {
        if (!SceneClass || !SceneClass.prototype) return;

        const methodNames = Object.getOwnPropertyNames(SceneClass.prototype)
            .filter((name) => name !== 'constructor')
            .filter((name) => typeof SceneClass.prototype[name] === 'function');

        methodNames.forEach((methodName) => {
            const original = SceneClass.prototype[methodName];
            if (!original || original.__bhTraced === true) return;

            const level = chooseTraceLevel(methodName);
            const scope = `${SceneClass.name}.${methodName}`;

            const wrapped = function tracedSceneMethod(...args) {
                try {
                    LOGGER[level](scope, 'ENTER', `args=${args.length}`);
                    const result = original.apply(this, args);

                    if (result && typeof result.then === 'function') {
                        return result
                            .then((value) => {
                                LOGGER.trace(scope, 'EXIT async');
                                return value;
                            })
                            .catch((err) => {
                                LOGGER.error(scope, 'ERROR async', err);
                                throw err;
                            });
                    }

                    LOGGER.trace(scope, 'EXIT');
                    return result;
                } catch (err) {
                    LOGGER.error(scope, 'ERROR sync', err);
                    throw err;
                }
            };

            wrapped.__bhTraced = true;
            SceneClass.prototype[methodName] = wrapped;
        });
    });
}

function queueLegacyPreloadAssets(scene) {
    LOGGER.debug('queueLegacyPreloadAssets', 'Caricamento preload legacy');
    scene.load
        .image('title', 'assets/images/common/title.png')
        .image('explorer', 'assets/images/common/explorer.png')
        .image('title_explosion', 'assets/images/common/title_explosion.png')
        .image('bg', 'assets/images/common/attract_bg.png')
        .image('game_bg', 'assets/images/common/level1.png')
        .spritesheet('flags', 'assets/images/common/flags.png', PRELOAD_SPRITESHEET_CONFIGS.flags)
        .spritesheet('tiles', 'assets/images/common/tiles.png', PRELOAD_SPRITESHEET_CONFIGS.tiles)
        .spritesheet('wall_tiles', 'assets/images/common/wall_completed.png', PRELOAD_SPRITESHEET_CONFIGS.wall_tiles)
        .spritesheet('objects', 'assets/images/common/obj_game.png', PRELOAD_SPRITESHEET_CONFIGS.objects)
        .spritesheet('bat', 'assets/images/common/bat.png', PRELOAD_SPRITESHEET_CONFIGS.bat)
        .spritesheet('ghost', 'assets/images/common/ghost.png', PRELOAD_SPRITESHEET_CONFIGS.ghost)
        .spritesheet('player_front', 'assets/images/common/player_front.png', PRELOAD_SPRITESHEET_CONFIGS.player_front)
        .spritesheet('player_back', 'assets/images/common/player_back.png', PRELOAD_SPRITESHEET_CONFIGS.player_back)
        .spritesheet('player_right', 'assets/images/common/player_right.png', PRELOAD_SPRITESHEET_CONFIGS.player_right)
        .spritesheet('player_back_right', 'assets/images/common/player_back_rigth.png', PRELOAD_SPRITESHEET_CONFIGS.player_back_right)
        .audio('intro_bgm', 'assets/music/intro.mp3')
        .audio('game_bgm', 'assets/music/game.mp3')
        .audio('step_sfx', 'assets/music/step.mp3')
        .audio('stone_sfx', 'assets/music/stone.mp3')
        .audio('explosion_sfx', 'assets/music/explosion.mp3')
        .audio('gem_sfx', 'assets/music/gem.mp3')
        .audio('rolling_sfx', 'assets/music/rolling_stones.mp3')
        .audio('gameover_sfx', 'assets/music/gameover.mp3')
        .audio('level_completed_sfx', 'assets/music/level_completed.mp3')
        .audio('coin_sfx', 'assets/music/coin.mp3')
        .audio('select_sfx', 'assets/music/select.mp3')
        .audio('ghost_sfx', 'assets/music/ghost.mp3')
        .audio('bat_sfx', 'assets/music/bat.mp3')
        .audio('rain_sfx', 'assets/music/rain.mp3')
        .image('game_bg_1', 'assets/images/common/level1.png')
        .image('game_bg_2', 'assets/images/common/level2.png')
        .image('game_bg_3', 'assets/images/common/level3.png')
        .image('game_bg_4', 'assets/images/common/level4.png')
        .image('game_bg_5', 'assets/images/common/level5.png')
        .image('game_fg', 'assets/images/common/foreground.png');
}

function queueAssetsFromManifest(scene, manifest) {
    LOGGER.debug('queueAssetsFromManifest', 'Inizio enqueue da manifest');
    if (!manifest || typeof manifest !== 'object') return 0;

    let queued = 0;
    const buckets = ['music', 'objects', 'backgrounds', 'foregrounds'];

    buckets.forEach((bucket) => {
        const entries = manifest[bucket];
        if (!Array.isArray(entries)) return;

        entries.forEach((entry) => {
            if (!entry || entry.inPreload !== true || entry.exists === false || !entry.key || !entry.path) {
                return;
            }

            const spriteConfig = PRELOAD_SPRITESHEET_CONFIGS[entry.key];
            if (bucket === 'music') {
                scene.load.audio(entry.key, entry.path);
            } else if (spriteConfig) {
                scene.load.spritesheet(entry.key, entry.path, spriteConfig);
            } else {
                scene.load.image(entry.key, entry.path);
            }

            queued += 1;
        });
    });

    LOGGER.info('queueAssetsFromManifest', 'Enqueue completato', `queued=${queued}`);
    return queued;
}

// Load persistent config if present (optional: can be merged after loadConfig)
function mergeLocalConfig() {
    LOGGER.trace('mergeLocalConfig', 'Tentativo merge config locale');
    try {
        const saved = localStorage.getItem('blockHunterConfig');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.tileSize) CONFIG.tileSize = parsed.tileSize;
            if (parsed.objectSize) CONFIG.objectSize = parsed.objectSize;
            if (parsed.playerSize) CONFIG.playerSize = parsed.playerSize;
            if (parsed.helmetRadiusTiles) CONFIG.helmetRadiusTiles = parsed.helmetRadiusTiles;
            // Backwards compatibility: support old 'objectScale' saved values
            else if (parsed.objectScale) CONFIG.objectSize = Math.round(parsed.objectScale * OBJECT_NATIVE_SIZE);
        }
    } catch (e) {
        LOGGER.warn('mergeLocalConfig', 'Errore accesso localStorage, merge saltato', e);
        // ignore localStorage errors
    }
}


function loadTranslations(lang, callback) {
    LOGGER.info('loadTranslations', 'Caricamento traduzioni', `lang=${lang}`);
    fetch(`data/dic/${lang}.json`)
        .then(res => res.json())
        .then(data => {
            TRANSLATIONS[lang] = data;
            LOGGER.debug('loadTranslations', 'Traduzioni caricate', `lang=${lang}`);
            if (typeof callback === 'function') callback(data);
        })
        .catch(() => {
            TRANSLATIONS[lang] = {};
            LOGGER.warn('loadTranslations', 'Fallback traduzioni vuote', `lang=${lang}`);
            if (typeof callback === 'function') callback({});
        });
}

function clearRuntimeMatchStorage() {
    LOGGER.trace('clearRuntimeMatchStorage', 'Pulizia storage runtime/sessione');
    try {
        if (window && window.localStorage) {
            // Runtime-only persistence for the current run
            localStorage.removeItem('blockHunterPlacedPlanks');
        }
    } catch (e) { }

    try {
        if (window && window.sessionStorage) {
            // Session data should never leak across fresh runs
            sessionStorage.clear();
        }
    } catch (e) { }
}

function resetGameStateForNewRun(players = 1) {
    LOGGER.info('resetGameStateForNewRun', 'Reset stato partita', `players=${players}`);
    const p = Number(players) === 2 ? 2 : 1;

    GAME_STATE.players = p;
    GAME_STATE.currentLevel = 0;
    GAME_STATE.score = 0;
    GAME_STATE.isGameOver = false;

    GAME_STATE.lives = 5;
    GAME_STATE.dynamiteCount = 20;
    GAME_STATE.keysCount = 0;
    GAME_STATE.woodenCount = 0;

    GAME_STATE.keysP1 = 0;
    GAME_STATE.keysP2 = 0;
    GAME_STATE.woodenP1 = 0;
    GAME_STATE.woodenP2 = 0;

    if (p === 2) {
        GAME_STATE.livesP1 = 5;
        GAME_STATE.livesP2 = 5;
    } else {
        delete GAME_STATE.livesP1;
        delete GAME_STATE.livesP2;
    }

    GAME_STATE.placedPlanks = [];
    clearRuntimeMatchStorage();
}



// Utility: draw a rounded panel (semi-transparent fill + black border) around a text object
function drawTextPanel(graphics, textObj, opts = {}) {
    LOGGER.trace('drawTextPanel', 'Disegno pannello testo');
    const paddingX = opts.paddingX || 12;
    const paddingY = opts.paddingY || 6;
    const radius = opts.radius || 6;

    graphics.clear();
    if (!textObj || !textObj.text) return;

    const width = (textObj.width || 0) + paddingX * 2;
    const height = (textObj.height || 0) + paddingY * 2;
    const x = textObj.x - width * (textObj.originX || 0.5);
    const y = textObj.y - height * (textObj.originY || 0.5);

    // semi-transparent dark fill
    graphics.fillStyle(0x000000, 0.35);
    if (graphics.fillRoundedRect) {
        graphics.fillRoundedRect(x, y, width, height, radius);
    } else {
        graphics.fillRect(x, y, width, height);
    }

    // black border
    graphics.lineStyle(2, 0x000000, 1);
    if (graphics.strokeRoundedRect) {
        graphics.strokeRoundedRect(x, y, width, height, radius);
    } else {
        graphics.strokeRect(x, y, width, height);
    }

    // Ensure panel sits behind the text
    try {
        graphics.setDepth((textObj.depth || 0) - 1);
    } catch (e) {
        // ignore if depth cannot be set
    }
}

function getTextureMaxNumericFrame(scene, textureKey, fallback = 0) {
    LOGGER.trace('getTextureMaxNumericFrame', 'Risoluzione frame massimo', `textureKey=${textureKey}`);
    try {
        const texture = scene?.textures?.get(textureKey);
        if (!texture) return fallback;

        const names = texture.getFrameNames ? texture.getFrameNames() : [];
        const numericFrames = names
            .map((name) => Number(name))
            .filter((value) => Number.isFinite(value));

        if (numericFrames.length > 0) {
            return Math.max(...numericFrames);
        }

        const frameTotal = Number(texture.frameTotal);
        if (Number.isFinite(frameTotal) && frameTotal > 1) {
            return Math.max(0, frameTotal - 1);
        }
    } catch (e) {
        // ignore and use fallback
    }

    return fallback;
}

function playLoopAudioSafely(scene, key, volume = 0.3) {
    LOGGER.debug('playLoopAudioSafely', 'Avvio audio loop', `key=${key}`);
    const sound = scene?.sound;
    if (!sound) return;

    const playNow = () => {
        const existing = sound.get(key);
        if (existing) {
            if (!existing.isPlaying) {
                existing.play({ loop: true, volume });
            }
            return;
        }
        sound.play(key, { loop: true, volume });
    };

    if (sound.locked) {
        sound.once('unlocked', () => {
            try {
                playNow();
            } catch (e) {
                // ignore autoplay race errors
            }
        });
        return;
    }

    try {
        const ctx = sound.context;
        if (ctx && ctx.state === 'suspended' && ctx.resume) {
            ctx.resume().catch(() => { });
        }
    } catch (e) {
        // ignore
    }

    playNow();
}

// Resolve contact type mapping from CONFIG for reuse across scenes
function resolveContactSpec(typename) {
    LOGGER.trace('resolveContactSpec', 'Risoluzione contact spec', `typename=${typename}`);
    try {
        const map = (CONFIG && CONFIG.objectContactByType) ? CONFIG.objectContactByType : {};
        const rawDef = (map && map.default) ? map.default : {};
        const def = {
            contactType: rawDef.contactType || 'edge',
            radiusMultiplier: (typeof rawDef.radiusMultiplier === 'number') ? rawDef.radiusMultiplier : 0.45,
            radiusPixels: (typeof rawDef.radiusPixels === 'number') ? rawDef.radiusPixels : null,
            proximityTiles: (typeof rawDef.proximityTiles === 'number') ? rawDef.proximityTiles : 0.9,
            proximityPixels: (typeof rawDef.proximityPixels === 'number') ? rawDef.proximityPixels : null
        };

        if (!typename) return def;
        const raw = map[typename];
        if (!raw) return def;

        // If spec is a string (historic), convert to object using defaults
        if (typeof raw === 'string') {
            return Object.assign({}, def, { contactType: raw });
        }

        return {
            contactType: raw.contactType || def.contactType,
            radiusMultiplier: (typeof raw.radiusMultiplier === 'number') ? raw.radiusMultiplier : def.radiusMultiplier,
            radiusPixels: (typeof raw.radiusPixels === 'number') ? raw.radiusPixels : def.radiusPixels,
            proximityTiles: (typeof raw.proximityTiles === 'number') ? raw.proximityTiles : def.proximityTiles,
            proximityPixels: (typeof raw.proximityPixels === 'number') ? raw.proximityPixels : def.proximityPixels
        };
    } catch (e) {
        return { contactType: 'edge', radiusMultiplier: 0.45, radiusPixels: null, proximityTiles: 0.9, proximityPixels: null };
    }
}

// Level configurations
const LEVEL_CONFIG = {
    globalRules: {
        staticRocks: {
            sizes: ["small", "medium", "large"],
            randomSpawn: true,
            generateShards: false
        },
        dynamicBoulders: {
            sizes: {
                small: { shards: [0, 1] },
                medium: { shards: [2, 3] },
                large: { shards: [4, 6] }
            }
        }
    },
    levels: [
        { id: "1.0", staticRocks: true, dynamicBoulders: false, speed: 1, escapeRoute: false },
        { id: "1.1", staticRocks: true, dynamicBoulders: false, speed: 2, escapeRoute: false },
        { id: "1.2", staticRocks: true, dynamicBoulders: false, speed: 3, escapeRoute: false },
        { id: "1.3", staticRocks: true, dynamicBoulders: false, speed: 4, escapeRoute: true },
        { id: "1.4", staticRocks: true, dynamicBoulders: false, speed: 5, escapeRoute: true },
        { id: "2.0", staticRocks: true, dynamicBoulders: { directions: ["top"], sizes: ["medium"] }, speed: 1, escapeRoute: false },
        { id: "2.1", staticRocks: true, dynamicBoulders: { directions: ["bottom"], sizes: ["medium"] }, speed: 2, escapeRoute: false },
        { id: "2.2", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom"], sizes: ["medium"] }, speed: 1, escapeRoute: false },
        { id: "2.3", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom"], sizes: ["medium", "large"] }, speed: 2, escapeRoute: true },
        { id: "2.4", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom"], sizes: ["large"] }, speed: 3, escapeRoute: true },
        { id: "3.0", staticRocks: true, dynamicBoulders: { directions: ["right"], sizes: ["medium"] }, speed: 1, escapeRoute: false },
        { id: "3.1", staticRocks: true, dynamicBoulders: { directions: ["left"], sizes: ["medium"] }, speed: 2, escapeRoute: false },
        { id: "3.2", staticRocks: true, dynamicBoulders: { directions: ["left", "right"], sizes: ["medium"] }, speed: 1, escapeRoute: false },
        { id: "3.3", staticRocks: true, dynamicBoulders: { directions: ["left", "right"], sizes: ["medium", "large"] }, speed: 2, escapeRoute: true },
        { id: "3.4", staticRocks: true, dynamicBoulders: { directions: ["left", "right"], sizes: ["large"] }, speed: 3, escapeRoute: true },
        { id: "4.0", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["medium"] }, speed: 1, escapeRoute: true },
        { id: "4.1", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["medium", "large"] }, speed: 2, escapeRoute: true },
        { id: "4.2", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["large"] }, speed: 3, escapeRoute: true },
        { id: "4.3", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["large", "small"] }, speed: 4, escapeRoute: true },
        { id: "4.4", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["large"] }, speed: 5, escapeRoute: true },
        { id: "5.0", staticRocks: { dynamicSize: true }, dynamicBoulders: false, speed: 1, escapeRoute: false },
        { id: "5.1", staticRocks: { dynamicSize: true }, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["medium", "large"] }, speed: 2, escapeRoute: true },
        { id: "5.2", staticRocks: { dynamicSize: true }, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["large"] }, speed: 3, escapeRoute: true },
        { id: "5.3", staticRocks: { dynamicSize: true, rotation: true }, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["large"] }, speed: 4, escapeRoute: true },
        { id: "5.4", staticRocks: { dynamicSize: true, chaotic: true }, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["large", "small"] }, speed: 5, escapeRoute: true }
    ]
};

// Helper function to get level file number from level index
// Level index 0-4 -> level10-14, 5-9 -> level20-24, etc.
function getLevelFileName(levelIndex) {
    LOGGER.trace('getLevelFileName', 'Calcolo file livello', `levelIndex=${levelIndex}`);
    const majorLevel = Math.floor(levelIndex / 5) + 1;
    const minorLevel = levelIndex % 5;
    return `level${majorLevel}${minorLevel}`;
}

function getLevelMasterNumber(levelIndex) {
    LOGGER.trace('getLevelMasterNumber', 'Calcolo master level', `levelIndex=${levelIndex}`);
    return Math.floor(levelIndex / 5) + 1;
}

function parseExitTargetLevel(rawTarget) {
    LOGGER.trace('parseExitTargetLevel', 'Parsing target livello uscita', `rawTarget=${rawTarget}`);
    const text = String(rawTarget ?? '').trim();
    if (!text) return null;

    let major = null;
    let minor = null;

    if (/^\d+\.\d+$/.test(text)) {
        const parts = text.split('.');
        major = Number(parts[0]);
        minor = Number(parts[1]);
    } else if (/^\d+$/.test(text)) {
        // Compact form: 12 => 1.2, 123 => 12.3
        if (text.length < 2) return null;
        major = Number(text.slice(0, -1));
        minor = Number(text.slice(-1));
    } else {
        return null;
    }

    if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
    if (major < 1 || minor < 0 || minor > 4) return null;

    const totalLevels = (LEVEL_CONFIG && Array.isArray(LEVEL_CONFIG.levels)) ? LEVEL_CONFIG.levels.length : 0;
    const index = ((major - 1) * 5) + minor;
    if (index < 0 || index >= totalLevels) return null;

    return {
        id: `${major}.${minor}`,
        index
    };
}

// Small helper to add an unobtrusive 'by SpikeCode' credit to a scene.
// Call from scenes where the credit should appear (not the main GameScene).
function addSpikeCredit(scene, opts = {}) {
    LOGGER.trace('addSpikeCredit', 'Aggiunta credit overlay');
    try {
        if (!scene || !scene.add) return null;
        const w = Number(CONFIG.width) || 800;
        const h = Number(CONFIG.height) || 600;
        const style = Object.assign({
            fontSize: '12px',
            fill: '#cfdff8',
            fontFamily: GAME_FONT,
            stroke: '#000000',
            strokeThickness: 3
        }, opts.style || {});

        const credit = scene.add.text(w - 8, h - 6, 'by SpikeCode', style).setOrigin(1, 1);
        try { credit.setDepth(9999); } catch (e) { }
        // Keep it fixed to camera (no parallax)
        try { credit.setScrollFactor(0); } catch (e) { }
        // Make it non-interactive
        try { credit.setInteractive && credit.disableInteractive && credit.disableInteractive(); } catch (e) { }
        return credit;
    } catch (e) { return null; }
}



// ============================================================================
// PRELOAD SCENE
// ============================================================================

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
    createLanguageCarousel
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

async function inizialization() {
    try {
        instrumentSceneMethods(BLOCKHUNTER_SCENE_CLASSES);
        LOGGER.info('BOOT', 'Tracing scene methods attivato.', `level=${LOGGER.getLevel()}`);

        const mappings = await loadGameplayMappings();
        LOGGER.debug('BOOT', 'Mapping gameplay caricati', `entities=${Object.keys(mappings.entities?.entities || {}).length}, tiles=${Object.keys(mappings.tiles?.tiles || {}).length}, effects=${Object.keys(mappings.effects?.effectProfiles || {}).length}`);

        const response = await fetch('data/config.json');
        const cfg = await response.json();
        LOGGER.debug('BOOT', 'Config caricata da data/config.json');
        // Copy all config keys to CONFIG
        Object.assign(CONFIG, cfg);
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

        // Resolve Phaser scale mode from config (defaults to FIT)
        const requestedScaleMode = String(CONFIG.scaleMode || 'FIT').toUpperCase();
        let phaserScaleMode = Phaser.Scale.FIT;
        if (requestedScaleMode === 'ENVELOP' || requestedScaleMode === 'ENVELOPE') phaserScaleMode = Phaser.Scale.ENVELOP;
        else if (requestedScaleMode === 'NONE') phaserScaleMode = Phaser.Scale.NONE;
        else if (requestedScaleMode === 'RESIZE') phaserScaleMode = Phaser.Scale.RESIZE;

        // Keep a stable logical resolution so scenes that use 800x600 coordinates
        // (loading, attract, overlays) stay centered while the canvas is scaled.
        const gameWidth = Number(CONFIG.width) || 800;
        const gameHeight = Number(CONFIG.height) || 600;
        let effectiveScaleMode = phaserScaleMode;
        if (CONFIG.responsiveMode && effectiveScaleMode === Phaser.Scale.RESIZE) {
            LOGGER.warn('BOOT', 'responsiveMode + RESIZE can break fixed-coordinate scenes; using FIT.');
            effectiveScaleMode = Phaser.Scale.FIT;
        }

        const config = {
            type: Phaser.AUTO,
            // Use Phaser Scale manager to display the original 800x600 game in the
            // available viewport according to the requested scale mode.
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
            scene: [PreloadScene, AttractScene, TopTenScene, CreditsScene, ConfigScene, LevelSelectScene, GameScene, BonusScene, GameOverScene]
        };

        // Copy game state keys to GAME_STATE (topScores will be loaded from server if available)
        const stateKeys = [
            'credits', 'language', 'difficulty', 'currentLevel', 'score', 'lives', 'dynamiteCount', 'keysCount', 'woodenCount'
        ];
        stateKeys.forEach(k => {
            if (cfg[k] !== undefined) GAME_STATE[k] = cfg[k];
        });

        // Try to load top scores from server API; fallback to config.json topScores if API not available
        try {
            let serverTopScores = null;
            try {
                const resp = await fetch('/api/top-scores');
                if (resp && resp.ok) {
                    serverTopScores = await resp.json();
                }
            } catch (e) { serverTopScores = null; }

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

        const game = new Phaser.Game(config);
        LOGGER.info('BOOT', 'Istanza Phaser.Game creata con successo.');

        // Handle window resize for responsive mode
        if (CONFIG.responsiveMode) {
            window.addEventListener('resize', () => {
                if (game && game.scale) {
                    game.scale.refresh();
                }
                LOGGER.debug('BOOT', 'Window resize handled', `viewport=${window.innerWidth}x${window.innerHeight}`);
            });
        }

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
        LOGGER.error('BOOT', 'Errore durante inizializzazione gioco', err);
        console.error('Errore caricamento config.json:', err);
        alert('Impossibile caricare la configurazione del gioco.');
        return false;
    }
}

window.inizialization = inizialization;