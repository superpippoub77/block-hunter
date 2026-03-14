// ============================================================================
// BLOCKHUNTER - Arcade Game in Phaser 3
// ============================================================================

import { OBJECT_FRAMES, TILE_FRAMES, WALL_TILE_COLS } from './data/module/constants.js';
import { createLanguageCarousel, loadLanguageCarouselTranslations as loadTranslations } from './module/plugin/languageCarousel/module.js';
import { createCreditsManager } from './module/plugin/creditsManager/module.js';
import { createAddCredit } from './module/plugin/addCredit/module.js';
import { createPreloadSceneClass } from './module/scenes/PreloadScene.js';
import { createSharedFrontendSceneClass } from './module/scenes/SharedFrontendScene.js';
import { createAttractSceneClass } from './module/scenes/AttractScene.js';
import { createTopTenSceneClass } from './module/scenes/TopTenScene.js';
import { createCreditsSceneClass } from './module/scenes/CreditsScene.js';
import { createConfigSceneClass } from './module/scenes/ConfigScene.js';
import { createLevelSelectSceneClass } from './module/scenes/LevelSelectScene.js';
import { createGameSceneClass } from './module/scenes/GameScene.js';
import { createBonusSceneClass } from './module/scenes/BonusScene.js';
import { createGameOverSceneClass } from './module/scenes/GameOverScene.js';

// Global configuration (populated from /data/config.json)
const CONFIG = {};

// Game state (populated from /data/config.json)
const GAME_STATE = {};

// Runtime effect library loaded from data/Library/*
const EFFECT_LIBRARY = {
    effects: {},
    aliases: {},
    loadedEntries: [],
    lastLoadError: null
};

function normalizeEffectKey(raw) {
    return String(raw || '').trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '');
}

function registerEffectLibraryDefinition(rawDef, sourcePath = '') {
    const def = (rawDef && typeof rawDef === 'object' && !Array.isArray(rawDef)) ? rawDef : null;
    if (!def) return false;

    const effectName = normalizeEffectKey(def.name || def.key || def.id);
    if (!effectName) return false;

    const built = {
        ...def,
        name: effectName,
        sourcePath: sourcePath || String(def.sourcePath || '')
    };

    EFFECT_LIBRARY.effects[effectName] = built;

    const aliases = Array.isArray(def.aliases) ? def.aliases : [];
    aliases.forEach((alias) => {
        const normalizedAlias = normalizeEffectKey(alias);
        if (!normalizedAlias) return;
        EFFECT_LIBRARY.aliases[normalizedAlias] = effectName;
    });

    EFFECT_LIBRARY.aliases[effectName] = effectName;
    return true;
}

function parseEffectLibraryManifestEntries(manifest) {
    const root = (manifest && typeof manifest === 'object') ? manifest : {};
    const list = Array.isArray(root)
        ? root
        : (Array.isArray(root.effects) ? root.effects : []);

    return list
        .map((entry) => {
            if (typeof entry === 'string') {
                const text = String(entry).trim();
                if (!text) return null;
                if (/\.js$/i.test(text)) {
                    return { path: text, nameHint: '' };
                }
                return {
                    path: `data/Library/${text}/effect.js`,
                    nameHint: normalizeEffectKey(text)
                };
            }

            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

            const nameHint = normalizeEffectKey(entry.name || entry.key || entry.id || '');
            let filePath = String(entry.entry || entry.file || entry.path || entry.src || entry.module || '').trim();
            if (!filePath && nameHint) {
                filePath = `data/Library/${nameHint}/effect.js`;
            }
            if (!filePath) return null;

            if (!/\.js$/i.test(filePath)) {
                filePath = `${filePath.replace(/\/+$/, '')}/effect.js`;
            }

            return { path: filePath, nameHint };
        })
        .filter(Boolean);
}

function toEffectImportPath(pathLike) {
    const raw = String(pathLike || '').trim();
    if (!raw) return '';
    if (/^(https?:|blob:|data:)/i.test(raw)) return raw;
    if (raw.startsWith('/')) return raw;
    if (raw.startsWith('./') || raw.startsWith('../')) return raw;
    return `./${raw}`;
}

