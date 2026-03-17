// ============================================================================
// BLOCKHUNTER - Arcade Game in Phaser 3
// ============================================================================

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
import { createConfiguredFrontSceneClass } from './module/scenes/ConfiguredFrontScene.js';

// Global configuration (populated from /data/config.json)
export const CONFIG = {};

// Game state (populated from /data/config.json)
export const GAME_STATE = {};

const DEFAULT_OBJECT_FRAMES = {};
const DEFAULT_TILE_FRAMES = {};

const DEFAULT_WALL_TILE_COLS = 6;
const OBJECT_FRAMES = { ...DEFAULT_OBJECT_FRAMES };
const TILE_FRAMES = { ...DEFAULT_TILE_FRAMES };
let WALL_TILE_COLS = DEFAULT_WALL_TILE_COLS;

/**
 * Converte una mappa generica di frame in un oggetto normalizzato key->numero intero >= 0.
 * Ignora chiavi vuote e valori non numerici.
 * @param {unknown} raw Oggetto sorgente con coppie nome frame / indice frame.
 * @returns {Record<string, number>} Mappa normalizzata dei frame.
 */
function toFrameMap(raw) {
    const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const out = {};
    Object.entries(src).forEach(([k, v]) => {
        const key = String(k || '').trim();
        const num = Number(v);
        if (!key || !Number.isFinite(num)) return;
        out[key] = Math.max(0, Math.floor(num));
    });
    return out;
}

/**
 * Reinizializza un oggetto target usando una base e un override opzionale.
 * @param {Record<string, any>} target Oggetto da svuotare e ripopolare.
 * @param {Record<string, any>} base Valori base da mantenere.
 * @param {Record<string, any>} [extra] Valori aggiuntivi/sovrascritture.
 * @returns {void}
 */
function resetObjectValues(target, base, extra) {
    Object.keys(target).forEach((k) => {
        delete target[k];
    });
    Object.assign(target, base, extra || {});
}

/**
 * Applica le costanti frame caricate da JSON validando struttura minima richiesta.
 * Aggiorna OBJECT_FRAMES, TILE_FRAMES e WALL_TILE_COLS in memoria.
 * @param {unknown} raw Payload JSON di constants.
 * @returns {void}
 * @throws {Error} Se objectFrames/tileFrames sono assenti o wallTileCols non e valido.
 */
function applyFrameConstants(raw) {
    const root = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const objectFrames = toFrameMap(root.objectFrames);
    const tileFrames = toFrameMap(root.tileFrames);
    const wallColsRaw = Number(root.wallTileCols);

    if (!Object.keys(objectFrames).length) {
        throw new Error('[FrameConstants] objectFrames mancante o vuoto in data/constants.json');
    }

    if (!Object.keys(tileFrames).length) {
        throw new Error('[FrameConstants] tileFrames mancante o vuoto in data/constants.json');
    }

    if (!Number.isFinite(wallColsRaw) || wallColsRaw <= 0) {
        throw new Error('[FrameConstants] wallTileCols mancante o non valido in data/constants.json');
    }

    resetObjectValues(OBJECT_FRAMES, DEFAULT_OBJECT_FRAMES, objectFrames);
    resetObjectValues(TILE_FRAMES, DEFAULT_TILE_FRAMES, tileFrames);
    WALL_TILE_COLS = Math.floor(wallColsRaw);
}

/**
 * Carica le costanti frame da una lista di path candidati e le applica al runtime.
 * @param {Record<string, any>} cfg Config globale (puo contenere constantsFile).
 * @param {string} [constantsPathOverride=''] Path opzionale prioritario.
 * @returns {Promise<void>} Promise risolta quando le costanti sono state applicate.
 * @throws {Error} Se nessun candidate path e valido.
 */
export async function loadFrameConstants(cfg, constantsPathOverride = '') {
    const candidates = [];
    const overridePath = String(constantsPathOverride || '').trim();
    if (overridePath) candidates.push(overridePath);
    const configuredPath = String(cfg?.constantsFile || '').trim();
    if (configuredPath) candidates.push(configuredPath);
    candidates.push('data/constants.json');

    const visited = new Set();
    let lastError = null;
    for (const p of candidates) {
        if (!p || visited.has(p)) continue;
        visited.add(p);
        try {
            const resp = await fetch(p, { cache: 'no-store' });
            if (!resp.ok) {
                lastError = new Error(`HTTP ${resp.status} su ${p}`);
                continue;
            }
            const parsed = await resp.json();
            applyFrameConstants(parsed);
            return;
        } catch (_e) {
            lastError = _e;
            // try next candidate
        }
    }

    throw new Error(`[FrameConstants] Impossibile caricare constantsFile valido. Ultimo errore: ${String(lastError?.message || lastError || 'n/a')}`);
}

// Runtime effect library loaded from module/effects/*
const EFFECT_LIBRARY = {
    effects: {},
    aliases: {},
    loadedEntries: [],
    lastLoadError: null
};

/**
 * Normalizza una chiave effetto in formato slug sicuro.
 * @param {unknown} raw Nome/identificatore effetto.
 * @returns {string} Chiave normalizzata minuscola.
 */
function normalizeEffectKey(raw) {
    return String(raw || '').trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '');
}

/**
 * Registra una definizione effetto nella libreria runtime e i relativi alias.
 * @param {unknown} rawDef Definizione effetto grezza.
 * @param {string} [sourcePath=''] Path sorgente del modulo.
 * @returns {boolean} true se registrata con successo, altrimenti false.
 */
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

