const OBJECT_FRAMES = {
    dynamite: 0,
    heart: 1,
    stone: 2,
    player: 3,
    dynamite_chest: 4,
    door: 5,
    gem: 6,
    stones: 7,
    key: 8,
    sand_pile: 9,
    ghost: 10,
    wooden: 10, // wooden plank alias (reuses frame 10)
    pepita: 11,
    wall: 12,
    hole1: 13,
    hole2: 14,
    exit: 14,
    explosion: 15,
    cart: 7,
    helmet: 3
};

const STORAGE_KEY = 'blockHunterLevelEditorState';
const WALL_TOKEN_REGEX = /^w(\d)(\d)(\d)([hv0])$/i;
const BG_ASSETS_DIR = 'assets/images/scenes/game/background';
const FG_ASSETS_DIR = 'assets/images/scenes/game/foreground';
const OBJECTS_ASSETS_DIR = 'assets/images/objects';
const ATTRACT_ASSETS_DIR = 'assets/images/scenes/attractmode';
const API_BASE_PATH = 'api';
const BG_MANIFEST_PATH = 'data/images-scenes-game-background.json';
const FG_MANIFEST_PATH = 'data/images-scenes-game-foreground.json';
const MUSIC_MANIFEST_PATH = 'data/music-scenes-game.json';
const CONFIG_JSON_PATH = 'data/config.json';
const START_JSON_PATH = 'data/start.json';
const OBJECTS_JSON_PATH = 'data/objects.json';
const LEVELS_DIR_PATH = 'data/level';

// Available numeric level backgrounds discovered from images/level<N>.png
const AVAILABLE_BG_LEVELS = [1,2,3,4,5,6];

const BASE_PALETTE_ITEMS = [
    //{ token: '-', label: 'vuoto (-)' },
    { token: '.', label: 'hole invisibile (.)' },
    { token: '#', label: 'muro invisibile (#)' },
    // tiles
    //{ token: 'f', label: 'sabbia / floor (f)' },
    { token: 'h', label: 'hole (h)' },
    //{ token: 's', label: 'hole2 / sand (s)' },
    // additional tile tokens
    { token: 'sand', label: 'sabbia (sand)' },
    { token: 'water', label: 'pozzanghera / water (water)' },
    { token: 'mud', label: 'fango / mud (mud)' },
    { token: 'back', label: 'back (torna al livello precedente) (back)' },
    // objects
    { token: 'g', label: 'gem (g)' },
    { token: 'd', label: 'door (d)' },
    { token: 'k', label: 'key (k)' },
    { token: 'p', label: 'pepita / gem pickup (p)' },
    { token: 'l', label: 'cuore / life (l)' },
    { token: 'exit', label: 'uscita / exit (exit)' },
    { token: 'wooden', label: 'asse / wooden (wooden)' },
    { token: 'helmet', label: 'helmet' },
    { token: 'b', label: 'dynamite chest (b)' },
    { token: 'c', label: 'cart / stones (c)' },
    { token: 'm', label: 'skeleton / wall (m)' },
    { token: 'stones', label: 'stones (stones)' },
    { token: 'ghost', label: 'ghost spawn' },
    { token: 'bat', label: 'bat spawn' }
];

// Palette shows all 24 wall variants (4 rows x 6 cols); rotation/mirroring applied after placement
const WALL_PALETTE_ITEMS = (() => {
    const arr = [];
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 6; c++) {
            arr.push({ token: `w${r}${c}00`, label: `wall ${r}${c}` });
        }
    }
    return arr;
})();

const PALETTE_ITEMS = [...BASE_PALETTE_ITEMS, ...WALL_PALETTE_ITEMS];

const DEFAULT_LEVEL = {
    id: '1.0',
    map: {
        cols: 12,
        rows: 12,
        timer: 120,
        tiles: []
    },
    playerStart: { row: 1, col: 1 },
    staticRocks: {
        enabled: true,
        dynamicSize: null,
        rotation: null,
        chaotic: null,
        shardBurstCount: 0
    },
    dynamicBoulders: {
        enabled: true,
        directions: ['top', 'bottom', 'left', 'right'],
        sizes: null,
        splitOnImpact: false,
        splitPiecesRange: [2, 3],
        maxSplitGeneration: 1
    },
    speed: 1,
    escapeRoute: true,
    objectiveLabel: 'objective_collect_gems_and_survive',
    enemies: null,
    collectibles: null,
    traps: null,
    spawnPoints: null,
    timeLimit: null,
    scoreRules: null,
    effects: {
        general: {
            light: 'piena',
            rain: {
                enabled: false,
                intensity: 1,
                frequency: 180,
                wind: 0,
                direction: 'down',
                interval: 5,
                duration: 0
            },
            fog: {
                enabled: false,
                alpha: 0.15,
                layers: 3,
                speed: 'slow',
                direction: 'left'
            }
        },
        objects: {}
    },
    backgroundEnabled: true,
    foregroundEnabled: true
};

function el(id) {
    return document.getElementById(id);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function parseBool(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return fallback;
}

function parseNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseRepeatValue(value, fallback = 1) {
    const raw = String(value ?? '').trim();
    if (raw === '*') return '*';
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.floor(parsed));
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        try {
            const reader = new FileReader();
            reader.onload = () => {
                const result = String(reader.result || '');
                const commaIdx = result.indexOf(',');
                resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
            };
            reader.onerror = () => reject(new Error('impossibile leggere il file selezionato'));
            reader.readAsDataURL(file);
        } catch (e) {
            reject(e);
        }
    });
}

function buildApiUrl(path) {
    const clean = String(path ?? '').replace(/^\/+|\/+$/g, '');
    // Always hit directory-style PHP endpoints with a trailing slash
    // to avoid server-side canonical redirects that may downgrade scheme.
    return `${API_BASE_PATH}/${clean}/`;
}

function buildPageRelativeUrl(path) {
    const clean = String(path ?? '').trim().replace(/^\.?\/+/, '');
    if (!clean) return '';
    if (/^(https?:|data:|blob:)/i.test(clean)) return clean;

    try {
        const pagePath = String(window?.location?.pathname || '/');
        const baseDir = pagePath.endsWith('/') ? pagePath : pagePath.replace(/\/[^/]*$/, '/');
        return `${baseDir}${clean}`;
    } catch (_e) {
        return clean;
    }
}

function buildStaticPathCandidates(path) {
    const clean = String(path ?? '').trim().replace(/^\.?\/+/, '');
    if (!clean) return [];

    const out = [clean, `./${clean}`];
    const pageRelative = buildPageRelativeUrl(clean);
    if (pageRelative && !out.includes(pageRelative)) out.push(pageRelative);
    return out;
}

async function fetchJsonListWithFallback(primaryUrl, fallbackUrl) {
    try {
        const primary = await fetch(primaryUrl);
        if (primary.ok) {
            const data = await primary.json();
            return Array.isArray(data) ? data : [];
        }
    } catch (_e) {
        // Fallback handled below.
    }

    const fallbackCandidates = buildStaticPathCandidates(fallbackUrl);
    for (const candidate of fallbackCandidates) {
        try {
            const fallback = await fetch(candidate);
            if (!fallback.ok) continue;
            const data = await fallback.json();
            return Array.isArray(data) ? data : [];
        } catch (_e) {
            // Continue with next candidate.
        }
    }

    return [];
}

function normalizeLayerSrc(rawValue, type) {
    const raw = String(rawValue ?? '').trim();
    if (!raw) return '';

    if (/^(https?:|data:|blob:|\/)/i.test(raw)) return raw;
    if (/^game_bg(_\d+)?$/i.test(raw)) return raw;
    if (raw.startsWith(`${BG_ASSETS_DIR}/`) || raw.startsWith(`${FG_ASSETS_DIR}/`)) return raw;

    const targetDir = type === 'fg' ? FG_ASSETS_DIR : BG_ASSETS_DIR;
    if (raw.startsWith('images/')) return `${targetDir}/${raw.slice('images/'.length)}`;
    if (!raw.includes('/')) return `${targetDir}/${raw}`;

    return raw;
}

function layerFilenameFromSrc(src, type) {
    const raw = String(src ?? '').trim();
    if (!raw) return '';
    const targetDir = type === 'fg' ? FG_ASSETS_DIR : BG_ASSETS_DIR;
    if (raw.startsWith(`${targetDir}/`)) return raw.slice(targetDir.length + 1);
    if (raw.startsWith('images/')) return raw.slice('images/'.length);
    return raw.includes('/') ? raw.split('/').pop() : raw;
}

function parseNullableInput(text) {
    const raw = String(text ?? '').trim();
    if (!raw || raw.toLowerCase() === 'null') return null;
    if (raw.toLowerCase() === 'true') return true;
    if (raw.toLowerCase() === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
        try {
            return JSON.parse(raw);
        } catch (_e) {
            return raw;
        }
    }

    return raw;
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function deepMerge(base, patch) {
    const left = isPlainObject(base) ? base : {};
    const right = isPlainObject(patch) ? patch : {};
    const out = { ...left };
    Object.keys(right).forEach((key) => {
        const lVal = out[key];
        const rVal = right[key];
        if (isPlainObject(lVal) && isPlainObject(rVal)) {
            out[key] = deepMerge(lVal, rVal);
        } else {
            out[key] = deepClone(rVal);
        }
    });
    return out;
}

function parseJsonObjectSafe(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return { ok: true, value: {} };
    try {
        const parsed = JSON.parse(raw);
        if (!isPlainObject(parsed)) {
            return { ok: false, value: {}, message: 'Il JSON avanzato deve essere un oggetto ({}).' };
        }
        return { ok: true, value: parsed };
    } catch (err) {
        return { ok: false, value: {}, message: `JSON avanzato non valido: ${err.message}` };
    }
}

function parseJsonArraySafe(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return { ok: true, value: [] };
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return { ok: false, value: [], message: 'Gli stati devono essere un array JSON ([]).' };
        }
        return { ok: true, value: parsed };
    } catch (err) {
        return { ok: false, value: [], message: `JSON stati non valido: ${err.message}` };
    }
}

function normalizeAction(rawAction) {
    const a = isPlainObject(rawAction) ? rawAction : {};
    const trigger = String(a.trigger ?? a.on ?? 'collect').trim() || 'collect';
    const type = String(a.type ?? a.actionType ?? 'none').trim() || 'none';
    const target = String(a.target ?? '').trim();
    const value = Number.isFinite(Number(a.value)) ? Number(a.value) : 0;
    const durationMs = Number.isFinite(Number(a.durationMs)) ? Math.max(0, Number(a.durationMs)) : 0;
    const cooldownMs = Number.isFinite(Number(a.cooldownMs)) ? Math.max(0, Number(a.cooldownMs)) : 0;
    const consumeOnUse = a.consumeOnUse !== undefined ? !!a.consumeOnUse : false;
    const repeatable = a.repeatable !== undefined ? !!a.repeatable : true;
    const conditions = isPlainObject(a.conditions) ? a.conditions : {};
    const payload = isPlainObject(a.payload) ? a.payload : {};
    return {
        trigger,
        type,
        target,
        value,
        durationMs,
        cooldownMs,
        consumeOnUse,
        repeatable,
        conditions,
        payload
    };
}

function normalizeStates(rawStates) {
    const arr = Array.isArray(rawStates) ? rawStates : [];
    return arr
        .filter((it) => isPlainObject(it))
        .map((it) => ({
            id: String(it.id ?? '').trim(),
            label: String(it.label ?? '').trim(),
            initial: !!it.initial,
            onEnter: Array.isArray(it.onEnter) ? it.onEnter : [],
            onExit: Array.isArray(it.onExit) ? it.onExit : [],
            transitions: Array.isArray(it.transitions) ? it.transitions : []
        }))
        .filter((it) => it.id);
}

function getNumberRangeForKey(pathKey, currentValue) {
    const key = String(pathKey || '').toLowerCase();
    const n = Number(currentValue);
    if (key.includes('alpha')) return { min: 0, max: 1, step: 0.01 };
    if (key.includes('speed') || key.includes('factor') || key.includes('difficulty')) return { min: 0, max: Math.max(10, Math.ceil((Number.isFinite(n) ? n : 1) * 2)), step: 0.1 };
    if (key.includes('duration') || key.includes('timeout') || key.includes('delay') || key.includes('lifetime')) return { min: 0, max: Math.max(60000, Math.ceil((Number.isFinite(n) ? n : 1000) * 3)), step: 1 };
    if (key.includes('size') || key.includes('width') || key.includes('height') || key.includes('radius') || key.includes('tile')) return { min: 0, max: Math.max(2000, Math.ceil((Number.isFinite(n) ? n : 100) * 3)), step: 1 };
    return { min: -100000, max: 100000, step: Number.isInteger(n) ? 1 : 0.1 };
}

function setPathValue(target, pathParts, value) {
    let ref = target;
    for (let i = 0; i < pathParts.length - 1; i++) {
        const p = pathParts[i];
        if (!isPlainObject(ref[p])) ref[p] = {};
        ref = ref[p];
    }
    ref[pathParts[pathParts.length - 1]] = value;
}

let CONFIG_EDITOR_STATE = {
    loadedConfig: null
};

const START_EDITOR_DEFAULT = {
    startup: {
        enableFrontScenes: true,
        coinMode: 'arcade',
        initialCredits: 0
    },
    attractMode: {
        enabled: false,
        canvas: { width: 800, height: 600 },
        elements: [],
        plugins: []
    }
};

const ATTRACT_PLUGIN_PRESETS = {
    insertCoin: { label: 'Insert Coin / Credit', x: 400, y: 520, w: 240, h: 34 },
    credits: { label: 'Credits Label', x: 400, y: 486, w: 220, h: 28 },
    language: { label: 'Language Selector', x: 400, y: 560, w: 170, h: 30 },
    players: { label: 'Player 1 / Player 2', x: 400, y: 548, w: 520, h: 28 }
};

let START_EDITOR_STATE = {
    loadedStart: deepClone(START_EDITOR_DEFAULT),
    selectedElementId: null,
    previewTimer: null,
    drag: {
        active: false,
        mode: 'move',
        elementId: null,
        startX: 0,
        startY: 0,
        baseX: 0,
        baseY: 0,
        baseW: 0,
        baseH: 0
    },
    attractAssets: []
};

let OBJECT_MAP_EDITOR_STATE = {
    items: []
};

let OBJECT_MAPPINGS_READY = false;

function getPaletteItemsFromObjectMappings() {
    const rows = Array.isArray(OBJECT_MAP_EDITOR_STATE.items) ? OBJECT_MAP_EDITOR_STATE.items : [];
    const seen = new Set();
    const tiles = [];
    const objects = [];

    rows.forEach((raw) => {
        if (!raw || typeof raw !== 'object') return;
        const tokenRaw = String(raw.token ?? raw.mapToken ?? '').trim();
        if (!tokenRaw) return;

        const token = normalizeToken(tokenRaw);
        if (!token || token === '-') return;
        if (WALL_TOKEN_REGEX.test(token)) return;

        const dedupeKey = token.toLowerCase();
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const keyLabel = String(raw.key ?? '').trim();
        const category = String(raw.category ?? '').trim().toLowerCase();
        const label = keyLabel ? `${keyLabel}` : token;
        const item = { token, label, category };

        if (category === 'tile') {
            tiles.push(item);
        } else if (category !== 'wall') {
            objects.push(item);
        }
    });

    const sortByToken = (a, b) => String(a.token).localeCompare(String(b.token), 'it');
    tiles.sort(sortByToken);
    objects.sort(sortByToken);

    return { tiles, objects };
}

function refreshObjectMappingsAvailability() {
    const groups = getPaletteItemsFromObjectMappings();
    OBJECT_MAPPINGS_READY = (groups.tiles.length + groups.objects.length) > 0;
    return OBJECT_MAPPINGS_READY;
}

function getObjectMappingByToken(token) {
    const normalized = normalizeToken(token);
    const rows = Array.isArray(OBJECT_MAP_EDITOR_STATE.items) ? OBJECT_MAP_EDITOR_STATE.items : [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== 'object') continue;
        const rowToken = normalizeToken(String(row.token ?? row.mapToken ?? '').trim());
        if (rowToken && rowToken === normalized) return row;
    }
    return null;
}

function getObjectMappingRenderSpec(token) {
    const row = getObjectMappingByToken(token);
    if (!row || typeof row !== 'object') return null;
    const sizePx = (row.sizePx && typeof row.sizePx === 'object') ? row.sizePx : {};
    return {
        row,
        category: String(row.category ?? '').trim().toLowerCase(),
        imageSrc: String(row.imageSrc ?? row.image ?? '').trim(),
        textureKey: String(row.textureKey ?? '').trim(),
        frame: Math.max(0, parseNumber(row.defaultFrame, 0)),
        frameW: Math.max(1, parseNumber(sizePx.width, 64)),
        frameH: Math.max(1, parseNumber(sizePx.height, 64))
    };
}

function buildObjectMappingTextureKey(spec) {
    const keyBase = String(spec?.row?.key ?? spec?.row?.token ?? spec?.textureKey ?? 'object')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'object';
    return `objmap_${keyBase}`;
}

function ensureObjectMappingTextureLoaded(scene, spec) {
    if (!scene || !spec) return null;
    if (!spec.imageSrc) return null;

    const runtimeKey = buildObjectMappingTextureKey(spec);
    if (scene.textures?.exists(runtimeKey)) return runtimeKey;

    if (!scene.__objMapPendingTextureLoads) {
        scene.__objMapPendingTextureLoads = new Set();
    }
    if (scene.__objMapPendingTextureLoads.has(runtimeKey)) return runtimeKey;

    const frameWidth = Math.max(1, parseNumber(spec.frameW, 64));
    const frameHeight = Math.max(1, parseNumber(spec.frameH, 64));

    try {
        scene.__objMapPendingTextureLoads.add(runtimeKey);
        scene.load.spritesheet(runtimeKey, spec.imageSrc, {
            frameWidth,
            frameHeight
        });
        scene.load.once('complete', () => {
            try { scene.__objMapPendingTextureLoads.delete(runtimeKey); } catch (e) { }
            try { scene.renderGrid(); } catch (e) { }
            try { drawMiniMapPreview(scene); } catch (e) { }
            try { buildDomPalette(); } catch (e) { }
        });
        scene.load.start();
    } catch (e) {
        try { scene.__objMapPendingTextureLoads.delete(runtimeKey); } catch (_e) { }
    }

    return runtimeKey;
}

function resolveTokenVisualFromMappings(scene, token) {
    const spec = getObjectMappingRenderSpec(token);
    if (!spec) return null;
    if (spec.category === 'wall') return null;

    const runtimeTexture = ensureObjectMappingTextureLoaded(scene, spec);
    const candidates = [runtimeTexture, spec.textureKey].filter(Boolean);
    for (let i = 0; i < candidates.length; i++) {
        const texture = candidates[i];
        if (scene?.textures?.exists(texture)) {
            return {
                texture,
                frame: spec.frame,
                category: spec.category
            };
        }
    }
    return null;
}

function queueObjectMappingsSpritesheets(scene, rawList) {
    if (!scene || !Array.isArray(rawList) || !rawList.length) return 0;
    if (!scene.__queuedObjectMappingSheets) {
        scene.__queuedObjectMappingSheets = new Set();
    }

    let queued = 0;
    rawList.forEach((raw) => {
        const norm = normalizeObjectMapping(raw);
        const imageSrc = String(norm.imageSrc || '').trim();
        if (!imageSrc) return;

        const frameWidth = Math.max(1, parseNumber(norm.sizePx?.width, 64));
        const frameHeight = Math.max(1, parseNumber(norm.sizePx?.height, 64));
        const runtimeKey = buildObjectMappingTextureKey({ row: norm, textureKey: norm.textureKey });
        const textureAlias = String(norm.textureKey || '').trim();
        const keysToQueue = [runtimeKey, textureAlias].filter(Boolean);

        keysToQueue.forEach((key) => {
            if (scene.textures?.exists(key)) return;
            if (scene.__queuedObjectMappingSheets.has(key)) return;
            scene.__queuedObjectMappingSheets.add(key);
            scene.load.spritesheet(key, imageSrc, { frameWidth, frameHeight });
            queued++;
        });
    });

    return queued;
}

function openObjectMapDialog(message = '', isError = false) {
    const objectMapModal = el('objectMapModal');
    if (objectMapModal) objectMapModal.classList.add('open');
    renderObjectMapEditor();
    if (message) setObjectMapStatus(message, isError);
}

function ensureObjectMappingsReadyOrPrompt(reason = '') {
    if (refreshObjectMappingsAvailability()) return true;
    const reasonText = reason ? ` (${reason})` : '';
    openObjectMapDialog('Nessun oggetto disponibile: aggiungi almeno un oggetto con token e salva.', true);
    setStatus(`Creazione mappa bloccata: nessun oggetto configurato${reasonText}.`, true);
    return false;
}

const OBJECT_MAPPINGS_EXAMPLE = [
    {
        key: 'ghost_hunter',
        token: 'ghost',
        category: 'enemy',
        entityType: 'ghost',
        imageSrc: 'assets/images/objects/ghost.png',
        textureKey: 'ghost',
        defaultFrame: 0,
        contactType: 'edge',
        dynamic: true,
        frameCount: 8,
        useOppositeSide: true,
        frames: {
            idle: {
                up: '0-1',
                down: '2-3',
                left: '4-5',
                right: '4-5'
            },
            move: {
                up: '6-7',
                down: '8-9',
                left: '10-13',
                right: '10-13'
            }
        },
        contactScore: -35,
        movement: {
            automatic: true,
            directions: ['up', 'down', 'left', 'right'],
            minStep: 1,
            maxStep: 4,
            pauseMs: 220
        },
        staticScore: 0,
        sizePx: {
            width: 64,
            height: 64
        },
        spawn: {
            fromMapToken: true,
            countFromLevelKey: 'ghost',
            speedFromLevelKeys: ['ghostSpeed']
        },
        advanced: {
            collision: {
                contactType: 'edge',
                radiusMultiplier: 0.45,
                proximityTiles: 0.9
            },
            actor: {
                canBeDestroyedByDynamite: true,
                damageLives: 1,
                stealGems: false
            },
            effects: {
                onSpawn: ['float', 'halo']
            }
        }
    },
    {
        key: 'bat_hunter',
        token: 'bat',
        category: 'enemy',
        entityType: 'bat',
        imageSrc: 'assets/images/objects/bat.png',
        textureKey: 'bat',
        defaultFrame: 0,
        contactType: 'edge',
        dynamic: true,
        frameCount: 10,
        useOppositeSide: true,
        frames: {
            idle: {
                up: '0-4',
                down: '0-4',
                left: '0-4',
                right: '0-4'
            },
            move: {
                up: '5-9',
                down: '5-9',
                left: '5-9',
                right: '5-9'
            }
        },
        contactScore: -10,
        movement: {
            automatic: true,
            directions: ['up', 'down', 'left', 'right'],
            minStep: 2,
            maxStep: 6,
            pauseMs: 120
        },
        staticScore: 0,
        sizePx: {
            width: 64,
            height: 64
        },
        spawn: {
            fromMapToken: true,
            countFromLevelKey: 'bat',
            speedFromLevelKeys: ['batSpeed']
        },
        advanced: {
            actor: {
                stealGems: true,
                flightsBeforeRestFromLevelKey: 'batFlightsBeforeRest',
                restSecondsFromLevelKey: 'batRestSeconds',
                restIntervalSecondsFromLevelKey: 'batRestIntervalSeconds'
            }
        }
    },
    {
        key: 'wall_variant',
        token: 'w0010',
        category: 'wall',
        entityType: 'wall',
        imageSrc: 'assets/images/objects/wall.png',
        textureKey: 'wall_tiles',
        defaultFrame: 1,
        contactType: 'edge',
        dynamic: false,
        frameCount: 1,
        useOppositeSide: false,
        frames: {
            idle: {
                up: '1',
                down: '1',
                left: '1',
                right: '1'
            },
            move: {
                up: '',
                down: '',
                left: '',
                right: ''
            }
        },
        contactScore: 0,
        movement: {
            automatic: false,
            directions: [],
            minStep: 0,
            maxStep: 0,
            pauseMs: 0
        },
        staticScore: 0,
        sizePx: {
            width: 64,
            height: 64
        },
        spawn: {
            fromMapToken: true,
            countFromLevelKey: null,
            speedFromLevelKeys: []
        },
        advanced: {
            wall: {
                frame: 1,
                rotation: 0,
                flip: '0',
                invisible: false,
                noTile: false
            }
        }
    },
    {
        key: 'tile_water',
        token: 'water',
        category: 'tile',
        entityType: 'tile',
        imageSrc: 'assets/images/objects/tiles.png',
        textureKey: 'tiles',
        defaultFrame: 4,
        contactType: 'edge',
        dynamic: false,
        frameCount: 1,
        useOppositeSide: false,
        frames: {
            idle: {
                up: '4',
                down: '4',
                left: '4',
                right: '4'
            },
            move: {
                up: '',
                down: '',
                left: '',
                right: ''
            }
        },
        contactScore: 0,
        movement: {
            automatic: false,
            directions: [],
            minStep: 0,
            maxStep: 0,
            pauseMs: 0
        },
        staticScore: 0,
        sizePx: {
            width: 64,
            height: 64
        },
        spawn: {
            fromMapToken: true,
            countFromLevelKey: null,
            speedFromLevelKeys: []
        },
        advanced: {
            tile: {
                type: 'water',
                walkable: true,
                noTile: false,
                invisible: false
            }
        }
    }
];

function setObjectMapStatus(message, isError = false) {
    const target = el('objectMapStatusText');
    if (!target) return;
    target.style.color = isError ? '#ff8f9a' : '#8ee89f';
    target.textContent = message;
}

function createDefaultObjectMapping(seedName = '') {
    return {
        key: String(seedName || 'new_object').trim() || 'new_object',
        token: '',
        category: 'custom',
        entityType: 'generic',
        imageSrc: '',
        textureKey: 'objects',
        defaultFrame: 0,
        contactType: 'edge',
        dynamic: false,
        frameCount: 1,
        useOppositeSide: true,
        frames: {
            idle: { up: '', down: '', left: '', right: '' },
            move: { up: '', down: '', left: '', right: '' }
        },
        contactScore: 0,
        movement: {
            automatic: false,
            directions: [],
            minStep: 0,
            maxStep: 0,
            pauseMs: 0
        },
        staticScore: 0,
        sizePx: {
            width: 64,
            height: 64
        },
        spawn: {
            fromMapToken: true,
            countFromLevelKey: null,
            speedFromLevelKeys: []
        },
        action: {
            trigger: 'collect',
            type: 'none',
            target: '',
            value: 0,
            durationMs: 0,
            cooldownMs: 0,
            consumeOnUse: false,
            repeatable: true,
            conditions: {},
            payload: {}
        },
        states: [],
        advanced: {}
    };
}

function getObjectMappingKnownKeys() {
    return new Set([
        'key', 'id', 'token', 'mapToken', 'category', 'entityType', 'type',
        'imageSrc', 'image', 'textureKey', 'defaultFrame', 'contactType',
        'dynamic', 'frameCount', 'useOppositeSide', 'mirrorHorizontal',
        'frames', 'contactScore', 'movement', 'staticScore', 'sizePx',
        'spawn', 'action', 'states', 'advanced', 'collision', 'render', 'tile', 'wall', 'actor',
        'pickup', 'effects', 'tags', 'params'
    ]);
}

function buildAdvancedFromRawObject(inObj) {
    const known = getObjectMappingKnownKeys();
    const residual = {};
    Object.keys(inObj).forEach((k) => {
        if (!known.has(k)) residual[k] = inObj[k];
    });
    const adv = isPlainObject(inObj.advanced) ? inObj.advanced : {};
    return deepMerge(residual, adv);
}

function parseCsvList(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return [];
    return raw.split(',').map((s) => String(s).trim()).filter(Boolean);
}

function mergeMappingWithAdvanced(baseMapping, advancedObject) {
    const merged = deepMerge(baseMapping, advancedObject);
    if (isPlainObject(merged.advanced)) {
        delete merged.advanced;
    }
    return merged;
}

function formatAdvancedJson(value) {
    if (!isPlainObject(value) || !Object.keys(value).length) return '';
    return JSON.stringify(value, null, 2);
}

function normalizeContactType(value) {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return 'edge';
    if (raw === 'center-front' || raw === 'center') return 'center-front';
    if (raw === 'edge') return 'edge';
    return raw;
}

function normalizeCategory(value) {
    const allowed = new Set(['enemy', 'pickup', 'tile', 'wall', 'exit', 'player', 'decor', 'custom']);
    const raw = String(value ?? '').trim().toLowerCase();
    if (allowed.has(raw)) return raw;
    return 'custom';
}

function normalizeSpawn(rawSpawn) {
    const s = isPlainObject(rawSpawn) ? rawSpawn : {};
    const speedKeys = Array.isArray(s.speedFromLevelKeys)
        ? s.speedFromLevelKeys.map((it) => String(it).trim()).filter(Boolean)
        : [];
    return {
        fromMapToken: s.fromMapToken !== undefined ? !!s.fromMapToken : true,
        countFromLevelKey: (s.countFromLevelKey === null || s.countFromLevelKey === undefined || s.countFromLevelKey === '')
            ? null
            : String(s.countFromLevelKey),
        speedFromLevelKeys: speedKeys
    };
}

function normalizeObjectMapping(raw) {
    const base = createDefaultObjectMapping(raw?.key || raw?.id || 'new_object');
    const inObj = isPlainObject(raw) ? raw : {};
    const frames = isPlainObject(inObj.frames) ? inObj.frames : {};
    const idle = isPlainObject(frames.idle) ? frames.idle : {};
    const move = isPlainObject(frames.move) ? frames.move : {};
    const movement = isPlainObject(inObj.movement) ? inObj.movement : {};
    const sizePx = isPlainObject(inObj.sizePx) ? inObj.sizePx : {};
    const spawn = normalizeSpawn(inObj.spawn);
    const action = normalizeAction(inObj.action);
    const states = normalizeStates(inObj.states);
    const advanced = buildAdvancedFromRawObject(inObj);
    const collision = isPlainObject(inObj.collision) ? inObj.collision : {};
    const render = isPlainObject(inObj.render) ? inObj.render : {};

    return {
        ...base,
        key: String(inObj.key ?? inObj.id ?? base.key).trim() || base.key,
        token: String(inObj.token ?? inObj.mapToken ?? '').trim(),
        category: normalizeCategory(inObj.category),
        entityType: String(inObj.entityType ?? inObj.type ?? base.entityType).trim() || base.entityType,
        imageSrc: String(inObj.imageSrc ?? inObj.image ?? '').trim(),
        textureKey: String(inObj.textureKey ?? render.textureKey ?? base.textureKey).trim() || base.textureKey,
        defaultFrame: Math.max(0, parseNumber(inObj.defaultFrame ?? render.frame, 0)),
        contactType: normalizeContactType(inObj.contactType ?? collision.contactType ?? base.contactType),
        dynamic: !!inObj.dynamic,
        frameCount: Math.max(1, parseNumber(inObj.frameCount, 1)),
        useOppositeSide: inObj.useOppositeSide !== undefined ? !!inObj.useOppositeSide : !!(inObj.mirrorHorizontal ?? true),
        frames: {
            idle: {
                up: String(idle.up ?? ''),
                down: String(idle.down ?? ''),
                left: String(idle.left ?? ''),
                right: String(idle.right ?? '')
            },
            move: {
                up: String(move.up ?? ''),
                down: String(move.down ?? ''),
                left: String(move.left ?? ''),
                right: String(move.right ?? '')
            }
        },
        contactScore: parseNumber(inObj.contactScore, 0),
        movement: {
            automatic: !!movement.automatic,
            directions: Array.isArray(movement.directions) ? movement.directions.map((d) => String(d)) : [],
            minStep: parseNumber(movement.minStep, 0),
            maxStep: parseNumber(movement.maxStep, 0),
            pauseMs: parseNumber(movement.pauseMs, 0)
        },
        staticScore: parseNumber(inObj.staticScore, 0),
        sizePx: {
            width: Math.max(1, parseNumber(sizePx.width, 64)),
            height: Math.max(1, parseNumber(sizePx.height, 64))
        },
        spawn,
        action,
        states,
        advanced
    };
}

function createDirectionChecks(prefix, selected = []) {
    const wrap = document.createElement('div');
    wrap.className = 'objmap-directions';
    ['up', 'down', 'left', 'right'].forEach((dir) => {
        const lbl = document.createElement('label');
        lbl.style.display = 'flex';
        lbl.style.alignItems = 'center';
        lbl.style.gap = '6px';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.style.width = 'auto';
        cb.className = `${prefix}-${dir}`;
        cb.checked = selected.includes(dir);
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(dir));
        wrap.appendChild(lbl);
    });
    return wrap;
}

function setObjectCardVisibility(card) {
    const dynamic = !!card.querySelector('.obj-dynamic')?.checked;
    const automatic = !!card.querySelector('.obj-auto')?.checked;
    const dynBlock = card.querySelector('.obj-dynamic-block');
    const moveBlock = card.querySelector('.obj-movement-block');
    const staticBlock = card.querySelector('.obj-static-block');
    if (dynBlock) dynBlock.style.display = dynamic ? '' : 'none';
    if (moveBlock) moveBlock.style.display = dynamic && automatic ? '' : 'none';
    if (staticBlock) staticBlock.style.display = dynamic ? 'none' : '';
}

function resolveObjectPreviewSrc(rawSrc) {
    const raw = String(rawSrc ?? '').trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:|\/)/i.test(raw)) return raw;
    return raw;
}

function parseFrameSequence(rawText) {
    const raw = String(rawText ?? '').trim();
    if (!raw) return [];
    const out = [];
    raw.split(',').map((part) => part.trim()).filter(Boolean).forEach((chunk) => {
        const m = chunk.match(/^(\d+)\s*-\s*(\d+)$/);
        if (m) {
            const a = Number(m[1]);
            const b = Number(m[2]);
            if (!Number.isFinite(a) || !Number.isFinite(b)) return;
            const step = a <= b ? 1 : -1;
            for (let i = a; step > 0 ? i <= b : i >= b; i += step) out.push(i);
            return;
        }
        const n = Number(chunk);
        if (Number.isFinite(n)) out.push(Math.max(0, Math.floor(n)));
    });
    return out;
}

function buildCardAnimationFrames(card) {
    const get = (sel) => String(card.querySelector(sel)?.value ?? '').trim();
    const sequenceCandidates = [
        get('.obj-move-right'),
        get('.obj-move-down'),
        get('.obj-move-up'),
        get('.obj-move-left'),
        get('.obj-idle-right'),
        get('.obj-idle-down'),
        get('.obj-idle-up'),
        get('.obj-idle-left')
    ];
    for (const candidate of sequenceCandidates) {
        const parsed = parseFrameSequence(candidate);
        if (parsed.length) return parsed;
    }
    const fallback = Number(card.querySelector('.obj-default-frame')?.value);
    return [Number.isFinite(fallback) ? Math.max(0, Math.floor(fallback)) : 0];
}

function getCardPreviewModel(card) {
    const src = resolveObjectPreviewSrc(card.querySelector('.obj-image-src')?.value);
    const frameW = Math.max(1, parseNumber(card.querySelector('.obj-size-w')?.value, 64));
    const frameH = Math.max(1, parseNumber(card.querySelector('.obj-size-h')?.value, 64));
    const defaultFrame = Math.max(0, parseNumber(card.querySelector('.obj-default-frame')?.value, 0));
    const animationFrames = buildCardAnimationFrames(card);
    return { src, frameW, frameH, defaultFrame, animationFrames };
}

function drawFrameOnCanvas(canvas, image, frameIndex, frameW, frameH) {
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 200;
    canvas.height = 200;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#061124';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cols = Math.max(1, Math.floor(image.width / frameW));
    const rows = Math.max(1, Math.floor(image.height / frameH));
    const maxFrame = Math.max(0, (cols * rows) - 1);
    const frame = Math.max(0, Math.min(maxFrame, Math.floor(frameIndex)));
    const sx = (frame % cols) * frameW;
    const sy = Math.floor(frame / cols) * frameH;

    const scale = Math.min((canvas.width - 16) / frameW, (canvas.height - 16) / frameH);
    const drawW = Math.max(1, Math.floor(frameW * scale));
    const drawH = Math.max(1, Math.floor(frameH * scale));
    const dx = Math.floor((canvas.width - drawW) / 2);
    const dy = Math.floor((canvas.height - drawH) / 2);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, sx, sy, frameW, frameH, dx, dy, drawW, drawH);
    ctx.strokeStyle = '#63b9ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(dx + 0.5, dy + 0.5, drawW, drawH);
}

function drawSheetOnCanvas(canvas, image, frameW, frameH, highlightFrames = []) {
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const maxViewW = 560;
    const maxViewH = 300;
    const scale = Math.min(maxViewW / image.width, maxViewH / image.height, 1);
    const drawW = Math.max(1, Math.floor(image.width * scale));
    const drawH = Math.max(1, Math.floor(image.height * scale));
    canvas.width = drawW;
    canvas.height = drawH;

    ctx.clearRect(0, 0, drawW, drawH);
    ctx.fillStyle = '#050d1d';
    ctx.fillRect(0, 0, drawW, drawH);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, drawW, drawH);

    const cols = Math.max(1, Math.floor(image.width / frameW));
    const rows = Math.max(1, Math.floor(image.height / frameH));
    const cellW = frameW * scale;
    const cellH = frameH * scale;

    ctx.strokeStyle = 'rgba(99,185,255,0.40)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= cols; x++) {
        const px = Math.round(x * cellW) + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, drawH);
        ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
        const py = Math.round(y * cellH) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(drawW, py);
        ctx.stroke();
    }

    const maxFrame = Math.max(0, (cols * rows) - 1);
    const unique = Array.from(new Set((highlightFrames || [])
        .map((it) => Math.floor(Number(it)))
        .filter((n) => Number.isFinite(n) && n >= 0 && n <= maxFrame)));

    unique.forEach((frame, index) => {
        const cx = frame % cols;
        const cy = Math.floor(frame / cols);
        const rx = Math.round(cx * cellW) + 1;
        const ry = Math.round(cy * cellH) + 1;
        const rw = Math.max(2, Math.round(cellW) - 2);
        const rh = Math.max(2, Math.round(cellH) - 2);
        ctx.strokeStyle = index === 0 ? '#ffe68f' : '#ff8fb0';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx + 0.5, ry + 0.5, rw, rh);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(rx, ry, Math.min(38, rw), Math.min(14, rh));
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.fillText(String(frame), rx + 3, ry + 10);
    });
}

function stopCardAnimationPreview(card) {
    const timer = card.__objPreviewAnimTimer;
    if (timer) {
        clearInterval(timer);
        card.__objPreviewAnimTimer = null;
    }
    card.__objPreviewAnimRunning = false;
}

function startCardAnimationPreview(card, image, frameW, frameH, sequence) {
    stopCardAnimationPreview(card);
    const frames = Array.isArray(sequence) ? sequence : [];
    if (!frames.length) return;
    const canvas = card.querySelector('.obj-preview-anim-canvas');
    if (!canvas) return;

    let i = 0;
    drawFrameOnCanvas(canvas, image, frames[i], frameW, frameH);
    card.__objPreviewAnimTimer = setInterval(() => {
        i = (i + 1) % frames.length;
        drawFrameOnCanvas(canvas, image, frames[i], frameW, frameH);
    }, 140);
    card.__objPreviewAnimRunning = true;
}

function renderCardPreview(card) {
    const { src, frameW, frameH, defaultFrame, animationFrames } = getCardPreviewModel(card);
    const statusEl = card.querySelector('.obj-preview-info');
    const sheetCanvas = card.querySelector('.obj-preview-sheet-canvas');
    const frameCanvas = card.querySelector('.obj-preview-frame-canvas');
    const animCanvas = card.querySelector('.obj-preview-anim-canvas');

    if (!src) {
        stopCardAnimationPreview(card);
        if (statusEl) statusEl.textContent = 'Inserisci imageSrc per vedere la preview.';
        [sheetCanvas, frameCanvas, animCanvas].forEach((c) => {
            if (!c) return;
            const ctx = c.getContext('2d');
            c.width = 240;
            c.height = c.classList.contains('obj-preview-sheet-canvas') ? 140 : 200;
            if (ctx) {
                ctx.clearRect(0, 0, c.width, c.height);
                ctx.fillStyle = '#050d1d';
                ctx.fillRect(0, 0, c.width, c.height);
            }
        });
        return;
    }

    const nextToken = `${src}__${frameW}__${frameH}__${animationFrames.join('-')}__${defaultFrame}`;
    const refreshWithImage = (img) => {
        drawSheetOnCanvas(sheetCanvas, img, frameW, frameH, animationFrames);
        drawFrameOnCanvas(frameCanvas, img, defaultFrame, frameW, frameH);
        drawFrameOnCanvas(animCanvas, img, animationFrames[0] ?? defaultFrame, frameW, frameH);
        if (statusEl) {
            const cols = Math.max(1, Math.floor(img.width / frameW));
            const rows = Math.max(1, Math.floor(img.height / frameH));
            const total = cols * rows;
            statusEl.textContent = `Sheet ${img.width}x${img.height}px | cella ${frameW}x${frameH}px | matrice ${cols}x${rows} (${total} frame)`;
        }
        if (card.__objPreviewAnimRunning) {
            startCardAnimationPreview(card, img, frameW, frameH, animationFrames);
        }
    };

    if (card.__objPreviewImage && card.__objPreviewImageSrc === src) {
        card.__objPreviewCacheToken = nextToken;
        refreshWithImage(card.__objPreviewImage);
        return;
    }

    stopCardAnimationPreview(card);
    const img = new Image();
    img.onload = () => {
        card.__objPreviewImage = img;
        card.__objPreviewImageSrc = src;
        card.__objPreviewCacheToken = nextToken;
        refreshWithImage(img);
    };
    img.onerror = () => {
        if (statusEl) statusEl.textContent = `Impossibile caricare: ${src}`;
    };
    img.src = src;
}

function attachCardPreviewEvents(card) {
    const selectors = [
        '.obj-image-src', '.obj-size-w', '.obj-size-h', '.obj-default-frame',
        '.obj-idle-up', '.obj-idle-down', '.obj-idle-left', '.obj-idle-right',
        '.obj-move-up', '.obj-move-down', '.obj-move-left', '.obj-move-right'
    ];
    selectors.forEach((sel) => {
        const node = card.querySelector(sel);
        if (!node) return;
        node.addEventListener('input', () => renderCardPreview(card));
        node.addEventListener('change', () => renderCardPreview(card));
    });

    const playBtn = card.querySelector('.obj-preview-play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (card.__objPreviewAnimRunning) {
                stopCardAnimationPreview(card);
                playBtn.textContent = 'Play animazione';
                const img = card.__objPreviewImage;
                if (img) {
                    const model = getCardPreviewModel(card);
                    drawFrameOnCanvas(card.querySelector('.obj-preview-anim-canvas'), img, model.animationFrames[0] ?? model.defaultFrame, model.frameW, model.frameH);
                }
            } else {
                const img = card.__objPreviewImage;
                if (!img) {
                    renderCardPreview(card);
                    return;
                }
                const model = getCardPreviewModel(card);
                startCardAnimationPreview(card, img, model.frameW, model.frameH, model.animationFrames);
                playBtn.textContent = 'Stop animazione';
            }
        });
    }
}

function createObjectMapCard(mapping) {
    const m = normalizeObjectMapping(mapping);
    const card = document.createElement('div');
    card.className = 'objmap-card';

    const titleRow = document.createElement('div');
    titleRow.className = 'objmap-title-row';
    const keyInput = document.createElement('input');
    keyInput.className = 'obj-key';
    keyInput.type = 'text';
    keyInput.placeholder = 'chiave oggetto (es. ghost)';
    keyInput.value = m.key;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Rimuovi';
    removeBtn.addEventListener('click', () => {
        stopCardAnimationPreview(card);
        card.remove();
        setObjectMapStatus('Oggetto rimosso.');
    });
    titleRow.appendChild(keyInput);
    titleRow.appendChild(removeBtn);
    card.appendChild(titleRow);

    const rowA = document.createElement('div');
    rowA.className = 'objmap-grid2';
    const tokenWrap = document.createElement('div');
    tokenWrap.innerHTML = '<label>Token mappa (es. ghost, bat, w0010, water)</label>';
    const tokenInput = document.createElement('input');
    tokenInput.className = 'obj-token';
    tokenInput.type = 'text';
    tokenInput.placeholder = 'token opzionale';
    tokenInput.value = m.token || '';
    tokenWrap.appendChild(tokenInput);

    const imgWrap = document.createElement('div');
    imgWrap.innerHTML = '<label>Image file</label>';
    const imgInput = document.createElement('input');
    imgInput.className = 'obj-image-src';
    imgInput.type = 'text';
    imgInput.placeholder = 'assets/images/objects/filename.png';
    imgInput.value = m.imageSrc;
    imgWrap.appendChild(imgInput);
    const dynWrap = document.createElement('div');
    dynWrap.innerHTML = '<label style="display:flex; align-items:center; gap:8px;"><input class="obj-dynamic" type="checkbox" style="width:auto; margin-right:6px;">Oggetto dinamico</label>';
    dynWrap.querySelector('.obj-dynamic').checked = m.dynamic;
    rowA.appendChild(tokenWrap);
    rowA.appendChild(imgWrap);
    rowA.appendChild(dynWrap);
    card.appendChild(rowA);

    const profileGrid = document.createElement('div');
    profileGrid.className = 'objmap-grid2';
    profileGrid.style.marginTop = '8px';

    const categoryWrap = document.createElement('div');
    categoryWrap.innerHTML = '<label>Categoria</label>';
    const categorySelect = document.createElement('select');
    categorySelect.className = 'obj-category';
    ['enemy', 'pickup', 'tile', 'wall', 'exit', 'player', 'decor', 'custom'].forEach((cat) => {
        const op = document.createElement('option');
        op.value = cat;
        op.textContent = cat;
        categorySelect.appendChild(op);
    });
    categorySelect.value = normalizeCategory(m.category);
    categoryWrap.appendChild(categorySelect);

    const entityWrap = document.createElement('div');
    entityWrap.innerHTML = '<label>Entity type</label>';
    const entityInput = document.createElement('input');
    entityInput.className = 'obj-entity-type';
    entityInput.type = 'text';
    entityInput.placeholder = 'es. ghost, bat, wall, tile, pickup';
    entityInput.value = m.entityType || '';
    entityWrap.appendChild(entityInput);

    const textureWrap = document.createElement('div');
    textureWrap.innerHTML = '<label>Texture key runtime</label>';
    const textureInput = document.createElement('input');
    textureInput.className = 'obj-texture-key';
    textureInput.type = 'text';
    textureInput.placeholder = 'objects, ghost, bat, tiles, wall_tiles';
    textureInput.value = m.textureKey || 'objects';
    textureWrap.appendChild(textureInput);

    const frameWrap = document.createElement('div');
    frameWrap.innerHTML = '<label>Frame default</label>';
    const frameInput = document.createElement('input');
    frameInput.className = 'obj-default-frame';
    frameInput.type = 'number';
    frameInput.step = '1';
    frameInput.min = '0';
    frameInput.value = String(m.defaultFrame ?? 0);
    frameWrap.appendChild(frameInput);

    const contactTypeWrap = document.createElement('div');
    contactTypeWrap.innerHTML = '<label>Contact type</label>';
    const contactTypeInput = document.createElement('input');
    contactTypeInput.className = 'obj-contact-type';
    contactTypeInput.type = 'text';
    contactTypeInput.placeholder = 'edge, center-front';
    contactTypeInput.value = m.contactType || 'edge';
    contactTypeWrap.appendChild(contactTypeInput);

    profileGrid.appendChild(categoryWrap);
    profileGrid.appendChild(entityWrap);
    profileGrid.appendChild(textureWrap);
    profileGrid.appendChild(frameWrap);
    profileGrid.appendChild(contactTypeWrap);
    card.appendChild(profileGrid);

    const dynBlock = document.createElement('div');
    dynBlock.className = 'obj-dynamic-block';
    dynBlock.innerHTML = '<div class="objmap-subtitle">Animazione / Frame</div>';
    const dynGrid = document.createElement('div');
    dynGrid.className = 'objmap-grid2';

    const frameCountWrap = document.createElement('div');
    frameCountWrap.innerHTML = '<label>Frame count</label>';
    const frameCount = document.createElement('input');
    frameCount.className = 'obj-frame-count';
    frameCount.type = 'number';
    frameCount.min = '1';
    frameCount.step = '1';
    frameCount.value = String(m.frameCount);
    frameCountWrap.appendChild(frameCount);

    const oppositeWrap = document.createElement('div');
    oppositeWrap.innerHTML = '<label style="display:flex; align-items:center; gap:8px;"><input class="obj-opposite" type="checkbox" style="width:auto; margin-right:6px;">Opposite side (usa lato dx anche per sx)</label>';
    oppositeWrap.querySelector('.obj-opposite').checked = !!m.useOppositeSide;

    dynGrid.appendChild(frameCountWrap);
    dynGrid.appendChild(oppositeWrap);
    dynBlock.appendChild(dynGrid);

    const idleTitle = document.createElement('div');
    idleTitle.className = 'objmap-subtitle';
    idleTitle.textContent = 'Frame Idle (up/down/left/right)';
    dynBlock.appendChild(idleTitle);
    const idleGrid = document.createElement('div');
    idleGrid.className = 'objmap-grid2';
    ['up', 'down', 'left', 'right'].forEach((dir) => {
        const w = document.createElement('div');
        w.innerHTML = `<label>idle ${dir}</label>`;
        const input = document.createElement('input');
        input.className = `obj-idle-${dir}`;
        input.type = 'text';
        input.placeholder = 'es: 0 oppure 0,1,2';
        input.value = m.frames.idle[dir] || '';
        w.appendChild(input);
        idleGrid.appendChild(w);
    });
    dynBlock.appendChild(idleGrid);

    const moveTitle = document.createElement('div');
    moveTitle.className = 'objmap-subtitle';
    moveTitle.textContent = 'Frame Movimento (up/down/left/right)';
    dynBlock.appendChild(moveTitle);
    const moveGrid = document.createElement('div');
    moveGrid.className = 'objmap-grid2';
    ['up', 'down', 'left', 'right'].forEach((dir) => {
        const w = document.createElement('div');
        w.innerHTML = `<label>move ${dir}</label>`;
        const input = document.createElement('input');
        input.className = `obj-move-${dir}`;
        input.type = 'text';
        input.placeholder = 'es: 3,4,5';
        input.value = m.frames.move[dir] || '';
        w.appendChild(input);
        moveGrid.appendChild(w);
    });
    dynBlock.appendChild(moveGrid);
    card.appendChild(dynBlock);

    const scoreRow = document.createElement('div');
    scoreRow.className = 'objmap-grid2';
    scoreRow.style.marginTop = '8px';
    const contactWrap = document.createElement('div');
    contactWrap.innerHTML = '<label>Punti al contatto player</label>';
    const contactScore = document.createElement('input');
    contactScore.className = 'obj-contact-score';
    contactScore.type = 'number';
    contactScore.step = '1';
    contactScore.value = String(m.contactScore);
    contactWrap.appendChild(contactScore);
    const sizeWrap = document.createElement('div');
    sizeWrap.innerHTML = '<label>Dimensione px (width,height)</label>';
    const sizeGrid = document.createElement('div');
    sizeGrid.className = 'objmap-grid2';
    const wInput = document.createElement('input');
    wInput.className = 'obj-size-w';
    wInput.type = 'number';
    wInput.min = '1';
    wInput.step = '1';
    wInput.value = String(m.sizePx.width);
    const hInput = document.createElement('input');
    hInput.className = 'obj-size-h';
    hInput.type = 'number';
    hInput.min = '1';
    hInput.step = '1';
    hInput.value = String(m.sizePx.height);
    sizeGrid.appendChild(wInput);
    sizeGrid.appendChild(hInput);
    sizeWrap.appendChild(sizeGrid);
    scoreRow.appendChild(contactWrap);
    scoreRow.appendChild(sizeWrap);
    card.appendChild(scoreRow);

    const moveToggleWrap = document.createElement('div');
    moveToggleWrap.style.marginTop = '8px';
    moveToggleWrap.innerHTML = '<label style="display:flex; align-items:center; gap:8px;"><input class="obj-auto" type="checkbox" style="width:auto; margin-right:6px;">Movimento automatico</label>';
    moveToggleWrap.querySelector('.obj-auto').checked = !!m.movement.automatic;
    card.appendChild(moveToggleWrap);

    const movementBlock = document.createElement('div');
    movementBlock.className = 'obj-movement-block';
    movementBlock.innerHTML = '<div class="objmap-subtitle">Parametri movimento automatico</div>';
    const dirWrap = document.createElement('div');
    dirWrap.innerHTML = '<label>Direzioni abilitate</label>';
    dirWrap.appendChild(createDirectionChecks('obj-dir', m.movement.directions));
    movementBlock.appendChild(dirWrap);
    const moveRangeGrid = document.createElement('div');
    moveRangeGrid.className = 'objmap-grid2';
    const minWrap = document.createElement('div');
    minWrap.innerHTML = '<label>Range min step</label>';
    const minInput = document.createElement('input');
    minInput.className = 'obj-min-step';
    minInput.type = 'number';
    minInput.step = '1';
    minInput.value = String(m.movement.minStep);
    minWrap.appendChild(minInput);
    const maxWrap = document.createElement('div');
    maxWrap.innerHTML = '<label>Range max step</label>';
    const maxInput = document.createElement('input');
    maxInput.className = 'obj-max-step';
    maxInput.type = 'number';
    maxInput.step = '1';
    maxInput.value = String(m.movement.maxStep);
    maxWrap.appendChild(maxInput);
    moveRangeGrid.appendChild(minWrap);
    moveRangeGrid.appendChild(maxWrap);
    movementBlock.appendChild(moveRangeGrid);
    const pauseWrap = document.createElement('div');
    pauseWrap.innerHTML = '<label>Pausa ms ai bordi</label>';
    const pauseInput = document.createElement('input');
    pauseInput.className = 'obj-pause-ms';
    pauseInput.type = 'number';
    pauseInput.step = '1';
    pauseInput.min = '0';
    pauseInput.value = String(m.movement.pauseMs);
    pauseWrap.appendChild(pauseInput);
    movementBlock.appendChild(pauseWrap);
    card.appendChild(movementBlock);

    const staticBlock = document.createElement('div');
    staticBlock.className = 'obj-static-block';
    staticBlock.style.marginTop = '8px';
    staticBlock.innerHTML = '<label>Punteggio oggetto statico</label>';
    const staticScore = document.createElement('input');
    staticScore.className = 'obj-static-score';
    staticScore.type = 'number';
    staticScore.step = '1';
    staticScore.value = String(m.staticScore);
    staticBlock.appendChild(staticScore);
    card.appendChild(staticBlock);

    const spawnBlock = document.createElement('div');
    spawnBlock.style.marginTop = '8px';
    spawnBlock.innerHTML = '<div class="objmap-subtitle">Spawn / binding livello</div>';
    const spawnGrid = document.createElement('div');
    spawnGrid.className = 'objmap-grid2';
    const spawnFromMapWrap = document.createElement('div');
    spawnFromMapWrap.innerHTML = '<label style="display:flex; align-items:center; gap:8px;"><input class="obj-spawn-from-map" type="checkbox" style="width:auto; margin-right:6px;">Spawn da token mappa</label>';
    spawnFromMapWrap.querySelector('.obj-spawn-from-map').checked = !!m.spawn?.fromMapToken;
    const spawnCountWrap = document.createElement('div');
    spawnCountWrap.innerHTML = '<label>Count da chiave livello</label>';
    const spawnCountInput = document.createElement('input');
    spawnCountInput.className = 'obj-spawn-count-key';
    spawnCountInput.type = 'text';
    spawnCountInput.placeholder = 'ghost, bat, ecc';
    spawnCountInput.value = String(m.spawn?.countFromLevelKey ?? '');
    spawnCountWrap.appendChild(spawnCountInput);
    const spawnSpeedWrap = document.createElement('div');
    spawnSpeedWrap.innerHTML = '<label>Speed keys livello (csv)</label>';
    const spawnSpeedInput = document.createElement('input');
    spawnSpeedInput.className = 'obj-spawn-speed-keys';
    spawnSpeedInput.type = 'text';
    spawnSpeedInput.placeholder = 'ghostSpeed, batSpeed';
    spawnSpeedInput.value = Array.isArray(m.spawn?.speedFromLevelKeys) ? m.spawn.speedFromLevelKeys.join(', ') : '';
    spawnSpeedWrap.appendChild(spawnSpeedInput);
    spawnGrid.appendChild(spawnFromMapWrap);
    spawnGrid.appendChild(spawnCountWrap);
    spawnGrid.appendChild(spawnSpeedWrap);
    spawnBlock.appendChild(spawnGrid);
    card.appendChild(spawnBlock);

    const actionBlock = document.createElement('div');
    actionBlock.style.marginTop = '8px';
    actionBlock.innerHTML = '<div class="objmap-subtitle">Action (meccanica oggetto)</div>';
    const actionGrid = document.createElement('div');
    actionGrid.className = 'objmap-grid2';

    const actionTriggerWrap = document.createElement('div');
    actionTriggerWrap.innerHTML = '<label>Trigger</label>';
    const actionTrigger = document.createElement('select');
    actionTrigger.className = 'obj-action-trigger';
    ['collect', 'enterTile', 'actionButton', 'proximity', 'hitByDynamite', 'timer', 'none'].forEach((name) => {
        const op = document.createElement('option');
        op.value = name;
        op.textContent = name;
        actionTrigger.appendChild(op);
    });
    actionTrigger.value = String(m.action?.trigger || 'collect');
    actionTriggerWrap.appendChild(actionTrigger);

    const actionTypeWrap = document.createElement('div');
    actionTypeWrap.innerHTML = '<label>Action type</label>';
    const actionType = document.createElement('select');
    actionType.className = 'obj-action-type';
    ['none', 'addInventory', 'consumeInventory', 'modifyScore', 'modifyLives', 'modifyDynamite', 'setSlowFactor', 'transformTile', 'openDoor', 'placePlank', 'spawnObject', 'goToPreviousLevel', 'custom'].forEach((name) => {
        const op = document.createElement('option');
        op.value = name;
        op.textContent = name;
        actionType.appendChild(op);
    });
    actionType.value = String(m.action?.type || 'none');
    actionTypeWrap.appendChild(actionType);

    const actionTargetWrap = document.createElement('div');
    actionTargetWrap.innerHTML = '<label>Target</label>';
    const actionTarget = document.createElement('input');
    actionTarget.className = 'obj-action-target';
    actionTarget.type = 'text';
    actionTarget.placeholder = 'es. keysCount, woodenCount, playerSlowFactor';
    actionTarget.value = String(m.action?.target || '');
    actionTargetWrap.appendChild(actionTarget);

    const actionValueWrap = document.createElement('div');
    actionValueWrap.innerHTML = '<label>Value</label>';
    const actionValue = document.createElement('input');
    actionValue.className = 'obj-action-value';
    actionValue.type = 'number';
    actionValue.step = '1';
    actionValue.value = String(parseNumber(m.action?.value, 0));
    actionValueWrap.appendChild(actionValue);

    const actionDurationWrap = document.createElement('div');
    actionDurationWrap.innerHTML = '<label>Duration ms</label>';
    const actionDuration = document.createElement('input');
    actionDuration.className = 'obj-action-duration';
    actionDuration.type = 'number';
    actionDuration.step = '1';
    actionDuration.min = '0';
    actionDuration.value = String(parseNumber(m.action?.durationMs, 0));
    actionDurationWrap.appendChild(actionDuration);

    const actionCooldownWrap = document.createElement('div');
    actionCooldownWrap.innerHTML = '<label>Cooldown ms</label>';
    const actionCooldown = document.createElement('input');
    actionCooldown.className = 'obj-action-cooldown';
    actionCooldown.type = 'number';
    actionCooldown.step = '1';
    actionCooldown.min = '0';
    actionCooldown.value = String(parseNumber(m.action?.cooldownMs, 0));
    actionCooldownWrap.appendChild(actionCooldown);

    const actionFlagsWrap = document.createElement('div');
    actionFlagsWrap.style.display = 'flex';
    actionFlagsWrap.style.gap = '10px';
    actionFlagsWrap.style.flexWrap = 'wrap';
    actionFlagsWrap.innerHTML = '<label style="display:flex;align-items:center;gap:6px;"><input class="obj-action-consume" type="checkbox" style="width:auto;">consumeOnUse</label><label style="display:flex;align-items:center;gap:6px;"><input class="obj-action-repeatable" type="checkbox" style="width:auto;">repeatable</label>';
    actionFlagsWrap.querySelector('.obj-action-consume').checked = !!m.action?.consumeOnUse;
    actionFlagsWrap.querySelector('.obj-action-repeatable').checked = m.action?.repeatable !== false;

    actionGrid.appendChild(actionTriggerWrap);
    actionGrid.appendChild(actionTypeWrap);
    actionGrid.appendChild(actionTargetWrap);
    actionGrid.appendChild(actionValueWrap);
    actionGrid.appendChild(actionDurationWrap);
    actionGrid.appendChild(actionCooldownWrap);
    actionGrid.appendChild(actionFlagsWrap);
    actionBlock.appendChild(actionGrid);

    const presetWrap = document.createElement('div');
    presetWrap.className = 'objmap-preview-actions';
    const presetKeyBtn = document.createElement('button');
    presetKeyBtn.type = 'button';
    presetKeyBtn.textContent = 'Preset Key';
    const presetWoodBtn = document.createElement('button');
    presetWoodBtn.type = 'button';
    presetWoodBtn.textContent = 'Preset Wooden';
    const presetWaterBtn = document.createElement('button');
    presetWaterBtn.type = 'button';
    presetWaterBtn.textContent = 'Preset Water';
    const presetMudBtn = document.createElement('button');
    presetMudBtn.type = 'button';
    presetMudBtn.textContent = 'Preset Mud';
    const presetSandBtn = document.createElement('button');
    presetSandBtn.type = 'button';
    presetSandBtn.textContent = 'Preset Sand';
    const presetBackBtn = document.createElement('button');
    presetBackBtn.type = 'button';
    presetBackBtn.textContent = 'Preset Back';
    presetWrap.appendChild(presetKeyBtn);
    presetWrap.appendChild(presetWoodBtn);
    presetWrap.appendChild(presetWaterBtn);
    presetWrap.appendChild(presetMudBtn);
    presetWrap.appendChild(presetSandBtn);
    presetWrap.appendChild(presetBackBtn);
    actionBlock.appendChild(presetWrap);

    const actionConditionsWrap = document.createElement('div');
    actionConditionsWrap.style.marginTop = '6px';
    actionConditionsWrap.innerHTML = '<label>Action conditions JSON</label>';
    const actionConditionsInput = document.createElement('textarea');
    actionConditionsInput.className = 'obj-action-conditions';
    actionConditionsInput.rows = 3;
    actionConditionsInput.style.width = '100%';
    actionConditionsInput.value = formatAdvancedJson(m.action?.conditions || {});
    actionConditionsWrap.appendChild(actionConditionsInput);
    actionBlock.appendChild(actionConditionsWrap);

    const actionPayloadWrap = document.createElement('div');
    actionPayloadWrap.style.marginTop = '6px';
    actionPayloadWrap.innerHTML = '<label>Action payload JSON</label>';
    const actionPayloadInput = document.createElement('textarea');
    actionPayloadInput.className = 'obj-action-payload';
    actionPayloadInput.rows = 3;
    actionPayloadInput.style.width = '100%';
    actionPayloadInput.value = formatAdvancedJson(m.action?.payload || {});
    actionPayloadWrap.appendChild(actionPayloadInput);

    const payloadVisualWrap = document.createElement('div');
    payloadVisualWrap.style.marginTop = '6px';
    payloadVisualWrap.innerHTML = '<div class="objmap-subtitle">Payload visual params (tile)</div>';
    const payloadVisualGrid = document.createElement('div');
    payloadVisualGrid.className = 'objmap-grid2';

    const splashEnabledWrap = document.createElement('div');
    splashEnabledWrap.innerHTML = '<label style="display:flex;align-items:center;gap:8px;"><input class="obj-pay-splash-enabled" type="checkbox" style="width:auto;">Splash</label>';
    const splashBurstsWrap = document.createElement('div');
    splashBurstsWrap.innerHTML = '<label>Splash bursts</label><input class="obj-pay-splash-bursts" type="number" min="1" step="1">';
    const splashIntervalWrap = document.createElement('div');
    splashIntervalWrap.innerHTML = '<label>Splash interval ms</label><input class="obj-pay-splash-interval" type="number" min="0" step="1">';
    const splashDropletWrap = document.createElement('div');
    splashDropletWrap.innerHTML = '<label>Splash droplet qty</label><input class="obj-pay-splash-drops" type="number" min="1" step="1">';
    const splashCooldownWrap = document.createElement('div');
    splashCooldownWrap.innerHTML = '<label>Splash cooldown ms</label><input class="obj-pay-splash-cooldown" type="number" min="0" step="1">';
    const splashColorWrap = document.createElement('div');
    splashColorWrap.innerHTML = '<label>Splash color</label><input class="obj-pay-splash-color" type="text" placeholder="#88ccff">';
    const splashRingColorWrap = document.createElement('div');
    splashRingColorWrap.innerHTML = '<label>Splash ring color</label><input class="obj-pay-splash-ring-color" type="text" placeholder="#3399ff">';

    const wetEnabledWrap = document.createElement('div');
    wetEnabledWrap.innerHTML = '<label style="display:flex;align-items:center;gap:8px;"><input class="obj-pay-wet-enabled" type="checkbox" style="width:auto;">Wet overlay</label>';
    const wetDurationWrap = document.createElement('div');
    wetDurationWrap.innerHTML = '<label>Wet duration ms</label><input class="obj-pay-wet-duration" type="number" min="0" step="1">';
    const wetColorWrap = document.createElement('div');
    wetColorWrap.innerHTML = '<label>Wet color</label><input class="obj-pay-wet-color" type="text" placeholder="#3399ff">';
    const wetAlphaWrap = document.createElement('div');
    wetAlphaWrap.innerHTML = '<label>Wet alpha</label><input class="obj-pay-wet-alpha" type="number" min="0" max="1" step="0.01">';
    const wetSizeWrap = document.createElement('div');
    wetSizeWrap.innerHTML = '<label>Wet size multiplier</label><input class="obj-pay-wet-size" type="number" min="0" step="0.01">';

    const mudHaloWrap = document.createElement('div');
    mudHaloWrap.innerHTML = '<label style="display:flex;align-items:center;gap:8px;"><input class="obj-pay-mud-halo" type="checkbox" style="width:auto;">Mud halo</label>';
    const mudImmuneWrap = document.createElement('div');
    mudImmuneWrap.innerHTML = '<label>Mud immune after ms</label><input class="obj-pay-mud-immune" type="number" min="0" step="1">';
    const mudStainEnabledWrap = document.createElement('div');
    mudStainEnabledWrap.innerHTML = '<label style="display:flex;align-items:center;gap:8px;"><input class="obj-pay-mud-stain-enabled" type="checkbox" style="width:auto;">Mud stain</label>';
    const mudStainDurationWrap = document.createElement('div');
    mudStainDurationWrap.innerHTML = '<label>Mud stain duration ms</label><input class="obj-pay-mud-stain-duration" type="number" min="0" step="1">';
    const mudStainColorWrap = document.createElement('div');
    mudStainColorWrap.innerHTML = '<label>Mud stain color</label><input class="obj-pay-mud-stain-color" type="text" placeholder="#552200">';
    const mudStainAlphaWrap = document.createElement('div');
    mudStainAlphaWrap.innerHTML = '<label>Mud stain alpha</label><input class="obj-pay-mud-stain-alpha" type="number" min="0" max="1" step="0.01">';
    const mudStainSizeWrap = document.createElement('div');
    mudStainSizeWrap.innerHTML = '<label>Mud stain size multiplier</label><input class="obj-pay-mud-stain-size" type="number" min="0" step="0.01">';

    const sandHaloWrap = document.createElement('div');
    sandHaloWrap.innerHTML = '<label style="display:flex;align-items:center;gap:8px;"><input class="obj-pay-sand-halo" type="checkbox" style="width:auto;">Sand halo</label>';
    const sandHaloColorWrap = document.createElement('div');
    sandHaloColorWrap.innerHTML = '<label>Sand halo color</label><input class="obj-pay-sand-halo-color" type="text" placeholder="#ffeaa7">';
    const sandHaloAlphaWrap = document.createElement('div');
    sandHaloAlphaWrap.innerHTML = '<label>Sand halo alpha</label><input class="obj-pay-sand-halo-alpha" type="number" min="0" max="1" step="0.01">';

    [
        splashEnabledWrap, splashBurstsWrap, splashIntervalWrap, splashDropletWrap, splashCooldownWrap, splashColorWrap, splashRingColorWrap,
        wetEnabledWrap, wetDurationWrap, wetColorWrap, wetAlphaWrap, wetSizeWrap,
        mudHaloWrap, mudImmuneWrap, mudStainEnabledWrap, mudStainDurationWrap, mudStainColorWrap, mudStainAlphaWrap, mudStainSizeWrap,
        sandHaloWrap, sandHaloColorWrap, sandHaloAlphaWrap
    ].forEach((n) => payloadVisualGrid.appendChild(n));
    payloadVisualWrap.appendChild(payloadVisualGrid);
    actionPayloadWrap.appendChild(payloadVisualWrap);
    actionBlock.appendChild(actionPayloadWrap);

    const setPayloadVisualFields = (payloadValue) => {
        const payload = isPlainObject(payloadValue) ? payloadValue : {};
        const splash = payload.splash;
        const splashObj = isPlainObject(splash) ? splash : {};
        actionPayloadWrap.querySelector('.obj-pay-splash-enabled').checked = !!(isPlainObject(splash) || splash === true);
        actionPayloadWrap.querySelector('.obj-pay-splash-bursts').value = String(parseNumber(splashObj.bursts, 3));
        actionPayloadWrap.querySelector('.obj-pay-splash-interval').value = String(parseNumber(splashObj.intervalMs, 120));
        actionPayloadWrap.querySelector('.obj-pay-splash-drops').value = String(parseNumber(splashObj.dropletQty, 5));
        actionPayloadWrap.querySelector('.obj-pay-splash-cooldown').value = String(parseNumber(splashObj.cooldownMs, 600));
        actionPayloadWrap.querySelector('.obj-pay-splash-color').value = String(splashObj.color ?? '#88ccff');
        actionPayloadWrap.querySelector('.obj-pay-splash-ring-color').value = String(splashObj.ringColor ?? '#3399ff');

        actionPayloadWrap.querySelector('.obj-pay-wet-enabled').checked = !!payload.wetOverlay;
        actionPayloadWrap.querySelector('.obj-pay-wet-duration').value = String(parseNumber(payload.wetDurationMs, 2500));
        actionPayloadWrap.querySelector('.obj-pay-wet-color').value = String(payload.wetColor ?? '#3399ff');
        actionPayloadWrap.querySelector('.obj-pay-wet-alpha').value = String(parseNumber(payload.wetAlpha, 0.22));
        actionPayloadWrap.querySelector('.obj-pay-wet-size').value = String(parseNumber(payload.wetSizeMultiplier, 0.84));

        actionPayloadWrap.querySelector('.obj-pay-mud-halo').checked = !!payload.mudHalo;
        actionPayloadWrap.querySelector('.obj-pay-mud-immune').value = String(parseNumber(payload.immuneAfterMs, 1000));
        actionPayloadWrap.querySelector('.obj-pay-mud-stain-enabled').checked = !!payload.mudStain;
        actionPayloadWrap.querySelector('.obj-pay-mud-stain-duration').value = String(parseNumber(payload.mudStainDurationMs, 6000));
        actionPayloadWrap.querySelector('.obj-pay-mud-stain-color').value = String(payload.mudStainColor ?? '#552200');
        actionPayloadWrap.querySelector('.obj-pay-mud-stain-alpha').value = String(parseNumber(payload.mudStainAlpha, 0.28));
        actionPayloadWrap.querySelector('.obj-pay-mud-stain-size').value = String(parseNumber(payload.mudStainSizeMultiplier, 0.9));

        actionPayloadWrap.querySelector('.obj-pay-sand-halo').checked = !!payload.sandHalo;
        actionPayloadWrap.querySelector('.obj-pay-sand-halo-color').value = String(payload.sandHaloColor ?? '#ffeaa7');
        actionPayloadWrap.querySelector('.obj-pay-sand-halo-alpha').value = String(parseNumber(payload.sandHaloAlpha, 0.32));
    };

    actionPayloadInput.addEventListener('change', () => {
        const parsed = parseJsonObjectSafe(actionPayloadInput.value);
        if (parsed.ok) {
            setPayloadVisualFields(parsed.value);
        }
        refreshActionPayloadSummary();
    });

    actionPayloadInput.addEventListener('input', () => {
        refreshActionPayloadSummary();
    });

    setPayloadVisualFields(m.action?.payload || {});

    const actionSummaryWrap = document.createElement('div');
    actionSummaryWrap.className = 'objmap-preview-meta obj-action-summary';
    actionSummaryWrap.style.marginTop = '6px';
    actionSummaryWrap.style.borderTop = '1px dashed rgba(255,255,255,0.2)';
    actionSummaryWrap.style.paddingTop = '6px';
    actionBlock.appendChild(actionSummaryWrap);

    const refreshActionPayloadSummary = () => {
        const trigger = actionTrigger.value || 'none';
        const type = actionType.value || 'none';
        const target = actionTarget.value ? ` -> ${actionTarget.value}` : '';
        const val = String(actionValue.value || '').trim();
        const duration = parseNumber(actionDuration.value, 0);
        const cooldown = parseNumber(actionCooldown.value, 0);

        const tags = [];
        if (getCheck('.obj-pay-splash-enabled')) {
            tags.push(`splash ${getNum('.obj-pay-splash-bursts', 3)}x/${getNum('.obj-pay-splash-interval', 120)}ms`);
        }
        if (getCheck('.obj-pay-wet-enabled')) {
            tags.push(`wet ${getNum('.obj-pay-wet-duration', 2500)}ms`);
        }
        if (getCheck('.obj-pay-mud-halo')) {
            tags.push(`mud halo`);
        }
        if (getCheck('.obj-pay-mud-stain-enabled')) {
            tags.push(`mud stain ${getNum('.obj-pay-mud-stain-duration', 6000)}ms`);
        }
        if (getCheck('.obj-pay-sand-halo')) {
            tags.push(`sand halo`);
        }

        const parsedPayload = parseJsonObjectSafe(actionPayloadInput.value);
        const payloadInfo = parsedPayload.ok
            ? `payload keys: ${Object.keys(parsedPayload.value || {}).length}`
            : 'payload JSON non valido';

        actionSummaryWrap.textContent = `Action: ${trigger} -> ${type}${target} (value: ${val || '0'}, duration: ${duration}ms, cooldown: ${cooldown}ms) | ${payloadInfo}${tags.length ? ` | fx: ${tags.join(', ')}` : ''}`;
    };

    const getNum = (sel, fallback = 0) => parseNumber(card.querySelector(sel)?.value, fallback);
    const getCheck = (sel) => !!card.querySelector(sel)?.checked;

    const summarySelectors = [
        '.obj-action-trigger', '.obj-action-type', '.obj-action-target', '.obj-action-value', '.obj-action-duration', '.obj-action-cooldown',
        '.obj-pay-splash-enabled', '.obj-pay-splash-bursts', '.obj-pay-splash-interval', '.obj-pay-splash-drops', '.obj-pay-splash-cooldown',
        '.obj-pay-wet-enabled', '.obj-pay-wet-duration', '.obj-pay-wet-color', '.obj-pay-wet-alpha', '.obj-pay-wet-size',
        '.obj-pay-mud-halo', '.obj-pay-mud-immune', '.obj-pay-mud-stain-enabled', '.obj-pay-mud-stain-duration', '.obj-pay-mud-stain-color', '.obj-pay-mud-stain-alpha', '.obj-pay-mud-stain-size',
        '.obj-pay-sand-halo', '.obj-pay-sand-halo-color', '.obj-pay-sand-halo-alpha'
    ];
    summarySelectors.forEach((sel) => {
        const node = actionBlock.querySelector(sel);
        if (!node) return;
        node.addEventListener('input', refreshActionPayloadSummary);
        node.addEventListener('change', refreshActionPayloadSummary);
    });

    const statesWrap = document.createElement('div');
    statesWrap.style.marginTop = '6px';
    statesWrap.innerHTML = '<label>States JSON (array)</label>';
    const statesInput = document.createElement('textarea');
    statesInput.className = 'obj-states-json';
    statesInput.rows = 6;
    statesInput.style.width = '100%';
    statesInput.value = JSON.stringify(Array.isArray(m.states) ? m.states : [], null, 2);
    statesWrap.appendChild(statesInput);
    actionBlock.appendChild(statesWrap);

    const applyPreset = (preset) => {
        if (preset === 'key') {
            actionTrigger.value = 'collect';
            actionType.value = 'addInventory';
            actionTarget.value = 'keysCount';
            actionValue.value = '1';
            actionDuration.value = '0';
            actionCooldown.value = '0';
            actionFlagsWrap.querySelector('.obj-action-consume').checked = true;
            actionFlagsWrap.querySelector('.obj-action-repeatable').checked = true;
            actionConditionsInput.value = JSON.stringify({}, null, 2);
            actionPayloadInput.value = JSON.stringify({ scoreDelta: 5, sound: 'credits_manager_coin' }, null, 2);
            statesInput.value = JSON.stringify([
                { id: 'idle', initial: true, transitions: [{ event: 'collect', to: 'collected' }] },
                { id: 'collected', onEnter: [{ type: 'destroySelf' }], transitions: [] }
            ], null, 2);
            refreshActionPayloadSummary();
        }
        if (preset === 'wooden') {
            actionTrigger.value = 'collect';
            actionType.value = 'addInventory';
            actionTarget.value = 'woodenCount';
            actionValue.value = '1';
            actionDuration.value = '0';
            actionCooldown.value = '0';
            actionFlagsWrap.querySelector('.obj-action-consume').checked = true;
            actionFlagsWrap.querySelector('.obj-action-repeatable').checked = true;
            actionConditionsInput.value = JSON.stringify({}, null, 2);
            actionPayloadInput.value = JSON.stringify({ scoreDelta: 5, sound: 'select_sfx', canPlaceOn: 'hole' }, null, 2);
            statesInput.value = JSON.stringify([
                { id: 'idle', initial: true, transitions: [{ event: 'collect', to: 'collected' }] },
                { id: 'collected', onEnter: [{ type: 'destroySelf' }], transitions: [] }
            ], null, 2);
            refreshActionPayloadSummary();
        }
        if (preset === 'water') {
            actionTrigger.value = 'enterTile';
            actionType.value = 'modifyDynamite';
            actionTarget.value = 'dynamiteCount';
            actionValue.value = '-10';
            actionDuration.value = '2500';
            actionCooldown.value = '1000';
            actionFlagsWrap.querySelector('.obj-action-consume').checked = false;
            actionFlagsWrap.querySelector('.obj-action-repeatable').checked = true;
            actionConditionsInput.value = JSON.stringify({ moving: true }, null, 2);
            actionPayloadInput.value = JSON.stringify({
                wetDurationMs: 2500,
                wetOverlay: true,
                wetColor: '#3399ff',
                wetAlpha: 0.22,
                wetSizeMultiplier: 0.84,
                splash: { bursts: 3, intervalMs: 120, dropletQty: 5, cooldownMs: 600, color: '#88ccff', ringColor: '#3399ff' }
            }, null, 2);
            statesInput.value = JSON.stringify([
                { id: 'idle', initial: true, transitions: [{ event: 'enterTile', to: 'wet' }] },
                { id: 'wet', onEnter: [{ type: 'spawnEffect', effect: 'splash' }], transitions: [{ event: 'timer', to: 'idle', afterMs: 2500 }] }
            ], null, 2);
            setPayloadVisualFields(parseJsonObjectSafe(actionPayloadInput.value).value || {});
            refreshActionPayloadSummary();
        }
        if (preset === 'mud') {
            actionTrigger.value = 'enterTile';
            actionType.value = 'setSlowFactor';
            actionTarget.value = 'playerMove';
            actionValue.value = '0';
            actionDuration.value = '3000';
            actionCooldown.value = '1000';
            actionFlagsWrap.querySelector('.obj-action-consume').checked = false;
            actionFlagsWrap.querySelector('.obj-action-repeatable').checked = true;
            actionConditionsInput.value = JSON.stringify({}, null, 2);
            actionPayloadInput.value = JSON.stringify({
                mudHalo: true,
                immuneAfterMs: 1000,
                mudStain: true,
                mudStainDurationMs: 6000,
                mudStainColor: '#552200',
                mudStainAlpha: 0.28,
                mudStainSizeMultiplier: 0.9
            }, null, 2);
            statesInput.value = JSON.stringify([
                { id: 'idle', initial: true, transitions: [{ event: 'enterTile', to: 'stuck' }] },
                { id: 'stuck', transitions: [{ event: 'timer', to: 'idle', afterMs: 3000 }] }
            ], null, 2);
            setPayloadVisualFields(parseJsonObjectSafe(actionPayloadInput.value).value || {});
            refreshActionPayloadSummary();
        }
        if (preset === 'sand') {
            actionTrigger.value = 'enterTile';
            actionType.value = 'setSlowFactor';
            actionTarget.value = 'playerMove';
            actionValue.value = '0.5';
            actionDuration.value = '20000';
            actionCooldown.value = '500';
            actionFlagsWrap.querySelector('.obj-action-consume').checked = false;
            actionFlagsWrap.querySelector('.obj-action-repeatable').checked = true;
            actionConditionsInput.value = JSON.stringify({ moving: true }, null, 2);
            actionPayloadInput.value = JSON.stringify({ sandHalo: true, sandHaloColor: '#ffeaa7', sandHaloAlpha: 0.32 }, null, 2);
            statesInput.value = JSON.stringify([
                { id: 'idle', initial: true, transitions: [{ event: 'enterTile', to: 'slow' }] },
                { id: 'slow', transitions: [{ event: 'timer', to: 'idle', afterMs: 20000 }] }
            ], null, 2);
            setPayloadVisualFields(parseJsonObjectSafe(actionPayloadInput.value).value || {});
            refreshActionPayloadSummary();
        }
        if (preset === 'back') {
            actionTrigger.value = 'enterTile';
            actionType.value = 'goToPreviousLevel';
            actionTarget.value = 'level';
            actionValue.value = '1';
            actionDuration.value = '0';
            actionCooldown.value = '0';
            actionFlagsWrap.querySelector('.obj-action-consume').checked = false;
            actionFlagsWrap.querySelector('.obj-action-repeatable').checked = true;
            actionConditionsInput.value = JSON.stringify({}, null, 2);
            actionPayloadInput.value = JSON.stringify({}, null, 2);
            statesInput.value = JSON.stringify([{ id: 'active', initial: true, transitions: [] }], null, 2);
            setPayloadVisualFields(parseJsonObjectSafe(actionPayloadInput.value).value || {});
            refreshActionPayloadSummary();
        }
    };

    presetKeyBtn.addEventListener('click', () => applyPreset('key'));
    presetWoodBtn.addEventListener('click', () => applyPreset('wooden'));
    presetWaterBtn.addEventListener('click', () => applyPreset('water'));
    presetMudBtn.addEventListener('click', () => applyPreset('mud'));
    presetSandBtn.addEventListener('click', () => applyPreset('sand'));
    presetBackBtn.addEventListener('click', () => applyPreset('back'));
    refreshActionPayloadSummary();

    card.appendChild(actionBlock);

    const advancedBlock = document.createElement('div');
    advancedBlock.style.marginTop = '8px';
    advancedBlock.innerHTML = '<label>Advanced JSON (parametri liberi: collision, tile, wall, actor, pickup, effects, render, tags...)</label>';
    const advancedInput = document.createElement('textarea');
    advancedInput.className = 'obj-advanced-json';
    advancedInput.rows = 8;
    advancedInput.style.width = '100%';
    advancedInput.value = formatAdvancedJson(m.advanced);
    advancedBlock.appendChild(advancedInput);
    card.appendChild(advancedBlock);

    const previewTitle = document.createElement('div');
    previewTitle.className = 'objmap-subtitle';
    previewTitle.textContent = 'Anteprima sprite / griglia frame / animazione';
    card.appendChild(previewTitle);

    const previewGrid = document.createElement('div');
    previewGrid.className = 'objmap-preview-grid';

    const sheetPane = document.createElement('div');
    sheetPane.className = 'objmap-preview-pane';
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.className = 'obj-preview-sheet-canvas';
    sheetCanvas.width = 320;
    sheetCanvas.height = 180;
    const previewInfo = document.createElement('div');
    previewInfo.className = 'objmap-preview-meta obj-preview-info';
    previewInfo.textContent = 'Inserisci imageSrc per vedere la preview.';
    sheetPane.appendChild(sheetCanvas);
    sheetPane.appendChild(previewInfo);

    const rightPane = document.createElement('div');
    rightPane.className = 'objmap-preview-pane';
    const frameCanvas = document.createElement('canvas');
    frameCanvas.className = 'obj-preview-frame-canvas';
    frameCanvas.width = 200;
    frameCanvas.height = 200;
    const animCanvas = document.createElement('canvas');
    animCanvas.className = 'obj-preview-anim-canvas';
    animCanvas.width = 200;
    animCanvas.height = 200;
    const actions = document.createElement('div');
    actions.className = 'objmap-preview-actions';
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'obj-preview-play-btn';
    playBtn.textContent = 'Play animazione';
    actions.appendChild(playBtn);
    rightPane.appendChild(frameCanvas);
    rightPane.appendChild(animCanvas);
    rightPane.appendChild(actions);

    previewGrid.appendChild(sheetPane);
    previewGrid.appendChild(rightPane);
    card.appendChild(previewGrid);

    const dynamicToggle = card.querySelector('.obj-dynamic');
    const autoToggle = card.querySelector('.obj-auto');
    dynamicToggle?.addEventListener('change', () => setObjectCardVisibility(card));
    autoToggle?.addEventListener('change', () => setObjectCardVisibility(card));
    attachCardPreviewEvents(card);
    renderCardPreview(card);
    setObjectCardVisibility(card);
    return card;
}

function renderObjectMapEditor() {
    const list = el('objectMapList');
    if (!list) return;
    list.innerHTML = '';
    OBJECT_MAP_EDITOR_STATE.items.forEach((item) => {
        list.appendChild(createObjectMapCard(item));
    });
}

function collectObjectMappingsFromEditor() {
    const list = el('objectMapList');
    if (!list) return [];
    const cards = Array.from(list.querySelectorAll('.objmap-card'));
    const out = cards.map((card) => {
        const getVal = (sel) => String(card.querySelector(sel)?.value ?? '').trim();
        const getNum = (sel, fallback = 0) => parseNumber(card.querySelector(sel)?.value, fallback);
        const getCheck = (sel) => !!card.querySelector(sel)?.checked;
        const dirs = ['up', 'down', 'left', 'right'].filter((d) => !!card.querySelector(`.obj-dir-${d}`)?.checked);
        const advancedRaw = parseJsonObjectSafe(getVal('.obj-advanced-json'));
        const actionConditionsRaw = parseJsonObjectSafe(getVal('.obj-action-conditions'));
        const actionPayloadRaw = parseJsonObjectSafe(getVal('.obj-action-payload'));
        const statesRaw = parseJsonArraySafe(getVal('.obj-states-json'));

        if (!advancedRaw.ok) {
            setObjectMapStatus(advancedRaw.message, true);
            throw new Error(advancedRaw.message);
        }
        if (!actionConditionsRaw.ok) {
            setObjectMapStatus(actionConditionsRaw.message, true);
            throw new Error(actionConditionsRaw.message);
        }
        if (!actionPayloadRaw.ok) {
            setObjectMapStatus(actionPayloadRaw.message, true);
            throw new Error(actionPayloadRaw.message);
        }
        if (!statesRaw.ok) {
            setObjectMapStatus(statesRaw.message, true);
            throw new Error(statesRaw.message);
        }

        const actionPayloadValue = isPlainObject(actionPayloadRaw.value) ? { ...actionPayloadRaw.value } : {};
        const splashEnabled = getCheck('.obj-pay-splash-enabled');
        if (splashEnabled) {
            actionPayloadValue.splash = {
                bursts: getNum('.obj-pay-splash-bursts', 3),
                intervalMs: getNum('.obj-pay-splash-interval', 120),
                dropletQty: getNum('.obj-pay-splash-drops', 5),
                cooldownMs: getNum('.obj-pay-splash-cooldown', 600),
                color: getVal('.obj-pay-splash-color') || '#88ccff',
                ringColor: getVal('.obj-pay-splash-ring-color') || '#3399ff'
            };
        } else {
            delete actionPayloadValue.splash;
        }

        const wetEnabled = getCheck('.obj-pay-wet-enabled');
        if (wetEnabled) {
            actionPayloadValue.wetOverlay = true;
            actionPayloadValue.wetDurationMs = getNum('.obj-pay-wet-duration', 2500);
            actionPayloadValue.wetColor = getVal('.obj-pay-wet-color') || '#3399ff';
            actionPayloadValue.wetAlpha = getNum('.obj-pay-wet-alpha', 0.22);
            actionPayloadValue.wetSizeMultiplier = getNum('.obj-pay-wet-size', 0.84);
        } else {
            delete actionPayloadValue.wetOverlay;
            delete actionPayloadValue.wetDurationMs;
            delete actionPayloadValue.wetColor;
            delete actionPayloadValue.wetAlpha;
            delete actionPayloadValue.wetSizeMultiplier;
        }

        const mudHaloEnabled = getCheck('.obj-pay-mud-halo');
        if (mudHaloEnabled) {
            actionPayloadValue.mudHalo = true;
            actionPayloadValue.immuneAfterMs = getNum('.obj-pay-mud-immune', 1000);
        } else {
            delete actionPayloadValue.mudHalo;
            delete actionPayloadValue.immuneAfterMs;
        }

        const mudStainEnabled = getCheck('.obj-pay-mud-stain-enabled');
        if (mudStainEnabled) {
            actionPayloadValue.mudStain = true;
            actionPayloadValue.mudStainDurationMs = getNum('.obj-pay-mud-stain-duration', 6000);
            actionPayloadValue.mudStainColor = getVal('.obj-pay-mud-stain-color') || '#552200';
            actionPayloadValue.mudStainAlpha = getNum('.obj-pay-mud-stain-alpha', 0.28);
            actionPayloadValue.mudStainSizeMultiplier = getNum('.obj-pay-mud-stain-size', 0.9);
        } else {
            delete actionPayloadValue.mudStain;
            delete actionPayloadValue.mudStainDurationMs;
            delete actionPayloadValue.mudStainColor;
            delete actionPayloadValue.mudStainAlpha;
            delete actionPayloadValue.mudStainSizeMultiplier;
        }

        const sandHaloEnabled = getCheck('.obj-pay-sand-halo');
        if (sandHaloEnabled) {
            actionPayloadValue.sandHalo = true;
            actionPayloadValue.sandHaloColor = getVal('.obj-pay-sand-halo-color') || '#ffeaa7';
            actionPayloadValue.sandHaloAlpha = getNum('.obj-pay-sand-halo-alpha', 0.32);
        } else {
            delete actionPayloadValue.sandHalo;
            delete actionPayloadValue.sandHaloColor;
            delete actionPayloadValue.sandHaloAlpha;
        }

        const normalized = normalizeObjectMapping({
            key: getVal('.obj-key'),
            token: getVal('.obj-token'),
            category: getVal('.obj-category'),
            entityType: getVal('.obj-entity-type'),
            imageSrc: getVal('.obj-image-src'),
            textureKey: getVal('.obj-texture-key'),
            defaultFrame: getNum('.obj-default-frame', 0),
            contactType: getVal('.obj-contact-type') || 'edge',
            dynamic: getCheck('.obj-dynamic'),
            frameCount: getNum('.obj-frame-count', 1),
            useOppositeSide: getCheck('.obj-opposite'),
            frames: {
                idle: {
                    up: getVal('.obj-idle-up'),
                    down: getVal('.obj-idle-down'),
                    left: getVal('.obj-idle-left'),
                    right: getVal('.obj-idle-right')
                },
                move: {
                    up: getVal('.obj-move-up'),
                    down: getVal('.obj-move-down'),
                    left: getVal('.obj-move-left'),
                    right: getVal('.obj-move-right')
                }
            },
            contactScore: getNum('.obj-contact-score', 0),
            movement: {
                automatic: getCheck('.obj-auto'),
                directions: dirs,
                minStep: getNum('.obj-min-step', 0),
                maxStep: getNum('.obj-max-step', 0),
                pauseMs: getNum('.obj-pause-ms', 0)
            },
            staticScore: getNum('.obj-static-score', 0),
            sizePx: {
                width: getNum('.obj-size-w', 64),
                height: getNum('.obj-size-h', 64)
            },
            spawn: {
                fromMapToken: getCheck('.obj-spawn-from-map'),
                countFromLevelKey: getVal('.obj-spawn-count-key') || null,
                speedFromLevelKeys: parseCsvList(getVal('.obj-spawn-speed-keys'))
            },
            action: {
                trigger: getVal('.obj-action-trigger') || 'collect',
                type: getVal('.obj-action-type') || 'none',
                target: getVal('.obj-action-target'),
                value: getNum('.obj-action-value', 0),
                durationMs: getNum('.obj-action-duration', 0),
                cooldownMs: getNum('.obj-action-cooldown', 0),
                consumeOnUse: getCheck('.obj-action-consume'),
                repeatable: getCheck('.obj-action-repeatable'),
                conditions: actionConditionsRaw.value,
                payload: actionPayloadValue
            }
        });

        const withStates = {
            ...normalized,
            states: normalizeStates(statesRaw.value)
        };

        return mergeMappingWithAdvanced(withStates, advancedRaw.value);
    }).filter((m) => m.key);

    OBJECT_MAP_EDITOR_STATE.items = out;
    refreshObjectMappingsAvailability();
    return out;
}

// Rebuilds enemy parameter inputs in #enemyParamsContainer from current object mappings.
// Accepts optional levelData object to pre-populate values; falls back to 0.
function rebuildEnemyParamsUI(levelData) {
    const container = el('enemyParamsContainer');
    if (!container) return;
    container.innerHTML = '';

    const items = Array.isArray(OBJECT_MAP_EDITOR_STATE.items) ? OBJECT_MAP_EDITOR_STATE.items : [];
    const enemies = items.filter((m) => String(m.category ?? '').trim().toLowerCase() === 'enemy');

    if (!enemies.length) {
        const hint = document.createElement('div');
        hint.className = 'tiny';
        hint.textContent = 'Nessun nemico definito negli object mappings.';
        container.appendChild(hint);
        return;
    }

    const data = (levelData && typeof levelData === 'object') ? levelData : {};
    const seenCountKeys = new Set();
    const seenSpeedKeys = new Set();

    const countGrid = document.createElement('div');
    countGrid.className = 'grid2';
    countGrid.style.marginTop = '6px';

    const speedGrid = document.createElement('div');
    speedGrid.className = 'grid2';
    speedGrid.style.marginTop = '6px';

    enemies.forEach((m) => {
        const label = String(m.key ?? m.token ?? '').trim();
        const spawn = (m.spawn && typeof m.spawn === 'object') ? m.spawn : {};

        // Count field
        const countKey = spawn.countFromLevelKey ? String(spawn.countFromLevelKey).trim() : null;
        if (countKey && !seenCountKeys.has(countKey)) {
            seenCountKeys.add(countKey);
            const div = document.createElement('div');
            const row = document.createElement('div');
            row.className = 'field-row';
            const lbl = document.createElement('label');
            lbl.className = 'field-label';
            lbl.setAttribute('for', `enemyParam_${countKey}`);
            lbl.textContent = `${label || countKey} :`;
            const valWrap = document.createElement('div');
            valWrap.className = 'field-value';
            const inp = document.createElement('input');
            inp.id = `enemyParam_${countKey}`;
            inp.type = 'number';
            inp.min = '0';
            inp.setAttribute('data-enemy-level-key', countKey);
            inp.value = String(data[countKey] ?? 0);
            inp.addEventListener('input', () => drawMiniMapPreview(getScene()));
            valWrap.appendChild(inp);
            row.appendChild(lbl);
            row.appendChild(valWrap);
            div.appendChild(row);
            countGrid.appendChild(div);
        }

        // Speed fields
        const speedKeys = Array.isArray(spawn.speedFromLevelKeys)
            ? spawn.speedFromLevelKeys.map((k) => String(k).trim()).filter(Boolean)
            : [];
        speedKeys.forEach((speedKey) => {
            if (seenSpeedKeys.has(speedKey)) return;
            seenSpeedKeys.add(speedKey);
            const div = document.createElement('div');
            const row = document.createElement('div');
            row.className = 'field-row';
            const lbl = document.createElement('label');
            lbl.className = 'field-label';
            lbl.setAttribute('for', `enemyParam_${speedKey}`);
            lbl.textContent = `${label || speedKey} Speed :`;
            const valWrap = document.createElement('div');
            valWrap.className = 'field-value';
            const inp = document.createElement('input');
            inp.id = `enemyParam_${speedKey}`;
            inp.type = 'number';
            inp.min = '0';
            inp.setAttribute('data-enemy-level-key', speedKey);
            inp.value = String(data[speedKey] ?? 0);
            const range = document.createElement('input');
            range.id = `enemyParam_${speedKey}_range`;
            range.type = 'range';
            range.min = '0';
            range.max = '200';
            range.step = '1';
            range.value = inp.value;
            inp.addEventListener('input', () => { range.value = inp.value; drawMiniMapPreview(getScene()); });
            range.addEventListener('input', () => { inp.value = range.value; drawMiniMapPreview(getScene()); });
            valWrap.appendChild(inp);
            valWrap.appendChild(range);
            row.appendChild(lbl);
            row.appendChild(valWrap);
            div.appendChild(row);
            speedGrid.appendChild(div);
        });
    });

    if (countGrid.children.length) container.appendChild(countGrid);
    if (speedGrid.children.length) container.appendChild(speedGrid);
}

// Collects all dynamic enemy param values from #enemyParamsContainer as a plain object
// e.g. { ghost: 2, ghostSpeed: 80, bat: 3, batSpeed: 90 }
function collectEnemyParamValues() {
    const container = el('enemyParamsContainer');
    if (!container) return {};
    const result = {};
    container.querySelectorAll('input[data-enemy-level-key]').forEach((inp) => {
        const key = inp.getAttribute('data-enemy-level-key');
        if (key) result[key] = parseNumber(inp.value, 0);
    });
    return result;
}

function loadObjectMappingsToEditor(rawList) {
    const arr = Array.isArray(rawList) ? rawList : [];
    OBJECT_MAP_EDITOR_STATE.items = arr.map((it) => normalizeObjectMapping(it));
    refreshObjectMappingsAvailability();
    renderObjectMapEditor();
    try { rebuildEnemyParamsUI(); } catch (e) {}
}

function loadObjectMappingsExample() {
    loadObjectMappingsToEditor(OBJECT_MAPPINGS_EXAMPLE);
    setObjectMapStatus('Esempio JSON esteso caricato: enemy/tile/wall/exit/pickup con parametri avanzati.');
}

async function loadObjectMappingsFromObjectsFile() {
    const candidates = buildStaticPathCandidates(OBJECTS_JSON_PATH);
    let lastError = null;

    try {
        for (const candidate of candidates) {
            try {
                const resp = await fetch(candidate, { cache: 'no-store' });
                if (!resp.ok) {
                    lastError = new Error(`HTTP ${resp.status} su ${candidate}`);
                    continue;
                }
                const data = await resp.json();
                if (!Array.isArray(data)) {
                    lastError = new Error(`Formato non valido su ${candidate}: atteso array JSON.`);
                    continue;
                }
                loadObjectMappingsToEditor(data);
                setObjectMapStatus(`Caricati ${data.length} oggetti da ${candidate}.`);
                return data.length;
            } catch (innerErr) {
                lastError = innerErr;
            }
        }

        const tried = candidates.join(', ');
        throw lastError || new Error(`Nessun path valido trovato. Tentativi: ${tried}`);
    } catch (err) {
        OBJECT_MAP_EDITOR_STATE.items = [];
        refreshObjectMappingsAvailability();
        const tried = candidates.join(', ');
        setObjectMapStatus(`Errore caricamento objects.json (${tried}): ${err.message}`, true);
        return -1;
    }
}

function setConfigStatus(message, isError = false) {
    const target = el('configStatusText');
    if (!target) return;
    target.style.color = isError ? '#ff8f9a' : '#8ee89f';
    target.textContent = message;
}

function buildConfigEditorUI(configObj) {
    const container = el('configFormContainer');
    if (!container) return;
    container.innerHTML = '';

    const cfg = deepClone(configObj || {});
    CONFIG_EDITOR_STATE.loadedConfig = cfg;

    const createCard = (title) => {
        const card = document.createElement('div');
        card.className = 'cfg-card';
        const h = document.createElement('div');
        h.className = 'cfg-title';
        h.textContent = title;
        card.appendChild(h);
        return card;
    };

    const appendField = (parent, pathParts, key, value) => {
        const row = document.createElement('div');
        row.className = 'cfg-row';
        const fullPath = [...pathParts, key].join('.');

        const label = document.createElement('label');
        label.textContent = fullPath;
        row.appendChild(label);

        if (typeof value === 'boolean') {
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = value;
            cb.style.width = 'auto';
            cb.addEventListener('change', () => setPathValue(CONFIG_EDITOR_STATE.loadedConfig, [...pathParts, key], !!cb.checked));
            row.appendChild(cb);
            parent.appendChild(row);
            return;
        }

        if (typeof value === 'number') {
            const wrap = document.createElement('div');
            wrap.className = 'cfg-inline';
            const range = document.createElement('input');
            const number = document.createElement('input');
            const meta = getNumberRangeForKey(fullPath, value);
            range.type = 'range';
            range.min = String(meta.min);
            range.max = String(meta.max);
            range.step = String(meta.step);
            range.value = String(value);
            number.type = 'number';
            number.step = String(meta.step);
            number.value = String(value);

            const sync = (src, dst) => {
                const v = Number(src.value);
                if (!Number.isFinite(v)) return;
                dst.value = String(v);
                setPathValue(CONFIG_EDITOR_STATE.loadedConfig, [...pathParts, key], v);
            };
            range.addEventListener('input', () => sync(range, number));
            number.addEventListener('input', () => sync(number, range));

            wrap.appendChild(range);
            wrap.appendChild(number);
            row.appendChild(wrap);
            parent.appendChild(row);
            return;
        }

        if (typeof value === 'string') {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            input.addEventListener('input', () => setPathValue(CONFIG_EDITOR_STATE.loadedConfig, [...pathParts, key], String(input.value)));
            row.appendChild(input);
            parent.appendChild(row);
            return;
        }

        // arrays or objects fallback: editable JSON textarea
        const ta = document.createElement('textarea');
        ta.style.minHeight = '72px';
        ta.value = JSON.stringify(value, null, 2);
        ta.addEventListener('input', () => {
            try {
                const parsed = JSON.parse(ta.value);
                ta.style.borderColor = '#35507f';
                setPathValue(CONFIG_EDITOR_STATE.loadedConfig, [...pathParts, key], parsed);
            } catch (_e) {
                ta.style.borderColor = '#b23f5a';
            }
        });
        row.appendChild(ta);
        parent.appendChild(row);
    };

    const appendObjectSection = (parent, obj, pathParts) => {
        Object.keys(obj).sort().forEach((k) => {
            const value = obj[k];
            if (isPlainObject(value)) {
                const details = document.createElement('details');
                details.open = false;
                details.style.marginBottom = '6px';
                const summary = document.createElement('summary');
                summary.textContent = [...pathParts, k].join('.');
                summary.style.cursor = 'pointer';
                summary.style.fontSize = '9px';
                summary.style.color = '#cbe5ff';
                details.appendChild(summary);
                const inner = document.createElement('div');
                inner.style.padding = '6px 2px 0 2px';
                appendObjectSection(inner, value, [...pathParts, k]);
                details.appendChild(inner);
                parent.appendChild(details);
            } else {
                appendField(parent, pathParts, k, value);
            }
        });
    };

    const topLevelKeys = Object.keys(cfg).sort();
    const generalCard = createCard('Generale');
    let hasGeneral = false;

    topLevelKeys.forEach((key) => {
        const value = cfg[key];
        if (isPlainObject(value)) {
            const card = createCard(key);
            appendObjectSection(card, value, [key]);
            container.appendChild(card);
        } else {
            hasGeneral = true;
            appendField(generalCard, [], key, value);
        }
    });

    if (hasGeneral) {
        container.prepend(generalCard);
    }
}

async function loadConfigEditor() {
    const candidates = buildStaticPathCandidates(CONFIG_JSON_PATH);
    let lastError = null;

    try {
        for (const candidate of candidates) {
            try {
                const resp = await fetch(candidate, { cache: 'no-store' });
                if (!resp.ok) {
                    lastError = new Error(`HTTP ${resp.status} su ${candidate}`);
                    continue;
                }
                const cfg = await resp.json();
                buildConfigEditorUI(cfg);
                setConfigStatus(`Configurazione caricata da ${candidate}.`);
                return;
            } catch (innerErr) {
                lastError = innerErr;
            }
        }

        const tried = candidates.join(', ');
        throw lastError || new Error(`Nessun path valido trovato. Tentativi: ${tried}`);
    } catch (e) {
        setConfigStatus(`Errore caricamento config: ${e.message}`, true);
    }
}

async function saveConfigEditor() {
    if (!CONFIG_EDITOR_STATE.loadedConfig) {
        setConfigStatus('Nessuna configurazione caricata.', true);
        return;
    }
    try {
        const resp = await fetch(buildApiUrl('config'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(CONFIG_EDITOR_STATE.loadedConfig)
        });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || payload.ok === false) {
            throw new Error(payload.error || `HTTP ${resp.status}`);
        }
        const backupFile = payload.backupFile ? ` Backup: ${payload.backupFile}` : '';
        setConfigStatus(`Configurazione salvata.${backupFile}`);
    } catch (e) {
        setConfigStatus(`Errore salvataggio config: ${e.message}`, true);
    }
}

function setStartStatus(message, isError = false) {
    const node = el('startStatusText');
    if (!node) return;
    node.style.color = isError ? '#ff9fa7' : '#8ee89f';
    node.textContent = message || '';
}

function sanitizeStartCoinMode(raw) {
    const mode = String(raw || 'arcade').trim().toLowerCase();
    return mode === 'freeplay' ? 'freeplay' : 'arcade';
}

function normalizeStartElement(raw, index = 0) {
    const inObj = isPlainObject(raw) ? raw : {};
    const typeRaw = String(inObj.type || 'image').trim().toLowerCase();
    const type = (typeRaw === 'text' || typeRaw === 'plugin') ? typeRaw : 'image';
    const id = String(inObj.id || `el_${Date.now()}_${index}`).trim() || `el_${Date.now()}_${index}`;
    const pluginId = String(inObj.pluginId || '').trim();
    const pluginPreset = ATTRACT_PLUGIN_PRESETS[pluginId] || null;
    return {
        id,
        type,
        pluginId,
        src: String(inObj.src || '').trim(),
        text: String(inObj.text || pluginPreset?.label || '').trim(),
        color: String(inObj.color || '#ffffff').trim() || '#ffffff',
        fontSize: Math.max(8, parseNumber(inObj.fontSize, 24)),
        x: Math.max(0, parseNumber(inObj.x, pluginPreset?.x ?? 80)),
        y: Math.max(0, parseNumber(inObj.y, pluginPreset?.y ?? 80)),
        w: Math.max(8, parseNumber(inObj.w, pluginPreset?.w ?? (type === 'text' ? 220 : 180))),
        h: Math.max(8, parseNumber(inObj.h, pluginPreset?.h ?? (type === 'text' ? 48 : 120))),
        effect: String(inObj.effect || 'none').trim() || 'none',
        delayMs: Math.max(0, parseNumber(inObj.delayMs, 0)),
        durationMs: Math.max(0, parseNumber(inObj.durationMs, 1000)),
        order: Math.max(0, Math.floor(parseNumber(inObj.order, index)))
    };
}

function normalizeStartPlugin(raw, index = 0) {
    const inObj = isPlainObject(raw) ? raw : {};
    const id = String(inObj.id || '').trim();
    const preset = ATTRACT_PLUGIN_PRESETS[id] || ATTRACT_PLUGIN_PRESETS.insertCoin;
    const effect = String(inObj.effect || 'none').trim() || 'none';
    const delayMs = Math.max(0, parseNumber(inObj.delayMs, 0));
    const durationMs = Math.max(0, parseNumber(inObj.durationMs, 1000));
    return {
        id: id || 'insertCoin',
        enabled: inObj.enabled !== false,
        x: Math.max(0, parseNumber(inObj.x, preset.x)),
        y: Math.max(0, parseNumber(inObj.y, preset.y)),
        w: Math.max(10, parseNumber(inObj.w, preset.w)),
        h: Math.max(10, parseNumber(inObj.h, preset.h)),
        label: String(inObj.label || preset.label).trim() || preset.label,
        effect,
        delayMs,
        durationMs,
        order: Math.max(0, Math.floor(parseNumber(inObj.order, index)))
    };
}

function normalizeStartConfig(raw) {
    const root = isPlainObject(raw) ? raw : {};
    const startup = isPlainObject(root.startup) ? root.startup : {};
    const attractMode = isPlainObject(root.attractMode) ? root.attractMode : {};
    const canvas = isPlainObject(attractMode.canvas) ? attractMode.canvas : {};
    const elementsRaw = Array.isArray(attractMode.elements) ? attractMode.elements : [];
    const pluginsRaw = Array.isArray(attractMode.plugins) ? attractMode.plugins : [];
    const elements = elementsRaw.map((it, idx) => normalizeStartElement(it, idx));
    const plugins = pluginsRaw.map((it, idx) => normalizeStartPlugin(it, idx));

    plugins.forEach((plugin, idx) => {
        const existing = elements.some((elItem) => elItem.type === 'plugin' && elItem.pluginId === plugin.id);
        if (existing) return;
        elements.push(normalizeStartElement({
            type: 'plugin',
            pluginId: plugin.id,
            text: plugin.label,
            x: plugin.x,
            y: plugin.y,
            w: plugin.w,
            h: plugin.h,
            effect: plugin.effect,
            delayMs: plugin.delayMs,
            durationMs: plugin.durationMs,
            order: Number(plugin.order) || idx
        }, elements.length + idx));
    });

    return {
        startup: {
            enableFrontScenes: startup.enableFrontScenes !== false,
            coinMode: sanitizeStartCoinMode(startup.coinMode),
            initialCredits: Math.max(0, Math.floor(parseNumber(startup.initialCredits, 0)))
        },
        attractMode: {
            enabled: !!attractMode.enabled,
            canvas: {
                width: Math.max(320, Math.floor(parseNumber(canvas.width, 800))),
                height: Math.max(200, Math.floor(parseNumber(canvas.height, 600)))
            },
            elements: elements.sort((a, b) => a.order - b.order),
            plugins: plugins.sort((a, b) => a.order - b.order)
        }
    };
}

function getSelectedStartElement() {
    const list = START_EDITOR_STATE.loadedStart?.attractMode?.elements;
    if (!Array.isArray(list)) return null;
    return list.find((it) => it.id === START_EDITOR_STATE.selectedElementId) || null;
}

function syncStartPluginsFromElements() {
    const cfg = START_EDITOR_STATE.loadedStart;
    if (!cfg || !cfg.attractMode) return;
    const items = Array.isArray(cfg.attractMode.elements) ? cfg.attractMode.elements : [];
    const plugins = [];
    items.forEach((item, idx) => {
        if (item.type !== 'plugin') return;
        plugins.push(normalizeStartPlugin({
            id: item.pluginId,
            enabled: true,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
            label: item.text,
            effect: item.effect,
            delayMs: item.delayMs,
            durationMs: item.durationMs,
            order: Number(item.order) || idx
        }, idx));
    });
    cfg.attractMode.plugins = plugins;
}

function renderStartElementInputs() {
    const selected = getSelectedStartElement();
    const xNode = el('startElementX');
    const yNode = el('startElementY');
    const wNode = el('startElementW');
    const hNode = el('startElementH');
    const effectNode = el('startElementEffect');
    const colorNode = el('startElementColor');
    const fontNode = el('startElementFontSize');
    const delayNode = el('startElementDelayMs');
    const durationNode = el('startElementDurationMs');
    const textNode = el('startElementText');

    const disabled = !selected;
    [xNode, yNode, wNode, hNode, effectNode, colorNode, fontNode, delayNode, durationNode, textNode]
        .forEach((node) => {
            if (!node) return;
            node.disabled = disabled;
        });

    if (!selected) {
        if (textNode) textNode.value = '';
        return;
    }

    if (xNode) xNode.value = String(Math.round(selected.x));
    if (yNode) yNode.value = String(Math.round(selected.y));
    if (wNode) wNode.value = String(Math.round(selected.w));
    if (hNode) hNode.value = String(Math.round(selected.h));
    if (effectNode) effectNode.value = selected.effect || 'none';
    if (colorNode) colorNode.value = selected.color || '#ffffff';
    if (fontNode) fontNode.value = String(Math.round(selected.fontSize || 24));
    if (delayNode) delayNode.value = String(Math.round(selected.delayMs || 0));
    if (durationNode) durationNode.value = String(Math.round(selected.durationMs || 1000));
    if (textNode) textNode.value = selected.text || '';
}

function applyStartFormFromState() {
    const cfg = normalizeStartConfig(START_EDITOR_STATE.loadedStart);
    START_EDITOR_STATE.loadedStart = cfg;

    const startup = cfg.startup;
    const attract = cfg.attractMode;

    const enableFront = el('startEnableFrontScenes');
    const coinMode = el('startCoinMode');
    const initialCredits = el('startInitialCredits');
    const attractEnabled = el('startAttractEnabled');
    const canvasW = el('startCanvasWidth');
    const canvasH = el('startCanvasHeight');

    if (enableFront) enableFront.checked = !!startup.enableFrontScenes;
    if (coinMode) coinMode.value = sanitizeStartCoinMode(startup.coinMode);
    if (initialCredits) {
        initialCredits.value = String(Math.max(0, startup.initialCredits || 0));
        initialCredits.disabled = sanitizeStartCoinMode(startup.coinMode) === 'freeplay';
    }
    if (attractEnabled) attractEnabled.checked = !!attract.enabled;
    if (canvasW) canvasW.value = String(attract.canvas.width);
    if (canvasH) canvasH.value = String(attract.canvas.height);

    if (!START_EDITOR_STATE.selectedElementId && attract.elements.length) {
        START_EDITOR_STATE.selectedElementId = attract.elements[0].id;
    }
    if (START_EDITOR_STATE.selectedElementId) {
        const exists = attract.elements.some((it) => it.id === START_EDITOR_STATE.selectedElementId);
        if (!exists) START_EDITOR_STATE.selectedElementId = attract.elements[0]?.id || null;
    }

    syncStartPluginsFromElements();
    renderStartAttractStage();
    renderStartTimelineList();
    renderStartElementInputs();
}

function renderStartAttractStage() {
    const stage = el('startAttractStage');
    if (!stage) return;

    const cfg = START_EDITOR_STATE.loadedStart || START_EDITOR_DEFAULT;
    const attract = cfg.attractMode || START_EDITOR_DEFAULT.attractMode;
    const canvasW = Math.max(320, parseNumber(attract.canvas?.width, 800));
    const canvasH = Math.max(200, parseNumber(attract.canvas?.height, 600));

    stage.style.width = `${canvasW}px`;
    stage.style.height = `${canvasH}px`;
    stage.innerHTML = '';

    const list = Array.isArray(attract.elements) ? attract.elements.slice().sort((a, b) => a.order - b.order) : [];
    list.forEach((entry) => {
        const node = document.createElement('div');
        node.className = 'start-node';
        if (entry.type === 'plugin') node.classList.add('plugin');
        if (entry.id === START_EDITOR_STATE.selectedElementId) node.classList.add('selected');
        node.dataset.id = entry.id;
        node.style.left = `${Math.round(entry.x)}px`;
        node.style.top = `${Math.round(entry.y)}px`;
        node.style.width = `${Math.max(8, Math.round(entry.w))}px`;
        node.style.height = `${Math.max(8, Math.round(entry.h))}px`;

        if (entry.type === 'plugin') {
            const textNode = document.createElement('div');
            textNode.className = 'start-text';
            const pluginLabel = ATTRACT_PLUGIN_PRESETS[entry.pluginId]?.label || entry.text || entry.pluginId || 'plugin';
            textNode.textContent = pluginLabel;
            textNode.style.color = '#a8d8ff';
            textNode.style.fontSize = `${Math.max(10, parseNumber(entry.fontSize, 16))}px`;
            node.appendChild(textNode);
        } else if (entry.type === 'text') {
            const textNode = document.createElement('div');
            textNode.className = 'start-text';
            textNode.textContent = entry.text || 'TEXT';
            textNode.style.color = entry.color || '#ffffff';
            textNode.style.fontSize = `${Math.max(8, parseNumber(entry.fontSize, 24))}px`;
            node.appendChild(textNode);
        } else {
            const imgNode = document.createElement('img');
            imgNode.src = entry.src || '';
            imgNode.alt = entry.id;
            node.appendChild(imgNode);
        }

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'start-resize-handle';
        resizeHandle.title = 'Resize';
        resizeHandle.addEventListener('pointerdown', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            START_EDITOR_STATE.selectedElementId = entry.id;
            START_EDITOR_STATE.drag.active = true;
            START_EDITOR_STATE.drag.mode = 'resize';
            START_EDITOR_STATE.drag.elementId = entry.id;
            START_EDITOR_STATE.drag.startX = ev.clientX;
            START_EDITOR_STATE.drag.startY = ev.clientY;
            START_EDITOR_STATE.drag.baseW = parseNumber(entry.w, 80);
            START_EDITOR_STATE.drag.baseH = parseNumber(entry.h, 40);
            START_EDITOR_STATE.drag.baseX = parseNumber(entry.x, 0);
            START_EDITOR_STATE.drag.baseY = parseNumber(entry.y, 0);
        });
        node.appendChild(resizeHandle);

        node.addEventListener('click', (ev) => {
            ev.stopPropagation();
            START_EDITOR_STATE.selectedElementId = entry.id;
            renderStartAttractStage();
            renderStartTimelineList();
            renderStartElementInputs();
        });

        node.addEventListener('pointerdown', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            START_EDITOR_STATE.selectedElementId = entry.id;
            START_EDITOR_STATE.drag.active = true;
            START_EDITOR_STATE.drag.mode = 'move';
            START_EDITOR_STATE.drag.elementId = entry.id;
            START_EDITOR_STATE.drag.startX = ev.clientX;
            START_EDITOR_STATE.drag.startY = ev.clientY;
            START_EDITOR_STATE.drag.baseX = parseNumber(entry.x, 0);
            START_EDITOR_STATE.drag.baseY = parseNumber(entry.y, 0);
            START_EDITOR_STATE.drag.baseW = parseNumber(entry.w, 80);
            START_EDITOR_STATE.drag.baseH = parseNumber(entry.h, 40);
            try { node.setPointerCapture(ev.pointerId); } catch (_e) { }
            renderStartAttractStage();
            renderStartTimelineList();
            renderStartElementInputs();
        });

        stage.appendChild(node);
    });

    stage.onclick = () => {
        START_EDITOR_STATE.selectedElementId = null;
        renderStartAttractStage();
        renderStartTimelineList();
        renderStartElementInputs();
    };
}

function renderStartTimelineList() {
    const listNode = el('startTimelineList');
    if (!listNode) return;
    listNode.innerHTML = '';

    const items = Array.isArray(START_EDITOR_STATE.loadedStart?.attractMode?.elements)
        ? START_EDITOR_STATE.loadedStart.attractMode.elements.slice().sort((a, b) => a.order - b.order)
        : [];

    if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'tiny';
        empty.textContent = 'Nessun elemento timeline. Aggiungi immagini o testi.';
        listNode.appendChild(empty);
        return;
    }

    items.forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'start-timeline-item';
        if (entry.id === START_EDITOR_STATE.selectedElementId) row.classList.add('is-selected');

        const title = document.createElement('div');
        title.className = 'tiny';
        title.style.color = '#c8e8ff';
        const kind = entry.type === 'text' ? 'Text' : (entry.type === 'plugin' ? `Plugin:${entry.pluginId || 'custom'}` : 'Image');
        title.textContent = `${index + 1}. ${kind} - ${entry.id}`;
        row.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'grid2';

        const orderInput = document.createElement('input');
        orderInput.type = 'number';
        orderInput.min = '0';
        orderInput.step = '1';
        orderInput.value = String(entry.order);
        orderInput.addEventListener('input', () => {
            entry.order = Math.max(0, Math.floor(parseNumber(orderInput.value, entry.order)));
            renderStartTimelineList();
            renderStartAttractStage();
        });
        const orderWrap = document.createElement('div');
        orderWrap.innerHTML = '<label>order</label>';
        orderWrap.appendChild(orderInput);

        const delayInput = document.createElement('input');
        delayInput.type = 'number';
        delayInput.min = '0';
        delayInput.step = '10';
        delayInput.value = String(entry.delayMs || 0);
        delayInput.addEventListener('input', () => {
            entry.delayMs = Math.max(0, parseNumber(delayInput.value, entry.delayMs));
            renderStartElementInputs();
        });
        const delayWrap = document.createElement('div');
        delayWrap.innerHTML = '<label>delayMs</label>';
        delayWrap.appendChild(delayInput);

        grid.appendChild(orderWrap);
        grid.appendChild(delayWrap);
        row.appendChild(grid);

        row.addEventListener('click', () => {
            START_EDITOR_STATE.selectedElementId = entry.id;
            renderStartTimelineList();
            renderStartAttractStage();
            renderStartElementInputs();
        });

        listNode.appendChild(row);
    });
}

function createStartElement(partial = {}) {
    const id = `attract_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    return normalizeStartElement({ id, ...partial });
}

function addStartImageElement() {
    const cfg = START_EDITOR_STATE.loadedStart;
    if (!cfg || !cfg.attractMode) return;
    const src = String(el('startAttractAssetSelect')?.value || '').trim();
    if (!src) {
        setStartStatus('Seleziona prima un asset attractmode da aggiungere.', true);
        return;
    }
    const list = cfg.attractMode.elements;
    const entry = createStartElement({
        type: 'image',
        src,
        x: 80 + (list.length * 12),
        y: 80 + (list.length * 12),
        w: 220,
        h: 150,
        order: list.length
    });
    list.push(entry);
    START_EDITOR_STATE.selectedElementId = entry.id;
    applyStartFormFromState();
    setStartStatus('Elemento immagine aggiunto.');
}

function addStartTextElement() {
    const cfg = START_EDITOR_STATE.loadedStart;
    if (!cfg || !cfg.attractMode) return;
    const text = String(el('startAddTextValue')?.value || '').trim() || 'TEXT';
    const color = String(el('startAddTextColor')?.value || '#ffffff').trim() || '#ffffff';
    const fontSize = Math.max(8, parseNumber(el('startAddTextSize')?.value, 24));
    const list = cfg.attractMode.elements;
    const entry = createStartElement({
        type: 'text',
        text,
        color,
        fontSize,
        x: 90 + (list.length * 10),
        y: 90 + (list.length * 10),
        w: Math.max(140, text.length * Math.max(8, fontSize * 0.45)),
        h: Math.max(40, fontSize * 1.8),
        order: list.length
    });
    list.push(entry);
    START_EDITOR_STATE.selectedElementId = entry.id;
    applyStartFormFromState();
    setStartStatus('Elemento testo aggiunto.');
}

function addStartPluginElement() {
    const cfg = START_EDITOR_STATE.loadedStart;
    if (!cfg || !cfg.attractMode) return;
    const pluginId = String(el('startPluginSelect')?.value || '').trim();
    const preset = ATTRACT_PLUGIN_PRESETS[pluginId];
    if (!preset) {
        setStartStatus('Plugin non valido.', true);
        return;
    }

    const already = (cfg.attractMode.elements || []).find((it) => it.type === 'plugin' && it.pluginId === pluginId);
    if (already) {
        START_EDITOR_STATE.selectedElementId = already.id;
        applyStartFormFromState();
        setStartStatus('Plugin gia presente: selezionato elemento esistente.');
        return;
    }

    const list = cfg.attractMode.elements;
    const entry = createStartElement({
        type: 'plugin',
        pluginId,
        text: preset.label,
        color: '#a8d8ff',
        fontSize: 16,
        x: preset.x,
        y: preset.y,
        w: preset.w,
        h: preset.h,
        order: list.length
    });
    list.push(entry);
    START_EDITOR_STATE.selectedElementId = entry.id;
    applyStartFormFromState();
    setStartStatus(`Plugin aggiunto: ${preset.label}.`);
}

function stopStartPreviewPlayback() {
    if (START_EDITOR_STATE.previewTimer) {
        clearTimeout(START_EDITOR_STATE.previewTimer);
        START_EDITOR_STATE.previewTimer = null;
    }
    const previewStage = el('startPreviewStage');
    if (previewStage) previewStage.innerHTML = '';
}

function animatePreviewNode(node, entry) {
    if (!node) return;
    const effect = String(entry.effect || 'none').trim();
    const delayMs = Math.max(0, parseNumber(entry.delayMs, 0));
    const durationMs = Math.max(100, parseNumber(entry.durationMs, 1000));

    if (effect === 'fadeIn') {
        node.animate([
            { opacity: 0 },
            { opacity: 1 }
        ], { duration: durationMs, delay: delayMs, fill: 'forwards', easing: 'ease-out' });
        return;
    }
    if (effect === 'slideLeft') {
        node.animate([
            { opacity: 0, transform: 'translateX(-40px)' },
            { opacity: 1, transform: 'translateX(0)' }
        ], { duration: durationMs, delay: delayMs, fill: 'forwards', easing: 'ease-out' });
        return;
    }
    if (effect === 'pulse') {
        node.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.08)' },
            { transform: 'scale(1)' }
        ], { duration: durationMs, delay: delayMs, iterations: Infinity, easing: 'ease-in-out' });
        return;
    }
    if (effect === 'blink') {
        node.animate([
            { opacity: 1 },
            { opacity: 0.25 },
            { opacity: 1 }
        ], { duration: durationMs, delay: delayMs, iterations: Infinity, easing: 'ease-in-out' });
    }
}

function playStartPreview() {
    collectStartConfigFromForm();
    const modal = el('startPreviewModal');
    const stage = el('startPreviewStage');
    if (!modal || !stage) return;

    stopStartPreviewPlayback();
    modal.classList.add('open');

    const cfg = normalizeStartConfig(START_EDITOR_STATE.loadedStart);
    const attract = cfg.attractMode;
    stage.style.width = `${attract.canvas.width}px`;
    stage.style.height = `${attract.canvas.height}px`;

    const list = Array.isArray(attract.elements) ? attract.elements.slice().sort((a, b) => a.order - b.order) : [];
    list.forEach((entry) => {
        const node = document.createElement('div');
        node.className = 'start-preview-node';
        node.style.left = `${Math.round(entry.x)}px`;
        node.style.top = `${Math.round(entry.y)}px`;
        node.style.width = `${Math.max(8, Math.round(entry.w))}px`;
        node.style.height = `${Math.max(8, Math.round(entry.h))}px`;

        if (entry.type === 'text') {
            node.style.color = entry.color || '#ffffff';
            node.style.fontSize = `${Math.max(8, parseNumber(entry.fontSize, 24))}px`;
            node.style.textAlign = 'center';
            node.style.whiteSpace = 'pre-wrap';
            node.style.lineHeight = '1.2';
            node.style.padding = '4px';
            node.textContent = entry.text || '';
        } else if (entry.type === 'plugin') {
            node.style.border = '1px solid #88baf0';
            node.style.background = 'rgba(20,40,70,0.45)';
            node.style.color = '#bfe1ff';
            node.style.fontSize = '14px';
            node.textContent = ATTRACT_PLUGIN_PRESETS[entry.pluginId]?.label || entry.text || 'Plugin';
        } else {
            const img = document.createElement('img');
            img.src = entry.src || '';
            img.alt = entry.id;
            node.appendChild(img);
        }

        stage.appendChild(node);
        animatePreviewNode(node, entry);
    });

    // Soft auto-stop to avoid runaway preview loops when left open.
    START_EDITOR_STATE.previewTimer = setTimeout(() => {
        START_EDITOR_STATE.previewTimer = null;
    }, 120000);
}

function removeSelectedStartElement() {
    const cfg = START_EDITOR_STATE.loadedStart;
    if (!cfg || !cfg.attractMode) return;
    const id = START_EDITOR_STATE.selectedElementId;
    if (!id) {
        setStartStatus('Nessun elemento selezionato.', true);
        return;
    }
    const prevLen = cfg.attractMode.elements.length;
    cfg.attractMode.elements = cfg.attractMode.elements.filter((it) => it.id !== id);
    if (cfg.attractMode.elements.length === prevLen) return;
    cfg.attractMode.elements.forEach((it, idx) => {
        it.order = idx;
    });
    START_EDITOR_STATE.selectedElementId = cfg.attractMode.elements[0]?.id || null;
    applyStartFormFromState();
    setStartStatus('Elemento rimosso.');
}

function updateSelectedStartElementFromInputs() {
    const selected = getSelectedStartElement();
    if (!selected) return;

    selected.x = Math.max(0, parseNumber(el('startElementX')?.value, selected.x));
    selected.y = Math.max(0, parseNumber(el('startElementY')?.value, selected.y));
    selected.w = Math.max(8, parseNumber(el('startElementW')?.value, selected.w));
    selected.h = Math.max(8, parseNumber(el('startElementH')?.value, selected.h));
    selected.effect = String(el('startElementEffect')?.value || selected.effect || 'none').trim() || 'none';
    selected.color = String(el('startElementColor')?.value || selected.color || '#ffffff').trim() || '#ffffff';
    selected.fontSize = Math.max(8, parseNumber(el('startElementFontSize')?.value, selected.fontSize || 24));
    selected.delayMs = Math.max(0, parseNumber(el('startElementDelayMs')?.value, selected.delayMs || 0));
    selected.durationMs = Math.max(0, parseNumber(el('startElementDurationMs')?.value, selected.durationMs || 1000));
    selected.text = String(el('startElementText')?.value || selected.text || '').trim();

    renderStartAttractStage();
    renderStartTimelineList();
}

function collectStartConfigFromForm() {
    const cfg = START_EDITOR_STATE.loadedStart || deepClone(START_EDITOR_DEFAULT);
    cfg.startup.enableFrontScenes = !!el('startEnableFrontScenes')?.checked;
    cfg.startup.coinMode = sanitizeStartCoinMode(el('startCoinMode')?.value);
    cfg.startup.initialCredits = Math.max(0, Math.floor(parseNumber(el('startInitialCredits')?.value, 0)));
    cfg.attractMode.enabled = !!el('startAttractEnabled')?.checked;
    cfg.attractMode.canvas.width = Math.max(320, Math.floor(parseNumber(el('startCanvasWidth')?.value, 800)));
    cfg.attractMode.canvas.height = Math.max(200, Math.floor(parseNumber(el('startCanvasHeight')?.value, 600)));
    cfg.attractMode.elements = (Array.isArray(cfg.attractMode.elements) ? cfg.attractMode.elements : [])
        .map((it, idx) => normalizeStartElement(it, idx))
        .sort((a, b) => a.order - b.order);
    syncStartPluginsFromElements();
    START_EDITOR_STATE.loadedStart = cfg;
    return normalizeStartConfig(cfg);
}

async function loadStartEditor() {
    const candidates = buildStaticPathCandidates(START_JSON_PATH);
    let loaded = null;
    let source = '';
    let lastError = null;

    for (const candidate of candidates) {
        try {
            const resp = await fetch(candidate, { cache: 'no-store' });
            if (!resp.ok) {
                lastError = new Error(`HTTP ${resp.status} su ${candidate}`);
                continue;
            }
            loaded = await resp.json();
            source = candidate;
            break;
        } catch (err) {
            lastError = err;
        }
    }

    if (!loaded) {
        loaded = deepClone(START_EDITOR_DEFAULT);
        source = 'default';
    }

    START_EDITOR_STATE.loadedStart = normalizeStartConfig(loaded);

    try {
        const attractList = await fetchJsonListWithFallback(buildApiUrl('images/attractmode'), 'data/images-scenes-attractmode.json');
        START_EDITOR_STATE.attractAssets = Array.isArray(attractList) ? attractList : [];
    } catch (_e) {
        START_EDITOR_STATE.attractAssets = [];
    }

    const assetsSelect = el('startAttractAssetSelect');
    if (assetsSelect) {
        assetsSelect.innerHTML = '<option value="">(nessuna)</option>';
        START_EDITOR_STATE.attractAssets.forEach((path) => {
            const value = String(path || '').trim();
            if (!value) return;
            const op = document.createElement('option');
            op.value = value;
            op.textContent = value.split('/').pop() || value;
            assetsSelect.appendChild(op);
        });
    }

    applyStartFormFromState();
    if (source === 'default' && lastError) {
        setStartStatus(`start.json non trovato: uso default (${lastError.message}).`, true);
    } else {
        setStartStatus(`Configurazione start caricata da ${source}.`);
    }
}

async function saveStartEditor() {
    try {
        const payload = collectStartConfigFromForm();
        const resp = await fetch(buildApiUrl('start'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const body = await resp.json().catch(() => ({}));
        if (!resp.ok || body.ok === false) {
            throw new Error(body.error || `HTTP ${resp.status}`);
        }
        const backupFile = body.backupFile ? ` Backup: ${body.backupFile}` : '';
        setStartStatus(`start.json salvato.${backupFile}`);
    } catch (e) {
        setStartStatus(`Errore salvataggio start.json: ${e.message}`, true);
    }
}

function bindStartEditorInteractions() {
    const stage = el('startAttractStage');
    if (!stage || stage.dataset.boundStartDrag === '1') return;
    stage.dataset.boundStartDrag = '1';

    window.addEventListener('pointermove', (ev) => {
        const drag = START_EDITOR_STATE.drag;
        if (!drag.active || !drag.elementId) return;
        const selected = getSelectedStartElement();
        if (!selected || selected.id !== drag.elementId) return;

        const cfg = START_EDITOR_STATE.loadedStart;
        const canvasW = Math.max(320, parseNumber(cfg?.attractMode?.canvas?.width, 800));
        const canvasH = Math.max(200, parseNumber(cfg?.attractMode?.canvas?.height, 600));

        const nextX = drag.baseX + (ev.clientX - drag.startX);
        const nextY = drag.baseY + (ev.clientY - drag.startY);
        if (drag.mode === 'resize') {
            const nextW = drag.baseW + (ev.clientX - drag.startX);
            const nextH = drag.baseH + (ev.clientY - drag.startY);
            selected.w = clamp(Math.round(nextW), 8, Math.max(8, canvasW - selected.x));
            selected.h = clamp(Math.round(nextH), 8, Math.max(8, canvasH - selected.y));
        } else {
            selected.x = clamp(Math.round(nextX), 0, Math.max(0, canvasW - selected.w));
            selected.y = clamp(Math.round(nextY), 0, Math.max(0, canvasH - selected.h));
        }

        renderStartAttractStage();
        renderStartElementInputs();
    });

    window.addEventListener('pointerup', () => {
        START_EDITOR_STATE.drag.active = false;
        START_EDITOR_STATE.drag.mode = 'move';
        START_EDITOR_STATE.drag.elementId = null;
    });
}

function tokenToMiniMapColor(token) {
    const raw = String(token ?? '').trim().toLowerCase();
    if (/^exit(\[[^\]]+\])?$/.test(raw)) return '#526f9f';
    if (/^(?:bck|back|back_level)(\[[^\]]+\])?$/.test(raw)) return '#526f9f';
    const normalized = normalizeToken(token);
    if (normalized === '-') return '#0f1f3e';
    if (normalized === 'f') return '#2f4f67';
    if (normalized === 'h') return '#101010';
    if (normalized === 's') return '#27103d';
    if (normalized === 'g') return '#1f3f88';
    if (normalized === 'd') return '#7f5a22';
    if (normalized === 'k') return '#8f7918';
    if (normalized === 'p' || normalized === 'l' || normalized === 'heart') return '#a05e1e';
    if (normalized === 'b') return '#8e2d2d';
    if (normalized === 'c') return '#2b8a8a';
    if (normalized === 'm') return '#6a6a6a';
    if (normalized === 'ghost') return '#64e1d8';
    if (normalized === 'bat') return '#7a58d1';
    if (WALL_TOKEN_REGEX.test(normalized)) return '#4b5f80';
    return '#526f9f';
}

function normalizeToken(token) {
    const raw = String(token ?? '-').trim();
    if (!raw) return '-';
    // Allow token mapping via global CONFIG.tokenMap (loaded from data/config.json)
    try {
        const cfgMap = (typeof window !== 'undefined' && window.CONFIG && window.CONFIG.tokenMap) ? window.CONFIG.tokenMap : null;
        if (cfgMap && typeof cfgMap === 'object') {
            // try exact, lower and upper keys; avoid infinite recursion if mapping equals raw
            const tryKeys = [raw, raw.toLowerCase(), raw.toUpperCase()];
            for (let k of tryKeys) {
                if (k && cfgMap[k] && String(cfgMap[k]).trim() !== raw) {
                    return normalizeToken(String(cfgMap[k]));
                }
            }
        }
    } catch (e) { /* ignore */ }
    if (raw === 'w') return 'w0000';
    // accept full tokens wRCRF (row, col, rot, flip)
    const wallMatch4 = raw.match(/^w(\d)(\d)(\d)([hv0])$/i);
    if (wallMatch4) {
        const row = clamp(Number(wallMatch4[1]), 0, 3);
        const col = clamp(Number(wallMatch4[2]), 0, 5);
        const rot = ((Number(wallMatch4[3]) % 4) + 4) % 4;
        const flip = String(wallMatch4[4]).toLowerCase() === 'h' ? 'h' : (String(wallMatch4[4]).toLowerCase() === 'v' ? 'v' : '0');
        return `w${row}${col}${rot}${flip}`;
    }
    // accept legacy 3-digit tokens wRCR (row, col, rot)
    const wallMatch3 = raw.match(/^w(\d)(\d)(\d)$/i);
    if (wallMatch3) {
        const row = clamp(Number(wallMatch3[1]), 0, 3);
        const col = clamp(Number(wallMatch3[2]), 0, 5);
        const rot = ((Number(wallMatch3[3]) % 4) + 4) % 4;
        return `w${row}${col}${rot}0`;
    }
    // fallback: accept legacy 2-digit tokens wFR (frame, rot) and convert to new scheme
    const wallMatch2 = raw.match(/^w(\d)(\d)$/i);
    if (wallMatch2) {
        const frame = clamp(Number(wallMatch2[1]), 0, 6);
        const rot = ((Number(wallMatch2[2]) % 4) + 4) % 4;
        // map legacy frame -> row/col. Prefer row 0 for frames 0..5, frame 6 -> row1 col0
        let row = 0;
        let col = frame;
        if (col > 5) { row = 1; col = Math.max(0, frame - 6); }
        col = clamp(col, 0, 5);
        return `w${row}${col}${rot}0`;
    }
    return raw;
}

function rotateWallToken(token, delta) {
    const normalized = normalizeToken(token);
    const match = normalized.match(WALL_TOKEN_REGEX);
    if (!match) return normalized;
    const row = Number(match[1]);
    const col = Number(match[2]);
    const rot = ((Number(match[3]) + delta) % 4 + 4) % 4; // only cycle 0..3 for rotation
    const flip = match[4] ? String(match[4]).toLowerCase() : '0';
    return `w${row}${col}${rot}${flip}`;
}

function splitToken(tokenString) {
    const token = String(tokenString ?? '-').trim();
    const slash = token.indexOf('/');
    if (slash <= 0 || slash >= token.length - 1) {
        return { base: normalizeToken(token), reveal: null };
    }
    return {
        base: normalizeToken(token.slice(0, slash)),
        reveal: normalizeToken(token.slice(slash + 1))
    };
}

function joinToken(base, reveal) {
    const b = normalizeToken(base);
    const r = reveal ? normalizeToken(reveal) : null;
    return r ? `${b}/${r}` : b;
}

function parseDecoratedToken(tokenInput) {
    let raw = String(tokenInput ?? '').trim();
    if (!raw) {
        return {
            raw: '',
            base: '',
            target: '',
            effects: '',
            invisible: false
        };
    }

    let invisible = false;
    if (raw.endsWith('.')) {
        invisible = true;
        raw = raw.slice(0, -1).trim();
    }

    let effects = '';
    const effectsMatch = raw.match(/\((.*)\)$/);
    if (effectsMatch) {
        effects = String(effectsMatch[1] || '').trim();
        raw = raw.slice(0, effectsMatch.index).trim();
    }

    let target = '';
    let base = raw;
    const targetMatch = raw.match(/^(.*)\[([^\]]+)\]$/);
    if (targetMatch) {
        base = String(targetMatch[1] || '').trim();
        target = String(targetMatch[2] || '').trim();
    }

    return {
        raw: String(tokenInput ?? '').trim(),
        base,
        target,
        effects,
        invisible
    };
}

function composeDecoratedToken(meta) {
    const safeBase = String(meta?.base || '').trim();
    if (!safeBase) return '-';

    let out = safeBase;
    const target = String(meta?.target || '').trim();
    if (target && /^(exit|back|bck|back_level)$/i.test(safeBase)) {
        out += `[${target}]`;
    }

    const effects = String(meta?.effects || '').trim();
    if (effects) {
        out += `(${effects})`;
    }

    if (meta?.invisible) {
        out += '.';
    }
    return out;
}

function getRenderableTokenBase(tokenInput) {
    return parseDecoratedToken(tokenInput).base || String(tokenInput || '').trim();
}

function splitEffectsList(text) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const out = [];
    let cur = '';
    let braceDepth = 0;
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
        if (ch === ',' && braceDepth === 0) {
            if (cur.trim()) out.push(cur.trim());
            cur = '';
            continue;
        }
        cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

const EDITOR_EFFECT_LIBRARY_STATE = {
    effects: [],
    source: ''
};

function parseEditorEffectManifestEntries(manifest) {
    const root = (manifest && typeof manifest === 'object') ? manifest : {};
    const list = Array.isArray(root)
        ? root
        : (Array.isArray(root.effects) ? root.effects : []);

    const out = [];
    list.forEach((entry) => {
        if (typeof entry === 'string') {
            const name = String(entry || '').trim().toLowerCase();
            if (name) out.push({ name, source: 'manifest' });
            return;
        }
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
        const name = String(entry.name ?? entry.key ?? entry.id ?? '').trim().toLowerCase();
        if (!name) return;
        out.push({
            name,
            aliases: Array.isArray(entry.aliases) ? entry.aliases.map((a) => String(a || '').trim().toLowerCase()).filter(Boolean) : [],
            source: String(entry.entry ?? entry.file ?? entry.path ?? '').trim() || 'manifest'
        });
    });

    const unique = [];
    const seen = new Set();
    out.forEach((it) => {
        if (!it?.name || seen.has(it.name)) return;
        seen.add(it.name);
        unique.push(it);
    });
    return unique;
}

function setEffectLibraryStatus(message, isError = false) {
    const target = el('effectLibraryStatus');
    if (!target) return;
    target.style.color = isError ? '#ff8f9a' : '#9de8ff';
    target.textContent = message;
}

function appendEffectNameToSelection(effectName) {
    const clean = String(effectName || '').trim().toLowerCase();
    if (!clean) return;

    const knownChecks = {
        lamp: el('selectedFxLamp'),
        pulse: el('selectedFxPulse'),
        float: el('selectedFxFloat'),
        halo: el('selectedFxHalo'),
        outline: el('selectedFxOutline')
    };

    if (knownChecks[clean]) {
        knownChecks[clean].checked = true;
        refreshSelectedEffectsPreview();
        return;
    }

    const customInput = el('selectedTokenEffectsCustom');
    if (!customInput) return;
    const entries = splitEffectsList(customInput.value || '');
    if (!entries.includes(clean)) {
        entries.push(clean);
        customInput.value = entries.join(',');
    }
    refreshSelectedEffectsPreview();
}

function renderEffectLibraryButtons() {
    const container = el('effectLibraryList');
    if (!container) return;
    container.innerHTML = '';

    if (!Array.isArray(EDITOR_EFFECT_LIBRARY_STATE.effects) || !EDITOR_EFFECT_LIBRARY_STATE.effects.length) {
        return;
    }

    EDITOR_EFFECT_LIBRARY_STATE.effects.forEach((entry) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icon-btn';
        btn.textContent = `+ ${entry.name}`;
        btn.title = entry.aliases?.length
            ? `Alias: ${entry.aliases.join(', ')}`
            : `Applica effetto ${entry.name}`;
        btn.addEventListener('click', () => {
            appendEffectNameToSelection(entry.name);
            setStatus(`Effetto ${entry.name} aggiunto al token selezionato.`);
        });
        container.appendChild(btn);
    });
}

async function loadEffectLibraryForEditor() {
    const candidates = ['data/library/manifest.json', 'data/library/manifest.json'];
    for (const p of candidates) {
        try {
            const resp = await fetch(p, { cache: 'no-store' });
            if (!resp.ok) continue;
            const manifest = await resp.json();
            const effects = parseEditorEffectManifestEntries(manifest);
            EDITOR_EFFECT_LIBRARY_STATE.effects = effects;
            EDITOR_EFFECT_LIBRARY_STATE.source = p;
            renderEffectLibraryButtons();
            setEffectLibraryStatus(
                effects.length
                    ? `Caricati ${effects.length} effetti da ${p}.`
                    : `Manifest caricato (${p}) ma senza effetti.`,
                effects.length === 0
            );
            return effects;
        } catch (_e) {
            // continue with next candidate
        }
    }

    EDITOR_EFFECT_LIBRARY_STATE.effects = [];
    EDITOR_EFFECT_LIBRARY_STATE.source = '';
    renderEffectLibraryButtons();
    setEffectLibraryStatus('Manifest libreria effetti non trovato (data/library/manifest.json).', true);
    return [];
}

function parseEffectEntry(entry) {
    const raw = String(entry || '').trim();
    if (!raw) return { name: '', options: {} };
    const match = raw.match(/^([a-zA-Z0-9_\-]+)(?:\{(.*)\})?$/);
    if (!match) return { name: raw.toLowerCase(), options: {} };

    const name = String(match[1] || '').trim().toLowerCase();
    const body = String(match[2] || '').trim();
    if (!body) return { name, options: {} };

    const options = {};
    body.split(/[;,]/).forEach((piece) => {
        const token = String(piece || '').trim();
        if (!token) return;
        const kv = token.split(/[:=]/);
        const key = String(kv[0] || '').trim();
        const value = String(kv.slice(1).join(':') || '').trim();
        if (!key || !value) return;
        options[key] = value;
    });

    return { name, options };
}

function clearGuidedEffectOptionInputs() {
    [
        'selectedLampRadius',
        'selectedLampColor',
        'selectedPulseScale',
        'selectedPulseDuration',
        'selectedFloatAmplitude',
        'selectedFloatDuration',
        'selectedHaloRadius',
        'selectedHaloColor',
        'selectedOutlineThickness',
        'selectedOutlineColor'
    ].forEach((id) => {
        const node = el(id);
        if (node) node.value = '';
    });
}

function buildEffectEntry(name, options = {}) {
    const keys = Object.keys(options).filter((k) => String(options[k] || '').trim() !== '');
    if (!keys.length) return name;
    const body = keys.map((k) => `${k}:${String(options[k]).trim()}`).join(';');
    return `${name}{${body}}`;
}

function buildSelectedEffectsFromControls() {
    const known = [];
    if (el('selectedFxLamp')?.checked) {
        known.push(buildEffectEntry('lamp', {
            radiusTiles: el('selectedLampRadius')?.value,
            color: el('selectedLampColor')?.value
        }));
    }
    if (el('selectedFxPulse')?.checked) {
        known.push(buildEffectEntry('pulse', {
            scale: el('selectedPulseScale')?.value,
            duration: el('selectedPulseDuration')?.value
        }));
    }
    if (el('selectedFxFloat')?.checked) {
        known.push(buildEffectEntry('float', {
            amplitudeTiles: el('selectedFloatAmplitude')?.value,
            duration: el('selectedFloatDuration')?.value
        }));
    }
    if (el('selectedFxHalo')?.checked) {
        known.push(buildEffectEntry('halo', {
            radiusTiles: el('selectedHaloRadius')?.value,
            color: el('selectedHaloColor')?.value
        }));
    }
    if (el('selectedFxOutline')?.checked) {
        known.push(buildEffectEntry('outline', {
            thickness: el('selectedOutlineThickness')?.value,
            color: el('selectedOutlineColor')?.value
        }));
    }

    const custom = splitEffectsList(el('selectedTokenEffectsCustom')?.value || '');
    const combined = [...known, ...custom].filter(Boolean);
    return combined.join(',');
}

function refreshSelectedEffectsPreview() {
    const toggle = (checkId, groupId) => {
        const group = el(groupId);
        if (!group) return;
        const enabled = !!el(checkId)?.checked;
        group.style.display = enabled ? '' : 'none';
    };

    toggle('selectedFxLamp', 'selectedLampOptions');
    toggle('selectedFxPulse', 'selectedPulseOptions');
    toggle('selectedFxFloat', 'selectedFloatOptions');
    toggle('selectedFxHalo', 'selectedHaloOptions');
    toggle('selectedFxOutline', 'selectedOutlineOptions');

    const preview = el('selectedTokenEffects');
    if (!preview) return;
    preview.value = buildSelectedEffectsFromControls();
}

function buildObjectsEffectsFromWizard() {
    const out = {};

    const pushIfEnabled = (name, enabledId, fieldMap) => {
        if (!el(enabledId)?.checked) return;
        const cfg = { enabled: true };
        Object.keys(fieldMap).forEach((k) => {
            const node = el(fieldMap[k]);
            const raw = String(node?.value ?? '').trim();
            if (!raw) return;
            const num = Number(raw);
            cfg[k] = Number.isFinite(num) ? num : raw;
        });
        out[name] = cfg;
    };

    pushIfEnabled('lamp', 'objFxLampEnabled', {
        radiusTiles: 'objFxLampRadius',
        color: 'objFxLampColor'
    });
    pushIfEnabled('pulse', 'objFxPulseEnabled', {
        scale: 'objFxPulseScale',
        duration: 'objFxPulseDuration'
    });
    pushIfEnabled('float', 'objFxFloatEnabled', {
        amplitudeTiles: 'objFxFloatAmplitude',
        duration: 'objFxFloatDuration'
    });
    pushIfEnabled('halo', 'objFxHaloEnabled', {
        radiusTiles: 'objFxHaloRadius',
        color: 'objFxHaloColor'
    });
    pushIfEnabled('outline', 'objFxOutlineEnabled', {
        thickness: 'objFxOutlineThickness',
        color: 'objFxOutlineColor'
    });

    return out;
}

function applyObjectsEffectsWizard(objectsEffects) {
    const root = (objectsEffects && typeof objectsEffects === 'object' && !Array.isArray(objectsEffects)) ? objectsEffects : {};

    const applyOne = (name, enabledId, fields) => {
        const cfg = (root[name] && typeof root[name] === 'object' && !Array.isArray(root[name])) ? root[name] : null;
        const enabled = !!(cfg && cfg.enabled !== false);
        if (el(enabledId)) el(enabledId).checked = enabled;
        Object.keys(fields).forEach((k) => {
            const node = el(fields[k]);
            if (!node) return;
            node.value = cfg && cfg[k] != null ? String(cfg[k]) : '';
        });
    };

    applyOne('lamp', 'objFxLampEnabled', {
        radiusTiles: 'objFxLampRadius',
        color: 'objFxLampColor'
    });
    applyOne('pulse', 'objFxPulseEnabled', {
        scale: 'objFxPulseScale',
        duration: 'objFxPulseDuration'
    });
    applyOne('float', 'objFxFloatEnabled', {
        amplitudeTiles: 'objFxFloatAmplitude',
        duration: 'objFxFloatDuration'
    });
    applyOne('halo', 'objFxHaloEnabled', {
        radiusTiles: 'objFxHaloRadius',
        color: 'objFxHaloColor'
    });
    applyOne('outline', 'objFxOutlineEnabled', {
        thickness: 'objFxOutlineThickness',
        color: 'objFxOutlineColor'
    });
}

class LevelEditorScene extends Phaser.Scene {
    constructor() {
        super('LevelEditorScene');
        this.cols = 12;
        this.rows = 12;
        this.cellSize = 64;
        this.baseCellSize = 64; // cell size without zoom (overridable by slider)
        this.zoom = 2; // default start zoom (2x) to show enlarged map
        this.gridOffsetX = 18;
        this.gridOffsetY = 18;
        this.gridPadding = 18; // fixed padding used for layout and scrolling math
        // these will be computed from the actual canvas size on create / resize
        this.gridAreaWidth = 0;
        this.gridAreaHeight = 0;
        this.cells = [];
        this.selectedCell = null;
        this.selectedTokenIndex = 0;
        this.paletteItems = [];
        this.lastBrushToken = 'w0000';
        this._dragNoTile = false; // true when user holds '.' while dragging to mark invisible
    }

    preload() {
        const objectsCatalogCandidates = buildStaticPathCandidates(OBJECTS_JSON_PATH);

        objectsCatalogCandidates.forEach((url, idx) => {
            const key = `objects_catalog_preload_${idx}`;
            this.load.json(key, url);
        });

        if (!this.__objectsCatalogPreloadBound) {
            this.__objectsCatalogPreloadBound = true;
            this.__objectsCatalogPreloadResolved = false;

            this.load.on('filecomplete', (key, type, data) => {
                if (type !== 'json') return;
                if (!String(key || '').startsWith('objects_catalog_preload_')) return;
                if (this.__objectsCatalogPreloadResolved) return;

                const list = Array.isArray(data) ? data : [];
                if (!list.length) return;

                this.__objectsCatalogPreloadResolved = true;

                try {
                    OBJECT_MAP_EDITOR_STATE.items = list.map((it) => normalizeObjectMapping(it));
                    refreshObjectMappingsAvailability();
                } catch (e) { /* ignore */ }

                try {
                    queueObjectMappingsSpritesheets(this, list);
                } catch (e) { /* ignore */ }
            });
        }

        // preload possible game backgrounds so the editor can offer them
        // Fallback default background (game_bg.png is not present in this repo)
        this.load.image('game_bg', 'images/attract_bg.png');
        // load all discovered numeric level backgrounds
        try {
            (AVAILABLE_BG_LEVELS || []).forEach((n) => {
                this.load.image(`game_bg_${String(n)}`, `images/level${String(n)}.png`);
            });
        } catch (e) { /* ignore */ }
    }

    create() {
        this.input.mouse?.disableContextMenu();
        // Darker background to increase tile visibility
        this.cameras.main.setBackgroundColor('#03050a');

        this.gridLayer = this.add.container(0, 0);
        this.paletteLayer = this.add.container(0, 0);
        this.selectionLayer = this.add.container(0, 0);

        this.resetGrid(this.cols, this.rows);
        // initialize tile size slider (if present in DOM)
        try {
            const tileSlider = el('tileSizeSlider');
            const tileValue = el('tileSizeValue');
            if (tileSlider) {
                // set initial display
                tileValue && (tileValue.textContent = `${tileSlider.value} px`);
                tileSlider.addEventListener('input', () => {
                    try {
                        tileValue && (tileValue.textContent = `${tileSlider.value} px`);
                        const v = Number(tileSlider.value) || 64;
                        this.setTileBaseSize(v);
                        // If auto-grid-from-bg is enabled, recompute cols/rows based on the
                        // background image natural size and the new tile size. Otherwise
                        // update background without auto-grid.
                        try {
                            const autoChk = el('autoGridFromBg');
                            if (autoChk && autoChk.checked) {
                                this.updateEditorBackgroundImage();
                            } else {
                                this.updateEditorBackgroundImage(true);
                            }
                        } catch (e) { try { this.updateEditorBackgroundImage(true); } catch(e){} }
                    } catch (e) { }
                });
            }
        } catch (e) { }
        this.createPalette();
        this.setupInputHandlers();
        this.setupScrollbars();
        this.renderGrid();

        // populate background select with available backgrounds
        try {
            this.populateBackgroundOptions();
        } catch (e) {
            // ignore
        }
        // ensure editor background image is created/updated
        try { this.updateEditorBackgroundImage(); } catch (e) { /* ignore */ }

        // Recompute layout on resize (Phaser RESIZE mode will update this.scale)
        this.scale.on('resize', (gameSize) => {
            const w = (gameSize && gameSize.width) ? gameSize.width : this.scale.width;
            const h = (gameSize && gameSize.height) ? gameSize.height : this.scale.height;
            this.onResize(w, h);
        }, this);

        // Fallback window resize
        window.addEventListener('resize', () => this.onResize(this.scale.width, this.scale.height));

        window.__levelEditorScene = this;
        window.dispatchEvent(new CustomEvent('level-editor-ready'));
    }

    populateBackgroundOptions() {
        const sel = el('levelBackground');
        if (!sel) return;
        // clear existing options
        sel.innerHTML = '';
        const addOption = (value, label) => {
            const o = document.createElement('option');
            o.value = value;
            o.textContent = label;
            sel.appendChild(o);
        };

        addOption('', '(default)');
        // prefer numbered level backgrounds if textures exist
        try {
            (AVAILABLE_BG_LEVELS || []).forEach((n) => {
                const key = `game_bg_${String(n)}`;
                if (this.textures.exists(key)) {
                    addOption(String(n), `level${String(n)}`);
                }
            });
        } catch (e) { /* ignore */ }
        // add generic game_bg if present and not already represented
        if (this.textures.exists('game_bg')) {
            addOption('game_bg', 'game_bg');
        }
    }

    getBackgroundKeyFromValue(val) {
        if (!val) return null;
        if (/^\d+$/.test(String(val))) {
            const k = `game_bg_${String(val)}`;
            return this.textures.exists(k) ? k : null;
        }
        if (this.textures.exists(val)) return val;
        // fallback: try game_bg
        return this.textures.exists('game_bg') ? 'game_bg' : null;
    }

    updateEditorBackgroundImage(skipAutoGrid = false) {
        const show = !!el('showBackground')?.checked;
        const showForeground = !!el('showForeground')?.checked;
        const destroyEditorBackgrounds = () => {
            try {
                if (Array.isArray(this.editorBgImages)) {
                    this.editorBgImages.forEach((img) => {
                        try { img.destroy(); } catch (e) { }
                    });
                }
            } catch (e) { }
            this.editorBgImages = [];
            this.editorBgImage = null;
        };

        const destroyEditorForegrounds = () => {
            try {
                if (Array.isArray(this.editorFgImages)) {
                    this.editorFgImages.forEach((img) => {
                        try { img.destroy(); } catch (e) { }
                    });
                }
            } catch (e) { }
            this.editorFgImages = [];
            this.editorFgImage = null;
        };

        const resolveBgLayerSrc = (layer) => {
            if (!layer) return '';
            const srcRaw = layer.src;
            if (typeof srcRaw === 'number') return String(srcRaw);
            return String(srcRaw || '').trim();
        };

        const resolveBgTextureKey = (src, idx) => {
            const raw = String(src || '').trim();
            if (!raw) return null;
            if (/^\d+$/.test(raw)) {
                const numbered = `game_bg_${raw}`;
                return this.textures.exists(numbered) ? numbered : null;
            }
            if (this.textures.exists(raw)) return raw;

            const safeKey = `editor_bg_${idx}_${raw.replace(/[^a-z0-9_.-]+/gi, '_')}`;
            if (this.textures.exists(safeKey)) return safeKey;

            try {
                this.load.image(safeKey, raw);
                this.load.once('complete', () => {
                    try { this.updateEditorBackgroundImage(skipAutoGrid); } catch (e) { }
                });
                this.load.start();
            } catch (e) { }
            return null;
        };

        const resolveFgLayerSrc = (layer) => {
            if (!layer) return '';
            return String(layer.src || '').trim();
        };

        const resolveFgTextureKey = (src, idx) => {
            const raw = String(src || '').trim();
            if (!raw) return null;
            if (this.textures.exists(raw)) return raw;

            const safeKey = `editor_fg_${idx}_${raw.replace(/[^a-z0-9_.-]+/gi, '_')}`;
            if (this.textures.exists(safeKey)) return safeKey;

            try {
                this.load.image(safeKey, raw);
                this.load.once('complete', () => {
                    try { this.updateEditorBackgroundImage(skipAutoGrid); } catch (e) { }
                });
                this.load.start();
            } catch (e) { }
            return null;
        };

        const domLayers = readBackgroundLayersFromDOM();
        let bgLayers = Array.isArray(domLayers) ? domLayers.slice() : [];
        if (!bgLayers.length) {
            const val = String(el('levelBackground')?.value ?? '').trim();
            const fallbackKey = this.getBackgroundKeyFromValue(val);
            if (fallbackKey) {
                bgLayers = [{ src: fallbackKey, parallaxBgAlpha: 1, enabled: true }];
            }
        }

        const enabledLayers = bgLayers.filter((ly) => ly && ly.enabled !== false && resolveBgLayerSrc(ly));

        if (!show || !enabledLayers.length) {
            destroyEditorBackgrounds();
        } else {
            const primaryLayer = enabledLayers[0];
            const primaryKey = resolveBgTextureKey(resolveBgLayerSrc(primaryLayer), 0);
            if (!primaryKey) {
                destroyEditorBackgrounds();
            } else {

                // If an actual texture frame exists and the user requested auto-grid-from-bg,
                // compute cols/rows from the natural background size assuming 64x64 cells.
                // Passing `skipAutoGrid=true` prevents this behavior (useful when the user
                // is only changing tile size and doesn't want cols/rows recomputed).
                try {
                    const autoChk = el('autoGridFromBg');
                    if (!skipAutoGrid && autoChk && autoChk.checked) {
                        const frame = this.textures.getFrame(primaryKey, 0);
                        if (frame && Number.isFinite(frame.cutWidth) && Number.isFinite(frame.cutHeight)) {
                            // Use the configured tile size (pixel dimension) when computing cols/rows.
                            const tileSizeInput = Number(el('tileSizeSlider')?.value) || 64;
                            const nCols = clamp(Math.floor(Number(frame.cutWidth) / tileSizeInput), 4, 120);
                            const nRows = clamp(Math.floor(Number(frame.cutHeight) / tileSizeInput), 4, 120);
                            if (nCols > 0 && nRows > 0 && (nCols !== this.cols || nRows !== this.rows)) {
                                const colsEl = el('gridCols');
                                const rowsEl = el('gridRows');
                                if (colsEl) colsEl.value = String(nCols);
                                if (rowsEl) rowsEl.value = String(nRows);
                                // Apply grid but skip bg update inside resetGrid to avoid recursion
                                try { this.resetGrid(nCols, nRows, true); } catch (e) { /* ignore */ }
                            }
                        }
                    }
                } catch (e) {
                    // ignore any issues while probing textures
                }

                const gridW = this.cellSize * this.cols;
                const gridH = this.cellSize * this.rows;
                destroyEditorBackgrounds();
                this.editorBgImages = [];

                const buildRepeatCount = (raw, span, step) => {
                    const parsed = parseRepeatValue(raw, 1);
                    if (parsed !== '*') return parsed;
                    const safeStep = Math.max(1, Math.abs(step || span));
                    return Math.max(1, Math.ceil(span / safeStep) + 2);
                };

                enabledLayers.forEach((layer, idx) => {
                    const textureKey = resolveBgTextureKey(resolveBgLayerSrc(layer), idx);
                    if (!textureKey) return;

                    const alpha = parseNumber(layer.parallaxBgAlpha, 1);
                    const offsetX = parseNumber(layer.offsetX ?? layer.left ?? layer.x ?? layer.positionX, 0);
                    const offsetY = parseNumber(layer.offsetY ?? layer.top ?? layer.y ?? layer.positionY, 0);

                    const stepX = parseNumber(layer.repeatStepX ?? layer.replicaStepX ?? layer.repeatOffsetX ?? layer.replicaOffsetX, gridW) || gridW;
                    const stepY = parseNumber(layer.repeatStepY ?? layer.replicaStepY ?? layer.repeatOffsetY ?? layer.replicaOffsetY, gridH) || gridH;

                    const countX = buildRepeatCount(layer.repeatX ?? layer.replicaX ?? layer.repeatCountX ?? layer.replicaCountX ?? 1, gridW + Math.abs(offsetX), stepX);
                    const countY = buildRepeatCount(layer.repeatY ?? layer.replicaY ?? layer.repeatCountY ?? layer.replicaCountY ?? 1, gridH + Math.abs(offsetY), stepY);

                    for (let iy = 0; iy < countY; iy++) {
                        for (let ix = 0; ix < countX; ix++) {
                            const img = this.add.image(0, 0, textureKey).setDepth(-500 - idx);
                            const x = this.gridOffsetX + offsetX + (stepX * ix) + gridW / 2;
                            const y = this.gridOffsetY + offsetY + (stepY * iy) + gridH / 2;
                            img.setDisplaySize(gridW, gridH);
                            img.setPosition(x, y);
                            img.setAlpha(clamp(alpha, 0, 1));
                            this.editorBgImages.push(img);
                        }
                    }
                });

                this.editorBgImage = this.editorBgImages.length ? this.editorBgImages[0] : null;
            }
        }
        const gridW = this.cellSize * this.cols;
        const gridH = this.cellSize * this.rows;
        const buildRepeatCount = (raw, span, step) => {
            const parsed = parseRepeatValue(raw, 1);
            if (parsed !== '*') return parsed;
            const safeStep = Math.max(1, Math.abs(step || span));
            return Math.max(1, Math.ceil(span / safeStep) + 2);
        };

        const domFgLayers = readForegroundLayersFromDOM();
        const enabledFgLayers = Array.isArray(domFgLayers)
            ? domFgLayers.filter((ly) => ly && ly.enabled !== false && resolveFgLayerSrc(ly))
            : [];

        destroyEditorForegrounds();
        if (!showForeground || !enabledFgLayers.length) {
            return;
        }

        enabledFgLayers.forEach((layer, idx) => {
            const textureKey = resolveFgTextureKey(resolveFgLayerSrc(layer), idx);
            if (!textureKey) return;

            const alpha = parseNumber(layer.parallaxFgAlpha, 1);
            const offsetX = parseNumber(layer.offsetX ?? layer.left ?? layer.x ?? layer.positionX, 0);
            const offsetY = parseNumber(layer.offsetY ?? layer.top ?? layer.y ?? layer.positionY, 0);

            const stepX = parseNumber(layer.repeatStepX ?? layer.replicaStepX ?? layer.repeatOffsetX ?? layer.replicaOffsetX, gridW) || gridW;
            const stepY = parseNumber(layer.repeatStepY ?? layer.replicaStepY ?? layer.repeatOffsetY ?? layer.replicaOffsetY, gridH) || gridH;

            const countX = buildRepeatCount(layer.repeatX ?? layer.replicaX ?? layer.repeatCountX ?? layer.replicaCountX ?? 1, gridW + Math.abs(offsetX), stepX);
            const countY = buildRepeatCount(layer.repeatY ?? layer.replicaY ?? layer.repeatCountY ?? layer.replicaCountY ?? 1, gridH + Math.abs(offsetY), stepY);

            for (let iy = 0; iy < countY; iy++) {
                for (let ix = 0; ix < countX; ix++) {
                    const img = this.add.image(0, 0, textureKey).setDepth(500 + idx);
                    const x = this.gridOffsetX + offsetX + (stepX * ix) + gridW / 2;
                    const y = this.gridOffsetY + offsetY + (stepY * iy) + gridH / 2;
                    img.setDisplaySize(gridW, gridH);
                    img.setPosition(x, y);
                    img.setAlpha(clamp(alpha, 0, 1));
                    this.editorFgImages.push(img);
                }
            }
        });

        this.editorFgImage = this.editorFgImages.length ? this.editorFgImages[0] : null;
    }

    resetGrid(cols, rows, skipBgUpdate = false) {
        const prevCells = Array.isArray(this.cells) ? this.cells : [];
        const prevRows = Number(this.rows) || 0;
        const prevCols = Number(this.cols) || 0;

        this.cols = clamp(Math.floor(cols), 4, 40);
        this.rows = clamp(Math.floor(rows), 4, 40);

        // Compute available area from actual canvas size. Reserve a palette column on the right.
        const totalW = Math.max(200, Math.floor(this.scale.width || this.sys.game.config.width || 1000));
        const totalH = Math.max(100, Math.floor(this.scale.height || this.sys.game.config.height || 700));

        // Candidate palette width: clamp between 180 and 440 or 28% of width
        const paletteWidth = Math.floor(Math.min(440, Math.max(180, totalW * 0.28)));
        const padding = 18;
        const availW = Math.max(64, totalW - paletteWidth - padding * 3);
        const availH = Math.max(64, totalH - padding * 2);

        this.gridAreaWidth = availW;
        this.gridAreaHeight = availH;

        // compute base cell size (without zoom) and apply current zoom
        this.baseCellSize = clamp(Math.floor(Math.min(this.gridAreaWidth / this.cols, this.gridAreaHeight / this.rows)), 20, 64);
        this.cellSize = clamp(Math.floor(this.baseCellSize * this.zoom), 8, 256);

        // compute actual grid pixel dimensions
        const gridW = this.cellSize * this.cols;
        const gridH = this.cellSize * this.rows;

        // center grid vertically and keep some left padding horizontally
        this.gridOffsetX = Math.max(padding, Math.floor((availW - gridW) / 2) + padding);
        this.gridOffsetY = Math.max(padding, Math.floor((totalH - gridH) / 2));

        // store palette area start X so createPalette can position items
        this.paletteArea = {
            width: paletteWidth,
            startX: Math.floor(totalW - paletteWidth + 12),
            startY: 24
        };

        this.cells = Array.from({ length: this.rows }, (_, r) => Array.from({ length: this.cols }, (_, c) => {
            const prevCell = (r < prevRows && c < prevCols && prevCells[r] && prevCells[r][c]) ? prevCells[r][c] : null;
            if (prevCell && typeof prevCell === 'object') {
                return {
                    base: normalizeToken(prevCell.base ?? '-'),
                    reveal: prevCell.reveal ? normalizeToken(prevCell.reveal) : null
                };
            }
            return {
                base: '-',
                reveal: null
            };
        }));
        this.selectedCell = null;
        this.renderGrid();
        // update background image after layout changes (unless explicitly skipped)
        if (!skipBgUpdate) {
            try { this.updateEditorBackgroundImage(); } catch (e) { /* ignore */ }
        }
        try { this.updateScrollbars(); } catch (e) { /* ignore */ }
    }

    // Recompute layout when zoom changes without resetting cells
    setZoom(zoom) {
        const z = Math.max(0.2, Math.min(4, Number(zoom) || 1));
        this.zoom = z;
        // recompute display cellSize from baseCellSize
        this.cellSize = clamp(Math.floor(this.baseCellSize * this.zoom), 8, 256);
        // recompute grid offsets using previously computed gridAreaWidth/Height
        const gridW = this.cellSize * this.cols;
        const gridH = this.cellSize * this.rows;
        const totalW = Math.max(200, Math.floor(this.scale.width || this.sys.game.config.width || 1000));
        const totalH = Math.max(100, Math.floor(this.scale.height || this.sys.game.config.height || 700));
        const padding = 18;
        this.gridOffsetX = Math.max(padding, Math.floor((Math.max(64, totalW - (this.paletteArea?.width || 360) - padding * 3) - gridW) / 2) + padding);
        this.gridOffsetY = Math.max(padding, Math.floor((totalH - gridH) / 2));
        // update background image and re-render
        // Zoom should not trigger auto-grid recomputation, otherwise cells may be reset.
        try { this.updateEditorBackgroundImage(true); } catch (e) {}
        this.renderGrid();
        // update scrollbar ranges after zooming/resizing cells
        try { this.updateScrollbars(); } catch (e) { /* ignore */ }
    }

    setTileBaseSize(size) {
        const s = clamp(Math.floor(Number(size) || 64), 8, 256);
        this.baseCellSize = s;
        // recompute cellSize using current zoom
        this.cellSize = clamp(Math.floor(this.baseCellSize * this.zoom), 8, 256);
        // recompute offsets similar to setZoom
        const totalW = Math.max(200, Math.floor(this.scale.width || this.sys.game.config.width || 1000));
        const totalH = Math.max(100, Math.floor(this.scale.height || this.sys.game.config.height || 700));
        const padding = 18;
        const gridW = this.cellSize * this.cols;
        const gridH = this.cellSize * this.rows;
        this.gridOffsetX = Math.max(padding, Math.floor((Math.max(64, totalW - (this.paletteArea?.width || 360) - padding * 3) - gridW) / 2) + padding);
        this.gridOffsetY = Math.max(padding, Math.floor((totalH - gridH) / 2));
        try { this.updateEditorBackgroundImage(); } catch (e) {}
        this.renderGrid();
        try { this.updateScrollbars(); } catch (e) { }
    }

    setupScrollbars() {
        // link DOM scroll inputs (created in HTML) to pan the grid
        const h = el('hScroll');
        const v = el('vScroll');
        if (!h && !v) return;

        const onH = () => {
            try {
                const val = Number(h.value) || 0;
                const gridW = this.cellSize * this.cols;
                const max = Math.max(0, gridW - (this.gridAreaWidth || 0));
                const clamped = clamp(val, 0, max);
                this.gridOffsetX = this.gridPadding - clamped;
                this.renderGrid();
            } catch (e) { /* ignore */ }
        };

        const onV = () => {
            try {
                const val = Number(v.value) || 0;
                const gridH = this.cellSize * this.rows;
                const max = Math.max(0, gridH - (this.gridAreaHeight || 0));
                const clamped = clamp(val, 0, max);
                this.gridOffsetY = this.gridPadding - clamped;
                this.renderGrid();
            } catch (e) { /* ignore */ }
        };

        if (h) {
            h.addEventListener('input', onH);
            h.addEventListener('change', onH);
        }
        if (v) {
            v.addEventListener('input', onV);
            v.addEventListener('change', onV);
        }

        // ensure initial ranges are set
        this.updateScrollbars();
    }

    updateScrollbars() {
        const h = el('hScroll');
        const v = el('vScroll');
        const gridW = this.cellSize * this.cols;
        const gridH = this.cellSize * this.rows;
        const maxX = Math.max(0, gridW - (this.gridAreaWidth || 0));
        const maxY = Math.max(0, gridH - (this.gridAreaHeight || 0));
        if (h) {
            h.max = String(Math.floor(maxX));
            // derive current scroll value from gridOffsetX
            const scrollX = clamp(Math.floor(this.gridPadding - this.gridOffsetX), 0, Math.floor(maxX));
            h.value = String(scrollX);
        }
        if (v) {
            v.max = String(Math.floor(maxY));
            const scrollY = clamp(Math.floor(this.gridPadding - this.gridOffsetY), 0, Math.floor(maxY));
            v.value = String(scrollY);
        }
    }

    onResize(width, height) {
        // Called when the canvas / container is resized. Recompute layout and redraw.
        try {
            this.resetGrid(this.cols, this.rows);
            this.createPalette();
            this.renderGrid();
            try { this.updateEditorBackgroundImage(); } catch (e) { /* ignore */ }
        } catch (e) {
            // ignore during early initialization
        }
    }

    setupInputHandlers() {
        this.input.on('pointerdown', (pointer) => {
            const cell = this.getGridCellFromPointer(pointer.worldX, pointer.worldY);
            if (!cell) return;

            this.selectedCell = cell;
            try {
                const rawParts = String(this.cells[cell.row]?.[cell.col]?.base || '').split('/').map((s) => s.trim()).filter(Boolean);
                this.selectedTokenIndex = Math.max(0, rawParts.length - 1);
            } catch (e) {
                this.selectedTokenIndex = 0;
            }
            this.updateSelectedCellInfo();

            if (pointer.rightButtonDown()) {
                this.rotateSelectedCell(1);
            } else if (this.lastBrushToken) {
                this.placeToken(cell.col, cell.row, this.lastBrushToken, { noTile: !!this._dragNoTile });
            }
            this.renderGrid();
        });

        this.input.on('wheel', (pointer, _gameObjects, _deltaX, deltaY) => {
            const cell = this.getGridCellFromPointer(pointer.worldX, pointer.worldY);
            if (!cell) return;
            this.selectedCell = cell;
            this.rotateSelectedCell(deltaY > 0 ? 1 : -1);
            this.renderGrid();
        });

        this.input.keyboard.on('keydown-LEFT', () => {
            this.rotateSelectedCell(-1);
            this.renderGrid();
        });

        this.input.keyboard.on('keydown-RIGHT', () => {
            this.rotateSelectedCell(1);
            this.renderGrid();
        });

        // Mirror: 'H' = horizontal flip (flipX), 'V' = vertical flip (flipY)
        this.input.keyboard.on('keydown-H', () => {
            this.mirrorSelectedCell('h');
            this.renderGrid();
        });

        this.input.keyboard.on('keydown-V', () => {
            this.mirrorSelectedCell('v');
            this.renderGrid();
        });

        // Track '.' key for marking dragged items as invisible (noTile)
        try {
            window.addEventListener('keydown', (ev) => {
                try {
                    if (ev && ev.key === '.') {
                        // hold modifier for dragging
                        this._dragNoTile = true;
                        // if a cell is selected, toggle notile on its last token
                        if (this.selectedCell) {
                            try {
                                const { row, col } = this.selectedCell;
                                const cell = this.cells[row] && this.cells[row][col] ? this.cells[row][col] : null;
                                if (cell && cell.base && cell.base !== '-') {
                                    const parts = String(cell.base).split('/').map(s => s.trim()).filter(Boolean);
                                    if (parts.length) {
                                        const last = parts[parts.length - 1];
                                        if (String(last).endsWith('.')) {
                                            // remove trailing dot
                                            parts[parts.length - 1] = String(last).slice(0, -1);
                                        } else {
                                            parts[parts.length - 1] = String(last) + '.';
                                        }
                                        cell.base = parts.join('/');
                                        this.updateSelectedCellInfo();
                                        this.renderGrid();
                                    }
                                }
                            } catch (e) { }
                        }
                    }
                } catch (e) { }
            });
            window.addEventListener('keyup', (ev) => {
                try {
                    if (ev && ev.key === '.') this._dragNoTile = false;
                } catch (e) { }
            });
        } catch (e) { }

        // Open wall variant picker with 'W' (was 'V' before; 'V' now flips vertical)
        this.input.keyboard.on('keydown-W', () => {
            this.toggleWallVariantPicker();
        });

        this.input.keyboard.on('keydown-DELETE', () => {
            this.clearSelectedCell();
        });

        this.input.keyboard.on('keydown-BACKSPACE', (event) => {
            event?.preventDefault?.();
            this.clearSelectedCell();
        });
    }

    createPalette() {
        // If DOM palette exists, skip drawing the in-canvas palette to avoid duplication.
        if (typeof document !== 'undefined' && document.querySelector('.left-panel .accordion')) {
            return;
        }

        this.paletteLayer.removeAll(true);
        this.paletteItems = [];

    const startX = (this.paletteArea && Number.isFinite(this.paletteArea.startX)) ? this.paletteArea.startX : Math.max(980, Math.floor(this.scale.width - 380));
    const startY = (this.paletteArea && Number.isFinite(this.paletteArea.startY)) ? this.paletteArea.startY : 34;
        const colCount = 3;
        const spacingX = 126;
        const spacingY = 56;

        this.add.text(startX, 8, 'PALETTE (DRAG & DROP)', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#8fd8ff'
        });

        PALETTE_ITEMS.forEach((item, index) => {
            const col = index % colCount;
            const row = Math.floor(index / colCount);
            const x = startX + col * spacingX;
            const y = startY + row * spacingY;

            const box = this.add.rectangle(0, 0, 116, 48, 0x102449, 0.95).setStrokeStyle(1, 0x2b4f86, 1);
            const iconContainer = this.add.container(-38, 0);
            this.addTokenVisual(iconContainer, item.token, 0, 0, 24);
            const label = this.add.text(-17, -8, `${item.token}`, {
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#ffffff'
            });
            const subLabel = this.add.text(-17, 7, item.label, {
                fontFamily: 'monospace',
                fontSize: '9px',
                color: '#98b6e8'
            });

            const container = this.add.container(x, y, [box, iconContainer, label, subLabel]);
            container.setSize(116, 48);
            container.setData('token', normalizeToken(item.token));
            container.setData('originX', x);
            container.setData('originY', y);

            container.setInteractive(new Phaser.Geom.Rectangle(-58, -24, 116, 48), Phaser.Geom.Rectangle.Contains);
            this.input.setDraggable(container);

            container.on('pointerdown', (pointer) => {
                this.lastBrushToken = container.getData('token');
                try {
                    // start drag immediately so a single press allows dragging
                    if (this.input && typeof this.input.startDrag === 'function') {
                        this.input.startDrag(container, pointer);
                    }
                } catch (e) {
                    // ignore if startDrag not available
                }
            });

            container.on('dragstart', () => {
                container.setScale(1.06);
                container.setAlpha(0.9);
                this.lastBrushToken = container.getData('token');
                // mark initial noTile state from global flag
                try { container.setData('noTile', !!this._dragNoTile); } catch (e) { }
            });

            container.on('drag', (_pointer, dragX, dragY) => {
                try {
                    // snap visual while dragging to nearest cell center for precise placement
                    const localX = dragX - this.gridOffsetX;
                    const localY = dragY - this.gridOffsetY;
                    const col = Math.floor(localX / this.cellSize);
                    const row = Math.floor(localY / this.cellSize);
                    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
                        const snapX = this.gridOffsetX + col * this.cellSize + this.cellSize / 2;
                        const snapY = this.gridOffsetY + row * this.cellSize + this.cellSize / 2;
                        container.setPosition(snapX, snapY);
                    } else {
                        container.setPosition(dragX, dragY);
                    }
                } catch (e) {
                    container.setPosition(dragX, dragY);
                }
            });

            container.on('dragend', (pointer) => {
                try {
                    // use the (possibly snapped) container position to determine target cell
                    const worldX = container.x;
                    const worldY = container.y;
                    const cell = this.getGridCellFromPointer(worldX, worldY);
                    if (cell) {
                        this.selectedCell = cell;
                        // respect noTile modifier on the dragged container
                        const tok = container.getData('token');
                        const noTile = !!container.getData('noTile') || !!this._dragNoTile;
                        this.placeToken(cell.col, cell.row, tok, { noTile });
                        try {
                            const rawParts = String(this.cells[cell.row]?.[cell.col]?.base || '').split('/').map((s) => s.trim()).filter(Boolean);
                            this.selectedTokenIndex = Math.max(0, rawParts.length - 1);
                        } catch (e) {
                            this.selectedTokenIndex = 0;
                        }
                        this.updateSelectedCellInfo();
                        this.renderGrid();
                    }
                } catch (e) { /* ignore */ }
                container.setPosition(container.getData('originX'), container.getData('originY'));
                container.setScale(1);
                container.setAlpha(1);
            });

            this.paletteItems.push(container);
            this.paletteLayer.add(container);
        });
    }

    getGridCellFromPointer(worldX, worldY) {
        const localX = worldX - this.gridOffsetX;
        const localY = worldY - this.gridOffsetY;
        if (localX < 0 || localY < 0) return null;

        const col = Math.floor(localX / this.cellSize);
        const row = Math.floor(localY / this.cellSize);
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
        return { col, row };
    }

    placeToken(col, row, token, opts = {}) {
        if (!ensureObjectMappingsReadyOrPrompt('aggiungi oggetti nel dialog OBJ')) return;
        if (!this.cells[row] || !this.cells[row][col]) return;
        const cell = this.cells[row][col];
        const useReveal = !!el('revealMode')?.checked;
        const normalized = normalizeToken(token);
        // If reveal mode is active, set reveal token (legacy support)
        if (useReveal) {
            cell.reveal = normalized === '-' ? null : normalized;
            return;
        }

        // Support multiple objects in same cell by appending with '/'
        const noTile = !!opts.noTile;
        const tokenToPlace = noTile ? `${normalized}.` : normalized;

        if (!cell.base || cell.base === '-' ) {
            cell.base = tokenToPlace;
            cell.reveal = null;
            this.selectedTokenIndex = 0;
            return;
        }

        // Append new token to existing base separated by '/'
        // Avoid duplicating same token consecutively
        try {
            const parts = String(cell.base || '').split('/').map(s => s.trim()).filter(Boolean);
            const last = parts.length ? parts[parts.length - 1] : null;
            if (last !== tokenToPlace) {
                parts.push(tokenToPlace);
                cell.base = parts.join('/');
                this.selectedTokenIndex = Math.max(0, parts.length - 1);
            }
        } catch (e) {
            cell.base = `${cell.base}/${tokenToPlace}`;
            this.selectedTokenIndex = Math.max(0, String(cell.base).split('/').filter(Boolean).length - 1);
        }
    }

    clearSelectedCell() {
        if (!this.selectedCell) return;
        const { row, col } = this.selectedCell;
        const cell = this.cells[row]?.[col];
        if (!cell) return;
        cell.base = '-';
        cell.reveal = null;
        this.updateSelectedCellInfo();
        this.renderGrid();
    }

    rotateSelectedCell(delta) {
        if (!this.selectedCell) return;
        const { row, col } = this.selectedCell;
        const cell = this.cells[row]?.[col];
        if (!cell) return;

        const useReveal = !!el('revealMode')?.checked;
        if (useReveal && cell.reveal) {
            cell.reveal = rotateWallToken(cell.reveal, delta);
            return;
        }

        cell.base = rotateWallToken(cell.base, delta);
    }

    mirrorSelectedCell(axis) {
        if (!this.selectedCell) return;
        const { row, col } = this.selectedCell;
        const cell = this.cells[row]?.[col];
        if (!cell) return;

        const useReveal = !!el('revealMode')?.checked;
        const targetKey = useReveal && cell.reveal ? 'reveal' : 'base';
        const token = normalizeToken(cell[targetKey] || '-');
        const match = token.match(WALL_TOKEN_REGEX);
        if (!match) return;
        const r = Number(match[1]);
        const c = Number(match[2]);
        const currentRot = Number(match[3]);
        const currentFlip = String(match[4] ?? '0').toLowerCase();
        const desired = axis === 'h' ? 'h' : 'v';
        // Toggle: if already flipped on the same axis, remove flip (0); otherwise set to desired
        const newFlip = currentFlip === desired ? '0' : desired;
        cell[targetKey] = `w${r}${c}${currentRot}${newFlip}`;
    }

    toggleWallVariantPicker() {
        if (this.variantPickerContainer) {
            this.closeWallVariantPicker();
            return;
        }
        this.showWallVariantPicker();
    }

    showWallVariantPicker() {
        if (!this.selectedCell) return;
        const { row: selRow, col: selCol } = this.selectedCell;
        const cell = this.cells[selRow]?.[selCol];
        if (!cell) return;

        // only for wall tokens
        const baseToken = normalizeToken(cell.base || '-');
        if (!WALL_TOKEN_REGEX.test(baseToken)) return;

        const startX = (this.paletteArea && Number.isFinite(this.paletteArea.startX)) ? this.paletteArea.startX : 880;
        const startY = (this.paletteArea && Number.isFinite(this.paletteArea.startY)) ? this.paletteArea.startY + 280 : 120;

        const picker = this.add.container(startX, startY);
        picker.setDepth(2000);

        const cols = 6;
        const rows = 4;
        const iconSize = 40;
        const padding = 6;

        const bgW = cols * (iconSize + padding) + padding;
        const bgH = rows * (iconSize + padding) + padding;
        const bg = this.add.rectangle(0, 0, bgW, bgH, 0x061025, 0.95).setOrigin(0);
        bg.setStrokeStyle(2, 0x2b4f86, 1);
        picker.add(bg);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const px = padding + c * (iconSize + padding);
                const py = padding + r * (iconSize + padding);
                const token = `w${r}${c}00`;
                const cellBox = this.add.container(px + iconSize / 2, py + iconSize / 2);
                const box = this.add.rectangle(0, 0, iconSize, iconSize, 0x102449, 0.95).setStrokeStyle(1, 0x2b4f86, 1);
                cellBox.add(box);
                // draw variant visual (no rotation)
                this.addTokenVisual(cellBox, token, 0, 0, iconSize - 8);
                cellBox.setSize(iconSize, iconSize);
                cellBox.setInteractive(new Phaser.Geom.Rectangle(-iconSize/2, -iconSize/2, iconSize, iconSize), Phaser.Geom.Rectangle.Contains);
                cellBox.on('pointerdown', () => {
                    // preserve existing rotation if any
                    const current = normalizeToken(cell.base || '-');
                    const m = current.match(WALL_TOKEN_REGEX);
                    const currentRot = m ? Number(m[3]) : 0;
                    const currentFlip = m ? String(m[4]).toLowerCase() : '0';
                    cell.base = `w${r}${c}${currentRot}${currentFlip}`;
                    this.closeWallVariantPicker();
                    this.renderGrid();
                });
                picker.add(cellBox);
            }
        }

        // close on outside click
        const outsideHandler = (pointer) => {
            const worldX = pointer.worldX;
            const worldY = pointer.worldY;
            const localX = worldX - picker.x;
            const localY = worldY - picker.y;
            if (localX < 0 || localY < 0 || localX > bgW || localY > bgH) {
                this.input.off('pointerdown', outsideHandler);
                this.closeWallVariantPicker();
            }
        };
        this.input.on('pointerdown', outsideHandler);

        this.variantPickerContainer = picker;
    }

    closeWallVariantPicker() {
        if (!this.variantPickerContainer) return;
        try { this.variantPickerContainer.destroy(true); } catch (e) { /* ignore */ }
        this.variantPickerContainer = null;
    }

    tokenToRenderInfo(token) {
        const baseToken = getRenderableTokenBase(token);
        const mappedVisual = resolveTokenVisualFromMappings(this, baseToken);
        if (mappedVisual) {
            if (mappedVisual.category === 'tile') {
                return { kind: 'tile', texture: mappedVisual.texture, frame: mappedVisual.frame };
            }
            return { kind: 'obj', texture: mappedVisual.texture, frame: mappedVisual.frame };
        }

        const raw = String(baseToken ?? '').trim().toLowerCase();
        if (/^exit(\[[^\]]+\])?$/.test(raw)) {
            return { kind: 'obj', frame: OBJECT_FRAMES.exit };
        }
        if (/^(?:bck|back|back_level)(\[[^\]]+\])?$/.test(raw)) {
            return { kind: 'tile', texture: 'tiles', frame: 5 };
        }
        const normalized = normalizeToken(baseToken);
        const wallMatch = normalized.match(WALL_TOKEN_REGEX);
        if (wallMatch) {
                const row = Number(wallMatch[1]);
                const col = Number(wallMatch[2]);
                const rot = Number(wallMatch[3]);
                const flip = String(wallMatch[4] ?? '0').toLowerCase();
                return {
                    kind: 'wall',
                    frame: row * 6 + col,
                    rot,
                    flip
                };
            }

        switch (normalized) {
            case '-': return { kind: 'empty' };
            case '.': return { kind: 'empty' };
            case '#': return { kind: 'empty' };
            case 'f': return { kind: 'tile', texture: 'tiles', frame: 3 };
            case 'h': return { kind: 'tile', texture: 'tiles', frame: 1 };
            case 's': return { kind: 'tile', texture: 'tiles', frame: 5 };
            case 'g': return { kind: 'obj', frame: OBJECT_FRAMES.gem };
            case 'd': return { kind: 'obj', frame: OBJECT_FRAMES.door };
            case 'k': return { kind: 'obj', frame: OBJECT_FRAMES.key };
            case 'p': return { kind: 'obj', frame: OBJECT_FRAMES.pepita };
            case 'b': return { kind: 'obj', frame: OBJECT_FRAMES.dynamite_chest };
            case 'c': return { kind: 'obj', frame: OBJECT_FRAMES.cart };
            case 'helmet': return { kind: 'obj', frame: OBJECT_FRAMES.helmet };
            case 'm': return { kind: 'obj', frame: OBJECT_FRAMES.wall };
            case 'ghost': return { kind: 'ghost' };
            case 'bat': return { kind: 'bat' };
            default: return { kind: 'text', text: normalized };
        }
    }

    addTokenVisual(container, token, x, y, size) {
        // support token lists joined by '/': render the topmost (last) token visually
        let mainToken = String(token ?? '-');
        try {
            const parts = mainToken.split('/').map(s => s.trim()).filter(Boolean);
            if (parts.length > 0) mainToken = parts[parts.length - 1];
        } catch (e) { }
        // strip trailing '.' marker for invisible/noTile when rendering visual
        let invisible = false;
        if (mainToken.endsWith('.')) { invisible = true; mainToken = mainToken.slice(0, -1); }

        const info = this.tokenToRenderInfo(mainToken);
        const scale = size / 64;

        if (info.kind === 'empty') {
            const marker = this.add.rectangle(x, y, size * 0.8, size * 0.8, 0x20345a, 0.25).setStrokeStyle(1, 0x486aa2, 0.8);
            container.add(marker);
            return;
        }

        if (info.kind === 'tile') {
            const tile = this.add.sprite(x, y, info.texture, info.frame);
            tile.setScale(scale);
            if (invisible) tile.setAlpha(0.35);
            container.add(tile);
            return;
        }

        if (info.kind === 'wall') {
            const wall = this.add.sprite(x, y, 'wall_tiles', info.frame);
            wall.setScale(scale);
            if (info.flip === 'h') wall.setFlipX(true);
            else if (info.flip === 'v') wall.setFlipY(true);
            else wall.setAngle((info.rot || 0) * 90);
            if (invisible) wall.setAlpha(0.35);
            container.add(wall);
            return;
        }

        if (info.kind === 'obj') {
            const texture = info.texture || 'objects';
            const obj = this.add.sprite(x, y, texture, info.frame);
            obj.setScale(scale * 0.9);
            if (invisible) obj.setAlpha(0.35);
            container.add(obj);
            return;
        }

        if (info.kind === 'ghost') {
            const ghost = this.add.sprite(x, y, 'ghost_anim', 0);
            ghost.setScale(scale * 0.9);
            container.add(ghost);
            return;
        }

        if (info.kind === 'bat') {
            const bat = this.add.sprite(x, y, 'bat_anim', 0);
            bat.setScale(scale * 0.9);
            container.add(bat);
            return;
        }

        const fallback = this.add.text(x, y, info.text || '?', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#ffffff'
        }).setOrigin(0.5);
        container.add(fallback);
    }

    renderGrid() {
        if (!this.gridLayer || !this.selectionLayer) return;
        this.gridLayer.removeAll(true);
        this.selectionLayer.removeAll(true);

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const x = this.gridOffsetX + col * this.cellSize;
                const y = this.gridOffsetY + row * this.cellSize;
                const cx = x + this.cellSize / 2;
                const cy = y + this.cellSize / 2;

                // choose background color for invisible wall (#) and invisible tile (.)
                const normBase = normalizeToken(this.cells[row][col].base);
                let bgColor = 0x0f1f3e;
                let bgAlpha = 0; // default transparent
                if (normBase === '#') {
                    bgColor = 0x8b4513; // brown for invisible wall
                    bgAlpha = 1;
                } else if (normBase === '.') {
                    bgColor = 0x000000; // black for invisible tile
                    bgAlpha = 1;
                }
                const bg = this.add.rectangle(cx, cy, this.cellSize, this.cellSize, bgColor, bgAlpha)
                    .setStrokeStyle(1, 0x304f83, 0.35);
                this.gridLayer.add(bg);

                const cell = this.cells[row][col];
                // Render main visual using last token if multiple present
                this.addTokenVisual(this.gridLayer, cell.base, cx, cy, this.cellSize);

                // If any token in the cell includes trailing '.', show 'notile' marker
                try {
                    const hasNoTile = String(cell.base || '').split('/').some(t => (String(t || '').trim().endsWith('.')));
                    if (hasNoTile) {
                        const nt = this.add.text(cx, cy + Math.floor(this.cellSize * 0.18), 'notile', {
                            fontFamily: 'monospace',
                            fontSize: `${Math.max(8, Math.floor(this.cellSize * 0.16))}px`,
                            color: '#ffffff'
                        }).setOrigin(0.5, 0);
                        this.gridLayer.add(nt);
                    }
                } catch (e) { }

                // Show small tag for additional stacked tokens (beyond first) in top-left
                try {
                    const parts = String(cell.base || '').split('/').map(s => s.trim()).filter(Boolean);
                    if (parts.length > 1) {
                        const extra = parts.slice(0, Math.min(parts.length - 1, 3)).join('/');
                        const tag = this.add.text(
                            x + 2,
                            y + 2,
                            `${extra}`,
                            {
                                fontFamily: 'monospace',
                                fontSize: `${Math.max(8, Math.floor(this.cellSize * 0.14))}px`,
                                color: '#ffd76a',
                                backgroundColor: '#1f1300'
                            }
                        ).setOrigin(0, 0);
                        this.gridLayer.add(tag);
                    }
                } catch (e) { }
            }
        }

        const borderW = this.cols * this.cellSize;
        const borderH = this.rows * this.cellSize;
        // ensure editor background (if present) matches current grid position/size so it scrolls with tiles
        try {
            if (Array.isArray(this.editorBgImages) && this.editorBgImages.length) {
                this.updateEditorBackgroundImage(true);
            } else if (this.editorBgImage) {
                this.editorBgImage.setDisplaySize(borderW, borderH);
                this.editorBgImage.setPosition(this.gridOffsetX + borderW / 2, this.gridOffsetY + borderH / 2);
            }
        } catch (e) { /* ignore background reposition errors */ }
        const border = this.add.rectangle(
            this.gridOffsetX + borderW / 2,
            this.gridOffsetY + borderH / 2,
            borderW,
            borderH,
            0x000000,
            0
        ).setStrokeStyle(2, 0x8fd8ff, 0.9);
        this.selectionLayer.add(border);

        if (this.selectedCell) {
            const sx = this.gridOffsetX + this.selectedCell.col * this.cellSize + this.cellSize / 2;
            const sy = this.gridOffsetY + this.selectedCell.row * this.cellSize + this.cellSize / 2;
            const s = this.add.rectangle(sx, sy, this.cellSize, this.cellSize, 0x4db6ff, 0.12)
                .setStrokeStyle(2, 0xffdd77, 1);
            this.selectionLayer.add(s);
        }

        drawMiniMapPreview(this);
    }

    updateSelectedCellInfo() {
        const infoEl = el('selectedCellInfo');
        if (!infoEl) return;
        if (!this.selectedCell) {
            infoEl.textContent = 'Cella selezionata: nessuna';
            return;
        }
        const { row, col } = this.selectedCell;
        const cell = this.cells[row]?.[col];
        const base = cell?.base || '-';
        const reveal = cell?.reveal ? ` / ${cell.reveal}` : '';
        // indicate notile if any token in base is marked with trailing '.'
        const hasNoTile = String(base).split('/').some(t => String(t || '').trim().endsWith('.'));
        infoEl.textContent = `Cella ${row},${col}: ${base}${reveal}` + (hasNoTile ? ' [notile]' : '');
    }

    toTilesMatrix() {
        return this.cells.map((row) => row.map((cell) => joinToken(cell.base, cell.reveal)));
    }

    loadFromJson(levelData) {
        if (!levelData || typeof levelData !== 'object') return;
        const mapObj = levelData.map || {};
        const tiles = Array.isArray(mapObj.tiles) ? mapObj.tiles : [];
        const rows = clamp(Number(mapObj.rows) || tiles.length || 12, 4, 40);
        const cols = clamp(Number(mapObj.cols) || tiles[0]?.length || 12, 4, 40);
        this.resetGrid(cols, rows);

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const raw = tiles[y]?.[x] ?? '-';
                const rawText = String(raw ?? '-').trim();
                // If raw contains multiple '/' tokens, preserve whole string in base
                try {
                    // Preserve inline decorated tokens as-is, otherwise splitToken can
                    // interpret '/' as reveal separator and lose inline effects.
                    const hasInlineDecorations = /[(){}\[\]]/.test(rawText);
                    if ((rawText.includes('/') && rawText.split('/').length > 2) || hasInlineDecorations) {
                        this.cells[y][x].base = rawText || '-';
                        this.cells[y][x].reveal = null;
                    } else {
                        const parsed = splitToken(rawText);
                        this.cells[y][x].base = parsed.base;
                        this.cells[y][x].reveal = parsed.reveal;
                    }
                } catch (e) {
                    const parsed = splitToken(rawText);
                    this.cells[y][x].base = parsed.base;
                    this.cells[y][x].reveal = parsed.reveal;
                }
            }
        }

        this.renderGrid();
        this.selectedCell = null;
        this.updateSelectedCellInfo();
    }
}

const phaserConfig = {
    type: Phaser.AUTO,
    parent: 'editor-game',
    backgroundColor: '#091022',
    scale: {
        mode: Phaser.Scale.RESIZE
    },
    scene: [LevelEditorScene]
};

new Phaser.Game(phaserConfig);

function getScene() {
    return window.__levelEditorScene || null;
}

function setStatus(message, isError = false) {
    const target = el('statusText');
    if (!target) return;
    target.style.color = isError ? '#ff8f9a' : '#8ee89f';
    target.textContent = message;
}

function drawMiniMapFrame(scene, ctx, textureKey, frameIndex, x, y, size, opts = {}) {
    const frame = scene?.textures?.getFrame(textureKey, frameIndex);
    const sourceImage = frame?.source?.image;
    if (!frame || !sourceImage) return false;

    const alpha = Number.isFinite(opts.alpha) ? opts.alpha : 1;
    const rotation = Number.isFinite(opts.rotation) ? opts.rotation : 0;
    const flipX = !!opts.flipX;
    const flipY = !!opts.flipY;

    ctx.save();
    ctx.globalAlpha = alpha;

    // apply flips and rotation, keeping drawing centered
    ctx.translate(x + size / 2, y + size / 2);
    if (flipX || flipY) {
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    }
    if (rotation !== 0) ctx.rotate(rotation);

    ctx.drawImage(
        sourceImage,
        frame.cutX,
        frame.cutY,
        frame.cutWidth,
        frame.cutHeight,
        -size / 2,
        -size / 2,
        size,
        size
    );

    ctx.restore();
    return true;
}

function drawMiniMapToken(scene, ctx, token, x, y, size, opts = {}) {
    const baseToken = getRenderableTokenBase(token);
    const mappedVisual = resolveTokenVisualFromMappings(scene, baseToken);
    if (mappedVisual) {
        return drawMiniMapFrame(scene, ctx, mappedVisual.texture, mappedVisual.frame, x, y, size, { alpha: opts.alpha });
    }

    const raw = String(baseToken ?? '').trim().toLowerCase();
    if (/^exit(\[[^\]]+\])?$/.test(raw)) {
        return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.exit, x, y, size, { alpha: opts.alpha });
    }
    if (/^(?:bck|back|back_level)(\[[^\]]+\])?$/.test(raw)) {
        return drawMiniMapFrame(scene, ctx, 'tiles', 5, x, y, size, { alpha: opts.alpha });
    }
    const normalized = normalizeToken(baseToken);
    const wallMatch = normalized.match(WALL_TOKEN_REGEX);
    if (wallMatch) {
        const row = clamp(Number(wallMatch[1]), 0, 3);
        const col = clamp(Number(wallMatch[2]), 0, 5);
        const rot = ((Number(wallMatch[3]) % 4) + 4) % 4;
        const flip = String(wallMatch[4] ?? '0').toLowerCase();
        const wallFrame = row * 6 + col;
        if (flip === 'h') {
            return drawMiniMapFrame(scene, ctx, 'wall_tiles', wallFrame, x, y, size, { alpha: opts.alpha, flipX: true });
        }
        if (flip === 'v') {
            return drawMiniMapFrame(scene, ctx, 'wall_tiles', wallFrame, x, y, size, { alpha: opts.alpha, flipY: true });
        }
        return drawMiniMapFrame(scene, ctx, 'wall_tiles', wallFrame, x, y, size, {
            alpha: opts.alpha,
            rotation: rot * (Math.PI / 2)
        });
    }

    const drawFloor = (alpha = 1) => drawMiniMapFrame(scene, ctx, 'tiles', 3, x, y, size, { alpha });

    switch (normalized) {
        case '-':
            return false;
        case 'f':
            // floor -> use sand frame
            return drawMiniMapFrame(scene, ctx, 'tiles', 0, x, y, size, { alpha: opts.alpha });
        case 'sand':
            return drawMiniMapFrame(scene, ctx, 'tiles', 0, x, y, size, { alpha: opts.alpha });
        case 'h':
            return drawMiniMapFrame(scene, ctx, 'tiles', 1, x, y, size, { alpha: opts.alpha });
        case '.':
            return drawMiniMapFrame(scene, ctx, 'tiles', 1, x, y, size, { alpha: opts.alpha });
        case 's':
            // legacy s token used as 'back' or hole2/sand depending on convention; keep mapping to back/frame5 for compatibility
            return drawMiniMapFrame(scene, ctx, 'tiles', 5, x, y, size, { alpha: opts.alpha });
        case 'water':
            return drawMiniMapFrame(scene, ctx, 'tiles', 3, x, y, size, { alpha: opts.alpha });
        case 'mud':
            return drawMiniMapFrame(scene, ctx, 'tiles', 4, x, y, size, { alpha: opts.alpha });
        case 'back':
            return drawMiniMapFrame(scene, ctx, 'tiles', 5, x, y, size, { alpha: opts.alpha });
        case 'g':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.gem, x, y, size, { alpha: opts.alpha });
        case 'd':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.door, x, y, size, { alpha: opts.alpha });
        case 'k':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.key, x, y, size, { alpha: opts.alpha });
        case 'p':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.pepita, x, y, size, { alpha: opts.alpha });
        case 'wooden':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.wooden, x, y, size, { alpha: opts.alpha });
        case 'exit':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.exit, x, y, size, { alpha: opts.alpha });
        case 'l':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.heart, x, y, size, { alpha: opts.alpha });
        case 'heart':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.heart, x, y, size, { alpha: opts.alpha });
        case 'b':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.dynamite_chest, x, y, size, { alpha: opts.alpha });
        case 'c':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.cart, x, y, size, { alpha: opts.alpha });
        case 'm':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.wall, x, y, size, { alpha: opts.alpha });
        case 'helmet':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.helmet, x, y, size, { alpha: opts.alpha });
        case 'ghost':
            return drawMiniMapFrame(scene, ctx, 'ghost_anim', 0, x, y, size, { alpha: opts.alpha });
        case 'bat':
            return drawMiniMapFrame(scene, ctx, 'bat_anim', 0, x, y, size, { alpha: opts.alpha });
        default:
            return false;
    }
}

function drawMiniMapPreview(scene) {
    if (!scene) return;
    const canvas = el('miniMapPreview');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    // compute map rectangle first so bg/fg images can be clipped to it
    const rows = scene.rows || 1;
    const cols = scene.cols || 1;
    const cell = Math.max(2, Math.floor(Math.min(width / cols, height / rows)));
    const mapW = cell * cols;
    const mapH = cell * rows;
    const offX = Math.floor((width - mapW) / 2);
    const offY = Math.floor((height - mapH) / 2);

    // draw layered background images (support multiple bg layers from DOM or select)
    const showBg = !!el('showBackground')?.checked;
    // try layers from DOM editor first
    const domBgLayers = readBackgroundLayersFromDOM();
    let bgLayers = null;
    if (Array.isArray(domBgLayers) && domBgLayers.length > 0) bgLayers = domBgLayers;
    else {
        // fallback: read from single select value
        const bgVal = String(el('levelBackground')?.value ?? '').trim();
        if (bgVal && showBg) {
            // prefer numbered levels textures
            if (/^\d+$/.test(bgVal)) {
                bgLayers = [{ src: `images/level${bgVal}.png`, parallaxBgFactor: 1.0, parallaxBgAlpha: 1.0 }];
            } else {
                bgLayers = [{ src: String(bgVal), parallaxBgFactor: 1.0, parallaxBgAlpha: 1.0 }];
            }
        }
    }

    // simple image cache to avoid reloading
    window.__levelEditorImageCache = window.__levelEditorImageCache || {};
    const drawLayerImage = (layer) => {
        if (!layer || !layer.src) return false;
        if (layer.enabled === false) return false;
        const src = String(layer.src || '').trim();
        if (!src) return false;
        const cache = window.__levelEditorImageCache;
        if (!cache[src]) {
            const img = new Image();
            try { img.crossOrigin = 'anonymous'; } catch (e) {}
            cache[src] = { img, loaded: false };
            img.onload = () => { cache[src].loaded = true; drawMiniMapPreview(scene); };
            img.onerror = () => { cache[src].loaded = false; };
            img.src = src;
            return false;
        }
        const entry = cache[src];
        if (!entry.loaded) return false;
        const img = entry.img;
        const alpha = Number.isFinite(layer.parallaxBgAlpha) ? layer.parallaxBgAlpha : 1.0;
        const offsetX = parseNumber(layer.offsetX ?? layer.left ?? layer.x ?? layer.positionX, 0);
        const offsetY = parseNumber(layer.offsetY ?? layer.top ?? layer.y ?? layer.positionY, 0);
        const stepX = parseNumber(layer.repeatStepX ?? layer.replicaStepX ?? layer.repeatOffsetX ?? layer.replicaOffsetX, mapW) || mapW;
        const stepY = parseNumber(layer.repeatStepY ?? layer.replicaStepY ?? layer.repeatOffsetY ?? layer.replicaOffsetY, mapH) || mapH;
        const repeatX = parseRepeatValue(layer.repeatX ?? layer.replicaX ?? layer.repeatCountX ?? layer.replicaCountX ?? 1, 1);
        const repeatY = parseRepeatValue(layer.repeatY ?? layer.replicaY ?? layer.repeatCountY ?? layer.replicaCountY ?? 1, 1);
        const countX = (repeatX === '*') ? Math.max(1, Math.ceil((mapW + Math.abs(offsetX)) / Math.max(1, Math.abs(stepX))) + 2) : repeatX;
        const countY = (repeatY === '*') ? Math.max(1, Math.ceil((mapH + Math.abs(offsetY)) / Math.max(1, Math.abs(stepY))) + 2) : repeatY;
        try {
            ctx.save();
            // clip to map rectangle so image stays inside blue mini-map
            ctx.beginPath();
            ctx.rect(offX, offY, mapW, mapH);
            ctx.clip();
            ctx.globalAlpha = alpha;
            for (let iy = 0; iy < countY; iy++) {
                for (let ix = 0; ix < countX; ix++) {
                    const dx = offX + offsetX + stepX * ix;
                    const dy = offY + offsetY + stepY * iy;
                    ctx.drawImage(img, dx, dy, mapW, mapH);
                }
            }
            ctx.restore();
        } catch (e) {
            return false;
        }
        return true;
    };

    if (showBg && Array.isArray(bgLayers) && bgLayers.length > 0) {
        bgLayers.forEach((ly) => drawLayerImage(ly));
    }

    // only clear with solid color when there are no background layers
    if (!showBg || !Array.isArray(bgLayers) || bgLayers.length === 0) {
        ctx.fillStyle = '#060d1f';
        ctx.fillRect(0, 0, width, height);
    }

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cellData = scene.cells?.[row]?.[col];
            const base = cellData?.base || '-';
            const normBase = normalizeToken(base);
            // treat '-' as empty (background shows through). For '.' and '#' draw explicit colors:
            const isEmptyToken = normBase === '-';
            const reveal = cellData?.reveal;

            const x = offX + col * cell;
            const y = offY + row * cell;
            // If the base token is an invisible wall (#) or invisible tile (.), draw a solid color
            if (normBase === '#') {
                ctx.fillStyle = '#8b4513'; // brown for invisible wall
                ctx.fillRect(x, y, cell, cell);
            } else if (normBase === '.') {
                ctx.fillStyle = '#000000'; // black for invisible tile
                ctx.fillRect(x, y, cell, cell);
            } else if (!isEmptyToken) {
                // If there are no background layers, draw a solid cell background.
                if (!showBg || !Array.isArray(bgLayers) || bgLayers.length === 0) {
                    ctx.fillStyle = '#0f1f3e';
                    ctx.fillRect(x, y, cell, cell);
                }

                const rendered = drawMiniMapToken(scene, ctx, base, x, y, cell);
                if (!rendered) {
                    // if a background image is present, draw semi-transparent tile color
                    if (showBg && Array.isArray(bgLayers) && bgLayers.length > 0) {
                        ctx.save();
                        ctx.globalAlpha = 0.85;
                        ctx.fillStyle = tokenToMiniMapColor(base);
                        ctx.fillRect(x, y, cell, cell);
                        ctx.restore();
                    } else {
                        ctx.fillStyle = tokenToMiniMapColor(base);
                        ctx.fillRect(x, y, cell, cell);
                    }
                }
            }

            if (reveal) {
                const insetSize = Math.max(4, Math.floor(cell * 0.45));
                const rx = x + cell - insetSize - 1;
                const ry = y + cell - insetSize - 1;
                ctx.fillStyle = '#0b152c';
                ctx.fillRect(rx, ry, insetSize, insetSize);
                const revealRendered = drawMiniMapToken(scene, ctx, reveal, rx, ry, insetSize);
                if (!revealRendered) {
                    ctx.fillStyle = tokenToMiniMapColor(reveal);
                    ctx.fillRect(rx, ry, insetSize, insetSize);
                }
                ctx.strokeStyle = 'rgba(255, 215, 106, 0.85)';
                ctx.strokeRect(rx + 0.5, ry + 0.5, insetSize - 1, insetSize - 1);
            }

            if (cell >= 6) {
                ctx.strokeStyle = 'rgba(140, 176, 230, 0.22)';
                ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
            }
        }
    }

    const playerRow = clamp(Math.floor(parseNumber(el('playerRow')?.value, 1)), 0, Math.max(0, rows - 1));
    const playerCol = clamp(Math.floor(parseNumber(el('playerCol')?.value, 1)), 0, Math.max(0, cols - 1));
    const px = offX + playerCol * cell + cell / 2;
    const py = offY + playerRow * cell + cell / 2;
    const markerSize = Math.max(6, Math.floor(cell * 0.75));
    const markerX = Math.floor(px - markerSize / 2);
    const markerY = Math.floor(py - markerSize / 2);
    const playerDrawn = drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.player, markerX, markerY, markerSize, { alpha: 1 });
    if (!playerDrawn) {
        const pr = Math.max(2, Math.floor(cell * 0.28));
        ctx.fillStyle = '#19ff7d';
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.strokeStyle = '#7cc7ff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(offX + 0.5, offY + 0.5, mapW - 1, mapH - 1);

    // draw foreground layers over the map (from DOM or fallback)
    const showFg = !!el('showForeground')?.checked;
    const domFg = readForegroundLayersFromDOM();
    let fgLayers = null;
    if (Array.isArray(domFg) && domFg.length > 0) fgLayers = domFg;
    else {
        const fgVal = String(el('levelForeground')?.value ?? '').trim();
        if (fgVal) fgLayers = [{ src: fgVal, parallaxFgFactor: 1.0, parallaxFgAlpha: 1.0 }];
    }
    if (showFg && Array.isArray(fgLayers) && fgLayers.length > 0) {
        fgLayers.forEach((ly) => {
            if (!ly || !ly.src) return;
            if (ly.enabled === false) return;
            const src = String(ly.src || '').trim();
            const cache = window.__levelEditorImageCache || {};
            if (!cache[src]) {
                const img = new Image();
                try { img.crossOrigin = 'anonymous'; } catch (e) {}
                cache[src] = { img, loaded: false };
                img.onload = () => { cache[src].loaded = true; drawMiniMapPreview(scene); };
                img.onerror = () => { cache[src].loaded = false; };
                img.src = src;
                window.__levelEditorImageCache = cache;
                return;
            }
            const entry = cache[src];
            if (!entry.loaded) return;
            const offsetX = parseNumber(ly.offsetX ?? ly.left ?? ly.x ?? ly.positionX, 0);
            const offsetY = parseNumber(ly.offsetY ?? ly.top ?? ly.y ?? ly.positionY, 0);
            const stepX = parseNumber(ly.repeatStepX ?? ly.replicaStepX ?? ly.repeatOffsetX ?? ly.replicaOffsetX, mapW) || mapW;
            const stepY = parseNumber(ly.repeatStepY ?? ly.replicaStepY ?? ly.repeatOffsetY ?? ly.replicaOffsetY, mapH) || mapH;
            const repeatX = parseRepeatValue(ly.repeatX ?? ly.replicaX ?? ly.repeatCountX ?? ly.replicaCountX ?? 1, 1);
            const repeatY = parseRepeatValue(ly.repeatY ?? ly.replicaY ?? ly.repeatCountY ?? ly.replicaCountY ?? 1, 1);
            const countX = (repeatX === '*') ? Math.max(1, Math.ceil((mapW + Math.abs(offsetX)) / Math.max(1, Math.abs(stepX))) + 2) : repeatX;
            const countY = (repeatY === '*') ? Math.max(1, Math.ceil((mapH + Math.abs(offsetY)) / Math.max(1, Math.abs(stepY))) + 2) : repeatY;
            try {
                ctx.save();
                // clip to map rectangle so fg stays inside mini-map
                ctx.beginPath();
                ctx.rect(offX, offY, mapW, mapH);
                ctx.clip();
                ctx.globalAlpha = Number.isFinite(ly.parallaxFgAlpha) ? ly.parallaxFgAlpha : 1.0;
                for (let iy = 0; iy < countY; iy++) {
                    for (let ix = 0; ix < countX; ix++) {
                        const dx = offX + offsetX + stepX * ix;
                        const dy = offY + offsetY + stepY * iy;
                        ctx.drawImage(entry.img, dx, dy, mapW, mapH);
                    }
                }
                ctx.restore();
            } catch (e) { /* ignore */ }
        });
    }
}

function readLevelFromForm() {
    if (!ensureObjectMappingsReadyOrPrompt('configura almeno un oggetto prima dell\'export')) {
        throw new Error('Nessun oggetto configurato. Apri OBJ e salva almeno un elemento con token valido.');
    }

    const scene = getScene();
    const cols = scene?.cols || parseNumber(el('gridCols')?.value, 12);
    const rows = scene?.rows || parseNumber(el('gridRows')?.value, 12);

    let dbSizes = null;
    try {
        const raw = String(el('dbSizes')?.value ?? '').trim();
        dbSizes = !raw || raw.toLowerCase() === 'null' ? null : JSON.parse(raw);
    } catch (_e) {
        dbSizes = null;
    }

    let extra = {};
    try {
        const rawExtra = String(el('extraRootJson')?.value ?? '').trim();
        extra = rawExtra ? JSON.parse(rawExtra) : {};
        if (!extra || typeof extra !== 'object' || Array.isArray(extra)) {
            extra = {};
        }
    } catch (_e) {
        extra = {};
    }

    const splitRangeRaw = String(el('dbSplitRange')?.value ?? '2,3').split(',').map((x) => Number(x.trim())).filter((x) => Number.isFinite(x));
    const splitRange = splitRangeRaw.length >= 2 ? [splitRangeRaw[0], splitRangeRaw[1]] : [2, 3];

    const objectsEffects = buildObjectsEffectsFromWizard();

    const level = {
        id: String(el('levelId')?.value ?? '1.0').trim() || '1.0',
        map: {
            cols,
            rows,
            timer: parseNumber(el('mapTimer')?.value, 120),
            tiles: scene ? scene.toTilesMatrix() : []
        },
        playerStart: {
            row: clamp(Math.floor(parseNumber(el('playerRow')?.value, 1)), 0, Math.max(0, rows - 1)),
            col: clamp(Math.floor(parseNumber(el('playerCol')?.value, 1)), 0, Math.max(0, cols - 1))
        },
        staticRocks: {
            enabled: parseBool(el('srEnabled')?.value, true),
            dynamicSize: parseNullableInput(el('srDynamicSize')?.value),
            rotation: parseNullableInput(el('srRotation')?.value),
            chaotic: parseNullableInput(el('srChaotic')?.value),
            shardBurstCount: parseNumber(el('srShardBurstCount')?.value, 0)
        },
        dynamicBoulders: {
            enabled: parseBool(el('dbEnabled')?.value, true),
            directions: (function(){
                const elDirs = el('dbDirections');
                if (elDirs && elDirs.options) {
                    return Array.from(elDirs.options).filter(o=>o.selected).map(o=>o.value).filter(Boolean);
                }
                return String(el('dbDirections')?.value || '').split(',').map((x) => x.trim()).filter(Boolean);
            })(),
            sizes: dbSizes,
            splitOnImpact: parseBool(el('dbSplitOnImpact')?.value, false),
            splitPiecesRange: splitRange,
            maxSplitGeneration: parseNumber(el('dbMaxSplitGen')?.value, 1)
        },
        speed: parseNumber(el('levelSpeed')?.value, 1),
        escapeRoute: parseBool(el('escapeRoute')?.value, true),
        objectiveLabel: String(el('objectiveLabel')?.value || 'objective_collect_gems_and_survive').trim(),
        enemies: null,
        collectibles: null,
        traps: null,
        spawnPoints: null,
        timeLimit: null,
        scoreRules: null,
        effects: {
            general: {
                light: String(el('lightMode')?.value || 'piena').trim(),
                rain: {
                    enabled: !!el('rainEnabled')?.checked,
                    intensity: parseNumber(el('rainIntensity')?.value, 1),
                    frequency: parseNumber(el('rainFrequency')?.value, 180),
                    wind: parseNumber(el('rainWind')?.value, 0),
                    direction: String(el('rainDirection')?.value || 'down'),
                    interval: parseNumber(el('rainInterval')?.value, 5),
                    duration: parseNumber(el('rainDuration')?.value, 0)
                },
                fog: {
                    enabled: !!el('fogEnabled')?.checked,
                    alpha: parseNumber(el('fogAlpha')?.value, 0.15),
                    layers: Math.max(1, parseNumber(el('fogLayers')?.value, 3)),
                    speed: String(el('fogSpeed')?.value || 'slow'),
                    direction: String(el('fogDirection')?.value || 'left')
                }
            },
            objects: objectsEffects
        },
        ...collectEnemyParamValues()
    };

    // tokenMap (optional mapping of shorthand tokens)
    try {
        const rawTokenMap = String(el('tokenMapJson')?.value ?? '').trim();
        if (rawTokenMap) {
            try {
                const parsedMap = JSON.parse(rawTokenMap);
                if (parsedMap && typeof parsedMap === 'object' && !Array.isArray(parsedMap)) {
                    level.tokenMap = parsedMap;
                }
            } catch (e) {
                // ignore parse errors and skip tokenMap
            }
        }
    } catch (e) {}

    // include background/foreground enabled flags
    level.backgroundEnabled = !!el('showBackground')?.checked;
    level.foregroundEnabled = !!el('showForeground')?.checked;

    // background can be single or multiple
    // Prefer structured background layers UI if present
    const bgList = readBackgroundLayersFromDOM();
    if (bgList && bgList.length) {
        level.background = bgList;
    } else {
        const bgEl = el('levelBackground');
        if (bgEl && bgEl.options) {
            const selected = Array.from(bgEl.options).filter(o => o.selected).map(o => (o.value === '' ? null : (/^\d+$/.test(o.value) ? Number(o.value) : o.value)));
            const real = selected.filter(v => v !== null);
            if (real.length === 1) level.background = real[0];
            else if (real.length > 1) level.background = real;
        }
    }

    // foreground (optional) can be single or multiple
    const fgList = readForegroundLayersFromDOM();
    if (fgList && fgList.length) {
        level.foreground = fgList;
    } else {
        const fgEl = el('levelForeground');
        if (fgEl && fgEl.options) {
            const selectedF = Array.from(fgEl.options).filter(o => o.selected).map(o => (o.value === '' ? null : o.value));
            const realF = selectedF.filter(v => v !== null);
            if (realF.length === 1) level.foreground = realF[0];
            else if (realF.length > 1) level.foreground = realF;
        }
    }

    // music (optional)
    try {
        const mu = String(el('levelMusic')?.value || '').trim();
        if (mu) level.music = mu;
    } catch (e) { /* ignore */ }

    // gems one-by-one flag (per-map)
    try {
        if (el('gemsOneByOne')) {
            level.map.gemsOneByOne = !!el('gemsOneByOne').checked;
        }
    } catch (e) { }

    try {
        const mappings = collectObjectMappingsFromEditor();
        if (Array.isArray(mappings) && mappings.length) {
            level.objectMappings = mappings;
        }
    } catch (e) { /* ignore */ }

    return { ...level, ...extra, map: level.map, playerStart: level.playerStart };
}

function applyLevelToForm(levelData) {
    const data = { ...DEFAULT_LEVEL, ...(levelData || {}) };
    const effectsRoot = (data.effects && typeof data.effects === 'object' && !Array.isArray(data.effects)) ? data.effects : {};
    const generalEffects = (effectsRoot.general && typeof effectsRoot.general === 'object' && !Array.isArray(effectsRoot.general)) ? effectsRoot.general : {};
    const objectsEffects = (effectsRoot.objects && typeof effectsRoot.objects === 'object' && !Array.isArray(effectsRoot.objects)) ? effectsRoot.objects : {};
    const resolvedLight = generalEffects.light ?? data.light ?? DEFAULT_LEVEL.effects.general.light;
    const resolvedRain = {
        ...(DEFAULT_LEVEL.effects?.general?.rain || {}),
        ...(data.rain || {}),
        ...(generalEffects.rain || {})
    };
    const resolvedFog = {
        ...(DEFAULT_LEVEL.effects?.general?.fog || {}),
        ...(data.fog || {}),
        ...(generalEffects.fog || {})
    };
    const mapData = data.map || {};
    const staticRocks = { ...DEFAULT_LEVEL.staticRocks, ...(data.staticRocks || {}) };
    const dynamicBoulders = { ...DEFAULT_LEVEL.dynamicBoulders, ...(data.dynamicBoulders || {}) };

    el('levelId').value = data.id ?? DEFAULT_LEVEL.id;
    el('gridCols').value = mapData.cols ?? DEFAULT_LEVEL.map.cols;
    el('gridRows').value = mapData.rows ?? DEFAULT_LEVEL.map.rows;
    el('mapTimer').value = mapData.timer ?? DEFAULT_LEVEL.map.timer;
    el('levelSpeed').value = data.speed ?? DEFAULT_LEVEL.speed;
    try { rebuildEnemyParamsUI(data); } catch (e) {}
    el('objectiveLabel').value = data.objectiveLabel ?? DEFAULT_LEVEL.objectiveLabel;
    el('lightMode').value = resolvedLight;
    el('escapeRoute').value = String(!!data.escapeRoute);
    // legacy background/foreground selects are optional; layers DOM is authoritative

    el('playerRow').value = data.playerStart?.row ?? DEFAULT_LEVEL.playerStart.row;
    el('playerCol').value = data.playerStart?.col ?? DEFAULT_LEVEL.playerStart.col;

    // background/foreground toggles
    if (el('showBackground')) el('showBackground').checked = data.backgroundEnabled !== undefined ? !!data.backgroundEnabled : true;
    if (el('showForeground')) el('showForeground').checked = data.foregroundEnabled !== undefined ? !!data.foregroundEnabled : true;
    if (el('autoGridFromBg')) el('autoGridFromBg').checked = true;
    if (el('rainEnabled')) el('rainEnabled').checked = !!resolvedRain.enabled;
    if (el('rainIntensity')) el('rainIntensity').value = resolvedRain.intensity ?? 1;
    if (el('rainFrequency')) el('rainFrequency').value = resolvedRain.frequency ?? 180;
    if (el('rainWind')) el('rainWind').value = resolvedRain.wind ?? 0;
    if (el('rainDirection')) el('rainDirection').value = resolvedRain.direction ?? 'down';
    if (el('rainInterval')) el('rainInterval').value = resolvedRain.interval ?? 5;
    if (el('rainDuration')) el('rainDuration').value = resolvedRain.duration ?? 0;

    // populate fog editor if present
    try {
        if (el('fogEnabled')) el('fogEnabled').checked = !!resolvedFog.enabled;
        if (el('fogAlpha')) el('fogAlpha').value = resolvedFog.alpha ?? 0.15;
        if (el('fogLayers')) el('fogLayers').value = resolvedFog.layers ?? 3;
        if (el('fogSpeed')) el('fogSpeed').value = resolvedFog.speed ?? 'slow';
        if (el('fogDirection')) el('fogDirection').value = resolvedFog.direction ?? 'left';
    } catch (e) {}

    try { applyObjectsEffectsWizard(objectsEffects); } catch (e) {}

    // populate tokenMap editor if present
    try {
        const tmEl = el('tokenMapJson');
        if (tmEl) {
            tmEl.value = data.tokenMap && typeof data.tokenMap === 'object' ? JSON.stringify(data.tokenMap, null, 2) : '{}';
        }
    } catch (e) {}

    el('srEnabled').value = String(!!staticRocks.enabled);
    el('srDynamicSize').value = staticRocks.dynamicSize === null ? 'null' : JSON.stringify(staticRocks.dynamicSize);
    el('srRotation').value = staticRocks.rotation === null ? 'null' : JSON.stringify(staticRocks.rotation);
    el('srChaotic').value = staticRocks.chaotic === null ? 'null' : JSON.stringify(staticRocks.chaotic);
    el('srShardBurstCount').value = staticRocks.shardBurstCount ?? 0;

    el('dbEnabled').value = String(!!dynamicBoulders.enabled);
    el('dbSplitOnImpact').value = String(!!dynamicBoulders.splitOnImpact);
    try {
        const dirsEl = el('dbDirections');
        if (dirsEl && dirsEl.options) {
            const vals = Array.isArray(dynamicBoulders.directions) ? dynamicBoulders.directions : (dynamicBoulders.directions ? String(dynamicBoulders.directions).split(',').map(s=>s.trim()) : []);
            Array.from(dirsEl.options).forEach(o => { o.selected = vals.includes(o.value); });
        } else {
            el('dbDirections').value = Array.isArray(dynamicBoulders.directions) ? dynamicBoulders.directions.join(',') : 'top,bottom,left,right';
        }
    } catch (e) { el('dbDirections').value = Array.isArray(dynamicBoulders.directions) ? dynamicBoulders.directions.join(',') : 'top,bottom,left,right'; }
    el('dbSizes').value = dynamicBoulders.sizes === null ? 'null' : JSON.stringify(dynamicBoulders.sizes, null, 2);
    const range = Array.isArray(dynamicBoulders.splitPiecesRange) && dynamicBoulders.splitPiecesRange.length >= 2
        ? dynamicBoulders.splitPiecesRange
        : [2, 3];
    el('dbSplitRange').value = `${range[0]},${range[1]}`;
    el('dbMaxSplitGen').value = dynamicBoulders.maxSplitGeneration ?? 1;

    // Populate background/foreground layer editors if present
    try { applyBackgroundLayersToDOM(data.background); } catch (e) {}
    try { applyForegroundLayersToDOM(data.foreground); } catch (e) {}

    // music
    try {
        if (el('levelMusic')) el('levelMusic').value = data.music ? String(data.music) : '';
        try { if (window.__editorMusicAudio && data.music) { window.__editorMusicAudio.src = String(data.music); } } catch (e) {}
    } catch (e) {}

    try {
        loadObjectMappingsToEditor(data.objectMappings || []);
        buildDomPalette();
    } catch (e) {}

    // set gemsOneByOne checkbox if present in map or top-level
    try {
        if (el('gemsOneByOne')) {
            el('gemsOneByOne').checked = Boolean((mapData && typeof mapData.gemsOneByOne !== 'undefined') ? mapData.gemsOneByOne : (typeof data.gemsOneByOne !== 'undefined' ? data.gemsOneByOne : false));
        }
    } catch (e) { }

    const knownKeys = new Set([
        'tokenMap',
        'id', 'map', 'playerStart', 'staticRocks', 'dynamicBoulders', 'speed', 'escapeRoute',
        'objectiveLabel', 'enemies', 'collectibles', 'traps', 'spawnPoints', 'timeLimit',
        'scoreRules', 'light', 'effects', 'ghost', 'bat', 'ghostSpeed', 'batSpeed',
        'background', 'foreground', 'backgroundEnabled', 'foregroundEnabled', 'rain', 'fog', 'music',
        'gemsOneByOne', 'requiredGems', 'gemsRequired', 'playerStart2', 'timer', 'objectMappings'
    ]);
    const extra = {};
    Object.keys(data).forEach((key) => {
        if (!knownKeys.has(key)) {
            extra[key] = data[key];
        }
    });
    el('extraRootJson').value = JSON.stringify(extra, null, 2);
}

function exportJsonToFile(levelData) {
    const fileNameBase = String(levelData.id || 'level_custom').replace(/[^a-z0-9_-]+/gi, '_');
    const blob = new Blob([JSON.stringify(levelData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileNameBase}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importLevelFromText(text, filename) {
    try {
        const parsed = JSON.parse(text);
        applyLevelToForm(parsed);
        const scene = getScene();
        scene?.loadFromJson(parsed);
        scene?.updateEditorBackgroundImage?.();
        setStatus(`Import completato: ${filename || 'clipboard/file'}`);
    } catch (error) {
        setStatus(`Errore import: ${error.message}`, true);
    }
}

// --- Background / Foreground DOM editors ---
function readBackgroundLayersFromDOM() {
    if (typeof document === 'undefined') return null;
    const container = el('bgLayersContainer');
    if (!container) return null;
    const layers = [];
    const items = Array.from(container.querySelectorAll('.bg-layer'));
    items.forEach((it) => {
        const enabled = !!it.querySelector('.bg-enabled')?.checked;
        let src = '';
        const sel = it.querySelector('select.bg-src');
        if (sel) {
            const v = String(sel.value || '').trim();
            src = v ? `${BG_ASSETS_DIR}/${v}` : '';
        } else {
            src = normalizeLayerSrc(it.querySelector('.bg-src')?.value, 'bg');
        }
        if (!src) return; // skip empty
        const factor = parseNumber(it.querySelector('.bg-factor')?.value, 1.0);
        const alpha = parseNumber(it.querySelector('.bg-alpha')?.value, 1.0);
        const offsetX = parseNumber(it.querySelector('.bg-offset-x')?.value, 0);
        const offsetY = parseNumber(it.querySelector('.bg-offset-y')?.value, 0);
        const repeatX = parseRepeatValue(it.querySelector('.bg-repeat-x')?.value, 1);
        const repeatY = parseRepeatValue(it.querySelector('.bg-repeat-y')?.value, 1);
        const stepX = parseNumber(it.querySelector('.bg-step-x')?.value, 0);
        const stepY = parseNumber(it.querySelector('.bg-step-y')?.value, 0);
        layers.push({
            src,
            enabled,
            parallaxBgFactor: factor,
            parallaxBgAlpha: alpha,
            offsetX,
            offsetY,
            repeatX,
            repeatY,
            repeatStepX: stepX,
            repeatStepY: stepY
        });
    });
    return layers;
}

function readForegroundLayersFromDOM() {
    if (typeof document === 'undefined') return null;
    const container = el('fgLayersContainer');
    if (!container) return null;
    const layers = [];
    const items = Array.from(container.querySelectorAll('.fg-layer'));
    items.forEach((it) => {
        const enabled = !!it.querySelector('.fg-enabled')?.checked;
        let src = '';
        const sel = it.querySelector('select.fg-src');
        if (sel) {
            const v = String(sel.value || '').trim();
            src = v ? `${FG_ASSETS_DIR}/${v}` : '';
        } else {
            src = normalizeLayerSrc(it.querySelector('.fg-src')?.value, 'fg');
        }
        if (!src) return;
        const factor = parseNumber(it.querySelector('.fg-factor')?.value, 1.0);
        const alpha = parseNumber(it.querySelector('.fg-alpha')?.value, 1.0);
        const offsetX = parseNumber(it.querySelector('.fg-offset-x')?.value, 0);
        const offsetY = parseNumber(it.querySelector('.fg-offset-y')?.value, 0);
        const repeatX = parseRepeatValue(it.querySelector('.fg-repeat-x')?.value, 1);
        const repeatY = parseRepeatValue(it.querySelector('.fg-repeat-y')?.value, 1);
        const stepX = parseNumber(it.querySelector('.fg-step-x')?.value, 0);
        const stepY = parseNumber(it.querySelector('.fg-step-y')?.value, 0);
        layers.push({
            src,
            enabled,
            parallaxFgFactor: factor,
            parallaxFgAlpha: alpha,
            offsetX,
            offsetY,
            repeatX,
            repeatY,
            repeatStepX: stepX,
            repeatStepY: stepY
        });
    });
    return layers;
}

function applyBackgroundLayersToDOM(bg) {
    const container = el('bgLayersContainer');
    if (!container) return;
    container.innerHTML = '';
    ensureBgHeader();
    if (!bg) return;
    const arr = Array.isArray(bg) ? bg : (bg ? [bg] : []);
    arr.forEach((layer, idx) => {
        const src = layer?.src || String(layer || '').trim();
        const enabled = layer?.enabled !== false;
        const factor = layer?.parallaxBgFactor ?? 1.0;
        const alpha = layer?.parallaxBgAlpha ?? 1.0;
        const offsetX = layer?.offsetX ?? layer?.left ?? layer?.x ?? layer?.positionX ?? 0;
        const offsetY = layer?.offsetY ?? layer?.top ?? layer?.y ?? layer?.positionY ?? 0;
        const repeatX = layer?.repeatX ?? layer?.replicaX ?? layer?.repeatCountX ?? layer?.replicaCountX ?? 1;
        const repeatY = layer?.repeatY ?? layer?.replicaY ?? layer?.repeatCountY ?? layer?.replicaCountY ?? 1;
        const stepX = layer?.repeatStepX ?? layer?.replicaStepX ?? layer?.repeatOffsetX ?? layer?.replicaOffsetX ?? 0;
        const stepY = layer?.repeatStepY ?? layer?.replicaStepY ?? layer?.repeatOffsetY ?? layer?.replicaOffsetY ?? 0;
        const elRow = createBgLayerElement({ src, enabled, factor, alpha, offsetX, offsetY, repeatX, repeatY, stepX, stepY, idx });
        container.appendChild(elRow);
    });
    // If no radio is selected, default to the first background layer
    try {
        const anyChecked = !!container.querySelector('input.bg-active-radio:checked');
        if (!anyChecked) {
            const firstRadio = container.querySelector('input.bg-active-radio');
            if (firstRadio) firstRadio.checked = true;
        }
    } catch (e) { /* ignore */ }
}

function applyForegroundLayersToDOM(fg) {
    const container = el('fgLayersContainer');
    if (!container) return;
    container.innerHTML = '';
    ensureFgHeader();
    if (!fg) return;
    const arr = Array.isArray(fg) ? fg : (fg ? [fg] : []);
    arr.forEach((layer, idx) => {
        const src = layer?.src || String(layer || '').trim();
        const enabled = layer?.enabled !== false;
        const factor = layer?.parallaxFgFactor ?? 1.0;
        const alpha = layer?.parallaxFgAlpha ?? 1.0;
        const offsetX = layer?.offsetX ?? layer?.left ?? layer?.x ?? layer?.positionX ?? 0;
        const offsetY = layer?.offsetY ?? layer?.top ?? layer?.y ?? layer?.positionY ?? 0;
        const repeatX = layer?.repeatX ?? layer?.replicaX ?? layer?.repeatCountX ?? layer?.replicaCountX ?? 1;
        const repeatY = layer?.repeatY ?? layer?.replicaY ?? layer?.repeatCountY ?? layer?.replicaCountY ?? 1;
        const stepX = layer?.repeatStepX ?? layer?.replicaStepX ?? layer?.repeatOffsetX ?? layer?.replicaOffsetX ?? 0;
        const stepY = layer?.repeatStepY ?? layer?.replicaStepY ?? layer?.repeatOffsetY ?? layer?.replicaOffsetY ?? 0;
        container.appendChild(createFgLayerElement({ src, enabled, factor, alpha, offsetX, offsetY, repeatX, repeatY, stepX, stepY, idx }));
    });
}

function createBgLayerElement(cfg = {}) {
    const src = cfg.src || '';
    const factor = cfg.factor ?? 1.0;
    const alpha = cfg.alpha ?? 1.0;
    const enabled = cfg.enabled !== false;
    const offsetX = cfg.offsetX ?? 0;
    const offsetY = cfg.offsetY ?? 0;
    const repeatX = cfg.repeatX ?? 1;
    const repeatY = cfg.repeatY ?? 1;
    const stepX = cfg.stepX ?? 0;
    const stepY = cfg.stepY ?? 0;

    const wrapper = document.createElement('div');
    wrapper.className = 'bg-layer';
    wrapper.draggable = true;
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = '1fr';
    wrapper.style.gap = '4px';
    wrapper.style.marginBottom = '8px';
    wrapper.style.padding = '6px';
    wrapper.style.border = '1px solid #2c3f63';
    wrapper.style.borderRadius = '4px';
    wrapper.style.background = 'rgba(10,20,44,0.45)';

    const rowTop = document.createElement('div');
    rowTop.style.display = 'grid';
    rowTop.style.gridTemplateColumns = '22px 22px 1fr 96px';
    rowTop.style.gap = '6px';

    const enabledChk = document.createElement('input');
    enabledChk.type = 'checkbox';
    enabledChk.className = 'bg-enabled';
    enabledChk.checked = enabled;
    enabledChk.title = 'Layer attivo';

    // radio to select this layer as active background
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'bgActive';
    radio.className = 'bg-active-radio';
    radio.title = 'Usa come background principale';
    radio.addEventListener('change', () => {
        try { setStatus('Background principale impostato.'); } catch (e) {}
        try { const scene = getScene(); scene?.updateEditorBackgroundImage?.(); } catch (e) {}
    });

    // second column: select of available bg images (fallback to text input)
    let inp;
    const masterSelect = el('bgImageSelect');
    if (masterSelect) {
        const sel = document.createElement('select'); sel.className = 'bg-src'; sel.classList.add('bg-src'); sel.style.width = '100%';
        // copy options from masterSelect
        Array.from(masterSelect.options).forEach((o) => {
            const opt = document.createElement('option'); opt.value = o.value; opt.textContent = o.textContent; sel.appendChild(opt);
        });
        // set value from src keeping only the filename
        const current = layerFilenameFromSrc(src, 'bg');
        if (current) try { sel.value = current; } catch (e) {}
        inp = sel;
    } else {
        inp = document.createElement('input'); inp.className = 'bg-src'; inp.placeholder = `src (es. ${BG_ASSETS_DIR}/bg_10.png)`; inp.value = src || '';
    }
    const f = document.createElement('input'); f.className = 'bg-factor'; f.type = 'number'; f.step = '0.1'; f.value = String(factor);
    const a = document.createElement('input'); a.className = 'bg-alpha'; a.type = 'number'; a.step = '0.05'; a.value = String(alpha);
    const moveUp = document.createElement('button');
    moveUp.type = 'button';
    moveUp.textContent = '↑';
    moveUp.title = 'Sposta su';
    moveUp.className = 'layer-move-up';
    moveUp.style.padding = '4px';
    moveUp.addEventListener('click', () => {
        const parent = wrapper.parentElement;
        if (!parent) return;
        const prev = wrapper.previousElementSibling;
        if (prev && !prev.classList.contains('bg-header')) {
            parent.insertBefore(wrapper, prev);
            refreshLayerPreviews();
        }
    });

    const moveDown = document.createElement('button');
    moveDown.type = 'button';
    moveDown.textContent = '↓';
    moveDown.title = 'Sposta giu';
    moveDown.className = 'layer-move-down';
    moveDown.style.padding = '4px';
    moveDown.addEventListener('click', () => {
        const parent = wrapper.parentElement;
        if (!parent) return;
        const next = wrapper.nextElementSibling;
        if (next) {
            parent.insertBefore(next, wrapper);
            refreshLayerPreviews();
        }
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '✖';
    del.title = 'Rimuovi';
    del.style.padding = '4px';
    del.addEventListener('click', () => { wrapper.remove(); refreshLayerPreviews(); });

    const actions = document.createElement('div');
    actions.style.display = 'grid';
    actions.style.gridTemplateColumns = 'repeat(3, 1fr)';
    actions.style.gap = '4px';
    actions.appendChild(moveUp);
    actions.appendChild(moveDown);
    actions.appendChild(del);

    const rowMid = document.createElement('div');
    rowMid.style.display = 'grid';
    rowMid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    rowMid.style.gap = '6px';

    const ox = document.createElement('input'); ox.className = 'bg-offset-x'; ox.type = 'number'; ox.step = '1'; ox.value = String(offsetX); ox.title = 'offsetX'; ox.placeholder = 'offX';
    const oy = document.createElement('input'); oy.className = 'bg-offset-y'; oy.type = 'number'; oy.step = '1'; oy.value = String(offsetY); oy.title = 'offsetY'; oy.placeholder = 'offY';

    const rowBottom = document.createElement('div');
    rowBottom.style.display = 'grid';
    rowBottom.style.gridTemplateColumns = 'repeat(4, 1fr)';
    rowBottom.style.gap = '6px';

    const rx = document.createElement('input'); rx.className = 'bg-repeat-x'; rx.type = 'text'; rx.value = String(repeatX); rx.title = 'repeatX / replicaX'; rx.placeholder = 'repX';
    const ry = document.createElement('input'); ry.className = 'bg-repeat-y'; ry.type = 'text'; ry.value = String(repeatY); ry.title = 'repeatY / replicaY'; ry.placeholder = 'repY';
    const sx = document.createElement('input'); sx.className = 'bg-step-x'; sx.type = 'number'; sx.step = '1'; sx.value = String(stepX); sx.title = 'repeatStepX'; sx.placeholder = 'stepX';
    const sy = document.createElement('input'); sy.className = 'bg-step-y'; sy.type = 'number'; sy.step = '1'; sy.value = String(stepY); sy.title = 'repeatStepY'; sy.placeholder = 'stepY';

    rowTop.appendChild(enabledChk);
    rowTop.appendChild(radio);
    rowTop.appendChild(inp);
    rowTop.appendChild(actions);

    rowMid.appendChild(f);
    rowMid.appendChild(a);
    rowMid.appendChild(ox);
    rowMid.appendChild(oy);

    rowBottom.appendChild(rx);
    rowBottom.appendChild(ry);
    rowBottom.appendChild(sx);
    rowBottom.appendChild(sy);

    wrapper.appendChild(rowTop);
    wrapper.appendChild(rowMid);
    wrapper.appendChild(rowBottom);

    wrapper.addEventListener('dragstart', (ev) => {
        const t = ev.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'BUTTON' || t.tagName === 'TEXTAREA')) {
            ev.preventDefault();
            return;
        }
        wrapper.classList.add('dragging');
        try {
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('text/plain', 'bg-layer');
        } catch (e) { }
    });
    wrapper.addEventListener('dragend', () => {
        wrapper.classList.remove('dragging');
    });

    return wrapper;
}

function createFgLayerElement(cfg = {}) {
    const src = cfg.src || '';
    const factor = cfg.factor ?? 1.0;
    const alpha = cfg.alpha ?? 1.0;
    const enabled = cfg.enabled !== false;
    const offsetX = cfg.offsetX ?? 0;
    const offsetY = cfg.offsetY ?? 0;
    const repeatX = cfg.repeatX ?? 1;
    const repeatY = cfg.repeatY ?? 1;
    const stepX = cfg.stepX ?? 0;
    const stepY = cfg.stepY ?? 0;

    const wrapper = document.createElement('div');
    wrapper.className = 'fg-layer';
    wrapper.draggable = true;
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = '1fr';
    wrapper.style.gap = '4px';
    wrapper.style.marginBottom = '8px';
    wrapper.style.padding = '6px';
    wrapper.style.border = '1px solid #2c3f63';
    wrapper.style.borderRadius = '4px';
    wrapper.style.background = 'rgba(10,20,44,0.45)';

    const rowTop = document.createElement('div');
    rowTop.style.display = 'grid';
    rowTop.style.gridTemplateColumns = '22px 1fr 96px';
    rowTop.style.gap = '6px';

    const enabledChk = document.createElement('input');
    enabledChk.type = 'checkbox';
    enabledChk.className = 'fg-enabled';
    enabledChk.checked = enabled;
    enabledChk.title = 'Layer attivo';

    let inp;
    const masterSelect = el('fgImageSelect');
    if (masterSelect) {
        const sel = document.createElement('select'); sel.className = 'fg-src'; sel.style.width = '100%';
        Array.from(masterSelect.options).forEach((o) => {
            const opt = document.createElement('option'); opt.value = o.value; opt.textContent = o.textContent; sel.appendChild(opt);
        });
        const current = layerFilenameFromSrc(src, 'fg');
        if (current) try { sel.value = current; } catch (e) {}
        inp = sel;
    } else {
        inp = document.createElement('input'); inp.className = 'fg-src'; inp.placeholder = `src (es. ${FG_ASSETS_DIR}/foreground2.png)`; inp.value = src || '';
    }
    const f = document.createElement('input'); f.className = 'fg-factor'; f.type = 'number'; f.step = '0.1'; f.value = String(factor);
    const a = document.createElement('input'); a.className = 'fg-alpha'; a.type = 'number'; a.step = '0.05'; a.value = String(alpha);
    const moveUp = document.createElement('button');
    moveUp.type = 'button';
    moveUp.textContent = '↑';
    moveUp.title = 'Sposta su';
    moveUp.className = 'layer-move-up';
    moveUp.style.padding = '4px';
    moveUp.addEventListener('click', () => {
        const parent = wrapper.parentElement;
        if (!parent) return;
        const prev = wrapper.previousElementSibling;
        if (prev && !prev.classList.contains('fg-header')) {
            parent.insertBefore(wrapper, prev);
            refreshLayerPreviews();
        }
    });

    const moveDown = document.createElement('button');
    moveDown.type = 'button';
    moveDown.textContent = '↓';
    moveDown.title = 'Sposta giu';
    moveDown.className = 'layer-move-down';
    moveDown.style.padding = '4px';
    moveDown.addEventListener('click', () => {
        const parent = wrapper.parentElement;
        if (!parent) return;
        const next = wrapper.nextElementSibling;
        if (next) {
            parent.insertBefore(next, wrapper);
            refreshLayerPreviews();
        }
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '✖';
    del.title = 'Rimuovi';
    del.style.padding = '4px';
    del.addEventListener('click', () => { wrapper.remove(); refreshLayerPreviews(); });

    const actions = document.createElement('div');
    actions.style.display = 'grid';
    actions.style.gridTemplateColumns = 'repeat(3, 1fr)';
    actions.style.gap = '4px';
    actions.appendChild(moveUp);
    actions.appendChild(moveDown);
    actions.appendChild(del);

    const rowMid = document.createElement('div');
    rowMid.style.display = 'grid';
    rowMid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    rowMid.style.gap = '6px';

    const ox = document.createElement('input'); ox.className = 'fg-offset-x'; ox.type = 'number'; ox.step = '1'; ox.value = String(offsetX); ox.title = 'offsetX'; ox.placeholder = 'offX';
    const oy = document.createElement('input'); oy.className = 'fg-offset-y'; oy.type = 'number'; oy.step = '1'; oy.value = String(offsetY); oy.title = 'offsetY'; oy.placeholder = 'offY';

    const rowBottom = document.createElement('div');
    rowBottom.style.display = 'grid';
    rowBottom.style.gridTemplateColumns = 'repeat(4, 1fr)';
    rowBottom.style.gap = '6px';

    const rx = document.createElement('input'); rx.className = 'fg-repeat-x'; rx.type = 'text'; rx.value = String(repeatX); rx.title = 'repeatX / replicaX'; rx.placeholder = 'repX';
    const ry = document.createElement('input'); ry.className = 'fg-repeat-y'; ry.type = 'text'; ry.value = String(repeatY); ry.title = 'repeatY / replicaY'; ry.placeholder = 'repY';
    const sx = document.createElement('input'); sx.className = 'fg-step-x'; sx.type = 'number'; sx.step = '1'; sx.value = String(stepX); sx.title = 'repeatStepX'; sx.placeholder = 'stepX';
    const sy = document.createElement('input'); sy.className = 'fg-step-y'; sy.type = 'number'; sy.step = '1'; sy.value = String(stepY); sy.title = 'repeatStepY'; sy.placeholder = 'stepY';

    rowTop.appendChild(enabledChk);
    rowTop.appendChild(inp);
    rowTop.appendChild(actions);

    rowMid.appendChild(f);
    rowMid.appendChild(a);
    rowMid.appendChild(ox);
    rowMid.appendChild(oy);

    rowBottom.appendChild(rx);
    rowBottom.appendChild(ry);
    rowBottom.appendChild(sx);
    rowBottom.appendChild(sy);

    wrapper.appendChild(rowTop);
    wrapper.appendChild(rowMid);
    wrapper.appendChild(rowBottom);

    wrapper.addEventListener('dragstart', (ev) => {
        const t = ev.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'BUTTON' || t.tagName === 'TEXTAREA')) {
            ev.preventDefault();
            return;
        }
        wrapper.classList.add('dragging');
        try {
            ev.dataTransfer.effectAllowed = 'move';
            ev.dataTransfer.setData('text/plain', 'fg-layer');
        } catch (e) { }
    });
    wrapper.addEventListener('dragend', () => {
        wrapper.classList.remove('dragging');
    });

    return wrapper;
}

function ensureBgHeader() {
    const container = el('bgLayersContainer');
    if (!container) return;
    if (container.querySelector('.bg-header')) return;
    const header = document.createElement('div');
    header.className = 'bg-header';
    header.style.display = 'block';
    header.style.marginBottom = '6px';
    header.style.color = '#9fb8df';
    header.style.fontSize = '8px';
    header.textContent = 'BG: [enabled][active][image] | [factor,alpha,offX,offY] | [repX,repY,stepX,stepY]';
    container.appendChild(header);
}

function ensureFgHeader() {
    const container = el('fgLayersContainer');
    if (!container) return;
    if (container.querySelector('.fg-header')) return;
    const header = document.createElement('div');
    header.className = 'fg-header';
    header.style.display = 'block';
    header.style.marginBottom = '6px';
    header.style.color = '#9fb8df';
    header.style.fontSize = '8px';
    header.textContent = 'FG: [enabled][image] | [factor,alpha,offX,offY] | [repX,repY,stepX,stepY]';
    container.appendChild(header);
}

function refreshLayerPreviews() {
    try {
        const scene = getScene();
        scene?.updateEditorBackgroundImage?.(true);
        drawMiniMapPreview(scene);
    } catch (e) { }
}

function bindLayerDnD(container, itemSelector) {
    if (!container || container.dataset.dndBound === '1') return;
    container.dataset.dndBound = '1';

    const getDragAfterElement = (clientY) => {
        const draggableElements = Array.from(container.querySelectorAll(`${itemSelector}:not(.dragging)`));
        let closest = null;
        let closestOffset = Number.NEGATIVE_INFINITY;

        draggableElements.forEach((child) => {
            const box = child.getBoundingClientRect();
            const offset = clientY - box.top - box.height / 2;
            if (offset < 0 && offset > closestOffset) {
                closestOffset = offset;
                closest = child;
            }
        });

        return closest;
    };

    container.addEventListener('dragover', (ev) => {
        const dragging = container.querySelector(`${itemSelector}.dragging`);
        if (!dragging) return;
        ev.preventDefault();
        const afterElement = getDragAfterElement(ev.clientY);
        if (!afterElement) {
            container.appendChild(dragging);
        } else {
            container.insertBefore(dragging, afterElement);
        }
    });

    container.addEventListener('drop', (ev) => {
        const dragging = container.querySelector(`${itemSelector}.dragging`);
        if (!dragging) return;
        ev.preventDefault();
        dragging.classList.remove('dragging');
        refreshLayerPreviews();
    });

    container.addEventListener('dragend', () => {
        const dragging = container.querySelector(`${itemSelector}.dragging`);
        if (dragging) dragging.classList.remove('dragging');
    });
}

function bindUI() {
    const applyGridBtn = el('applyGridBtn');
    const clearGridBtn = el('clearGridBtn');
    const exportBtn = el('exportBtn');
    const copyJsonBtn = el('copyJsonBtn');
    const saveLocalBtn = el('saveLocalBtn');
    const loadLocalBtn = el('loadLocalBtn');
    const existingLevelSelect = el('existingLevelSelect');
    const reloadLevelFilesBtn = el('reloadLevelFilesBtn');
    const loadLevelFileBtn = el('loadLevelFileBtn');
    const saveLevelFileBtn = el('saveLevelFileBtn');
    const saveAsNewLevelFileBtn = el('saveAsNewLevelFileBtn');
    const importJsonFile = el('importJsonFile');
    const openConfigDialogBtn = el('openConfigDialogBtn');
    const openStartDialogBtn = el('openStartDialogBtn');
    const closeConfigDialogBtn = el('closeConfigDialogBtn');
    const closeStartDialogBtn = el('closeStartDialogBtn');
    const reloadConfigBtn = el('reloadConfigBtn');
    const reloadStartBtn = el('reloadStartBtn');
    const saveConfigBtn = el('saveConfigBtn');
    const saveStartBtn = el('saveStartBtn');
    const startPreviewModal = el('startPreviewModal');
    const closeStartPreviewBtn = el('closeStartPreviewBtn');
    const configModal = el('configModal');
    const startConfigModal = el('startConfigModal');
    const openObjectMapDialogBtn = el('openObjectMapDialogBtn');
    const openFileManagerBtn = el('openFileManagerBtn');
    const closeFileManagerBtn = el('closeFileManagerBtn');
    const refreshFileManagerBtn = el('refreshFileManagerBtn');
    const fileManagerModal = el('fileManagerModal');
    const closeObjectMapDialogBtn = el('closeObjectMapDialogBtn');
    const loadObjectMapFromFileBtn = el('loadObjectMapFromFileBtn');
    const loadObjectMapExampleBtn = el('loadObjectMapExampleBtn');
    const addObjectMapBtn = el('addObjectMapBtn');
    const saveObjectMapBtn = el('saveObjectMapBtn');
    const objectMapModal = el('objectMapModal');
    const reloadEffectLibraryBtn = el('reloadEffectLibraryBtn');
    const refreshLeftPalette = () => {
        try { buildDomPalette(); } catch (_e) { }
    };

    const FILE_MANAGER_STATE = {
        bgSelected: '',
        fgSelected: '',
        musicSelected: '',
        objSelected: '',
        attractSelected: '',
        bgSearch: '',
        fgSearch: '',
        musicSearch: '',
        objSearch: '',
        attractSearch: '',
        bgList: [],
        fgList: [],
        musicList: [],
        objList: [],
        attractList: []
    };

    function setFileManagerStatus(message, isError = false) {
        const node = el('fileManagerStatusText');
        if (!node) return;
        node.style.color = isError ? '#ff9fa7' : '#8ee89f';
        node.textContent = message || '';
    }

    function getFilePathByName(items, name) {
        const clean = String(name || '').trim();
        if (!clean) return '';
        const found = (Array.isArray(items) ? items : []).find((filePath) => {
            return (String(filePath || '').split('/').pop() || '') === clean;
        });
        return String(found || '').trim();
    }

    function renderImagePreview(previewId, srcPath) {
        const node = el(previewId);
        if (!node) return;
        node.innerHTML = '';
        const src = String(srcPath || '').trim();
        if (!src) {
            node.textContent = 'Nessun file selezionato';
            return;
        }
        const img = document.createElement('img');
        img.src = `${src}${src.includes('?') ? '&' : '?'}fm=${Date.now()}`;
        img.alt = src.split('/').pop() || 'preview';
        node.appendChild(img);
    }

    function formatAudioDuration(seconds) {
        const total = Number(seconds);
        if (!Number.isFinite(total) || total < 0) return '--:--';
        const mins = Math.floor(total / 60);
        const secs = Math.floor(total % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function renderMusicPreview(previewId, srcPath) {
        const node = el(previewId);
        if (!node) return;
        node.innerHTML = '';
        const src = String(srcPath || '').trim();
        if (!src) {
            node.textContent = 'Nessun file selezionato';
            return;
        }
        const wrapper = document.createElement('div');
        wrapper.style.width = '100%';
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'metadata';
        audio.src = `${src}${src.includes('?') ? '&' : '?'}fm=${Date.now()}`;
        const meta = document.createElement('div');
        meta.className = 'tiny';
        meta.style.marginTop = '6px';
        meta.style.color = '#b8d9ff';
        meta.textContent = 'Durata: caricamento...';
        audio.addEventListener('loadedmetadata', () => {
            meta.textContent = `Durata: ${formatAudioDuration(audio.duration)}`;
        });
        audio.addEventListener('error', () => {
            meta.textContent = 'Durata: non disponibile';
        });
        wrapper.appendChild(audio);
        wrapper.appendChild(meta);
        node.appendChild(wrapper);
    }

    function refreshManagerPreviews() {
        const bgPath = getFilePathByName(FILE_MANAGER_STATE.bgList, FILE_MANAGER_STATE.bgSelected);
        const fgPath = getFilePathByName(FILE_MANAGER_STATE.fgList, FILE_MANAGER_STATE.fgSelected);
        const musicPath = getFilePathByName(FILE_MANAGER_STATE.musicList, FILE_MANAGER_STATE.musicSelected);
        const objPath = getFilePathByName(FILE_MANAGER_STATE.objList, FILE_MANAGER_STATE.objSelected);
        const attractPath = getFilePathByName(FILE_MANAGER_STATE.attractList, FILE_MANAGER_STATE.attractSelected);
        renderImagePreview('fmBgPreview', bgPath);
        renderImagePreview('fmFgPreview', fgPath);
        renderImagePreview('fmObjPreview', objPath);
        renderImagePreview('fmAttractPreview', attractPath);
        renderMusicPreview('fmMusicPreview', musicPath);
    }

    function renderFileManagerList(containerId, items, selectedName, searchText, onSelect, inUseChecker) {
        const container = el(containerId);
        if (!container) return;
        container.innerHTML = '';
        const rawItems = Array.isArray(items) ? items : [];
        const search = String(searchText || '').trim().toLowerCase();
        const filtered = search
            ? rawItems.filter((filePath) => String(filePath || '').toLowerCase().includes(search))
            : rawItems;

        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'tiny';
            empty.textContent = search ? 'Nessun file trovato con il filtro corrente' : 'Nessun file disponibile';
            container.appendChild(empty);
            return;
        }
        filtered.forEach((filePath) => {
            const name = String(filePath || '').split('/').pop() || '';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filemgr-item';
            if (name === selectedName) btn.classList.add('is-selected');

            const nameSpan = document.createElement('span');
            nameSpan.className = 'name';
            nameSpan.textContent = name;

            const metaSpan = document.createElement('span');
            metaSpan.className = 'meta';
            metaSpan.textContent = inUseChecker && inUseChecker(name) ? 'In uso' : '';

            btn.appendChild(nameSpan);
            btn.appendChild(metaSpan);
            btn.addEventListener('click', () => onSelect(name));
            container.appendChild(btn);
        });
    }

    function renderFileManagerLists() {
        renderFileManagerList('fmBgList', FILE_MANAGER_STATE.bgList, FILE_MANAGER_STATE.bgSelected, FILE_MANAGER_STATE.bgSearch, (name) => {
            FILE_MANAGER_STATE.bgSelected = name;
            renderFileManagerLists();
        }, isBgFileInUse);

        renderFileManagerList('fmFgList', FILE_MANAGER_STATE.fgList, FILE_MANAGER_STATE.fgSelected, FILE_MANAGER_STATE.fgSearch, (name) => {
            FILE_MANAGER_STATE.fgSelected = name;
            renderFileManagerLists();
        }, isFgFileInUse);

        renderFileManagerList('fmMusicList', FILE_MANAGER_STATE.musicList, FILE_MANAGER_STATE.musicSelected, FILE_MANAGER_STATE.musicSearch, (name) => {
            FILE_MANAGER_STATE.musicSelected = name;
            renderFileManagerLists();
        }, isMusicFileInUse);

        renderFileManagerList('fmObjList', FILE_MANAGER_STATE.objList, FILE_MANAGER_STATE.objSelected, FILE_MANAGER_STATE.objSearch, (name) => {
            FILE_MANAGER_STATE.objSelected = name;
            renderFileManagerLists();
        }, isObjectFileInUse);

        renderFileManagerList('fmAttractList', FILE_MANAGER_STATE.attractList, FILE_MANAGER_STATE.attractSelected, FILE_MANAGER_STATE.attractSearch, (name) => {
            FILE_MANAGER_STATE.attractSelected = name;
            renderFileManagerLists();
        }, isAttractFileInUse);

        refreshManagerPreviews();
    }

    async function uploadAssetFile(endpoint, file) {
        if (!file) {
            throw new Error('nessun file selezionato');
        }
        const base64 = await fileToBase64(file);
        const response = await fetch(buildApiUrl(endpoint), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: file.name,
                contentBase64: base64
            })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || `upload fallito (${response.status})`);
        }
        return payload;
    }

    async function refreshFileManagerData() {
        const [bgList, fgList, musicList, objList, attractList] = await Promise.all([
            fetchJsonListWithFallback(buildApiUrl('images/background'), BG_MANIFEST_PATH),
            fetchJsonListWithFallback(buildApiUrl('images/foreground'), FG_MANIFEST_PATH),
            fetchJsonListWithFallback(buildApiUrl('music'), MUSIC_MANIFEST_PATH),
            fetchJsonListWithFallback(buildApiUrl('images/objects'), ''),
            fetchJsonListWithFallback(buildApiUrl('images/attractmode'), '')
        ]);

        FILE_MANAGER_STATE.bgList = bgList;
        FILE_MANAGER_STATE.fgList = fgList;
        FILE_MANAGER_STATE.musicList = musicList;
        FILE_MANAGER_STATE.objList = objList;
        FILE_MANAGER_STATE.attractList = attractList;

        const bgNames = new Set(bgList.map((p) => String(p).split('/').pop()));
        const fgNames = new Set(fgList.map((p) => String(p).split('/').pop()));
        const musicNames = new Set(musicList.map((p) => String(p).split('/').pop()));
        const objNames = new Set(objList.map((p) => String(p).split('/').pop()));
        const attractNames = new Set(attractList.map((p) => String(p).split('/').pop()));

        if (!bgNames.has(FILE_MANAGER_STATE.bgSelected)) FILE_MANAGER_STATE.bgSelected = '';
        if (!fgNames.has(FILE_MANAGER_STATE.fgSelected)) FILE_MANAGER_STATE.fgSelected = '';
        if (!musicNames.has(FILE_MANAGER_STATE.musicSelected)) FILE_MANAGER_STATE.musicSelected = '';
        if (!objNames.has(FILE_MANAGER_STATE.objSelected)) FILE_MANAGER_STATE.objSelected = '';
        if (!attractNames.has(FILE_MANAGER_STATE.attractSelected)) FILE_MANAGER_STATE.attractSelected = '';

        renderFileManagerLists();
    }

    async function refreshAllAssetSelectorsAndManager() {
        await Promise.all([
            populateImageOptions(),
            populateMusicOptions()
        ]);
        await refreshFileManagerData();
        refreshAssetUsageBadges();
    }

    async function renameAsset(endpoint, oldName, newName) {
        const response = await fetch(buildApiUrl(endpoint), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'rename',
                oldName,
                newName
            })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || `rinomina fallita (${response.status})`);
        }
        return payload;
    }

    async function uploadFromManagerInput(endpoint, inputId, selectedKey) {
        const input = el(inputId);
        const file = input?.files?.[0];
        if (!file) {
            setFileManagerStatus('Seleziona un file da caricare.', true);
            return;
        }
        const payload = await uploadAssetFile(endpoint, file);
        const fileName = String(payload?.file || '').split('/').pop() || file.name;
        FILE_MANAGER_STATE[selectedKey] = fileName;
        if (input) input.value = '';
        await refreshAllAssetSelectorsAndManager();
        setFileManagerStatus(`File caricato: ${fileName}`);
    }

    async function uploadFromDroppedFile(endpoint, file, selectedKey) {
        const payload = await uploadAssetFile(endpoint, file);
        const fileName = String(payload?.file || '').split('/').pop() || file.name;
        FILE_MANAGER_STATE[selectedKey] = fileName;
        await refreshAllAssetSelectorsAndManager();
        setFileManagerStatus(`File caricato: ${fileName}`);
    }

    async function deleteFromManager(endpoint, selectedName, inUseChecker, emptyMsg) {
        if (!selectedName) {
            setFileManagerStatus(emptyMsg, true);
            return;
        }
        if (inUseChecker(selectedName)) {
            setFileManagerStatus('File in uso nel livello: rimuovi prima il riferimento.', true);
            return;
        }
        if (!window.confirm(`Eliminare definitivamente il file "${selectedName}"?`)) {
            return;
        }
        await deleteAsset(endpoint, selectedName);
        await refreshAllAssetSelectorsAndManager();
        setFileManagerStatus(`File eliminato: ${selectedName}`);
    }

    async function renameFromManager(endpoint, selectedKey, inUseChecker, emptyMsg) {
        const oldName = String(FILE_MANAGER_STATE[selectedKey] || '').trim();
        if (!oldName) {
            setFileManagerStatus(emptyMsg, true);
            return;
        }
        if (inUseChecker(oldName)) {
            setFileManagerStatus('File in uso nel livello: rimuovi prima il riferimento.', true);
            return;
        }
        const newNameRaw = window.prompt(`Nuovo nome per "${oldName}"`, oldName);
        if (newNameRaw === null) return;
        const newName = String(newNameRaw || '').trim();
        if (!newName) {
            setFileManagerStatus('Nome file non valido.', true);
            return;
        }
        if (!/^[a-z0-9._-]+$/i.test(newName)) {
            setFileManagerStatus('Nome non valido: usa solo lettere, numeri, punto, trattino e underscore.', true);
            return;
        }
        await renameAsset(endpoint, oldName, newName);
        FILE_MANAGER_STATE[selectedKey] = newName;
        await refreshAllAssetSelectorsAndManager();
        setFileManagerStatus(`File rinominato: ${oldName} -> ${newName}`);
    }

    function bindDropzone(dropzoneId, endpoint, selectedKey) {
        const zone = el(dropzoneId);
        if (!zone) return;

        zone.addEventListener('dragover', (ev) => {
            ev.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', async (ev) => {
            ev.preventDefault();
            zone.classList.remove('drag-over');
            const file = ev.dataTransfer?.files?.[0];
            if (!file) {
                setFileManagerStatus('Nessun file rilevato nel drag and drop.', true);
                return;
            }
            try {
                await uploadFromDroppedFile(endpoint, file, selectedKey);
            } catch (e) {
                setFileManagerStatus(`Errore upload: ${e.message}`, true);
            }
        });
    }

    if (openConfigDialogBtn) {
        openConfigDialogBtn.addEventListener('click', async () => {
            if (configModal) configModal.classList.add('open');
            await loadConfigEditor();
        });
    }

    if (closeConfigDialogBtn) {
        closeConfigDialogBtn.addEventListener('click', () => {
            if (configModal) configModal.classList.remove('open');
        });
    }

    if (reloadConfigBtn) {
        reloadConfigBtn.addEventListener('click', async () => {
            await loadConfigEditor();
        });
    }

    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', async () => {
            await saveConfigEditor();
        });
    }

    if (configModal) {
        configModal.addEventListener('click', (ev) => {
            if (ev.target === configModal) {
                configModal.classList.remove('open');
            }
        });
    }

    if (openStartDialogBtn) {
        openStartDialogBtn.addEventListener('click', async () => {
            if (startConfigModal) startConfigModal.classList.add('open');
            bindStartEditorInteractions();
            await loadStartEditor();
        });
    }

    if (closeStartDialogBtn) {
        closeStartDialogBtn.addEventListener('click', () => {
            if (startConfigModal) startConfigModal.classList.remove('open');
        });
    }

    if (reloadStartBtn) {
        reloadStartBtn.addEventListener('click', async () => {
            await loadStartEditor();
        });
    }

    if (saveStartBtn) {
        saveStartBtn.addEventListener('click', async () => {
            await saveStartEditor();
        });
    }

    if (startConfigModal) {
        startConfigModal.addEventListener('click', (ev) => {
            if (ev.target === startConfigModal) {
                startConfigModal.classList.remove('open');
            }
        });
    }

    const startEnableFrontScenes = el('startEnableFrontScenes');
    if (startEnableFrontScenes) {
        startEnableFrontScenes.addEventListener('change', () => {
            collectStartConfigFromForm();
        });
    }

    const startCoinMode = el('startCoinMode');
    if (startCoinMode) {
        startCoinMode.addEventListener('change', () => {
            collectStartConfigFromForm();
            applyStartFormFromState();
        });
    }

    const startInitialCredits = el('startInitialCredits');
    if (startInitialCredits) {
        startInitialCredits.addEventListener('input', () => {
            collectStartConfigFromForm();
        });
    }

    const startAttractEnabled = el('startAttractEnabled');
    if (startAttractEnabled) {
        startAttractEnabled.addEventListener('change', () => {
            collectStartConfigFromForm();
        });
    }

    const startCanvasWidth = el('startCanvasWidth');
    if (startCanvasWidth) {
        startCanvasWidth.addEventListener('input', () => {
            collectStartConfigFromForm();
            renderStartAttractStage();
        });
    }

    const startCanvasHeight = el('startCanvasHeight');
    if (startCanvasHeight) {
        startCanvasHeight.addEventListener('input', () => {
            collectStartConfigFromForm();
            renderStartAttractStage();
        });
    }

    const startAddImageBtn = el('startAddImageBtn');
    if (startAddImageBtn) {
        startAddImageBtn.addEventListener('click', () => addStartImageElement());
    }

    const startAddTextBtn = el('startAddTextBtn');
    if (startAddTextBtn) {
        startAddTextBtn.addEventListener('click', () => addStartTextElement());
    }

    const startAddPluginBtn = el('startAddPluginBtn');
    if (startAddPluginBtn) {
        startAddPluginBtn.addEventListener('click', () => addStartPluginElement());
    }

    const startRemoveElementBtn = el('startRemoveElementBtn');
    if (startRemoveElementBtn) {
        startRemoveElementBtn.addEventListener('click', () => removeSelectedStartElement());
    }

    [
        'startElementX',
        'startElementY',
        'startElementW',
        'startElementH',
        'startElementEffect',
        'startElementColor',
        'startElementFontSize',
        'startElementDelayMs',
        'startElementDurationMs',
        'startElementText'
    ].forEach((id) => {
        const node = el(id);
        if (!node) return;
        node.addEventListener('input', () => updateSelectedStartElementFromInputs());
        node.addEventListener('change', () => updateSelectedStartElementFromInputs());
    });

    const startPreviewPlayBtn = el('startPreviewPlayBtn');
    if (startPreviewPlayBtn) {
        startPreviewPlayBtn.addEventListener('click', () => playStartPreview());
    }

    const startPreviewStopBtn = el('startPreviewStopBtn');
    if (startPreviewStopBtn) {
        startPreviewStopBtn.addEventListener('click', () => stopStartPreviewPlayback());
    }

    if (closeStartPreviewBtn) {
        closeStartPreviewBtn.addEventListener('click', () => {
            stopStartPreviewPlayback();
            if (startPreviewModal) startPreviewModal.classList.remove('open');
        });
    }

    if (startPreviewModal) {
        startPreviewModal.addEventListener('click', (ev) => {
            if (ev.target === startPreviewModal) {
                stopStartPreviewPlayback();
                startPreviewModal.classList.remove('open');
            }
        });
    }

    if (openObjectMapDialogBtn) {
        openObjectMapDialogBtn.addEventListener('click', () => {
            openObjectMapDialog('Editor mappaggio oggetti aperto.');
        });
    }

    if (openFileManagerBtn) {
        openFileManagerBtn.addEventListener('click', async () => {
            if (fileManagerModal) fileManagerModal.classList.add('open');
            setFileManagerStatus('Caricamento file...');
            try {
                await refreshAllAssetSelectorsAndManager();
                setFileManagerStatus('File manager pronto.');
            } catch (e) {
                setFileManagerStatus(`Errore caricamento liste: ${e.message}`, true);
            }
        });
    }
    if (closeFileManagerBtn) {
        closeFileManagerBtn.addEventListener('click', () => {
            if (fileManagerModal) fileManagerModal.classList.remove('open');
        });
    }
    if (refreshFileManagerBtn) {
        refreshFileManagerBtn.addEventListener('click', async () => {
            setFileManagerStatus('Aggiornamento liste...');
            try {
                await refreshAllAssetSelectorsAndManager();
                setFileManagerStatus('Liste aggiornate.');
            } catch (e) {
                setFileManagerStatus(`Errore aggiornamento: ${e.message}`, true);
            }
        });
    }
    if (fileManagerModal) {
        fileManagerModal.addEventListener('click', (ev) => {
            if (ev.target === fileManagerModal) {
                fileManagerModal.classList.remove('open');
            }
        });
    }

    const fmBgSearch = el('fmBgSearch');
    if (fmBgSearch) {
        fmBgSearch.addEventListener('input', () => {
            FILE_MANAGER_STATE.bgSearch = String(fmBgSearch.value || '');
            renderFileManagerLists();
        });
    }
    const fmFgSearch = el('fmFgSearch');
    if (fmFgSearch) {
        fmFgSearch.addEventListener('input', () => {
            FILE_MANAGER_STATE.fgSearch = String(fmFgSearch.value || '');
            renderFileManagerLists();
        });
    }
    const fmMusicSearch = el('fmMusicSearch');
    if (fmMusicSearch) {
        fmMusicSearch.addEventListener('input', () => {
            FILE_MANAGER_STATE.musicSearch = String(fmMusicSearch.value || '');
            renderFileManagerLists();
        });
    }
    const fmObjSearch = el('fmObjSearch');
    if (fmObjSearch) {
        fmObjSearch.addEventListener('input', () => {
            FILE_MANAGER_STATE.objSearch = String(fmObjSearch.value || '');
            renderFileManagerLists();
        });
    }
    const fmAttractSearch = el('fmAttractSearch');
    if (fmAttractSearch) {
        fmAttractSearch.addEventListener('input', () => {
            FILE_MANAGER_STATE.attractSearch = String(fmAttractSearch.value || '');
            renderFileManagerLists();
        });
    }

    const fmBgUploadBtn = el('fmBgUploadBtn');
    if (fmBgUploadBtn) {
        fmBgUploadBtn.addEventListener('click', async () => {
            try {
                await uploadFromManagerInput('images/background', 'fmBgInput', 'bgSelected');
            } catch (e) {
                setFileManagerStatus(`Errore upload background: ${e.message}`, true);
            }
        });
    }
    const fmFgUploadBtn = el('fmFgUploadBtn');
    if (fmFgUploadBtn) {
        fmFgUploadBtn.addEventListener('click', async () => {
            try {
                await uploadFromManagerInput('images/foreground', 'fmFgInput', 'fgSelected');
            } catch (e) {
                setFileManagerStatus(`Errore upload foreground: ${e.message}`, true);
            }
        });
    }
    const fmMusicUploadBtn = el('fmMusicUploadBtn');
    if (fmMusicUploadBtn) {
        fmMusicUploadBtn.addEventListener('click', async () => {
            try {
                await uploadFromManagerInput('music', 'fmMusicInput', 'musicSelected');
            } catch (e) {
                setFileManagerStatus(`Errore upload musica: ${e.message}`, true);
            }
        });
    }
    const fmObjUploadBtn = el('fmObjUploadBtn');
    if (fmObjUploadBtn) {
        fmObjUploadBtn.addEventListener('click', async () => {
            try {
                await uploadFromManagerInput('images/objects', 'fmObjInput', 'objSelected');
            } catch (e) {
                setFileManagerStatus(`Errore upload objects: ${e.message}`, true);
            }
        });
    }
    const fmAttractUploadBtn = el('fmAttractUploadBtn');
    if (fmAttractUploadBtn) {
        fmAttractUploadBtn.addEventListener('click', async () => {
            try {
                await uploadFromManagerInput('images/attractmode', 'fmAttractInput', 'attractSelected');
            } catch (e) {
                setFileManagerStatus(`Errore upload attractmode: ${e.message}`, true);
            }
        });
    }

    const fmBgDeleteBtn = el('fmBgDeleteBtn');
    if (fmBgDeleteBtn) {
        fmBgDeleteBtn.addEventListener('click', async () => {
            try {
                await deleteFromManager('images/background', FILE_MANAGER_STATE.bgSelected, isBgFileInUse, 'Seleziona un background da eliminare.');
            } catch (e) {
                setFileManagerStatus(`Errore eliminazione background: ${e.message}`, true);
            }
        });
    }
    const fmFgDeleteBtn = el('fmFgDeleteBtn');
    if (fmFgDeleteBtn) {
        fmFgDeleteBtn.addEventListener('click', async () => {
            try {
                await deleteFromManager('images/foreground', FILE_MANAGER_STATE.fgSelected, isFgFileInUse, 'Seleziona un foreground da eliminare.');
            } catch (e) {
                setFileManagerStatus(`Errore eliminazione foreground: ${e.message}`, true);
            }
        });
    }
    const fmMusicDeleteBtn = el('fmMusicDeleteBtn');
    if (fmMusicDeleteBtn) {
        fmMusicDeleteBtn.addEventListener('click', async () => {
            try {
                await deleteFromManager('music', FILE_MANAGER_STATE.musicSelected, isMusicFileInUse, 'Seleziona una traccia da eliminare.');
            } catch (e) {
                setFileManagerStatus(`Errore eliminazione musica: ${e.message}`, true);
            }
        });
    }
    const fmObjDeleteBtn = el('fmObjDeleteBtn');
    if (fmObjDeleteBtn) {
        fmObjDeleteBtn.addEventListener('click', async () => {
            try {
                await deleteFromManager('images/objects', FILE_MANAGER_STATE.objSelected, isObjectFileInUse, 'Seleziona un file objects da eliminare.');
            } catch (e) {
                setFileManagerStatus(`Errore eliminazione objects: ${e.message}`, true);
            }
        });
    }
    const fmAttractDeleteBtn = el('fmAttractDeleteBtn');
    if (fmAttractDeleteBtn) {
        fmAttractDeleteBtn.addEventListener('click', async () => {
            try {
                await deleteFromManager('images/attractmode', FILE_MANAGER_STATE.attractSelected, isAttractFileInUse, 'Seleziona un file attractmode da eliminare.');
            } catch (e) {
                setFileManagerStatus(`Errore eliminazione attractmode: ${e.message}`, true);
            }
        });
    }

    const fmBgRenameBtn = el('fmBgRenameBtn');
    if (fmBgRenameBtn) {
        fmBgRenameBtn.addEventListener('click', async () => {
            try {
                await renameFromManager('images/background', 'bgSelected', isBgFileInUse, 'Seleziona un background da rinominare.');
            } catch (e) {
                setFileManagerStatus(`Errore rinomina background: ${e.message}`, true);
            }
        });
    }
    const fmFgRenameBtn = el('fmFgRenameBtn');
    if (fmFgRenameBtn) {
        fmFgRenameBtn.addEventListener('click', async () => {
            try {
                await renameFromManager('images/foreground', 'fgSelected', isFgFileInUse, 'Seleziona un foreground da rinominare.');
            } catch (e) {
                setFileManagerStatus(`Errore rinomina foreground: ${e.message}`, true);
            }
        });
    }
    const fmMusicRenameBtn = el('fmMusicRenameBtn');
    if (fmMusicRenameBtn) {
        fmMusicRenameBtn.addEventListener('click', async () => {
            try {
                await renameFromManager('music', 'musicSelected', isMusicFileInUse, 'Seleziona una traccia da rinominare.');
            } catch (e) {
                setFileManagerStatus(`Errore rinomina musica: ${e.message}`, true);
            }
        });
    }
    const fmObjRenameBtn = el('fmObjRenameBtn');
    if (fmObjRenameBtn) {
        fmObjRenameBtn.addEventListener('click', async () => {
            try {
                await renameFromManager('images/objects', 'objSelected', isObjectFileInUse, 'Seleziona un file objects da rinominare.');
            } catch (e) {
                setFileManagerStatus(`Errore rinomina objects: ${e.message}`, true);
            }
        });
    }
    const fmAttractRenameBtn = el('fmAttractRenameBtn');
    if (fmAttractRenameBtn) {
        fmAttractRenameBtn.addEventListener('click', async () => {
            try {
                await renameFromManager('images/attractmode', 'attractSelected', isAttractFileInUse, 'Seleziona un file attractmode da rinominare.');
            } catch (e) {
                setFileManagerStatus(`Errore rinomina attractmode: ${e.message}`, true);
            }
        });
    }

    bindDropzone('fmBgDropzone', 'images/background', 'bgSelected');
    bindDropzone('fmFgDropzone', 'images/foreground', 'fgSelected');
    bindDropzone('fmMusicDropzone', 'music', 'musicSelected');
    bindDropzone('fmObjDropzone', 'images/objects', 'objSelected');
    bindDropzone('fmAttractDropzone', 'images/attractmode', 'attractSelected');
    if (closeObjectMapDialogBtn) {
        closeObjectMapDialogBtn.addEventListener('click', () => {
            if (objectMapModal) objectMapModal.classList.remove('open');
        });
    }
    if (loadObjectMapFromFileBtn) {
        loadObjectMapFromFileBtn.addEventListener('click', async () => {
            await loadObjectMappingsFromObjectsFile();
            refreshLeftPalette();
        });
    }
    if (loadObjectMapExampleBtn) {
        loadObjectMapExampleBtn.addEventListener('click', () => {
            loadObjectMappingsExample();
            refreshLeftPalette();
        });
    }
    if (addObjectMapBtn) {
        addObjectMapBtn.addEventListener('click', () => {
            OBJECT_MAP_EDITOR_STATE.items.push(createDefaultObjectMapping(`obj_${OBJECT_MAP_EDITOR_STATE.items.length + 1}`));
            refreshObjectMappingsAvailability();
            renderObjectMapEditor();
            setObjectMapStatus('Nuovo oggetto aggiunto.');
            refreshLeftPalette();
        });
    }
    if (saveObjectMapBtn) {
        saveObjectMapBtn.addEventListener('click', () => {
            const items = collectObjectMappingsFromEditor();
            refreshLeftPalette();
            if (!refreshObjectMappingsAvailability()) {
                setObjectMapStatus('Aggiungi almeno un oggetto con token valido prima di continuare.', true);
                openObjectMapDialog('', true);
                return;
            }
            setObjectMapStatus(`Mappaggio salvato (${items.length} oggetti).`);
            if (objectMapModal) objectMapModal.classList.remove('open');
        });
    }
    if (objectMapModal) {
        objectMapModal.addEventListener('click', (ev) => {
            if (ev.target === objectMapModal) {
                objectMapModal.classList.remove('open');
            }
        });
    }

    if (reloadEffectLibraryBtn) {
        reloadEffectLibraryBtn.addEventListener('click', async () => {
            await loadEffectLibraryForEditor();
        });
    }

    applyGridBtn?.addEventListener('click', () => {
        const scene = getScene();
        if (!scene) return;
        const cols = parseNumber(el('gridCols')?.value, 12);
        const rows = parseNumber(el('gridRows')?.value, 12);
        scene.resetGrid(cols, rows);
        setStatus(`Griglia aggiornata: ${scene.cols}x${scene.rows}`);
    });

    clearGridBtn?.addEventListener('click', () => {
        const scene = getScene();
        if (!scene) return;
        scene.resetGrid(scene.cols, scene.rows);
        setStatus('Griglia svuotata.');
    });

    exportBtn?.addEventListener('click', () => {
        try {
            const level = readLevelFromForm();
            exportJsonToFile(level);
            setStatus('JSON esportato con successo.');
        } catch (error) {
            setStatus(`Errore export: ${error.message}`, true);
        }
    });

    copyJsonBtn?.addEventListener('click', async () => {
        try {
            const level = readLevelFromForm();
            await navigator.clipboard.writeText(JSON.stringify(level, null, 2));
            setStatus('JSON copiato negli appunti.');
        } catch (error) {
            setStatus(`Errore copia: ${error.message}`, true);
        }
    });

    saveLocalBtn?.addEventListener('click', () => {
        try {
            const level = readLevelFromForm();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(level));
            setStatus('Livello salvato in localStorage.');
        } catch (error) {
            setStatus(`Errore salvataggio: ${error.message}`, true);
        }
    });

    loadLocalBtn?.addEventListener('click', () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                setStatus('Nessun livello salvato trovato.', true);
                return;
            }
            const parsed = JSON.parse(raw);
            applyLevelToForm(parsed);
            const scene = getScene();
            scene?.loadFromJson(parsed);
            setStatus('Livello caricato da localStorage.');
        } catch (error) {
            setStatus(`Errore caricamento: ${error.message}`, true);
        }
    });

    const normalizeLevelFilePath = (rawPath) => {
        const raw = String(rawPath || '').trim();
        if (!raw) return '';
        const cleaned = decodeURIComponent(raw).split('?')[0].split('#')[0].replace(/\\/g, '/');
        const baseName = cleaned.split('/').pop();
        if (!baseName || baseName.includes('..') || !baseName.toLowerCase().endsWith('.json')) return '';
        return `${LEVELS_DIR_PATH}/${baseName}`;
    };

    const fetchLevelFileList = async () => {
        let list = [];

        try {
            const resp = await fetch(buildApiUrl('levels'), { cache: 'no-store' });
            if (resp.ok) {
                const data = await resp.json();
                if (Array.isArray(data)) {
                    list = data
                        .map(normalizeLevelFilePath)
                        .filter(Boolean);
                }
            }
        } catch (_e) {
            // fallback below
        }

        if (!list.length) {
            const dirCandidates = buildStaticPathCandidates(`${LEVELS_DIR_PATH}/`);
            for (const candidate of dirCandidates) {
                try {
                    const resp = await fetch(candidate, { cache: 'no-store' });
                    if (!resp.ok) continue;
                    const html = await resp.text();
                    const matches = [...html.matchAll(/href=["']([^"']+\.json)["']/gi)];
                    const parsed = matches
                        .map((m) => normalizeLevelFilePath(m && m[1]))
                        .filter(Boolean);
                    if (parsed.length) {
                        list = parsed;
                        break;
                    }
                } catch (_e) {
                    // continue with next candidate
                }
            }
        }

        const unique = [...new Set(list)];
        unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        return unique;
    };

    const suggestNextLevelFileName = (levels) => {
        const entries = Array.isArray(levels) ? levels : [];
        const numericLevels = entries
            .map((p) => {
                const name = String(p || '').split('/').pop() || '';
                const m = name.match(/^level(\d+)\.json$/i);
                return m ? Number(m[1]) : NaN;
            })
            .filter((n) => Number.isFinite(n));

        if (!numericLevels.length) return 'level10.json';

        const maxNum = Math.max(...numericLevels);
        const major = Math.floor(maxNum / 10);
        const minor = maxNum % 10;
        const nextNum = (minor < 4) ? (maxNum + 1) : ((major + 1) * 10);
        return `level${nextNum}.json`;
    };

    const populateLevelFileOptions = async () => {
        if (!existingLevelSelect) return [];
        const previous = String(existingLevelSelect.value || '').trim();
        const levels = await fetchLevelFileList();

        existingLevelSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- seleziona livello --';
        existingLevelSelect.appendChild(placeholder);

        levels.forEach((path) => {
            const option = document.createElement('option');
            option.value = path;
            option.textContent = String(path).split('/').pop();
            existingLevelSelect.appendChild(option);
        });

        if (previous && levels.includes(previous)) {
            existingLevelSelect.value = previous;
        }

        if (!levels.length) {
            setStatus('Nessun file livello trovato in data/level.', true);
        }

        return levels;
    };

    const loadSelectedLevelFile = async () => {
        const selected = String(existingLevelSelect?.value || '').trim();
        if (!selected) {
            setStatus('Seleziona prima un livello dal menu a tendina.', true);
            return;
        }

        const candidates = buildStaticPathCandidates(selected);
        let lastError = null;

        for (const candidate of candidates) {
            try {
                const resp = await fetch(candidate, { cache: 'no-store' });
                if (!resp.ok) {
                    lastError = new Error(`HTTP ${resp.status} su ${candidate}`);
                    continue;
                }
                const parsed = await resp.json();
                applyLevelToForm(parsed);
                const scene = getScene();
                scene?.loadFromJson(parsed);
                drawMiniMapPreview(scene);
                setStatus(`Livello caricato da ${candidate}.`);
                return;
            } catch (err) {
                lastError = err;
            }
        }

        setStatus(`Errore caricamento livello: ${(lastError && lastError.message) || 'file non trovato'}.`, true);
    };

    const saveSelectedLevelFile = async () => {
        const selected = String(existingLevelSelect?.value || '').trim();
        if (!selected) {
            setStatus('Seleziona prima un livello dal menu a tendina per salvarlo.', true);
            return;
        }

        const normalized = normalizeLevelFilePath(selected);
        const fileName = String(normalized.split('/').pop() || '').trim();
        if (!fileName) {
            setStatus('Nome file livello non valido.', true);
            return;
        }

        let level = null;
        try {
            level = readLevelFromForm();
        } catch (error) {
            setStatus(`Errore preparazione livello: ${error.message}`, true);
            return;
        }

        try {
            const resp = await fetch(buildApiUrl('levels'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName, level })
            });
            const payload = await resp.json().catch(() => ({}));
            if (!resp.ok || payload.ok === false) {
                throw new Error(payload.error || `HTTP ${resp.status}`);
            }

            const savedPath = String(payload.file || normalized);
            const levels = await populateLevelFileOptions();
            if (levels.includes(savedPath)) {
                existingLevelSelect.value = savedPath;
            } else if (levels.includes(normalized)) {
                existingLevelSelect.value = normalized;
            }

            setStatus(`Livello salvato su ${savedPath}.`);
        } catch (error) {
            setStatus(`Errore salvataggio livello: ${error.message}`, true);
        }
    };

    const saveAsNewLevelFile = async () => {
        const levels = await fetchLevelFileList();
        const suggested = suggestNextLevelFileName(levels);
        const answer = window.prompt('Nome nuovo file livello (es: level60.json)', suggested);
        const fileName = String(answer || '').trim();
        if (!fileName) {
            setStatus('Salvataggio annullato.', true);
            return;
        }

        if (!/^[a-z0-9._-]+\.json$/i.test(fileName) || fileName.includes('..')) {
            setStatus('Nome file non valido. Usa solo lettere/numeri/-/_ e estensione .json', true);
            return;
        }

        const targetPath = `${LEVELS_DIR_PATH}/${fileName}`;
        if (levels.includes(targetPath)) {
            const overwrite = window.confirm(`Il file ${fileName} esiste gia. Vuoi sovrascriverlo?`);
            if (!overwrite) {
                setStatus('Salvataggio annullato.', true);
                return;
            }
        }

        let level = null;
        try {
            level = readLevelFromForm();
        } catch (error) {
            setStatus(`Errore preparazione livello: ${error.message}`, true);
            return;
        }

        try {
            const resp = await fetch(buildApiUrl('levels'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName, level })
            });
            const payload = await resp.json().catch(() => ({}));
            if (!resp.ok || payload.ok === false) {
                throw new Error(payload.error || `HTTP ${resp.status}`);
            }

            const savedPath = String(payload.file || targetPath);
            const refreshed = await populateLevelFileOptions();
            if (existingLevelSelect && refreshed.includes(savedPath)) {
                existingLevelSelect.value = savedPath;
            }
            setStatus(`Nuovo livello salvato su ${savedPath}.`);
        } catch (error) {
            setStatus(`Errore salvataggio livello: ${error.message}`, true);
        }
    };

    if (reloadLevelFilesBtn) {
        reloadLevelFilesBtn.addEventListener('click', async () => {
            const levels = await populateLevelFileOptions();
            if (levels.length) {
                setStatus(`Lista livelli aggiornata (${levels.length} file).`);
            }
        });
    }

    if (loadLevelFileBtn) {
        loadLevelFileBtn.addEventListener('click', async () => {
            await loadSelectedLevelFile();
        });
    }

    if (saveLevelFileBtn) {
        saveLevelFileBtn.addEventListener('click', async () => {
            await saveSelectedLevelFile();
        });
    }

    if (saveAsNewLevelFileBtn) {
        saveAsNewLevelFileBtn.addEventListener('click', async () => {
            await saveAsNewLevelFile();
        });
    }

    if (existingLevelSelect) {
        existingLevelSelect.addEventListener('change', async () => {
            await loadSelectedLevelFile();
        });
    }

    importJsonFile?.addEventListener('change', async (event) => {
        const target = event.target;
        const file = target?.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            importLevelFromText(text, file.name);
        } catch (error) {
            setStatus(`Errore import: ${error.message}`, true);
        } finally {
            target.value = '';
        }
    });

    // Top-level import/export buttons (header)
    const exportTop = el('exportTopBtn');
    const copyTop = el('copyTopBtn');
    const importTop = el('importTopBtn');
    const importTopFile = el('importTopFile');

    if (exportTop) {
        exportTop.addEventListener('click', () => {
            try {
                const level = readLevelFromForm();
                exportJsonToFile(level);
                setStatus('JSON esportato con successo.');
            } catch (error) {
                setStatus(`Errore export: ${error.message}`, true);
            }
        });
    }
    if (copyTop) {
        copyTop.addEventListener('click', async () => {
            try {
                const level = readLevelFromForm();
                await navigator.clipboard.writeText(JSON.stringify(level, null, 2));
                setStatus('JSON copiato negli appunti.');
            } catch (error) {
                setStatus(`Errore copia: ${error.message}`, true);
            }
        });
    }
    if (importTop) {
        importTop.addEventListener('click', () => {
            if (importTopFile) importTopFile.click();
        });
    }
    if (importTopFile) {
        importTopFile.addEventListener('change', async (ev) => {
            const file = ev.target?.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                importLevelFromText(text, file.name);
            } catch (e) {
                setStatus(`Errore import: ${e.message}`, true);
            } finally {
                ev.target.value = '';
            }
        });
    }

    const realtimeFields = [
        'playerRow', 'playerCol', 'gridCols', 'gridRows', 'mapTimer', 'revealMode',
        'levelId', 'levelSpeed',
        'objectiveLabel', 'lightMode', 'escapeRoute', 'srEnabled', 'srShardBurstCount',
        'srDynamicSize', 'srRotation', 'srChaotic', 'dbEnabled', 'dbSplitOnImpact',
        'dbDirections', 'dbSizes', 'dbSplitRange', 'dbMaxSplitGen', 'extraRootJson',
        'objFxLampEnabled', 'objFxLampRadius', 'objFxLampColor',
        'objFxPulseEnabled', 'objFxPulseScale', 'objFxPulseDuration',
        'objFxFloatEnabled', 'objFxFloatAmplitude', 'objFxFloatDuration',
        'objFxHaloEnabled', 'objFxHaloRadius', 'objFxHaloColor',
        'objFxOutlineEnabled', 'objFxOutlineThickness', 'objFxOutlineColor'
    ];

    // include rain controls for realtime preview updates
    realtimeFields.push('rainEnabled', 'rainIntensity', 'rainFrequency', 'rainWind', 'rainDirection', 'rainInterval', 'rainDuration');
    // fog realtime controls
    realtimeFields.push('fogEnabled', 'fogAlpha', 'fogLayers', 'fogSpeed', 'fogDirection');

    realtimeFields.forEach((id) => {
        const input = el(id);
        if (!input) return;
        input.addEventListener('input', () => drawMiniMapPreview(getScene()));
        input.addEventListener('change', () => drawMiniMapPreview(getScene()));
    });
    
    // Music controls: preview/play selected track from data/music
    try {
        window.__editorMusicAudio = window.__editorMusicAudio || new Audio();
        const audio = window.__editorMusicAudio;
        audio.loop = true;
        const playBtn = el('playMusicBtn');
        const stopBtn = el('stopMusicBtn');
        const musicSel = el('levelMusic');
        const vol = el('musicVolume');
        const previewBtn = el('previewMusicBtn');

        // preview audio instance (separate from main player)
        window.__editorMusicPreviewAudio = window.__editorMusicPreviewAudio || new Audio();
        const pAudio = window.__editorMusicPreviewAudio;
        pAudio.loop = false;

        if (musicSel) {
            musicSel.addEventListener('change', () => {
                try {
                    const v = String(musicSel.value || '').trim();
                    if (v) audio.src = v;
                    setStatus(`Musica selezionata: ${v || '(none)'}`);
                } catch (e) { /* ignore */ }
            });
        }
        if (playBtn) playBtn.addEventListener('click', async () => {
            try {
                const src = String(musicSel?.value || '').trim();
                if (!src) { setStatus('Nessuna traccia selezionata.', true); return; }
                if (!audio.src || audio.src.indexOf(src) === -1) audio.src = src;
                audio.volume = parseFloat(vol?.value ?? 0.6) || 0.6;
                await audio.play();
                setStatus('Musica in riproduzione...');
            } catch (e) { setStatus(`Errore riproduzione: ${e.message}`, true); }
        });
        if (stopBtn) stopBtn.addEventListener('click', () => { try { audio.pause(); audio.currentTime = 0; setStatus('Musica fermata.'); } catch (e) {} });
        if (vol) vol.addEventListener('input', () => { try { audio.volume = parseFloat(vol.value) || 0; pAudio.volume = parseFloat(vol.value) || 0; } catch (e) {} });

        if (previewBtn) {
            previewBtn.addEventListener('click', async () => {
                try {
                    const src = String(musicSel?.value || '').trim();
                    if (!src) { setStatus('Nessuna traccia selezionata per preview.', true); return; }
                    // toggle: if preview playing, stop it
                    if (!pAudio.paused && !pAudio.ended) {
                        try { clearTimeout(pAudio._previewTimeout); } catch (e) {}
                        pAudio.pause(); pAudio.currentTime = 0;
                        setStatus('Preview fermata.');
                        return;
                    }
                    if (!pAudio.src || pAudio.src.indexOf(src) === -1) pAudio.src = src;
                    pAudio.volume = parseFloat(vol?.value ?? 0.6) || 0.6;
                    pAudio.currentTime = 0;
                    await pAudio.play();
                    setStatus('Preview in riproduzione...');
                    // auto-stop preview after 6s if still playing
                    try { clearTimeout(pAudio._previewTimeout); } catch (e) {}
                    pAudio._previewTimeout = setTimeout(() => {
                        try { pAudio.pause(); pAudio.currentTime = 0; setStatus('Preview terminata.'); } catch (e) {}
                    }, 6000);
                    pAudio.addEventListener('ended', () => { try { clearTimeout(pAudio._previewTimeout); setStatus('Preview terminata.'); } catch (e) {} }, { once: true });
                } catch (e) { setStatus(`Errore preview: ${e.message}`, true); }
            });
        }
    } catch (e) { /* ignore music UI errors */ }

    // Populate levelMusic select dynamically from API with static manifest fallback
    async function populateMusicOptions() {
        try {
            const list = await fetchJsonListWithFallback(buildApiUrl('music'), MUSIC_MANIFEST_PATH);
            const sel = el('levelMusic');
            if (!sel) return;
            // clear existing options and add (none)
            sel.innerHTML = '';
            const noneOpt = document.createElement('option'); noneOpt.value = ''; noneOpt.textContent = '(none)'; sel.appendChild(noneOpt);
            list.forEach((p) => {
                const name = String(p).split('/').pop();
                const o = document.createElement('option'); o.value = p; o.textContent = name; sel.appendChild(o);
            });
        } catch (e) {
            // ignore
        }
    }

    function syncLayerSelectsFromMaster(masterId, rowSelector, selectClass) {
        const master = el(masterId);
        if (!master) return;
        const masterOptions = Array.from(master.options).map((o) => ({ value: o.value, label: o.textContent }));
        const selects = Array.from(document.querySelectorAll(`${rowSelector} select.${selectClass}`));
        selects.forEach((sel) => {
            const prev = String(sel.value || '').trim();
            sel.innerHTML = '';
            masterOptions.forEach((opt) => {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.label;
                sel.appendChild(o);
            });
            if (prev && masterOptions.some((o) => o.value === prev)) {
                sel.value = prev;
            }
        });
    }

    function updateInUseBadge(badgeId, inUse, inUseText, freeText) {
        const badge = el(badgeId);
        if (!badge) return;
        badge.textContent = inUse ? inUseText : freeText;
        badge.style.color = inUse ? '#ffd27a' : '#9de8ff';
    }

    function isBgFileInUse(fileName) {
        const clean = String(fileName || '').trim();
        if (!clean) return false;
        const target = `${BG_ASSETS_DIR}/${clean}`;
        const layers = readBackgroundLayersFromDOM() || [];
        return layers.some((layer) => String(layer?.src || '').trim() === target);
    }

    function isFgFileInUse(fileName) {
        const clean = String(fileName || '').trim();
        if (!clean) return false;
        const target = `${FG_ASSETS_DIR}/${clean}`;
        const layers = readForegroundLayersFromDOM() || [];
        return layers.some((layer) => String(layer?.src || '').trim() === target);
    }

    function isMusicFileInUse(fileName) {
        const clean = String(fileName || '').trim();
        if (!clean) return false;
        const selected = String(el('levelMusic')?.value || '').trim();
        if (!selected) return false;
        return selected.split('/').pop() === clean;
    }

    function isObjectFileInUse(fileName) {
        const clean = String(fileName || '').trim();
        if (!clean) return false;
        const full = `${OBJECTS_ASSETS_DIR}/${clean}`;
        const list = Array.isArray(OBJECT_MAP_EDITOR_STATE?.items) ? OBJECT_MAP_EDITOR_STATE.items : [];
        return list.some((it) => {
            const src = String(it?.imageSrc || '').trim();
            return src === full || src.split('/').pop() === clean;
        });
    }

    function isAttractFileInUse(_fileName) {
        return false;
    }

    function refreshAssetUsageBadges() {
        const bgFile = String(el('bgImageSelect')?.value || '').trim();
        const fgFile = String(el('fgImageSelect')?.value || '').trim();
        const musicPath = String(el('levelMusic')?.value || '').trim();
        const musicFile = musicPath ? musicPath.split('/').pop() : '';

        updateInUseBadge('bgInUseBadge', isBgFileInUse(bgFile), 'In uso nel livello', 'Non usato nel livello');
        updateInUseBadge('fgInUseBadge', isFgFileInUse(fgFile), 'In uso nel livello', 'Non usato nel livello');
        updateInUseBadge('musicInUseBadge', isMusicFileInUse(musicFile), 'In uso nel livello', 'Nessuna traccia attiva');
    }

    async function uploadAsset(endpoint, fileInputId) {
        const input = el(fileInputId);
        const file = input?.files?.[0];
        if (!file) {
            setStatus('Seleziona un file prima del caricamento.', true);
            return null;
        }
        const payload = await uploadAssetFile(endpoint, file);
        if (input) input.value = '';
        return payload;
    }

    async function deleteAsset(endpoint, fileName) {
        const clean = String(fileName || '').trim();
        if (!clean) {
            throw new Error('nessun file selezionato');
        }
        const response = await fetch(`${buildApiUrl(endpoint)}?file=${encodeURIComponent(clean)}`, {
            method: 'DELETE'
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error || `eliminazione fallita (${response.status})`);
        }
        return payload;
    }

    try { populateMusicOptions(); } catch (e) {}
    try { populateLevelFileOptions(); } catch (e) {}

    // Populate bg/fg image selects dynamically from server assets images folders
    async function populateImageOptions() {
        try {
            const [bgList, fgList] = await Promise.all([
                fetchJsonListWithFallback(buildApiUrl('images/background'), BG_MANIFEST_PATH),
                fetchJsonListWithFallback(buildApiUrl('images/foreground'), FG_MANIFEST_PATH)
            ]);

            const bgSel = el('bgImageSelect');
            const fgSel = el('fgImageSelect');
            if (bgSel) {
                // keep a default placeholder option
                bgSel.innerHTML = '';
                const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = '-- scegli immagine background --'; bgSel.appendChild(placeholder);
                bgList.forEach((p) => {
                    const name = String(p).split('/').pop();
                    const o = document.createElement('option'); o.value = name; o.textContent = name; bgSel.appendChild(o);
                });
            }
            if (fgSel) {
                fgSel.innerHTML = '';
                const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = '-- scegli immagine foreground --'; fgSel.appendChild(placeholder);
                fgList.forEach((p) => {
                    const name = String(p).split('/').pop();
                    const o = document.createElement('option'); o.value = name; o.textContent = name; fgSel.appendChild(o);
                });
            }

            syncLayerSelectsFromMaster('bgImageSelect', '#bgLayersContainer .bg-layer', 'bg-src');
            syncLayerSelectsFromMaster('fgImageSelect', '#fgLayersContainer .fg-layer', 'fg-src');
            refreshAssetUsageBadges();
        } catch (e) {
            // ignore
        }
    }

    try { populateImageOptions(); } catch (e) {}

    const bgImageSelect = el('bgImageSelect');
    if (bgImageSelect) {
        bgImageSelect.addEventListener('change', refreshAssetUsageBadges);
    }

    const fgImageSelect = el('fgImageSelect');
    if (fgImageSelect) {
        fgImageSelect.addEventListener('change', refreshAssetUsageBadges);
    }

    const levelMusicSelect = el('levelMusic');
    if (levelMusicSelect) {
        levelMusicSelect.addEventListener('change', refreshAssetUsageBadges);
    }

    const bgUploadBtn = el('bgUploadBtn');
    if (bgUploadBtn) {
        bgUploadBtn.addEventListener('click', async () => {
            try {
                const payload = await uploadAsset('images/background', 'bgUploadInput');
                await populateImageOptions();
                const bgSel = el('bgImageSelect');
                const fileName = String(payload?.file || '').split('/').pop() || '';
                if (bgSel && fileName) bgSel.value = fileName;
                refreshAssetUsageBadges();
                setStatus(`Background caricato: ${fileName}`);
            } catch (e) {
                setStatus(`Errore upload background: ${e.message}`, true);
            }
        });
    }

    const fgUploadBtn = el('fgUploadBtn');
    if (fgUploadBtn) {
        fgUploadBtn.addEventListener('click', async () => {
            try {
                const payload = await uploadAsset('images/foreground', 'fgUploadInput');
                await populateImageOptions();
                const fgSel = el('fgImageSelect');
                const fileName = String(payload?.file || '').split('/').pop() || '';
                if (fgSel && fileName) fgSel.value = fileName;
                refreshAssetUsageBadges();
                setStatus(`Foreground caricato: ${fileName}`);
            } catch (e) {
                setStatus(`Errore upload foreground: ${e.message}`, true);
            }
        });
    }

    const bgDeleteBtn = el('bgDeleteBtn');
    if (bgDeleteBtn) {
        bgDeleteBtn.addEventListener('click', async () => {
            try {
                const bgSel = el('bgImageSelect');
                const fileName = String(bgSel?.value || '').trim();
                if (!fileName) {
                    setStatus('Seleziona un background da eliminare.', true);
                    return;
                }
                if (isBgFileInUse(fileName)) {
                    setStatus('Background in uso nel livello: rimuovilo dai layer prima di eliminarlo.', true);
                    return;
                }
                if (!window.confirm(`Eliminare definitivamente il background "${fileName}"?`)) {
                    return;
                }
                await deleteAsset('images/background', fileName);
                await populateImageOptions();
                refreshAssetUsageBadges();
                setStatus(`Background eliminato: ${fileName}`);
            } catch (e) {
                setStatus(`Errore eliminazione background: ${e.message}`, true);
            }
        });
    }

    const fgDeleteBtn = el('fgDeleteBtn');
    if (fgDeleteBtn) {
        fgDeleteBtn.addEventListener('click', async () => {
            try {
                const fgSel = el('fgImageSelect');
                const fileName = String(fgSel?.value || '').trim();
                if (!fileName) {
                    setStatus('Seleziona un foreground da eliminare.', true);
                    return;
                }
                if (isFgFileInUse(fileName)) {
                    setStatus('Foreground in uso nel livello: rimuovilo dai layer prima di eliminarlo.', true);
                    return;
                }
                if (!window.confirm(`Eliminare definitivamente il foreground "${fileName}"?`)) {
                    return;
                }
                await deleteAsset('images/foreground', fileName);
                await populateImageOptions();
                refreshAssetUsageBadges();
                setStatus(`Foreground eliminato: ${fileName}`);
            } catch (e) {
                setStatus(`Errore eliminazione foreground: ${e.message}`, true);
            }
        });
    }

    const musicUploadBtn = el('musicUploadBtn');
    if (musicUploadBtn) {
        musicUploadBtn.addEventListener('click', async () => {
            try {
                const payload = await uploadAsset('music', 'musicUploadInput');
                await populateMusicOptions();
                const sel = el('levelMusic');
                const filePath = String(payload?.file || '').trim();
                if (sel && filePath) sel.value = filePath;
                refreshAssetUsageBadges();
                setStatus(`Musica caricata: ${filePath.split('/').pop() || filePath}`);
            } catch (e) {
                setStatus(`Errore upload musica: ${e.message}`, true);
            }
        });
    }

    const musicDeleteBtn = el('musicDeleteBtn');
    if (musicDeleteBtn) {
        musicDeleteBtn.addEventListener('click', async () => {
            try {
                const sel = el('levelMusic');
                const selectedPath = String(sel?.value || '').trim();
                const fileName = selectedPath ? selectedPath.split('/').pop() : '';
                if (!fileName) {
                    setStatus('Seleziona una traccia da eliminare.', true);
                    return;
                }
                if (isMusicFileInUse(fileName)) {
                    setStatus('Traccia in uso nel livello: seleziona (none) prima di eliminarla.', true);
                    return;
                }
                if (!window.confirm(`Eliminare definitivamente la traccia "${fileName}"?`)) {
                    return;
                }
                await deleteAsset('music', fileName);
                await populateMusicOptions();
                if (sel) sel.value = '';
                refreshAssetUsageBadges();
                setStatus(`Musica eliminata: ${fileName}`);
            } catch (e) {
                setStatus(`Errore eliminazione musica: ${e.message}`, true);
            }
        });
    }
    
    // zoom slider
    const zoomSlider = el('zoomSlider');
    if (zoomSlider) {
        zoomSlider.addEventListener('input', () => {
            const scene = getScene();
            if (!scene) return;
            const z = parseFloat(zoomSlider.value) || 1;
            try { scene.setZoom(z); } catch (e) {}
            drawMiniMapPreview(scene);
        });
    }

    // background select and toggle (legacy selector may be absent)
    const bgSelect = el('levelBackground');
    if (bgSelect) {
        bgSelect.addEventListener('change', () => {
            const scene = getScene();
            scene?.updateEditorBackgroundImage?.();
            drawMiniMapPreview(scene);
        });
    }
    // sync range sliders with numeric inputs for speeds — now handled dynamically by rebuildEnemyParamsUI
    const showBg = el('showBackground');
    if (showBg) {
        showBg.addEventListener('change', () => {
            const scene = getScene();
            scene?.updateEditorBackgroundImage?.();
            drawMiniMapPreview(scene);
        });
    }
    const showFg = el('showForeground');
    if (showFg) {
        showFg.addEventListener('change', () => {
            const scene = getScene();
            scene?.updateEditorBackgroundImage?.();
            drawMiniMapPreview(scene);
        });
    }

    const bgLayerContainer = el('bgLayersContainer');
    if (bgLayerContainer) {
        const onBgLayerChange = () => {
            const scene = getScene();
            scene?.updateEditorBackgroundImage?.(true);
            drawMiniMapPreview(scene);
            refreshAssetUsageBadges();
        };
        bgLayerContainer.addEventListener('input', onBgLayerChange);
        bgLayerContainer.addEventListener('change', onBgLayerChange);
    }

    const fgLayerContainer = el('fgLayersContainer');
    if (fgLayerContainer) {
        const onFgLayerChange = () => {
            const scene = getScene();
            scene?.updateEditorBackgroundImage?.(true);
            drawMiniMapPreview(scene);
            refreshAssetUsageBadges();
        };
        fgLayerContainer.addEventListener('input', onFgLayerChange);
        fgLayerContainer.addEventListener('change', onFgLayerChange);
    }

    try { refreshAssetUsageBadges(); } catch (e) {}

    // auto-grid-from-background toggle
    const autoGridChk = el('autoGridFromBg');
    if (autoGridChk) {
        autoGridChk.addEventListener('change', () => {
            const scene = getScene();
            scene?.updateEditorBackgroundImage?.();
            drawMiniMapPreview(scene);
        });
    }

    const applySelectedTokenPropsBtn = el('applySelectedTokenPropsBtn');
    if (applySelectedTokenPropsBtn) {
        applySelectedTokenPropsBtn.addEventListener('click', () => {
            const scene = getScene();
            if (!scene || !scene.selectedCell) {
                setStatus('Nessuna cella selezionata.', true);
                return;
            }
            const { row, col } = scene.selectedCell;
            const cell = scene.cells[row]?.[col];
            if (!cell) return;

            const parts = String(cell.base || '-').split('/').map((s) => s.trim()).filter(Boolean);
            if (!parts.length) {
                setStatus('Nessun oggetto da modificare in questa cella.', true);
                return;
            }

            const idx = clamp(parseNumber(el('selectedTokenIndex')?.value, parts.length - 1), 0, parts.length - 1);
            const base = String(el('selectedTokenBase')?.value || '').trim();
            const target = String(el('selectedTokenTargetLevel')?.value || '').trim();
            const effects = String(buildSelectedEffectsFromControls() || '').trim();
            const invisible = !!el('selectedTokenInvisible')?.checked;

            parts[idx] = composeDecoratedToken({ base, target, effects, invisible });
            cell.base = parts.join('/');
            scene.selectedTokenIndex = idx;
            scene.updateSelectedCellInfo();
            scene.renderGrid();
            drawMiniMapPreview(scene);
            setStatus('Proprieta oggetto applicate.');
        });
    }

    const removeSelectedTokenBtn = el('removeSelectedTokenBtn');
    if (removeSelectedTokenBtn) {
        removeSelectedTokenBtn.addEventListener('click', () => {
            const scene = getScene();
            if (!scene || !scene.selectedCell) {
                setStatus('Nessuna cella selezionata.', true);
                return;
            }
            const { row, col } = scene.selectedCell;
            const cell = scene.cells[row]?.[col];
            if (!cell) return;

            const parts = String(cell.base || '-').split('/').map((s) => s.trim()).filter(Boolean);
            if (!parts.length) {
                setStatus('Nessun oggetto da rimuovere.', true);
                return;
            }
            const idx = clamp(parseNumber(el('selectedTokenIndex')?.value, parts.length - 1), 0, parts.length - 1);
            parts.splice(idx, 1);
            cell.base = parts.length ? parts.join('/') : '-';
            scene.selectedTokenIndex = Math.max(0, parts.length - 1);
            scene.updateSelectedCellInfo();
            scene.renderGrid();
            drawMiniMapPreview(scene);
            setStatus('Oggetto rimosso dalla cella.');
        });
    }

    const selectedTokenIndex = el('selectedTokenIndex');
    if (selectedTokenIndex) {
        selectedTokenIndex.addEventListener('change', () => {
            const scene = getScene();
            scene?.updateSelectedCellInfo();
        });
    }

    [
        'selectedFxLamp',
        'selectedFxPulse',
        'selectedFxFloat',
        'selectedFxHalo',
        'selectedFxOutline',
        'selectedTokenEffectsCustom',
        'selectedLampRadius',
        'selectedLampColor',
        'selectedPulseScale',
        'selectedPulseDuration',
        'selectedFloatAmplitude',
        'selectedFloatDuration',
        'selectedHaloRadius',
        'selectedHaloColor',
        'selectedOutlineThickness',
        'selectedOutlineColor'
    ]
        .forEach((id) => {
            const node = el(id);
            if (!node) return;
            node.addEventListener('input', refreshSelectedEffectsPreview);
            node.addEventListener('change', refreshSelectedEffectsPreview);
        });
}

window.addEventListener('level-editor-ready', async () => {
    applyLevelToForm(DEFAULT_LEVEL);
    const scene = getScene();
    if (scene) {
        scene.loadFromJson(DEFAULT_LEVEL);
    }
    bindUI();
    try { setupDomDragAndDrop(); } catch (e) { /* ignore */ }
    try { setupRightAccordion(); } catch (e) { /* ignore */ }
    try { await loadEffectLibraryForEditor(); } catch (e) { /* ignore */ }

    // Load palette source from objects.json at startup.
    const loadedCount = await loadObjectMappingsFromObjectsFile();
    try { buildDomPalette(); } catch (e) { /* ignore */ }

    if (!refreshObjectMappingsAvailability()) {
        openObjectMapDialog('Nessun oggetto trovato in data/objects.json. Inserisci almeno un oggetto per avviare la creazione mappa.', true);
        setStatus('Creazione mappa bloccata: aggiungi oggetti dal dialog OBJ e salva.', true);
    } else if (loadedCount >= 0) {
        setStatus(`Editor pronto. Oggetti caricati: ${loadedCount}.`);
    } else {
        setStatus('Editor pronto con palette locale: verifica data/objects.json.', true);
    }

    drawMiniMapPreview(scene);
});

// Convert right-panel sections into accordions and bind toggles
function setupRightAccordion() {
    if (typeof document === 'undefined') return;
    const panel = document.querySelector('.panel');
    if (!panel) return;
    const sections = Array.from(panel.querySelectorAll('.section'));
    sections.forEach((sec, idx) => {
        const h2 = sec.querySelector('h2');
        if (!h2) return;
        // color tone class per section for quick visual distinction
        const tone = (idx % 6) + 1;
        sec.classList.add(`section-tone-${tone}`);
        // add +/- indicator
        let ind = h2.querySelector('.section-indicator');
        if (!ind) {
            ind = document.createElement('span');
            ind.className = 'section-indicator';
            ind.style.marginRight = '8px';
            ind.style.fontFamily = 'monospace';
            ind.style.fontWeight = 'bold';
            h2.prepend(ind);
        }
        // wrap all nodes after h2 into .section-body
        let body = sec.querySelector('.section-body');
        if (!body) {
            body = document.createElement('div');
            body.className = 'section-body';
            // move nodes after h2 into body
            let node = h2.nextSibling;
            const toMove = [];
            while (node) {
                toMove.push(node);
                node = node.nextSibling;
            }
            toMove.forEach(n => body.appendChild(n));
            sec.appendChild(body);
        }
        // default: collapsed
        sec.classList.add('collapsed');
        // set initial indicator state
        try { ind.textContent = sec.classList.contains('collapsed') ? '+' : '-'; } catch (e) {}
        // toggle on click and update indicator
        h2.addEventListener('click', () => {
            sec.classList.toggle('collapsed');
            try { ind.textContent = sec.classList.contains('collapsed') ? '+' : '-'; } catch (e) {}
        });
    });
}

// hook add bg/fg buttons if present
window.addEventListener('load', () => {
    const refreshLayerVisuals = () => {
        refreshLayerPreviews();
    };

    try { bindLayerDnD(el('bgLayersContainer'), '.bg-layer'); } catch (e) {}
    try { bindLayerDnD(el('fgLayersContainer'), '.fg-layer'); } catch (e) {}

    const setAllLayerEnabled = (containerId, checkboxClass, enabled) => {
        try {
            const container = el(containerId);
            if (!container) return;
            const checks = Array.from(container.querySelectorAll(`input.${checkboxClass}`));
            checks.forEach((c) => { c.checked = !!enabled; });
            refreshLayerVisuals();
        } catch (e) { }
    };

    try {
        const addBg = el('addBgLayerBtn');
        if (addBg) addBg.addEventListener('click', () => {
            const container = el('bgLayersContainer');
            if (!container) return;
            ensureBgHeader();
            container.appendChild(createBgLayerElement({ src: '', factor: 1.0, alpha: 1.0, enabled: true }));
            try { getScene()?.updateEditorBackgroundImage?.(true); } catch (e) {}
            try { drawMiniMapPreview(getScene()); } catch (e) {}
        });
    } catch (e) {}
    try {
        const addFg = el('addFgLayerBtn');
        if (addFg) addFg.addEventListener('click', () => {
            const container = el('fgLayersContainer');
            if (!container) return;
            ensureFgHeader();
            container.appendChild(createFgLayerElement({ src: '', factor: 1.0, alpha: 1.0, enabled: true }));
            try { getScene()?.updateEditorBackgroundImage?.(true); } catch (e) {}
            try { drawMiniMapPreview(getScene()); } catch (e) {}
        });
    } catch (e) {}
    try {
        const bgEnableAllBtn = el('bgEnableAllBtn');
        if (bgEnableAllBtn) bgEnableAllBtn.addEventListener('click', () => {
            setAllLayerEnabled('bgLayersContainer', 'bg-enabled', true);
            try { setStatus('Tutti i background attivati.'); } catch (e) { }
        });
    } catch (e) {}

    try {
        const bgDisableAllBtn = el('bgDisableAllBtn');
        if (bgDisableAllBtn) bgDisableAllBtn.addEventListener('click', () => {
            setAllLayerEnabled('bgLayersContainer', 'bg-enabled', false);
            try { setStatus('Tutti i background disattivati.'); } catch (e) { }
        });
    } catch (e) {}

    try {
        const fgEnableAllBtn = el('fgEnableAllBtn');
        if (fgEnableAllBtn) fgEnableAllBtn.addEventListener('click', () => {
            setAllLayerEnabled('fgLayersContainer', 'fg-enabled', true);
            try { setStatus('Tutti i foreground attivati.'); } catch (e) { }
        });
    } catch (e) {}

    try {
        const fgDisableAllBtn = el('fgDisableAllBtn');
        if (fgDisableAllBtn) fgDisableAllBtn.addEventListener('click', () => {
            setAllLayerEnabled('fgLayersContainer', 'fg-enabled', false);
            try { setStatus('Tutti i foreground disattivati.'); } catch (e) { }
        });
    } catch (e) {}
});

// Build left DOM palette inside #domPalette-* containers. Creates simple accordion groups
function buildDomPalette() {

    function applyRightPanelFieldLayout() {
        const panel = document.querySelector('.panel');
        if (!panel) return;

        let tooltipNode = document.getElementById('fieldTooltip');
        const hideTooltip = () => {
            if (tooltipNode) tooltipNode.remove();
            tooltipNode = null;
        };
        const showTooltip = (anchor, text) => {
            if (!anchor || !text) return;
            hideTooltip();
            const tip = document.createElement('div');
            tip.id = 'fieldTooltip';
            tip.className = 'field-tooltip';
            tip.textContent = text;
            document.body.appendChild(tip);
            const rect = anchor.getBoundingClientRect();
            const margin = 8;
            let left = rect.left;
            let top = rect.bottom + margin;
            const maxLeft = window.innerWidth - tip.offsetWidth - margin;
            if (left > maxLeft) left = Math.max(margin, maxLeft);
            if (top + tip.offsetHeight > window.innerHeight - margin) {
                top = Math.max(margin, rect.top - tip.offsetHeight - margin);
            }
            tip.style.left = `${left}px`;
            tip.style.top = `${top}px`;
            tooltipNode = tip;
            window.setTimeout(() => {
                const closeIfOpen = () => {
                    hideTooltip();
                    document.removeEventListener('click', closeIfOpen, true);
                    document.removeEventListener('keydown', onEsc, true);
                };
                const onEsc = (ev) => {
                    if (ev.key === 'Escape') closeIfOpen();
                };
                document.addEventListener('click', closeIfOpen, true);
                document.addEventListener('keydown', onEsc, true);
            }, 0);
        };

        const legendMap = {
            levelId: 'Identificativo univoco del livello (es. 1.0, 2.3).',
            levelSpeed: 'Moltiplicatore generale della velocita della mappa.',
            gridCols: 'Numero di colonne della griglia.',
            gridRows: 'Numero di righe della griglia.',
            mapTimer: 'Tempo massimo del livello in secondi.',
            ghostCount: 'Numero totale di ghost presenti nel livello.',
            batCount: 'Numero totale di bat presenti nel livello.',
            ghostSpeed: 'Velocita di movimento dei ghost.',
            batSpeed: 'Velocita di movimento dei bat.',
            objectiveLabel: 'Chiave testo per l obiettivo mostrato al giocatore.',
            escapeRoute: 'Abilita o disabilita la via di uscita del livello.',
            lightMode: 'Modalita di illuminazione globale del livello.',
            playerRow: 'Riga iniziale del player.',
            playerCol: 'Colonna iniziale del player.'
        };

        const labels = Array.from(panel.querySelectorAll('label[for]'));
        labels.forEach((labelNode) => {
            if (!(labelNode instanceof HTMLElement)) return;
            if (labelNode.dataset.layoutDone === '1') return;

            const fieldId = String(labelNode.getAttribute('for') || '').trim();
            if (!fieldId) return;

            const parent = labelNode.parentElement;
            if (!parent || !(parent instanceof HTMLElement)) return;
            if (parent.closest('.config-dialog')) return;

            const directChildren = Array.from(parent.children);
            if (!directChildren.includes(labelNode)) return;

            const controls = directChildren.filter((child) => {
                if (!(child instanceof HTMLElement)) return false;
                if (child === labelNode) return false;
                if (child.classList.contains('tiny')) return false;
                return ['INPUT', 'SELECT', 'TEXTAREA'].includes(child.tagName);
            });

            if (!controls.length) return;

            const row = document.createElement('div');
            row.className = 'field-row';

            labelNode.classList.add('field-label');
            labelNode.dataset.layoutDone = '1';
            const longLabel = labelNode.textContent.trim();
            labelNode.textContent = `${longLabel} :`;
            const tipText = legendMap[fieldId] || `Campo ${longLabel}: modifica questo valore per influenzare il comportamento della mappa.`;
            labelNode.title = tipText;
            row.appendChild(labelNode);

            const valueWrap = document.createElement('div');
            valueWrap.className = 'field-value';
            controls.forEach((ctrl) => valueWrap.appendChild(ctrl));
            row.appendChild(valueWrap);

            const firstTiny = parent.querySelector(':scope > .tiny');
            if (firstTiny) parent.insertBefore(row, firstTiny);
            else parent.appendChild(row);

            labelNode.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                showTooltip(labelNode, tipText);
            });
        });

        const inlineLabels = Array.from(panel.querySelectorAll('label:not([for])'));
        inlineLabels.forEach((labelNode) => {
            if (!(labelNode instanceof HTMLElement)) return;
            if (labelNode.dataset.layoutDone === '1') return;
            if (labelNode.closest('.config-dialog')) return;

            const check = labelNode.querySelector('input[type="checkbox"], input[type="radio"]');
            if (!(check instanceof HTMLElement)) return;

            const parent = labelNode.parentElement;
            if (!parent || !(parent instanceof HTMLElement)) return;
            const directChildren = Array.from(parent.children);
            if (!directChildren.includes(labelNode)) return;

            const text = labelNode.textContent.trim();
            if (!text) return;
            const checkId = String(check.id || '').trim();
            const tipText = legendMap[checkId] || `Campo ${text}: attiva o disattiva questa opzione per cambiare il comportamento della mappa.`;

            const row = document.createElement('div');
            row.className = 'field-row';

            const pseudoLabel = document.createElement('label');
            pseudoLabel.className = 'field-label';
            pseudoLabel.textContent = `${text} :`;
            pseudoLabel.title = tipText;
            row.appendChild(pseudoLabel);

            const valueWrap = document.createElement('div');
            valueWrap.className = 'field-value';
            check.style.width = 'auto';
            valueWrap.appendChild(check);
            row.appendChild(valueWrap);

            parent.insertBefore(row, labelNode);

            pseudoLabel.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                showTooltip(pseudoLabel, tipText);
            });

            labelNode.remove();
        });
    }

        try { applyRightPanelFieldLayout(); } catch (e) {}
    if (typeof document === 'undefined') return;
    const leftPanel = document.querySelector('.left-panel');
    if (!leftPanel) return;

    const hintNode = leftPanel.querySelector(':scope > .tiny');
    Array.from(leftPanel.querySelectorAll(':scope > .accordion')).forEach((node) => node.remove());

    const byCategory = new Map();
    const seen = new Set();
    const rows = Array.isArray(OBJECT_MAP_EDITOR_STATE.items) ? OBJECT_MAP_EDITOR_STATE.items : [];

    rows.forEach((raw) => {
        if (!raw || typeof raw !== 'object') return;
        const tokenRaw = String(raw.token ?? raw.mapToken ?? '').trim();
        if (!tokenRaw) return;

        const token = normalizeToken(tokenRaw);
        if (!token || token === '-') return;

        const dedupeKey = token.toLowerCase();
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const category = String(raw.category ?? 'other').trim().toLowerCase() || 'other';
        const label = String(raw.key ?? '').trim() || token;
        if (!byCategory.has(category)) byCategory.set(category, []);
        byCategory.get(category).push({ token, label });
    });

    // Keep wall variants available under wall category.
    WALL_PALETTE_ITEMS.forEach((it) => {
        const token = normalizeToken(it.token);
        const dedupeKey = token.toLowerCase();
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        if (!byCategory.has('wall')) byCategory.set('wall', []);
        byCategory.get('wall').push({ token, label: it.label || it.token });
    });

    const categoryNames = Array.from(byCategory.keys()).sort((a, b) => a.localeCompare(b, 'it'));
    categoryNames.forEach((category) => {
        const accordion = document.createElement('div');
        accordion.className = 'accordion';

        const header = document.createElement('h3');
        header.dataset.group = category;
        header.textContent = category;

        const content = document.createElement('div');
        content.className = 'content';
        content.style.display = 'none';

        const list = byCategory.get(category) || [];
        list.sort((a, b) => String(a.token).localeCompare(String(b.token), 'it'));
        list.forEach((it) => {
            content.appendChild(makePaletteItem(it.label || it.token, normalizeToken(it.token)));
        });

        accordion.appendChild(header);
        accordion.appendChild(content);

        if (hintNode) leftPanel.insertBefore(accordion, hintNode);
        else leftPanel.appendChild(accordion);
    });

    // accordion toggles
    const accHeads = Array.from(document.querySelectorAll('.accordion h3'));
    accHeads.forEach((h) => {
        // add +/- indicator
        let ind = h.querySelector('.accordion-indicator');
        if (!ind) {
            ind = document.createElement('span');
            ind.className = 'accordion-indicator';
            ind.style.marginRight = '8px';
            ind.style.fontFamily = 'monospace';
            ind.style.fontWeight = 'bold';
            h.prepend(ind);
        }
        // set initial state based on content visibility
        const content = h.nextElementSibling;
        try { ind.textContent = (content && (content.style.display === 'block' || getComputedStyle(content).display !== 'none')) ? '-' : '+'; } catch (e) {}
        if (h.dataset.paletteAccordionBound !== '1') {
            h.addEventListener('click', () => {
                const content = h.nextElementSibling;
                if (!content) return;
                const isNowVisible = content.style.display === 'block' ? false : true;
                content.style.display = isNowVisible ? 'block' : 'none';
                try { ind.textContent = isNowVisible ? '-' : '+'; } catch (e) {}
            });
            h.dataset.paletteAccordionBound = '1';
        }
    });

    // expand objects group by default
    // keep all left accordions collapsed by default

    function makePaletteItem(labelText, token) {
        const d = document.createElement('div');
        d.className = 'palette-item';
        d.draggable = true;
        d.dataset.token = token;
        // build content: canvas preview + label
        const previewSize = 36;
        const canvas = document.createElement('canvas');
        canvas.width = previewSize;
        canvas.height = previewSize;
        canvas.style.width = `${previewSize}px`;
        canvas.style.height = `${previewSize}px`;
        canvas.style.flex = '0 0 auto';
        canvas.style.marginRight = '8px';

        const txt = document.createElement('div');
        txt.style.flex = '1 1 auto';
        // Avoid appending the token in parentheses if the label already contains it
        if (String(labelText || '').includes(`(${token})`)) {
            txt.textContent = String(labelText || '');
        } else {
            txt.textContent = `${labelText} (${token})`;
        }
        d.style.display = 'flex';
        d.style.alignItems = 'center';
        d.appendChild(canvas);
        d.appendChild(txt);

        // try to draw using Phaser textures if scene is ready
        try {
            const scene = getScene();
            const ctx = canvas.getContext('2d');
            if (scene && ctx) {
                ctx.imageSmoothingEnabled = false;
                const drawn = drawMiniMapToken(scene, ctx, token, 0, 0, previewSize, { alpha: 1 });
                if (!drawn) {
                    // fallback: fill with color
                    ctx.fillStyle = tokenToMiniMapColor(token);
                    ctx.fillRect(0, 0, previewSize, previewSize);
                    ctx.fillStyle = '#fff';
                    ctx.font = '10px monospace';
                    ctx.fillText(token, 2, 12);
                }
            }
        } catch (e) {
            // ignore drawing errors
        }

        d.addEventListener('dragstart', (ev) => {
            try { ev.dataTransfer.setData('text/plain', token); } catch (e) { /* ignore */ }
            const scene = getScene();
            if (scene) scene.lastBrushToken = token;
        });

        d.addEventListener('click', () => {
            const scene = getScene();
            if (scene) {
                scene.lastBrushToken = token;
                setStatus(`Brush selezionato: ${token}`);
            }
        });

        return d;
    }
}

// Setup dragover/drop handlers on #editor-game to place tokens into the Phaser grid
function setupDomDragAndDrop() {
    if (typeof document === 'undefined') return;
    const target = document.getElementById('editor-game');
    if (!target) return;

    target.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        try { ev.dataTransfer.dropEffect = 'copy'; } catch (e) {}
    });

    target.addEventListener('drop', (ev) => {
        ev.preventDefault();
        const token = (ev.dataTransfer && (ev.dataTransfer.getData('text/plain') || ev.dataTransfer.getData('Text'))) || null;
        if (!token) {
            setStatus('Nessun token nel drop', true);
            return;
        }

        const rect = target.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        const scene = getScene();
        if (!scene) {
            setStatus('Editor non pronto', true);
            return;
        }
        const cell = scene.getGridCellFromPointer(x, y);
        if (!cell) {
            setStatus('Drop fuori dalla griglia', true);
            return;
        }

        scene.placeToken(cell.col, cell.row, token);
        scene.selectedCell = cell;
        try {
            const rawParts = String(scene.cells[cell.row]?.[cell.col]?.base || '').split('/').map((s) => s.trim()).filter(Boolean);
            scene.selectedTokenIndex = Math.max(0, rawParts.length - 1);
        } catch (e) {
            scene.selectedTokenIndex = 0;
        }
        scene.updateSelectedCellInfo();
        scene.renderGrid();
        drawMiniMapPreview(scene);
        setStatus(`Token ${token} posato in ${cell.row},${cell.col}`);
    });
}

function fillSelectedTokenEditor(scene) {
    const infoEl = el('selectedObjectInfo');
    const idxEl = el('selectedTokenIndex');
    const baseEl = el('selectedTokenBase');
    const invEl = el('selectedTokenInvisible');
    const targetEl = el('selectedTokenTargetLevel');
    const fxEl = el('selectedTokenEffects');
    const fxCustomEl = el('selectedTokenEffectsCustom');
    const knownChecks = {
        lamp: el('selectedFxLamp'),
        pulse: el('selectedFxPulse'),
        float: el('selectedFxFloat'),
        halo: el('selectedFxHalo'),
        outline: el('selectedFxOutline')
    };

    if (!infoEl || !idxEl || !baseEl || !invEl || !targetEl || !fxEl || !fxCustomEl) return;

    if (!scene || !scene.selectedCell) {
        infoEl.textContent = 'Nessun oggetto selezionato.';
        idxEl.innerHTML = '';
        baseEl.value = '';
        invEl.checked = false;
        targetEl.value = '';
        fxEl.value = '';
        fxCustomEl.value = '';
        Object.values(knownChecks).forEach((c) => { if (c) c.checked = false; });
        clearGuidedEffectOptionInputs();
        refreshSelectedEffectsPreview();
        return;
    }

    const { row, col } = scene.selectedCell;
    const cell = scene.cells[row]?.[col];
    const parts = String(cell?.base || '-').split('/').map((s) => s.trim()).filter(Boolean);
    if (!parts.length || (parts.length === 1 && parts[0] === '-')) {
        infoEl.textContent = `Cella ${row},${col}: nessun oggetto.`;
        idxEl.innerHTML = '';
        baseEl.value = '';
        invEl.checked = false;
        targetEl.value = '';
        fxEl.value = '';
        fxCustomEl.value = '';
        Object.values(knownChecks).forEach((c) => { if (c) c.checked = false; });
        clearGuidedEffectOptionInputs();
        refreshSelectedEffectsPreview();
        return;
    }

    idxEl.innerHTML = '';
    parts.forEach((token, i) => {
        const parsed = parseDecoratedToken(token);
        const o = document.createElement('option');
        o.value = String(i);
        o.textContent = `${i + 1}. ${parsed.base || token}`;
        idxEl.appendChild(o);
    });

    const pickedIndex = clamp(Number(scene.selectedTokenIndex) || 0, 0, parts.length - 1);
    scene.selectedTokenIndex = pickedIndex;
    idxEl.value = String(pickedIndex);

    const parsed = parseDecoratedToken(parts[pickedIndex]);
    baseEl.value = parsed.base;
    invEl.checked = !!parsed.invisible;
    targetEl.value = parsed.target;

    Object.values(knownChecks).forEach((c) => { if (c) c.checked = false; });
    clearGuidedEffectOptionInputs();
    const customEffects = [];
    splitEffectsList(parsed.effects).forEach((entry) => {
        const clean = String(entry || '').trim();
        if (!clean) return;
        const parsedEntry = parseEffectEntry(clean);
        const name = parsedEntry.name;
        const options = parsedEntry.options || {};
        if (!['lamp', 'pulse', 'float', 'halo', 'outline'].includes(name) || !knownChecks[name]) {
            customEffects.push(clean);
            return;
        }
        knownChecks[name].checked = true;

        if (name === 'lamp') {
            if (el('selectedLampRadius') && options.radiusTiles != null) el('selectedLampRadius').value = options.radiusTiles;
            if (el('selectedLampColor') && options.color != null) el('selectedLampColor').value = options.color;
        } else if (name === 'pulse') {
            if (el('selectedPulseScale') && options.scale != null) el('selectedPulseScale').value = options.scale;
            if (el('selectedPulseDuration') && options.duration != null) el('selectedPulseDuration').value = options.duration;
        } else if (name === 'float') {
            if (el('selectedFloatAmplitude') && options.amplitudeTiles != null) el('selectedFloatAmplitude').value = options.amplitudeTiles;
            if (el('selectedFloatDuration') && options.duration != null) el('selectedFloatDuration').value = options.duration;
        } else if (name === 'halo') {
            if (el('selectedHaloRadius') && options.radiusTiles != null) el('selectedHaloRadius').value = options.radiusTiles;
            if (el('selectedHaloColor') && options.color != null) el('selectedHaloColor').value = options.color;
        } else if (name === 'outline') {
            if (el('selectedOutlineThickness') && options.thickness != null) el('selectedOutlineThickness').value = options.thickness;
            if (el('selectedOutlineColor') && options.color != null) el('selectedOutlineColor').value = options.color;
        }
    });
    fxCustomEl.value = customEffects.join(',');
    refreshSelectedEffectsPreview();
    infoEl.textContent = `Cella ${row},${col}: oggetto ${pickedIndex + 1}/${parts.length}`;
}

const _originalUpdateSelectedCellInfo = LevelEditorScene.prototype.updateSelectedCellInfo;
LevelEditorScene.prototype.updateSelectedCellInfo = function updateSelectedCellInfoExtended() {
    _originalUpdateSelectedCellInfo.call(this);
    fillSelectedTokenEditor(this);
};