function loadEffectDefinitionFromScript(pathLike) {
    return new Promise((resolve) => {
        try {
            const src = String(pathLike || '').trim();
            if (!src || typeof document === 'undefined') {
                resolve(null);
                return;
            }

            window.__BLOCKHUNTER_EFFECT_EXPORT__ = null;

            const script = document.createElement('script');
            script.async = true;
            script.src = src;

            script.onload = () => {
                const exported = window.__BLOCKHUNTER_EFFECT_EXPORT__;
                window.__BLOCKHUNTER_EFFECT_EXPORT__ = null;
                try { script.remove(); } catch (_e) { }
                resolve(exported || null);
            };

            script.onerror = () => {
                window.__BLOCKHUNTER_EFFECT_EXPORT__ = null;
                try { script.remove(); } catch (_e) { }
                resolve(null);
            };

            document.head.appendChild(script);
        } catch (_e) {
            resolve(null);
        }
    });
}

async function fetchEffectManifest() {
    const candidates = [
        'data/Library/manifest.json',
        'Data/Library/manifest.json'
    ];

    for (const candidate of candidates) {
        try {
            const resp = await fetch(candidate, { cache: 'no-store' });
            if (!resp.ok) continue;
            const parsed = await resp.json();
            return { path: candidate, manifest: parsed };
        } catch (_e) {
            // Try next candidate.
        }
    }

    return { path: '', manifest: null };
}

async function loadCustomEffectLibrary() {
    try {
        const payload = await fetchEffectManifest();
        const manifest = payload.manifest;
        const entries = parseEffectLibraryManifestEntries(manifest);

        if (!entries.length) {
            EFFECT_LIBRARY.loadedEntries = [];
            EFFECT_LIBRARY.lastLoadError = null;
            window.__BLOCKHUNTER_EFFECT_LIBRARY = EFFECT_LIBRARY;
            return EFFECT_LIBRARY;
        }

        const loaded = [];
        for (const entry of entries) {
            const importPath = toEffectImportPath(entry.path);
            if (!importPath) continue;

            try {
                const moduleNs = await import(importPath);
                const rawCandidate = moduleNs.default ?? moduleNs.effect ?? moduleNs.EFFECT ?? moduleNs.blockHunterEffect;
                const resolved = (typeof rawCandidate === 'function') ? rawCandidate() : rawCandidate;
                const defObj = (resolved && typeof resolved === 'object' && !Array.isArray(resolved))
                    ? resolved
                    : {
                        name: entry.nameHint,
                        apply: null,
                        defaults: {}
                    };

                if (!defObj.name && entry.nameHint) {
                    defObj.name = entry.nameHint;
                }

                if (registerEffectLibraryDefinition(defObj, entry.path)) {
                    loaded.push(entry.path);
                }
            } catch (err) {
                // Fallback for plain script files exporting to window.__BLOCKHUNTER_EFFECT_EXPORT__
                const fallback = await loadEffectDefinitionFromScript(entry.path);
                const resolvedFallback = (typeof fallback === 'function') ? fallback() : fallback;

                if (resolvedFallback && registerEffectLibraryDefinition({
                    ...(typeof resolvedFallback === 'object' && !Array.isArray(resolvedFallback) ? resolvedFallback : {}),
                    name: (resolvedFallback && resolvedFallback.name) ? resolvedFallback.name : entry.nameHint
                }, entry.path)) {
                    loaded.push(entry.path);
                    continue;
                }

                console.warn('[EffectLibrary] Import failed:', importPath, err);
            }
        }

        EFFECT_LIBRARY.loadedEntries = loaded;
        EFFECT_LIBRARY.lastLoadError = null;
    } catch (err) {
        EFFECT_LIBRARY.lastLoadError = String(err?.message || err || 'unknown error');
        console.warn('[EffectLibrary] Load failed:', err);
    }

    window.__BLOCKHUNTER_EFFECT_LIBRARY = EFFECT_LIBRARY;
    return EFFECT_LIBRARY;
}


const GAME_FONT = '"Press Start 2P"';
// Depth value for HUD elements so they always render above game world/foreground
const HUD_DEPTH = 10000;
// Translations
const TRANSLATIONS = {};