/**
 * Trasforma il manifest effetti in una lista uniforme di entry caricabili.
 * @param {unknown} manifest Manifest letto da JSON.
 * @returns {Array<{path:string, nameHint:string}>} Elenco entry normalizzate.
 */
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
                    path: `module/effects/${text}/effect.js`,
                    nameHint: normalizeEffectKey(text)
                };
            }

            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

            const nameHint = normalizeEffectKey(entry.name || entry.key || entry.id || '');
            let filePath = String(entry.entry || entry.file || entry.path || entry.src || entry.module || '').trim();
            if (!filePath && nameHint) {
                filePath = `module/effects/${nameHint}/effect.js`;
            }
            if (!filePath) return null;

            if (!/\.js$/i.test(filePath)) {
                filePath = `${filePath.replace(/\/+$/, '')}/effect.js`;
            }

            return { path: filePath, nameHint };
        })
        .filter(Boolean);
}

/**
 * Converte un path modulo in import path utilizzabile da dynamic import.
 * @param {unknown} pathLike Path sorgente.
 * @returns {string} Path normalizzato per import.
 */
function toEffectImportPath(pathLike) {
    const raw = String(pathLike || '').trim();
    if (!raw) return '';
    if (/^(https?:|blob:|data:)/i.test(raw)) return raw;
    if (raw.startsWith('/')) return raw;
    if (raw.startsWith('./') || raw.startsWith('../')) return raw;
    return `./${raw}`;
}

/**
 * Carica una definizione effetto come script legacy (window export).
 * @param {unknown} pathLike Path script.
 * @returns {Promise<object|null>} Definizione effetto esportata o null.
 */
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

/**
 * Recupera il manifest effetti dal primo candidate path valido.
 * @returns {Promise<{path:string, manifest:any}>} Path usato e contenuto manifest.
 */