const STARTUP_DEFAULTS = {
    startup: {
        enableFrontScenes: true,
        coinMode: 'arcade',
        initialCredits: 0
    },
    attractMode: {
        enabled: false,
        canvas: {
            width: 800,
            height: 600
        },
        elements: [],
        plugins: []
    }
};

const STARTUP_SETTINGS = JSON.parse(JSON.stringify(STARTUP_DEFAULTS));

function normalizeStartupElement(raw, index = 0) {
    const inObj = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const type = String(inObj.type || 'image').trim().toLowerCase() === 'text' ? 'text' : 'image';
    return {
        id: String(inObj.id || `el_${index}`),
        type,
        src: String(inObj.src || '').trim(),
        text: String(inObj.text || '').trim(),
        color: String(inObj.color || '#ffffff').trim() || '#ffffff',
        fontSize: Math.max(8, Number(inObj.fontSize) || 24),
        x: Math.max(0, Number(inObj.x) || 0),
        y: Math.max(0, Number(inObj.y) || 0),
        w: Math.max(8, Number(inObj.w) || (type === 'text' ? 220 : 180)),
        h: Math.max(8, Number(inObj.h) || (type === 'text' ? 48 : 120)),
        effect: String(inObj.effect || 'none').trim() || 'none',
        delayMs: Math.max(0, Number(inObj.delayMs) || 0),
        durationMs: Math.max(0, Number(inObj.durationMs) || 1000),
        order: Math.max(0, Math.floor(Number(inObj.order) || index))
    };
}

function normalizeStartupSettings(raw) {
    const root = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const startup = (root.startup && typeof root.startup === 'object' && !Array.isArray(root.startup)) ? root.startup : {};
    const attractMode = (root.attractMode && typeof root.attractMode === 'object' && !Array.isArray(root.attractMode)) ? root.attractMode : {};
    const canvas = (attractMode.canvas && typeof attractMode.canvas === 'object' && !Array.isArray(attractMode.canvas)) ? attractMode.canvas : {};
    const plugins = (Array.isArray(attractMode.plugins) ? attractMode.plugins : [])
        .map((plugin, idx) => {
            const p = (plugin && typeof plugin === 'object' && !Array.isArray(plugin)) ? plugin : {};
            return {
                id: String(p.id || '').trim(),
                enabled: p.enabled !== false,
                x: Math.max(0, Number(p.x) || 0),
                y: Math.max(0, Number(p.y) || 0),
                w: Math.max(10, Number(p.w) || 10),
                h: Math.max(10, Number(p.h) || 10),
                effect: String(p.effect || 'none').trim() || 'none',
                delayMs: Math.max(0, Number(p.delayMs) || 0),
                durationMs: Math.max(0, Number(p.durationMs) || 1000),
                order: Math.max(0, Math.floor(Number(p.order) || idx))
            };
        })
        .sort((a, b) => a.order - b.order);
    const mode = String(startup.coinMode || 'arcade').trim().toLowerCase() === 'freeplay' ? 'freeplay' : 'arcade';

    return {
        startup: {
            enableFrontScenes: startup.enableFrontScenes !== false,
            coinMode: mode,
            initialCredits: Math.max(0, Math.floor(Number(startup.initialCredits) || 0))
        },
        attractMode: {
            enabled: !!attractMode.enabled,
            canvas: {
                width: Math.max(320, Math.floor(Number(canvas.width) || 800)),
                height: Math.max(200, Math.floor(Number(canvas.height) || 600))
            },
            elements: (Array.isArray(attractMode.elements) ? attractMode.elements : [])
                .map((it, idx) => normalizeStartupElement(it, idx))
                .sort((a, b) => a.order - b.order),
            plugins
        }
    };
}

function applyStartupSettings(raw) {
    const normalized = normalizeStartupSettings(raw);
    Object.assign(STARTUP_SETTINGS.startup, normalized.startup);
    STARTUP_SETTINGS.attractMode.enabled = normalized.attractMode.enabled;
    STARTUP_SETTINGS.attractMode.canvas = { ...normalized.attractMode.canvas };
    STARTUP_SETTINGS.attractMode.elements = normalized.attractMode.elements.slice();
    STARTUP_SETTINGS.attractMode.plugins = normalized.attractMode.plugins.slice();
}