async function fetchEffectManifest() {
    const candidates = [
        'module/effects/manifest.json',
        'Module/effects/manifest.json'
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

/**
 * Carica dinamicamente tutti gli effetti custom dichiarati nel manifest.
 * Supporta sia moduli ESM sia script legacy.
 * @returns {Promise<object>} Libreria effetti runtime aggiornata.
 */
export async function loadCustomEffectLibrary() {
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

export const STARTUP_SETTINGS = JSON.parse(JSON.stringify(STARTUP_DEFAULTS));

const FRONT_SCENE_BASE_KEYS = ['AttractScene', 'CreditsScene', 'LevelSelectScene', 'GameOverScene'];

const FRONT_SCENE_DEFAULT_ENTRY = {
    enabled: false,
    replaceDefault: false,
    canvas: { width: 800, height: 600 },
    background: null,
    overlay: null,
    timeline: {
        autoStart: true,
        loop: false,
        duration: null,
        nextScene: '',
        nextDelayMs: null
    },
    elements: []
};

const FRONT_SCENES_DEFAULTS = {
    flow: {
        initialScene: 'AttractScene'
    },
    scenes: FRONT_SCENE_BASE_KEYS.reduce((acc, key) => {
        acc[key] = JSON.parse(JSON.stringify(FRONT_SCENE_DEFAULT_ENTRY));
        return acc;
    }, {})
};

export const FRONT_SCENES_SETTINGS = JSON.parse(JSON.stringify(FRONT_SCENES_DEFAULTS));

/**
 * Legge un valore annidato da un oggetto usando un path separato da punto.
 * @param {object} source Oggetto sorgente.
 * @param {string} path Path annidato (es: a.b.c).
 * @returns {any}
 */
function getPathValue(source, path) {
    const root = (source && typeof source === 'object') ? source : null;
    if (!root) return undefined;
    const parts = String(path || '').split('.').map((it) => String(it || '').trim()).filter(Boolean);
    if (!parts.length) return undefined;
    let ref = root;
    for (const part of parts) {
        if (!ref || typeof ref !== 'object' || !(part in ref)) return undefined;
        ref = ref[part];
    }
    return ref;
}

/**
 * Normalizza un elemento dichiarativo per una front-scene.
 * @param {unknown} raw Definizione grezza elemento.
 * @param {number} [index=0] Indice fallback.
 * @returns {{id:string,type:string,src:string,text:string,color:string,fontSize:number,x:number,y:number,w:number,h:number,effect:string,delayMs:number,durationMs:number,lifeMs:number,showAtMs:number,hideAtMs:number,hiddenInitially:boolean,order:number}}
 */
function normalizeFrontSceneElement(raw, index = 0) {
    const inObj = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const typeRaw = String(inObj.type || 'image').trim().toLowerCase();
    const type = (typeRaw === 'text') ? 'text' : 'image';
    return {
        id: String(inObj.id || `front_el_${index}`),
        type,
        src: String(inObj.src || '').trim(),
        text: String(inObj.text || '').trim(),
        color: String(inObj.color || '#ffffff').trim() || '#ffffff',
        fontSize: Math.max(8, Number(inObj.fontSize) || 24),
        x: Number.isFinite(Number(inObj.x)) ? Number(inObj.x) : 0,
        y: Number.isFinite(Number(inObj.y)) ? Number(inObj.y) : 0,
        w: Math.max(8, Number(inObj.w) || (type === 'text' ? 220 : 180)),
        h: Math.max(8, Number(inObj.h) || (type === 'text' ? 48 : 120)),
        effect: String(inObj.effect || 'none').trim() || 'none',
        delayMs: Math.max(0, Number(inObj.delayMs) || 0),
        durationMs: Math.max(0, Number(inObj.durationMs) || 1000),
        lifeMs: Math.max(0, Number(inObj.lifeMs) || 0),
        showAtMs: Math.max(0, Number(inObj.showAtMs) || 0),
        hideAtMs: Math.max(0, Number(inObj.hideAtMs) || 0),
        hiddenInitially: !!inObj.hiddenInitially,
        order: Math.max(0, Math.floor(Number(inObj.order) || index))
    };
}

/**
 * Normalizza configurazione di una singola scena frontend.
 * @param {unknown} raw Definizione grezza scena.
 * @returns {{enabled:boolean,replaceDefault:boolean,canvas:{width:number,height:number},elements:Array<object>}}
 */
function normalizeFrontSceneEntry(raw) {
    const inObj = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const canvas = (inObj.canvas && typeof inObj.canvas === 'object' && !Array.isArray(inObj.canvas)) ? inObj.canvas : {};
    const background = (inObj.background && typeof inObj.background === 'object' && !Array.isArray(inObj.background)) ? inObj.background : null;
    const overlay = (inObj.overlay && typeof inObj.overlay === 'object' && !Array.isArray(inObj.overlay)) ? inObj.overlay : null;
    const timeline = (inObj.timeline && typeof inObj.timeline === 'object' && !Array.isArray(inObj.timeline)) ? inObj.timeline : {};
    const elements = Array.isArray(inObj.elements) ? inObj.elements : [];
    return {
        enabled: !!inObj.enabled,
        replaceDefault: !!inObj.replaceDefault,
        canvas: {
            width: Math.max(320, Math.floor(Number(canvas.width) || 800)),
            height: Math.max(200, Math.floor(Number(canvas.height) || 600))
        },
        background: background ? {
            imageKey: String(background.imageKey || '').trim(),
            displaySize: Array.isArray(background.displaySize) ? background.displaySize.slice(0, 2) : null,
            depth: Number(background.depth)
        } : null,
        overlay: overlay ? {
            color: String(overlay.color || '#000000').trim() || '#000000',
            alpha: Math.max(0, Math.min(1, Number(overlay.alpha) || 0)),
            depth: Number(overlay.depth)
        } : null,
        timeline: {
            autoStart: timeline.autoStart !== false,
            loop: !!timeline.loop,
            duration: Number.isFinite(Number(timeline.duration)) ? Number(timeline.duration) : null,
            nextScene: String(timeline.nextScene || '').trim(),
            nextDelayMs: Number.isFinite(Number(timeline.nextDelayMs)) ? Number(timeline.nextDelayMs) : null,
            transitions: (timeline.transitions && typeof timeline.transitions === 'object' && !Array.isArray(timeline.transitions))
                ? Object.keys(timeline.transitions).reduce((acc, k) => {
                    const value = String(timeline.transitions[k] || '').trim();
                    if (value) acc[String(k || '').trim()] = value;
                    return acc;
                }, {})
                : {}
        },
        elements: elements.map((it, idx) => normalizeFrontSceneElement(it, idx)).sort((a, b) => a.order - b.order)
    };
}

/**
 * Normalizza la configurazione completa delle front-scenes.
 * @param {unknown} raw Config grezza.
 * @returns {{scenes: Record<string, object>}}
 */
function normalizeFrontScenesSettings(raw) {
    const root = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const flowRaw = (root.flow && typeof root.flow === 'object' && !Array.isArray(root.flow)) ? root.flow : {};
    const scenesRaw = (root.scenes && typeof root.scenes === 'object' && !Array.isArray(root.scenes)) ? root.scenes : {};
    const scenes = {};
    const allKeys = Array.from(new Set([...FRONT_SCENE_BASE_KEYS, ...Object.keys(scenesRaw)]));
    allKeys.forEach((key) => {
        scenes[key] = normalizeFrontSceneEntry(scenesRaw[key]);
    });
    return {
        flow: {
            initialScene: String(flowRaw.initialScene || FRONT_SCENES_DEFAULTS.flow.initialScene).trim() || 'AttractScene'
        },
        scenes
    };
}

/**
 * Restituisce tutte le chiavi scena frontend configurate (incluse quelle custom).
 * @returns {string[]}
 */
export function getConfiguredFrontSceneKeys() {
    const all = (FRONT_SCENES_SETTINGS && FRONT_SCENES_SETTINGS.scenes) ? FRONT_SCENES_SETTINGS.scenes : {};
    return Object.keys(all)
        .map((k) => String(k || '').trim())
        .filter(Boolean);
}

/**
 * Applica la configurazione front-scenes normalizzata al runtime.
 * @param {unknown} raw Config grezza.
 * @returns {void}
 */
function applyFrontScenesSettings(raw) {
    const normalized = normalizeFrontScenesSettings(raw);
    FRONT_SCENES_SETTINGS.flow = normalized.flow;
    FRONT_SCENES_SETTINGS.scenes = normalized.scenes;
}

/**
 * Risolve la scena iniziale frontend configurata.
 * @returns {string}
 */
export function resolveInitialFrontSceneKey() {
    const flow = (FRONT_SCENES_SETTINGS && FRONT_SCENES_SETTINGS.flow && typeof FRONT_SCENES_SETTINGS.flow === 'object')
        ? FRONT_SCENES_SETTINGS.flow
        : FRONT_SCENES_DEFAULTS.flow;
    const preferred = String(flow.initialScene || '').trim();
    if (preferred) {
        const cfg = resolveFrontSceneConfig(preferred);
        if (cfg && cfg.enabled) return preferred;
    }
    const fallback = resolveFrontSceneConfig('AttractScene');
    if (fallback && fallback.enabled) return 'AttractScene';
    const firstEnabled = getConfiguredFrontSceneKeys().find((key) => resolveFrontSceneConfig(key).enabled);
    return firstEnabled || 'AttractScene';
}

/**
 * Risolve la scena target per una transizione dichiarata nella front-scene.
 * Priorita: timeline.transitions[transitionKey] -> timeline.nextScene -> fallback.
 * @param {string} sceneKey Chiave scena corrente.
 * @param {string} transitionKey Nome transizione (es. onStart/onTimeout/onEsc).
 * @param {string} [fallback=''] Fallback se non configurato.
 * @returns {string}
 */
export function resolveConfiguredFrontSceneTarget(sceneKey, transitionKey, fallback = '') {
    const cfg = resolveFrontSceneConfig(sceneKey);
    const timeline = (cfg && cfg.timeline && typeof cfg.timeline === 'object') ? cfg.timeline : {};
    const transitions = (timeline.transitions && typeof timeline.transitions === 'object') ? timeline.transitions : {};
    const key = String(transitionKey || '').trim();
    if (key && transitions[key]) return String(transitions[key]).trim();
    if (key === 'next' && timeline.nextScene) return String(timeline.nextScene).trim();
    return String(fallback || '').trim();
}

/**
 * Carica la configurazione front-scenes da JSON con fallback ai default.
 * @param {string} [frontScenesPathOverride=''] Path opzionale.
 * @returns {Promise<void>}
 */
export async function loadFrontScenesSettings(frontScenesPathOverride = '') {
    const frontScenesPath = String(frontScenesPathOverride || '').trim() || 'data/front-scenes.json';
    try {
        const resp = await fetch(frontScenesPath, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const parsed = await resp.json();
        applyFrontScenesSettings(parsed);
    } catch (err) {
        applyFrontScenesSettings(FRONT_SCENES_DEFAULTS);
        console.warn('[FrontScenes] fallback defaults:', err);
    }
}

/**
 * Risolve la config front scene per chiave scena.
 * @param {string} sceneKey Chiave scena Phaser.
 * @returns {{enabled:boolean,replaceDefault:boolean,canvas:{width:number,height:number},elements:Array<object>}}
 */
function resolveFrontSceneConfig(sceneKey) {
    const key = String(sceneKey || '').trim();
    const all = (FRONT_SCENES_SETTINGS && FRONT_SCENES_SETTINGS.scenes) ? FRONT_SCENES_SETTINGS.scenes : {};
    return normalizeFrontSceneEntry(all[key]);
}

/**
 * Applica binding template sul testo elemento ({{t.key}}, {{state.score}}, {{config.width}}).
 * @param {string} text Testo sorgente.
 * @param {object} [runtimeContext={}] Context runtime.
 * @returns {string}
 */
function resolveFrontTemplateText(text, runtimeContext = {}) {
    const src = String(text || '');
    if (!src.includes('{{')) return src;

    const t = (runtimeContext && runtimeContext.t && typeof runtimeContext.t === 'object') ? runtimeContext.t : {};
    const state = (runtimeContext && runtimeContext.state && typeof runtimeContext.state === 'object') ? runtimeContext.state : GAME_STATE;
    const cfg = (runtimeContext && runtimeContext.config && typeof runtimeContext.config === 'object') ? runtimeContext.config : CONFIG;

    return src.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, exprRaw) => {
        const expr = String(exprRaw || '').trim();
        if (!expr) return '';
        if (expr.startsWith('t.')) {
            const value = getPathValue(t, expr.slice(2));
            return (value === undefined || value === null) ? '' : String(value);
        }
        if (expr.startsWith('state.')) {
            const value = getPathValue(state, expr.slice(6));
            return (value === undefined || value === null) ? '' : String(value);
        }
        if (expr.startsWith('config.')) {
            const value = getPathValue(cfg, expr.slice(7));
            return (value === undefined || value === null) ? '' : String(value);
        }
        if (expr.startsWith('runtime.')) {
            const value = getPathValue(runtimeContext, expr.slice(8));
            return (value === undefined || value === null) ? '' : String(value);
        }
        return '';
    });
}

/**
 * Applica tween configurato su un nodo front-scene.
 * @param {Phaser.Scene} scene Scena corrente.
 * @param {any} node Nodo target.
 * @param {{effect?:string,durationMs?:number,delayMs?:number}} element Config elemento.
 * @returns {void}
 */
function playConfiguredFrontSceneElementTween(scene, node, element) {
    if (!scene || !node || !scene.tweens) return;
    const effect = String(element.effect || 'none').trim();
    const duration = Math.max(0, Number(element.durationMs) || 1000);
    const delay = Math.max(0, Number(element.delayMs) || 0);

    // Support sequential tweens from element.tweens array
    if (Array.isArray(element.tweens) && element.tweens.length > 0) {
        element.tweens.forEach((tweenDef, index) => {
            const startMs = Math.max(0, Number(tweenDef.startMs) || 0);
            const durationMs = Math.max(0, Number(tweenDef.durationMs) || 0);
            const easeStr = String(tweenDef.ease || 'Linear').trim();
            const property = String(tweenDef.property || 'alpha').trim();
            const targetValue = tweenDef.targetValue;
            const yoyo = Boolean(tweenDef.yoyo);
            const repeat = Number(tweenDef.repeat) || 0;
            const onComplete = String(tweenDef.onComplete || '').trim();

            scene.time.delayedCall(startMs, () => {
                if (!node || !node.active) return;
                const tweenConfig = {
                    targets: node,
                    [property]: targetValue,
                    duration: durationMs,
                    ease: easeStr,
                    yoyo: yoyo,
                    repeat: repeat
                };

                // Handle onComplete callbacks
                if (onComplete === 'destroyElement') {
                    tweenConfig.onComplete = () => {
                        try { if (node && node.active) node.destroy(); } catch (_e) { }
                    };
                }

                scene.tweens.add(tweenConfig);
            });
        });
        return;
    }

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
            scene.tweens.add({
                targets: node,
                scaleX: 1.08,
                scaleY: 1.08,
                duration: Math.max(120, duration),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });
        return;
    }
    if (effect === 'blink') {
        scene.time.delayedCall(delay, () => {
            if (!node || !node.active) return;
            scene.tweens.add({
                targets: node,
                alpha: 0.25,
                duration: Math.max(120, duration),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });
        return;
    }
    if (effect === 'zoomIn') {
        node.setScale(0.7, 0.7);
        node.setAlpha(0);
        scene.tweens.add({ targets: node, scaleX: 1, scaleY: 1, alpha: 1, duration, delay, ease: 'Back.easeOut' });
        return;
    }
    node.setAlpha(1);
}

/**
 * Renderizza il layout data-driven per una front scene.
 * @param {Phaser.Scene} scene Scena target.
 * @param {string} sceneKey Chiave scena (AttractScene/CreditsScene/LevelSelectScene/GameOverScene).
 * @param {object} [runtimeContext={}] Context runtime per binding testo.
 * @returns {{enabled:boolean,replaceDefault:boolean,rendered:number}}
 */
function applyConfiguredFrontSceneLayout(scene, sceneKey, runtimeContext = {}) {
    if (!scene) return { enabled: false, replaceDefault: false, rendered: 0 };

    const cfg = resolveFrontSceneConfig(sceneKey);
    if (!cfg.enabled) {
        if (scene.__frontSceneRuntimeLayer && scene.__frontSceneRuntimeLayer.destroy) {
            try { scene.__frontSceneRuntimeLayer.destroy(true); } catch (_e) { }
        }
        scene.__frontSceneRuntimeLayer = null;
        scene.__frontSceneRuntimeNodes = {};
        return { enabled: false, replaceDefault: false, rendered: 0 };
    }

    try {
        if (scene.__frontSceneRuntimeLayer && scene.__frontSceneRuntimeLayer.destroy) scene.__frontSceneRuntimeLayer.destroy(true);
    } catch (_e) { }

    const camera = scene.cameras?.main;
    const viewW = Number(camera?.width) || Number(CONFIG.width) || 800;
    const viewH = Number(camera?.height) || Number(CONFIG.height) || 600;
    const virtualW = Math.max(320, Number(cfg.canvas?.width) || viewW);
    const virtualH = Math.max(200, Number(cfg.canvas?.height) || viewH);
    const scaleX = viewW / virtualW;
    const scaleY = viewH / virtualH;

    const layer = scene.add.layer();
    layer.setDepth(6500);
    scene.__frontSceneRuntimeLayer = layer;
    scene.__frontSceneRuntimeNodes = {};

    const ordered = Array.isArray(cfg.elements) ? cfg.elements.slice().sort((a, b) => a.order - b.order) : [];
    ordered.forEach((element) => {
        try {
            const px = (Number(element.x) || 0) * scaleX;
            const py = (Number(element.y) || 0) * scaleY;
            const pw = Math.max(4, (Number(element.w) || 1) * scaleX);
            const ph = Math.max(4, (Number(element.h) || 1) * scaleY);
            let node = null;

            if (element.type === 'text') {
                node = scene.add.text(px, py, resolveFrontTemplateText(element.text || '', runtimeContext), {
                    fontSize: `${Math.max(8, Number(element.fontSize) || 24) * ((scaleX + scaleY) * 0.5)}px`,
                    fill: String(element.color || '#ffffff'),
                    fontFamily: GAME_FONT,
                    align: 'center',
                    wordWrap: { width: Math.max(40, pw) }
                }).setOrigin(0.5, 0.5);
            } else if (element.src || element.imageKey) {
                const keyOrPath = String(element.src || element.imageKey || '').trim();
                const imgScale = Number(element.scale) || 1;
                const imgWidth = Number(element.width) || Number(element.w) || 64;
                const imgHeight = Number(element.height) || Number(element.h) || 64;
                node = scene.add.image(px, py, keyOrPath);
                if (imgScale && imgScale !== 1) {
                    node.setScale(imgScale);
                } else if (imgWidth > 0 || imgHeight > 0) {
                    node.setDisplaySize(imgWidth * scaleX, imgHeight * scaleY);
                }
            }

            if (!node) return;
            node.name = String(element.id || '');
            
                        // Apply initial properties
                        if (Number(element.scale) && element.type !== 'text') {
                            node.setScale(Number(element.scale));
                        }
                        if (Number(element.alpha) !== undefined) {
                            node.setAlpha(Number(element.alpha));
                        }
                        if (Number(element.depth)) {
                            node.setDepth(Number(element.depth));
                        }
                        if (Array.isArray(element.origin)) {
                            node.setOrigin(Number(element.origin[0]) || 0.5, Number(element.origin[1]) || 0.5);
                        }
                        if (Number(element.rotation)) {
                            node.setRotation(Number(element.rotation));
                        }
                        if (typeof element.visible === 'boolean') {
                            node.setVisible(element.visible);
                        }
            
            if (element.hiddenInitially) node.setVisible(false);
            layer.add(node);
            scene.__frontSceneRuntimeNodes[element.id] = { node, element };

            playConfiguredFrontSceneElementTween(scene, node, element);

            if (Number(element.lifeMs) > 0) {
                const ttl = Math.max(0, Number(element.delayMs) || 0) + Math.max(0, Number(element.durationMs) || 0) + Math.max(0, Number(element.lifeMs) || 0);
                scene.time.delayedCall(ttl, () => {
                    try { if (node && node.active) node.destroy(); } catch (_e) { }
                });
            }
        } catch (_e) {
            // Skip malformed nodes.
        }
    });

    return { enabled: true, replaceDefault: !!cfg.replaceDefault, rendered: ordered.length };
}

/**
 * Esegue la timeline dichiarativa (show/hide) della front scene.
 * @param {Phaser.Scene} scene Scena target.
 * @param {string} sceneKey Chiave scena.
 * @returns {void}
 */
function playConfiguredFrontSceneTimeline(scene, sceneKey) {
    if (!scene || !scene.time) return;
    const cfg = resolveFrontSceneConfig(sceneKey);
    if (!cfg.enabled || !Array.isArray(cfg.elements)) return;

    cfg.elements.forEach((element) => {
        const id = String(element.id || '').trim();
        if (!id) return;
        const showAt = Math.max(0, Number(element.showAtMs) || 0);
        const hideAt = Math.max(0, Number(element.hideAtMs) || 0);

        if (showAt > 0) {
            scene.time.delayedCall(showAt, () => {
                const entry = scene.__frontSceneRuntimeNodes?.[id];
                if (entry && entry.node && entry.node.active && entry.node.setVisible) {
                    entry.node.setVisible(true);
                }
            });
        }

        if (hideAt > 0) {
            scene.time.delayedCall(hideAt, () => {
                const entry = scene.__frontSceneRuntimeNodes?.[id];
                if (entry && entry.node && entry.node.active && entry.node.setVisible) {
                    entry.node.setVisible(false);
                }
            });
        }
    });
}

/**
 * Normalizza un elemento grafico/testuale per la schermata attract.
 * @param {unknown} raw Definizione grezza elemento.
 * @param {number} [index=0] Indice fallback per ordinamento/id.
 * @returns {{id:string,type:string,src:string,text:string,color:string,fontSize:number,x:number,y:number,w:number,h:number,effect:string,delayMs:number,durationMs:number,order:number}}
 */
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
        x: Number.isFinite(Number(inObj.x)) ? Number(inObj.x) : 0,
        y: Number.isFinite(Number(inObj.y)) ? Number(inObj.y) : 0,
        w: Math.max(8, Number(inObj.w) || (type === 'text' ? 220 : 180)),
        h: Math.max(8, Number(inObj.h) || (type === 'text' ? 48 : 120)),
        effect: String(inObj.effect || 'none').trim() || 'none',
        delayMs: Math.max(0, Number(inObj.delayMs) || 0),
        durationMs: Math.max(0, Number(inObj.durationMs) || 1000),
        order: Math.max(0, Math.floor(Number(inObj.order) || index))
    };
}

/**
 * Normalizza l'intera configurazione startup/attract mode.
 * @param {unknown} raw Configurazione grezza caricata da JSON.
 * @returns {{startup: object, attractMode: object}} Config normalizzata.
 */
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

/**
 * Applica in memoria la startup config normalizzata.
 * @param {unknown} raw Configurazione grezza startup.
 * @returns {void}
 */
function applyStartupSettings(raw) {
    const normalized = normalizeStartupSettings(raw);
    Object.assign(STARTUP_SETTINGS.startup, normalized.startup);
    STARTUP_SETTINGS.attractMode.enabled = normalized.attractMode.enabled;
    STARTUP_SETTINGS.attractMode.canvas = { ...normalized.attractMode.canvas };
    STARTUP_SETTINGS.attractMode.elements = normalized.attractMode.elements.slice();
    STARTUP_SETTINGS.attractMode.plugins = normalized.attractMode.plugins.slice();
}

/**
 * Carica le impostazioni startup da JSON con fallback ai default.
 * @param {string} [startPathOverride=''] Path opzionale startup.
 * @returns {Promise<void>}
 */
export async function loadStartupSettings(startPathOverride = '') {
    const startupPath = String(startPathOverride || '').trim() || 'data/start.json';
    try {
        const resp = await fetch(startupPath, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const parsed = await resp.json();
        applyStartupSettings(parsed);
    } catch (err) {
        applyStartupSettings(STARTUP_DEFAULTS);
        console.warn('[StartConfig] fallback defaults:', err);
    }
}

/**
 * Determina se il gioco e in modalita freeplay.
 * @returns {boolean} true se freeplay attivo via startup o config crediti.
 */
export function isFreePlayMode() {
    const startupFreeplay = String(STARTUP_SETTINGS.startup?.coinMode || '').toLowerCase() === 'freeplay';
    const configFreeplay = !!CONFIG?.creditSettings?.freeplay;
    return startupFreeplay || configFreeplay;
}

/**
 * Verifica se le scene frontend devono essere abilitate.
 * @returns {boolean}
 */
function isFrontScenesEnabled() {
    return STARTUP_SETTINGS.startup?.enableFrontScenes !== false;
}

/**
 * Applica tween animato a un nodo attract in base all'effetto configurato.
 * @param {Phaser.Scene} scene Scena Phaser corrente.
 * @param {any} node Nodo grafico target.
 * @param {{effect?:string,durationMs?:number,delayMs?:number}} element Config effetto elemento.
 * @returns {void}
 */
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

/**
 * Renderizza gli elementi attract configurati con scaling relativo alla viewport.
 * @param {Phaser.Scene} scene Scena target.
 * @returns {void}
 */
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

/**
 * Posiziona i plugin attract (insert coin, players, language) secondo config.
 * @param {Phaser.Scene} scene Scena target.
 * @returns {void}
 */
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
export const OBJECT_NATIVE_SIZE = 64; // objects.png frames are 64x64

//Default frame dimension
const defaultFrame = { frameWidth: OBJECT_NATIVE_SIZE, frameHeight: OBJECT_NATIVE_SIZE };

// Load persistent config if present (optional: can be merged after loadConfig)
/**
 * Effettua merge della configurazione salvata localmente con quella runtime.
 * @returns {void}
 */
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
/**
 * Pulisce storage runtime/session relativo alla partita corrente.
 * @returns {void}
 */
function clearRuntimeMatchStorage() {
    try {
        if (window && window.localStorage) {
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

/**
 * Reinizializza lo stato partita per una nuova run (1P o 2P).
 * @param {number} [players=1] Numero giocatori richiesto.
 * @returns {void}
 */
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
/**
 * Disegna un pannello arrotondato dietro un oggetto di testo.
 * @param {Phaser.GameObjects.Graphics} graphics Istanza graphics da usare.
 * @param {any} textObj Oggetto testo Phaser.
 * @param {{paddingX?:number,paddingY?:number,radius?:number}} [opts={}] Opzioni pannello.
 * @returns {void}
 */
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

/**
 * Recupera il massimo indice frame numerico disponibile per una texture.
 * @param {Phaser.Scene} scene Scena corrente.
 * @param {string} textureKey Chiave texture.
 * @param {number} [fallback=0] Valore fallback.
 * @returns {number} Ultimo frame numerico noto o fallback.
 */
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

/**
 * Avvia audio in loop in modo sicuro gestendo lock audio/autoplay.
 * @param {Phaser.Scene} scene Scena corrente.
 * @param {string} key Chiave audio.
 * @param {number} [volume=0.3] Volume target.
 * @returns {void}
 */
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

const DEFAULT_CONTACT_SPEC = {
    contactType: 'edge',
    radiusMultiplier: 0.45,
    radiusPixels: null,
    proximityTiles: 0.9,
    proximityPixels: null
};

/**
 * Normalizza una contact spec con fallback su valori default.
 * @param {any} raw Specifica grezza.
 * @param {object} [fallback=DEFAULT_CONTACT_SPEC] Spec fallback.
 * @returns {{contactType:string,radiusMultiplier:number,radiusPixels:number|null,proximityTiles:number,proximityPixels:number|null}}
 */
function normalizeContactSpec(raw, fallback = DEFAULT_CONTACT_SPEC) {
    const def = (fallback && typeof fallback === 'object') ? fallback : DEFAULT_CONTACT_SPEC;
    if (typeof raw === 'string') {
        return Object.assign({}, def, { contactType: raw || def.contactType });
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return Object.assign({}, def);
    }
    return {
        contactType: raw.contactType || def.contactType,
        radiusMultiplier: (typeof raw.radiusMultiplier === 'number') ? raw.radiusMultiplier : def.radiusMultiplier,
        radiusPixels: (typeof raw.radiusPixels === 'number') ? raw.radiusPixels : def.radiusPixels,
        proximityTiles: (typeof raw.proximityTiles === 'number') ? raw.proximityTiles : def.proximityTiles,
        proximityPixels: (typeof raw.proximityPixels === 'number') ? raw.proximityPixels : def.proximityPixels
    };
}

/**
 * Costruisce profili contatto a partire dal catalogo oggetti.
 * @param {Array<any>} catalog Catalogo oggetti (objects.json).
 * @returns {Record<string, object>} Mappa profili contatto per tipo/token.
 */
function buildContactProfilesFromObjectsCatalog(catalog) {
    const map = {
        default: Object.assign({}, DEFAULT_CONTACT_SPEC),
        player: {
            contactType: 'center',
            radiusMultiplier: 0.35,
            radiusPixels: 22,
            proximityTiles: 0.85,
            proximityPixels: 54
        }
    };
    if (!Array.isArray(catalog)) return map;

    const assignIfMissing = (key, spec) => {
        const k = String(key || '').trim().toLowerCase();
        if (!k || map[k]) return;
        map[k] = normalizeContactSpec(spec, map.default);
    };

    catalog.forEach((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;

        const collision = (entry.collision && typeof entry.collision === 'object' && !Array.isArray(entry.collision))
            ? entry.collision
            : entry;
        const spec = normalizeContactSpec(collision, map.default);

        const token = String(entry.token || '').trim().toLowerCase();
        const category = String(entry.category || '').trim().toLowerCase();
        const entityType = String(entry.entityType || '').trim().toLowerCase();
        const key = String(entry.key || '').trim().toLowerCase();

        assignIfMissing(token, spec);
        assignIfMissing(category, spec);
        assignIfMissing(entityType, spec);
        assignIfMissing(key, spec);

        if (category === 'pickup') assignIfMissing('item', spec);
        if (category === 'door' || entityType === 'door' || token === 'door') assignIfMissing('door', spec);
        if (category === 'exit' || entityType === 'exit' || token === 'exit') assignIfMissing('exit', spec);
        if (category === 'wall' || entityType === 'wall' || token.startsWith('w')) assignIfMissing('wall', spec);
        if (category === 'gem' || entityType === 'gem' || token === 'gem') assignIfMissing('gem', spec);
        if (category === 'rock' || entityType === 'rock' || token === 'rock') assignIfMissing('rock', spec);
    });

    return map;
}

// Resolve contact specs with priority: objects catalog (token-driven) -> legacy config -> defaults.
/**
 * Risolve la specifica contatto per un typename con priorita runtime->legacy->default.
 * @param {string} typename Tipo logico/token da risolvere.
 * @returns {{contactType:string,radiusMultiplier:number,radiusPixels:number|null,proximityTiles:number,proximityPixels:number|null}}
 */
function resolveContactSpec(typename) {
    try {
        const globalObj = (typeof window !== 'undefined' && window) ? window : {};
        const legacyMap = (CONFIG && CONFIG.objectContactByType) ? CONFIG.objectContactByType : {};

        let runtimeMap = (globalObj.__BLOCKHUNTER_OBJECT_CONTACT_PROFILES__
            && typeof globalObj.__BLOCKHUNTER_OBJECT_CONTACT_PROFILES__ === 'object')
            ? globalObj.__BLOCKHUNTER_OBJECT_CONTACT_PROFILES__
            : null;

        if (!runtimeMap) {
            const catalog = Array.isArray(globalObj.__BLOCKHUNTER_OBJECTS_CATALOG__)
                ? globalObj.__BLOCKHUNTER_OBJECTS_CATALOG__
                : null;
            runtimeMap = buildContactProfilesFromObjectsCatalog(catalog);
            globalObj.__BLOCKHUNTER_OBJECT_CONTACT_PROFILES__ = runtimeMap;
        }

        const base = normalizeContactSpec(runtimeMap.default || legacyMap.default || DEFAULT_CONTACT_SPEC, DEFAULT_CONTACT_SPEC);
        if (!typename) return base;

        const key = String(typename || '').trim().toLowerCase();
        if (!key) return base;

        const runtimeRaw = runtimeMap[key];
        if (runtimeRaw) return normalizeContactSpec(runtimeRaw, base);

        const legacyRaw = legacyMap[key];
        if (legacyRaw) return normalizeContactSpec(legacyRaw, base);

        return base;
    } catch (e) {
        return Object.assign({}, DEFAULT_CONTACT_SPEC);
    }
}

// Helper function to get level file number from level index
// Level index 0-4 -> level10-14, 5-9 -> level20-24, etc.
/**
 * Converte indice livello interno nel nome file levelXY.
 * @param {number} levelIndex Indice livello zero-based.
 * @returns {string} Nome cache/file livello (es. level10).
 */
function getLevelFileName(levelIndex) {
    const majorLevel = Math.floor(levelIndex / 5) + 1;
    const minorLevel = levelIndex % 5;
    return `level${majorLevel}${minorLevel}`;
}

/**
 * Restituisce il livello master (1..N) da indice zero-based.
 * @param {number} levelIndex Indice livello interno.
 * @returns {number} Numero livello master.
 */
function getLevelMasterNumber(levelIndex) {
    return Math.floor(levelIndex / 5) + 1;
}

/**
 * Parse del target livello in uscita (formato X.Y o compatto XY).
 * @param {unknown} rawTarget Valore target da JSON mappa.
 * @returns {{id:string,index:number}|null} Destinazione valida oppure null.
 */
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

    const totalLevels = Number(CONFIG?.levelSpecs?.totalPlayableLevels) || 25;
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
/**
 * Costruisce le classi scena con supporto override factories.
 * @param {Record<string, Function>} [sceneFactoryOverrides={}] Override opzionali delle factory scena.
 * @returns {{PreloadScene:any,AttractScene:any,TopTenScene:any,CreditsScene:any,ConfigScene:any,LevelSelectScene:any,GameScene:any,BonusScene:any,GameOverScene:any}}
 */
export function buildSceneClasses(sceneFactoryOverrides = {}) {
    const sceneFactories = (sceneFactoryOverrides && typeof sceneFactoryOverrides === 'object' && !Array.isArray(sceneFactoryOverrides))
        ? sceneFactoryOverrides
        : {};

    const preloadFactory = sceneFactories.createPreloadSceneClass || createPreloadSceneClass;
    const sharedFrontendFactory = sceneFactories.createSharedFrontendSceneClass || createSharedFrontendSceneClass;
    const attractFactory = sceneFactories.createAttractSceneClass || createAttractSceneClass;
    const topTenFactory = sceneFactories.createTopTenSceneClass || createTopTenSceneClass;
    const creditsFactory = sceneFactories.createCreditsSceneClass || createCreditsSceneClass;
    const configFactory = sceneFactories.createConfigSceneClass || createConfigSceneClass;
    const levelSelectFactory = sceneFactories.createLevelSelectSceneClass || createLevelSelectSceneClass;
    const gameFactory = sceneFactories.createGameSceneClass || createGameSceneClass;
    const bonusFactory = sceneFactories.createBonusSceneClass || createBonusSceneClass;
    const gameOverFactory = sceneFactories.createGameOverSceneClass || createGameOverSceneClass;

    const deps = {
        createAddCredit,
        createCreditsManager,
        createLanguageCarousel,
        applyConfiguredAttractLayout,
        applyConfiguredAttractPlugins,
        applyConfiguredFrontSceneLayout,
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
        playConfiguredFrontSceneTimeline,
        playLoopAudioSafely,
        Promise,
        registerEffectLibraryDefinition,
        resetGameStateForNewRun,
        resolveContactSpec,
        resolveConfiguredFrontSceneTarget,
        resolveInitialFrontSceneKey,
        resolveFrontSceneConfig,
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

    const PreloadScene = preloadFactory(deps);
    const SharedFrontendScene = sharedFrontendFactory(deps);
    deps.SharedFrontendScene = SharedFrontendScene;

    const fixedSceneMap = {
        PreloadScene,
        AttractScene: attractFactory(deps),
        TopTenScene: topTenFactory(deps),
        CreditsScene: creditsFactory(deps),
        ConfigScene: configFactory(deps),
        LevelSelectScene: levelSelectFactory(deps),
        GameScene: gameFactory(deps),
        BonusScene: bonusFactory(deps),
        GameOverScene: gameOverFactory(deps)
    };

    const dynamicFrontScenes = {};
    const protectedKeys = new Set(Object.keys(fixedSceneMap));
    getConfiguredFrontSceneKeys().forEach((sceneKey) => {
        if (protectedKeys.has(sceneKey)) return;
        const cfg = resolveFrontSceneConfig(sceneKey);
        if (!cfg.enabled) return;
        dynamicFrontScenes[sceneKey] = createConfiguredFrontSceneClass(sceneKey, deps);
    });

    return {
        ...fixedSceneMap,
        ...dynamicFrontScenes
    };
}