async function loadStartupSettings() {
    try {
        const resp = await fetch('data/start.json', { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const parsed = await resp.json();
        applyStartupSettings(parsed);
    } catch (err) {
        applyStartupSettings(STARTUP_DEFAULTS);
        console.warn('[StartConfig] fallback defaults:', err);
    }
}

function isFreePlayMode() {
    const startupFreeplay = String(STARTUP_SETTINGS.startup?.coinMode || '').toLowerCase() === 'freeplay';
    const configFreeplay = !!CONFIG?.creditSettings?.freeplay;
    return startupFreeplay || configFreeplay;
}

function isFrontScenesEnabled() {
    return STARTUP_SETTINGS.startup?.enableFrontScenes !== false;
}

function playConfiguredAttractElementTween(scene, node, element) {
    const effect = String(element.effect || 'none').trim();
    const duration = Math.max(0, Number(element.durationMs) || 1000);
    const delay = Math.max(0, Number(element.delayMs) || 0);

    if (!scene || !node || !scene.tweens) return;

    if (effect === 'fadeIn') {
        node.setAlpha(0);
        scene.tweens.add({ targets: node, alpha: 1, duration, delay, ease: 'Sine.easeOut' });
        return;
    }
    if (effect === 'slideLeft') {
        const baseX = Number(node.x) || 0;
        node.setAlpha(0);
        node.setX(baseX - 40);
        scene.tweens.add({ targets: node, x: baseX, alpha: 1, duration, delay, ease: 'Cubic.easeOut' });
        return;
    }
    if (effect === 'pulse') {
        scene.time.delayedCall(delay, () => {
            if (!node || !node.active) return;
            scene.tweens.add({ targets: node, scaleX: 1.08, scaleY: 1.08, duration: Math.max(120, duration), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
        return;
    }
    if (effect === 'blink') {
        scene.time.delayedCall(delay, () => {
            if (!node || !node.active) return;
            scene.tweens.add({ targets: node, alpha: 0.2, duration: Math.max(120, duration), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        });
        return;
    }

    node.setAlpha(1);
}

function applyConfiguredAttractLayout(scene) {
    const cfg = STARTUP_SETTINGS.attractMode;
    if (!scene || !cfg || cfg.enabled !== true) return;
    const elements = Array.isArray(cfg.elements) ? cfg.elements.slice().sort((a, b) => a.order - b.order) : [];
    if (!elements.length) return;

    const camera = scene.cameras?.main;
    const virtualW = Math.max(320, Number(cfg.canvas?.width) || 800);
    const virtualH = Math.max(200, Number(cfg.canvas?.height) || 600);
    const viewW = Number(camera?.width) || 800;
    const viewH = Number(camera?.height) || 600;
    const scaleX = viewW / virtualW;
    const scaleY = viewH / virtualH;

    elements.forEach((element) => {
        try {
            if (String(element.type || '').toLowerCase() === 'plugin') return;
            const px = (Number(element.x) || 0) * scaleX;
            const py = (Number(element.y) || 0) * scaleY;
            const pw = Math.max(4, (Number(element.w) || 1) * scaleX);
            const ph = Math.max(4, (Number(element.h) || 1) * scaleY);
            let node = null;

            if (element.type === 'text') {
                node = scene.add.text(px, py, element.text || '', {
                    fontSize: `${Math.max(8, Number(element.fontSize) || 24) * ((scaleX + scaleY) * 0.5)}px`,
                    fill: String(element.color || '#ffffff'),
                    fontFamily: GAME_FONT,
                    align: 'center'
                }).setOrigin(0, 0).setDepth(65);
            } else if (element.src) {
                node = scene.add.image(px + (pw / 2), py + (ph / 2), element.src).setDisplaySize(pw, ph).setDepth(65);
            }

            if (node) playConfiguredAttractElementTween(scene, node, element);
        } catch (_e) {
            // Ignore malformed attract entries.
        }
    });
}

function applyConfiguredAttractPlugins(scene) {
    const cfg = STARTUP_SETTINGS.attractMode;
    if (!scene || !cfg) return;

    const camera = scene.cameras?.main;
    const virtualW = Math.max(320, Number(cfg.canvas?.width) || 800);
    const virtualH = Math.max(200, Number(cfg.canvas?.height) || 600);
    const viewW = Number(camera?.width) || 800;
    const viewH = Number(camera?.height) || 600;
    const scaleX = viewW / virtualW;
    const scaleY = viewH / virtualH;

    const plugins = Array.isArray(cfg.plugins) ? cfg.plugins : [];
    plugins.forEach((plugin) => {
        if (!plugin || plugin.enabled === false) return;
        const id = String(plugin.id || '').trim().toLowerCase();
        const x = (Number(plugin.x) || 0) * scaleX;
        const y = (Number(plugin.y) || 0) * scaleY;
        const w = Math.max(10, (Number(plugin.w) || 10) * scaleX);
        const h = Math.max(10, (Number(plugin.h) || 10) * scaleY);
        const scale = Math.max(0.2, Math.min(4, Math.min(w / 220, h / 28)));

        const applyToText = (node, center = true) => {
            if (!node || !node.setPosition) return;
            if (center && node.setOrigin) node.setOrigin(0.5);
            node.setPosition(center ? (x + w / 2) : x, y + h / 2);
            if (node.setScale) node.setScale(scale);
        };

        if (id === 'insertcoin' || id === 'credits') {
            applyToText(scene.coinText, true);
            return;
        }
        if (id === 'players') {
            if (scene.player1Text && scene.player2Text) {
                scene.player1Text.setPosition(x + (w * 0.2), y + h / 2);
                scene.player2Text.setPosition(x + (w * 0.8), y + h / 2);
                scene.player1Text.setScale(scale);
                scene.player2Text.setScale(scale);
            }
            return;
        }
        if (id === 'language') {
            if (scene.flagSprite) {
                scene.flagSprite.baseX = x + (w / 2);
                scene.flagSprite.setPosition(x + (w / 2), y + h / 2);
                scene.flagSprite.setScale(scale, scale);
            }
            if (scene.leftArrow) {
                scene.leftArrow.setPosition((x + (w / 2)) - (80 * scale), y + h / 2);
                scene.leftArrow.setScale(scale);
            }
            if (scene.rightArrow) {
                scene.rightArrow.setPosition((x + (w / 2)) + (80 * scale), y + h / 2);
                scene.rightArrow.setScale(scale);
            }
        }
    });
}
// Load configuration from /data/config.json
// Rimosso: la configurazione viene caricata solo tramite loadConfigAndStartGame

// Native asset sizes (used to compute scale when adapting to CONFIG)
const TILE_NATIVE_WIDTH = 64; // tiles spritesheet native width per tile frame
const TILE_NATIVE_HEIGHT = 48;
const OBJECT_NATIVE_SIZE = 64; // objects.png frames are 64x64

//Default frame dimension
const defaultFrame = { frameWidth: OBJECT_NATIVE_SIZE, frameHeight: OBJECT_NATIVE_SIZE };

// Load persistent config if present (optional: can be merged after loadConfig)
function mergeLocalConfig() {
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
        // ignore localStorage errors
    }
}


function clearRuntimeMatchStorage() {
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
    const majorLevel = Math.floor(levelIndex / 5) + 1;
    const minorLevel = levelIndex % 5;
    return `level${majorLevel}${minorLevel}`;
}

function getLevelMasterNumber(levelIndex) {
    return Math.floor(levelIndex / 5) + 1;
}

function parseExitTargetLevel(rawTarget) {
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

// ============================================================================
// PRELOAD SCENE
// ============================================================================
// Scene moved to module/scenes/PreloadScene.js

// ============================================================================
// ATTRACT SCENE
// ============================================================================
// Scene moved to module/scenes/SharedFrontendScene.js

// Scene moved to module/scenes/AttractScene.js

// ============================================================================
// TOP TEN SCENE
// ============================================================================
// Scene moved to module/scenes/TopTenScene.js

// CREDITS SCENE
// ---------------------------------------------------------------------------
// Scene moved to module/scenes/CreditsScene.js

// ============================================================================
// CONFIG SCENE
// ============================================================================
// Scene moved to module/scenes/ConfigScene.js

// ============================================================================
// LEVEL SELECT SCENE
// ============================================================================
// Scene moved to module/scenes/LevelSelectScene.js

// ============================================================================
// GAME SCENE
// ============================================================================
// Scene moved to module/scenes/GameScene.js

// ============================================================================
// BONUS SCENE (Mine cart runner)
// ============================================================================
// Scene moved to module/scenes/BonusScene.js

// ============================================================================
// GAME OVER SCENE
// ============================================================================
// Scene moved to module/scenes/GameOverScene.js

// ============================================================================
// GAME INITIALIZATION
// Caricamento della configurazione da file JSON e avvio del gioco con Phaser
// ============================================================================
// Scene classes are assembled from dedicated files with shared game dependencies.
const SCENE_FACTORY_DEPS = {
    createAddCredit,
    createCreditsManager,
    createLanguageCarousel,
    applyConfiguredAttractLayout,
    applyConfiguredAttractPlugins,
    applyStartupSettings,
    Boolean,
    clearInterval,
    clearRuntimeMatchStorage,
    clearTimeout,
    CONFIG,
    console,
    Date,
    defaultFrame,
    document,
    drawTextPanel,
    EFFECT_LIBRARY,
    GAME_FONT,
    GAME_STATE,
    getLevelFileName,
    getLevelMasterNumber,
    getTextureMaxNumericFrame,
    HUD_DEPTH,
    isFinite,
    isFreePlayMode,
    isFrontScenesEnabled,
    isNaN,
    JSON,
    LEVEL_CONFIG,
    loadTranslations,
    loadEffectDefinitionFromScript,
    Math,
    mergeLocalConfig,
    normalizeEffectKey,
    normalizeStartupElement,
    normalizeStartupSettings,
    Number,
    OBJECT_NATIVE_SIZE,
    OBJECT_FRAMES,
    parseEffectLibraryManifestEntries,
    parseExitTargetLevel,
    parseFloat,
    parseInt,
    Phaser,
    playConfiguredAttractElementTween,
    playLoopAudioSafely,
    Promise,
    registerEffectLibraryDefinition,
    resetGameStateForNewRun,
    resolveContactSpec,
    setInterval,
    setTimeout,
    STARTUP_DEFAULTS,
    STARTUP_SETTINGS,
    String,
    TILE_NATIVE_HEIGHT,
    TILE_NATIVE_WIDTH,
    TILE_FRAMES,
    toEffectImportPath,
    TRANSLATIONS,
    WALL_TILE_COLS,
    window,
};

const PreloadScene = createPreloadSceneClass(SCENE_FACTORY_DEPS);
const SharedFrontendScene = createSharedFrontendSceneClass(SCENE_FACTORY_DEPS);
SCENE_FACTORY_DEPS.SharedFrontendScene = SharedFrontendScene;
const AttractScene = createAttractSceneClass(SCENE_FACTORY_DEPS);
const TopTenScene = createTopTenSceneClass(SCENE_FACTORY_DEPS);
const CreditsScene = createCreditsSceneClass(SCENE_FACTORY_DEPS);
const ConfigScene = createConfigSceneClass(SCENE_FACTORY_DEPS);
const LevelSelectScene = createLevelSelectSceneClass(SCENE_FACTORY_DEPS);
const GameScene = createGameSceneClass(SCENE_FACTORY_DEPS);
const BonusScene = createBonusSceneClass(SCENE_FACTORY_DEPS);
const GameOverScene = createGameOverSceneClass(SCENE_FACTORY_DEPS);

async function inizialization() {
    try {
        const response = await fetch('data/config.json');
        const cfg = await response.json();

        // Load startup/front-end behavior from data/start.json (optional).
        await loadStartupSettings();

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

        // Optional plugin-like effect library from data/Library/*
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
        stateKeys.forEach(k => {
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

window.inizialization = inizialization;