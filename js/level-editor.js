import { makePlatformTextures } from '../kit/platform/textures.js';

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
    spider: 10,
    snake: 10,
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

// Game identity from game.manifest.json: browser keys are namespaced per game
// (storagePrefix "blockHunter" → blockHunterLevelEditorState, blockHunterTestLevel…)
let STORAGE_PREFIX = 'blockHunter';
const gameManifestReady = fetch('game.manifest.json', { cache: 'no-store' })
    .then((resp) => (resp.ok ? resp.json() : null))
    .then((manifest) => {
        if (manifest?.game?.storagePrefix) STORAGE_PREFIX = String(manifest.game.storagePrefix);
        try { window.SPIKE_GAME_MANIFEST = manifest; } catch (e) { }
        return manifest;
    })
    .catch(() => null);
const storageKey = (name) => `${STORAGE_PREFIX}${name}`;
const WALL_TOKEN_REGEX = /^w(\d)(\d)(\d)([hv0])$/i;
const COMMON_ASSETS_DIR = 'assets/images/common';
const BG_ASSETS_DIR = 'assets/images/background';
const FG_ASSETS_DIR = 'assets/images/foreground';
const API_BASE_PATH = 'api';
const BG_MANIFEST_PATH = 'data/background-images.json';
const FG_MANIFEST_PATH = 'data/foreground-images.json';
const MUSIC_MANIFEST_PATH = 'data/music-files.json';
const CONFIG_JSON_PATH = 'data/config.json';
const ASSETS_API_PATH = 'assets';
const DICTIONARIES_API_PATH = 'dictionaries';
const MAPPINGS_API_PATH = 'mappings';

// Available numeric level backgrounds discovered from assets/images/common/level<N>.png
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
    { token: 'm', label: 'skeleton (m)' },
    { token: 'stones', label: 'stones (stones)' },
    { token: 'ghost', label: 'ghost spawn' },
    { token: 'bat', label: 'bat spawn' },
    { token: 'spider', label: 'spider spawn' },
    { token: 'snake', label: 'snake spawn' }
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

// Platform games (game.manifest.json → "gameplay": "platform", engine kit/platform): their pieces
const PLATFORM_PALETTE_ITEMS = [
    { token: 'block', label: 'terreno / blocco pieno', texture: 'pf_block_top' },
    { token: 'plat', label: 'piattaforma (si salta da sotto)', texture: 'pf_plat' },
    { token: 'ladder', label: 'scala', texture: 'pf_ladder' },
    { token: 'spikes', label: 'spuntoni', texture: 'pf_spikes' },
    { token: 'cp', label: 'checkpoint', texture: 'pf_checkpoint' },
    { token: 'player', label: 'partenza del player', texture: null }
];
const PLATFORM_TOKEN_TEXTURES = Object.fromEntries(PLATFORM_PALETTE_ITEMS.filter((i) => i.texture).map((i) => [i.token, i.texture]));
const isPlatformGame = () => {
    try { return String(window.SPIKE_GAME_MANIFEST?.gameplay || '').toLowerCase() === 'platform'; } catch (e) { return false; }
};

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
    ghost: 2,
    bat: 2,
    spider: 0,
    snake: 0,
    ghostSpeed: 80,
    batSpeed: 90,
    spiderSpeed: 100,
    snakeSpeed: 95,
    batFlightsBeforeRest: 4,
    batRestSeconds: 2,
    batRestIntervalSeconds: 0,
    backgroundEnabled: true,
    foregroundEnabled: true,
    jumpEnabled: true,
    requiredGems: 0
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

// Real in-game tile size (px). Background/foreground width/height/offset/step values in the
// level JSON are game pixels, so editor previews must scale them by cellSize / GAME_TILE_SIZE
// (not by the editor-only "Tile size" slider). Loaded from data/config.json and overridden by
// the player's saved config, exactly like the game does (module/configUtils.js).
let GAME_TILE_SIZE = 32;
let GAME_VIEW_WIDTH = 800;
let GAME_VIEW_HEIGHT = 600;
// Radius of the player's physics circle (GameScene.createPlayer → objectContactByType.player)
let GAME_PLAYER_RADIUS = 22;

function resolvePlayerRadius(cfg) {
    const spec = cfg?.objectContactByType?.player;
    if (spec && Number(spec.radiusPixels) > 0) return Number(spec.radiusPixels);
    const size = Number(cfg?.playerSize) || Number(cfg?.objectSize) || 64;
    const mult = (spec && Number(spec.radiusMultiplier) > 0) ? Number(spec.radiusMultiplier) : 0.35;
    return Math.floor(size * mult);
}

function applySavedGameConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey('Config')) || 'null');
        const values = (saved && saved.__fullConfig === true && saved.values) ? saved.values : saved;
        if (values && Number(values.tileSize) > 0) GAME_TILE_SIZE = Number(values.tileSize);
        if (values && Number(values.width) > 0) GAME_VIEW_WIDTH = Number(values.width);
        if (values && Number(values.height) > 0) GAME_VIEW_HEIGHT = Number(values.height);
    } catch (e) { /* ignore */ }
}

const gameConfigReady = fetch(CONFIG_JSON_PATH, { cache: 'no-store' })
    .then((resp) => (resp.ok ? resp.json() : null))
    .then((cfg) => {
        if (cfg && Number(cfg.tileSize) > 0) GAME_TILE_SIZE = Number(cfg.tileSize);
        if (cfg && Number(cfg.width) > 0) GAME_VIEW_WIDTH = Number(cfg.width);
        if (cfg && Number(cfg.height) > 0) GAME_VIEW_HEIGHT = Number(cfg.height);
        if (cfg) GAME_PLAYER_RADIUS = resolvePlayerRadius(cfg);
    })
    .catch(() => { /* keep defaults */ })
    .then(() => gameManifestReady)
    .then(() => applySavedGameConfig());

// Data-driven entities (data/game-entities-mapping.json entries with a "behaviour"): the
// editor shows them in the palette and on the grid with their editor.icon (and tint), so a new
// enemy/character added to the mapping is immediately placeable without touching this file.
const EDITOR_ENTITIES = new Map(); // token -> { id, token, label, icon, tint, textureKey }
const editorEntitiesReady = fetch('data/game-entities-mapping.json', { cache: 'no-store' })
    .then((resp) => (resp.ok ? resp.json() : null))
    .then((json) => {
        Object.entries(json?.entities || {}).forEach(([id, def]) => {
            if (!def || !def.behaviour) return;
            const icon = def.editor?.icon || null;
            const tintStr = def.editor?.tint || def.sprite?.tint || null;
            const tint = tintStr ? parseInt(String(tintStr).replace('#', ''), 16) : null;
            (def.tokens && def.tokens.length ? def.tokens : [id]).forEach((t) => {
                const token = String(t).toLowerCase();
                EDITOR_ENTITIES.set(token, {
                    id, token, label: def.label || id, icon,
                    tint: Number.isFinite(tint) ? tint : null, tintCss: tintStr,
                    textureKey: icon?.src ? `entity_${id}` : null
                });
                AUTO_TILE_PROTECTED_TOKENS.add(token);
            });
        });
    })
    .catch(() => { /* no data entities */ });

function editorEntityFor(token) {
    return EDITOR_ENTITIES.get(String(token ?? '').trim().toLowerCase()) || null;
}

// Mirrors GameScene resolveLayerSize/resolveLayerPlacement: returns the layout of a bg/fg layer
// in game pixels, relative to the map origin.
// Same transform as GameScene placeLayerImage: (x, y, w, h) is the unrotated box
function placeEditorLayerImage(img, x, y, w, h, layer) {
    const tf = layerTransformFromJson(layer);
    img.setOrigin(0.5, 0.5);
    img.setDisplaySize(w, h);
    img.setPosition(x + w / 2, y + h / 2);
    img.setAngle(tf.rotation);
    img.setFlip(tf.flipX, tf.flipY);
}

function computeGameLayerLayout(layer, cols, rows, natW = 0, natH = 0) {
    const worldW = cols * GAME_TILE_SIZE;
    const worldH = rows * GAME_TILE_SIZE;
    const defaultW = Math.max(worldW, GAME_VIEW_WIDTH);
    const defaultH = Math.max(worldH, GAME_VIEW_HEIGHT);

    const rawW = Number(layer.width ?? layer.w ?? layer.displayWidth ?? layer.layerWidth);
    const rawH = Number(layer.height ?? layer.h ?? layer.displayHeight ?? layer.layerHeight);
    const hasW = Number.isFinite(rawW) && rawW > 0;
    const hasH = Number.isFinite(rawH) && rawH > 0;
    let layerW = hasW ? rawW : defaultW;
    let layerH = hasH ? rawH : defaultH;
    if (hasW && !hasH && natW > 0 && natH > 0) layerH = Math.round(rawW * natH / natW);
    if (hasH && !hasW && natW > 0 && natH > 0) layerW = Math.round(rawH * natW / natH);

    const offsetX = parseNumber(layer.offsetX ?? layer.left ?? layer.x ?? layer.positionX, 0);
    const offsetY = parseNumber(layer.offsetY ?? layer.top ?? layer.y ?? layer.positionY, 0);
    const rawStepX = parseNumber(layer.repeatStepX ?? layer.replicaStepX ?? layer.repeatOffsetX ?? layer.replicaOffsetX, layerW);
    const rawStepY = parseNumber(layer.repeatStepY ?? layer.replicaStepY ?? layer.repeatOffsetY ?? layer.replicaOffsetY, layerH);
    const stepX = Math.abs(rawStepX) > 0 ? rawStepX : layerW;
    const stepY = Math.abs(rawStepY) > 0 ? rawStepY : layerH;

    const repeatX = parseRepeatValue(layer.repeatX ?? layer.replicaX ?? layer.repeatCountX ?? layer.replicaCountX ?? 1, 1);
    const repeatY = parseRepeatValue(layer.repeatY ?? layer.replicaY ?? layer.repeatCountY ?? layer.replicaCountY ?? 1, 1);
    const infiniteCount = (stepAbs, span) => Math.max(1, Math.ceil(span / Math.max(1, stepAbs)) + 2);
    const countX = (repeatX === '*')
        ? infiniteCount(Math.abs(stepX), Math.max(worldW, GAME_VIEW_WIDTH) + Math.abs(offsetX) + Math.abs(stepX))
        : repeatX;
    const countY = (repeatY === '*')
        ? infiniteCount(Math.abs(stepY), Math.max(worldH, GAME_VIEW_HEIGHT) + Math.abs(offsetY) + Math.abs(stepY))
        : repeatY;

    return { layerW, layerH, offsetX, offsetY, stepX, stepY, countX, countY };
}

function buildApiUrl(path) {
    const clean = String(path ?? '').replace(/^\/+|\/+$/g, '');
    return `${API_BASE_PATH}/${clean}/`;
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

    try {
        const fallback = await fetch(fallbackUrl);
        if (!fallback.ok) return [];
        const data = await fallback.json();
        return Array.isArray(data) ? data : [];
    } catch (_e) {
        return [];
    }
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

const AUTO_TILE_PROTECTED_TOKENS = new Set([
    'g', 'd', 'k', 'p', 'l', 'exit', 'wooden', 'helmet', 'b', 'c', 'm', 'stones',
    'ghost', 'bat', 'spider', 'snake', 'player', 'door', 'key', 'gem', 'heart',
    'block', 'plat', 'ladder', 'spikes', 'cp'
]);

function randomWallVariantToken() {
    const row = Math.floor(Math.random() * 4);
    const col = Math.floor(Math.random() * 6);
    return `w${row}${col}00`;
}

function isTerrainOrWallToken(token) {
    const base = String(token || '').trim().replace(/\.$/, '');
    if (!base || base === '-' || base === '#') return true;
    if (WALL_TOKEN_REGEX.test(base)) return true;
    return ['sand', 'water', 'mud', 'h', 'back', 'hole', 'hole2', 'floor', 'f', 's'].includes(base);
}

function resolveLayerToImagePath(src, type) {
    const normalized = normalizeLayerSrc(src, type);
    if (!normalized) return '';
    if (/^(https?:|data:|blob:|\/)/i.test(normalized)) return normalized;
    if (/^game_bg(_\d+)?$/i.test(normalized)) return '';

    const targetDir = type === 'fg' ? FG_ASSETS_DIR : BG_ASSETS_DIR;
    if (normalized.startsWith('assets/')) return normalized;
    if (normalized.startsWith(`${targetDir}/`)) return normalized;
    if (!normalized.includes('/')) return `${targetDir}/${normalized}`;
    return normalized;
}

function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Immagine non caricabile: ${src}`));
        img.src = src;
    });
}

function getAutoTileSensitivitySettings() {
    const wallSensitivity = clamp(parseNumber(el('autoWallSensitivity')?.value, 50), 0, 100);
    const liquidSensitivity = clamp(parseNumber(el('autoLiquidSensitivity')?.value, 50), 0, 100);
    return { wallSensitivity, liquidSensitivity };
}

function refreshAutoTileSensitivityLabels() {
    const wall = getAutoTileSensitivitySettings().wallSensitivity;
    const liquid = getAutoTileSensitivitySettings().liquidSensitivity;
    const wallTarget = el('autoWallSensitivityValue');
    const liquidTarget = el('autoLiquidSensitivityValue');
    if (wallTarget) wallTarget.textContent = String(wall);
    if (liquidTarget) liquidTarget.textContent = String(liquid);
}

function classifyAutoTileFromPixel(r, g, b, a, structureBias = false, settings = { wallSensitivity: 50, liquidSensitivity: 50 }, floor = null) {
    if (a < 20) return null;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sat = max === 0 ? 0 : (max - min) / max;

    const wallAdj = (Number(settings.wallSensitivity || 50) - 50) / 50;
    const liquidAdj = (Number(settings.liquidSensitivity || 50) - 50) / 50;

    const waterBlueVsGreen = 16 - (liquidAdj * 8);
    const waterBlueVsRed = 20 - (liquidAdj * 10);
    const waterBlueMin = 72 - (liquidAdj * 18);
    const mudDeltaMin = 18 - (liquidAdj * 8);
    const mudRedMin = 58 - (liquidAdj * 12);
    const mudGreenMin = 40 - (liquidAdj * 10);
    const mudSatMin = 0.14 - (liquidAdj * 0.05);

    // The dominant colour of the map is the walkable floor: liquids must clearly differ from it
    const floorDist = floor ? Math.hypot(r - floor.r, g - floor.g, b - floor.b) : Infinity;
    const liquidAllowed = floorDist > (46 - liquidAdj * 22);

    const looksWater = liquidAllowed && (b > g + waterBlueVsGreen) && (b > r + waterBlueVsRed) && (b >= waterBlueMin);
    if (looksWater) return 'water';

    const looksMud = liquidAllowed && (r > g) && (g >= b) && ((r - b) > mudDeltaMin) && r >= mudRedMin && g >= mudGreenMin && b <= 130 && sat >= mudSatMin;
    if (looksMud) return 'mud';

    const darkRock = lum <= (50 + wallAdj * 22);
    const neutralSolid = sat <= (0.18 + wallAdj * 0.08) && lum <= (112 + wallAdj * 28);
    const structureLike = structureBias && sat <= (0.30 + wallAdj * 0.06) && lum <= (132 + wallAdj * 24) && r >= 50 && g >= 50 && b >= 50;
    if (darkRock || neutralSolid || structureLike) return 'wall';

    return null;
}

function applyAutoTileToCell(cell, targetToken) {
    if (!cell || !targetToken) return false;
    const rawParts = String(cell.base || '-').split('/').map((s) => s.trim()).filter(Boolean);
    const parts = rawParts.length ? rawParts : ['-'];

    const normalizedParts = parts.map((part) => getRenderableTokenBase(part).replace(/\.$/, ''));
    const hasProtected = normalizedParts.some((base) => AUTO_TILE_PROTECTED_TOKENS.has(base));
    if (hasProtected) return false;

    const terrainIdx = normalizedParts.findIndex((base) => isTerrainOrWallToken(base));
    if (terrainIdx >= 0) {
        if (normalizedParts[terrainIdx] === targetToken) return false;
        parts[terrainIdx] = targetToken;
    } else {
        parts.unshift(targetToken);
    }

    const nextValue = parts.join('/');
    if (nextValue === String(cell.base || '-')) return false;
    cell.base = nextValue;
    return true;
}

const AUTO_PATH_OBJECT_TOKENS = new Set(['g', 'ghost', 'bat', 'snake', 'spider']);
const AUTO_PATH_ENEMY_TOKENS = ['ghost', 'bat', 'snake', 'spider'];

function getCellTokenParts(cell) {
    return String(cell?.base || '-')
        .split('/')
        .map((s) => String(s || '').trim())
        .filter(Boolean);
}

function getCellTokenBases(cell) {
    return getCellTokenParts(cell).map((part) => getRenderableTokenBase(part).replace(/\.$/, ''));
}

function setCellBasesPreservingDecorations(cell, nextBases) {
    const safe = Array.isArray(nextBases) ? nextBases.filter(Boolean) : [];
    cell.base = safe.length ? safe.join('/') : '-';
}

function getPrimaryTerrainToken(cell) {
    const bases = getCellTokenBases(cell);
    for (const base of bases) {
        if (isTerrainOrWallToken(base)) return base;
    }
    return '-';
}

function isBlockedForPath(cell) {
    const terrain = getPrimaryTerrainToken(cell);
    if (!terrain || terrain === '-') return false;
    if (terrain === '#' || terrain === 'h' || terrain === 'hole' || terrain === 'hole2' || terrain === 'back') return true;
    if (WALL_TOKEN_REGEX.test(terrain)) return true;
    return false;
}

function hasObjectToken(cell, token) {
    const bases = getCellTokenBases(cell);
    return bases.includes(token);
}

function clearAutoPathObjectTokens(scene) {
    for (let y = 0; y < scene.rows; y++) {
        for (let x = 0; x < scene.cols; x++) {
            const cell = scene.cells[y]?.[x];
            if (!cell) continue;
            const next = getCellTokenBases(cell).filter((base) => !AUTO_PATH_OBJECT_TOKENS.has(base));
            setCellBasesPreservingDecorations(cell, next);
        }
    }
}

function countTokenInScene(scene, token) {
    let count = 0;
    for (let y = 0; y < scene.rows; y++) {
        for (let x = 0; x < scene.cols; x++) {
            const cell = scene.cells[y]?.[x];
            if (!cell) continue;
            if (hasObjectToken(cell, token)) count++;
        }
    }
    return count;
}

function addObjectTokenToCell(cell, token) {
    const bases = getCellTokenBases(cell);
    if (bases.includes(token)) return false;

    const terrain = getPrimaryTerrainToken(cell);
    const objects = bases.filter((base) => !isTerrainOrWallToken(base));
    const next = [];
    if (terrain && terrain !== '-') next.push(terrain);
    next.push(...objects, token);
    setCellBasesPreservingDecorations(cell, next);
    return true;
}

// Reachability with the real player body: the player is a circle of GAME_PLAYER_RADIUS px (44 px wide
// with the default config) while tiles are GAME_TILE_SIZE px (32), so 1-tile corridors are not walkable.
// Positions are sampled every half tile; a position is free when the circle touches no blocking cell
// and stays inside the world. A cell is reachable when the player can get its centre within half a tile.
function buildPlayerReachability(scene, startRow, startCol) {
    const ts = GAME_TILE_SIZE;
    const half = ts / 2;
    const R = Math.max(1, GAME_PLAYER_RADIUS) - 0.5;
    const rows = scene.rows, cols = scene.cols;
    const W = cols * ts, H = rows * ts;

    const zoneBlocked = new Set();
    ['wall', 'hole'].forEach((z) => {
        const bag = scene.zoneCells?.get?.(z);
        if (bag) bag.forEach((k) => zoneBlocked.add(k)); // "col,row"
    });
    const blocked = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) =>
        isBlockedForPath(scene.cells[r]?.[c]) || zoneBlocked.has(`${c},${r}`)));

    const nX = cols * 2 + 1, nY = rows * 2 + 1; // position index i -> i * half px
    const posFree = (ix, iy) => {
        const px = ix * half, py = iy * half;
        if (px - R < 0 || py - R < 0 || px + R > W || py + R > H) return false;
        const c0 = Math.max(0, Math.floor((px - R) / ts)), c1 = Math.min(cols - 1, Math.floor((px + R) / ts));
        const r0 = Math.max(0, Math.floor((py - R) / ts)), r1 = Math.min(rows - 1, Math.floor((py + R) / ts));
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                if (!blocked[r][c]) continue;
                const nx = Math.max(c * ts, Math.min(px, (c + 1) * ts));
                const ny = Math.max(r * ts, Math.min(py, (r + 1) * ts));
                if ((px - nx) ** 2 + (py - ny) ** 2 < R * R) return false;
            }
        }
        return true;
    };

    // start: the cell centre, or the nearest free position inside the start cell
    const sx = startCol * 2 + 1, sy = startRow * 2 + 1;
    let start = null;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (posFree(sx + dx, sy + dy)) { start = [sx + dx, sy + dy]; break; }
    }

    const dist = new Map();
    const neighborsByKey = new Map();
    if (!start) return { dist, neighborsByKey, startFits: false };

    const seen = new Int32Array(nX * nY).fill(-1);
    const queue = [start];
    seen[start[1] * nX + start[0]] = 0;
    for (let qi = 0; qi < queue.length; qi++) {
        const [x, y] = queue[qi];
        const d = seen[y * nX + x];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= nX || ny >= nY) continue;
            if (seen[ny * nX + nx] !== -1 || !posFree(nx, ny)) continue;
            seen[ny * nX + nx] = d + 1;
            queue.push([nx, ny]);
        }
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (blocked[r][c]) continue;
            let best = -1;
            for (let iy = r * 2; iy <= r * 2 + 2; iy++) {
                for (let ix = c * 2; ix <= c * 2 + 2; ix++) {
                    const d = seen[iy * nX + ix];
                    if (d >= 0 && (best < 0 || d < best)) best = d;
                }
            }
            if (best >= 0) dist.set(`${r},${c}`, Math.round(best / 2));
        }
    }
    for (const key of dist.keys()) {
        const [r, c] = key.split(',').map(Number);
        const nb = [];
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (dist.has(`${r + dr},${c + dc}`)) nb.push([r + dr, c + dc]);
        }
        neighborsByKey.set(key, nb);
    }
    return { dist, neighborsByKey, startFits: true };
}

function pickDistributedCells(candidates, count, minDist) {
    const picked = [];
    for (const c of candidates) {
        if (picked.length >= count) break;
        const ok = picked.every((p) => Math.abs(p.row - c.row) + Math.abs(p.col - c.col) >= minDist);
        if (ok) picked.push(c);
    }
    return picked;
}

function chooseEnemyCandidates(candidates, neighborsByKey, type) {
    const withDegree = candidates.map((c) => {
        const degree = (neighborsByKey.get(`${c.row},${c.col}`) || []).length;
        return { ...c, degree };
    });

    if (type === 'ghost') {
        return withDegree.filter((c) => c.degree >= 3).sort((a, b) => b.dist - a.dist);
    }
    if (type === 'bat') {
        return withDegree.filter((c) => c.left && c.right).sort((a, b) => b.dist - a.dist);
    }
    if (type === 'snake') {
        return withDegree.filter((c) => c.up && c.down).sort((a, b) => b.dist - a.dist);
    }
    if (type === 'spider') {
        return withDegree.filter((c) => c.degree <= 2).sort((a, b) => b.dist - a.dist);
    }
    return withDegree.sort((a, b) => b.dist - a.dist);
}

async function autoPopulatePathSpawns() {
    const scene = getScene();
    if (!scene) {
        setStatus('Scene editor non disponibile.', true);
        return;
    }

    const startRow = clamp(parseNumber(el('playerRow')?.value, 1), 0, Math.max(0, scene.rows - 1));
    const startCol = clamp(parseNumber(el('playerCol')?.value, 1), 0, Math.max(0, scene.cols - 1));

    const { dist, neighborsByKey, startFits } = buildPlayerReachability(scene, startRow, startCol);
    if (!startFits) {
        setStatus(`Il player (largo ${GAME_PLAYER_RADIUS * 2} px) non entra nella cella di partenza ${startRow},${startCol}: spostalo in una zona più aperta.`, true);
        return;
    }
    if (!dist.size) {
        setStatus('Percorso non calcolabile: verifica posizione player e tile bloccanti.', true);
        return;
    }

    const preserveManualSpawns = !!el('preserveManualSpawns')?.checked;
    if (!preserveManualSpawns) {
        clearAutoPathObjectTokens(scene);
    }

    const inBounds = (r, c) => r >= 0 && c >= 0 && r < scene.rows && c < scene.cols;
    const keyOf = (r, c) => `${r},${c}`;

    const walkable = [];
    for (const [key, d] of dist.entries()) {
        const [row, col] = key.split(',').map((v) => Number(v));
        if (row === startRow && col === startCol) continue;
        const cell = scene.cells[row]?.[col];
        if (!cell || isBlockedForPath(cell)) continue;
        const left = inBounds(row, col - 1) && dist.has(keyOf(row, col - 1));
        const right = inBounds(row, col + 1) && dist.has(keyOf(row, col + 1));
        const up = inBounds(row - 1, col) && dist.has(keyOf(row - 1, col));
        const down = inBounds(row + 1, col) && dist.has(keyOf(row + 1, col));
        walkable.push({ row, col, dist: d, left, right, up, down });
    }

    walkable.sort((a, b) => b.dist - a.dist);
    if (!walkable.length) {
        setStatus('Nessuna cella valida per spawn automatico.', true);
        return;
    }

    const totalWalkable = walkable.length;
    const defaultGems = clamp(Math.floor(totalWalkable * 0.08), 6, 40);
    const gemCount = defaultGems;

    const enemyCounts = {
        ghost: clamp(parseNumber(el('ghostCount')?.value, 0), 0, 100),
        bat: clamp(parseNumber(el('batCount')?.value, 0), 0, 100),
        snake: clamp(parseNumber(el('snakeCount')?.value, 0), 0, 100),
        spider: clamp(parseNumber(el('spiderCount')?.value, 0), 0, 100)
    };

    const occupied = new Set();
    if (preserveManualSpawns) {
        for (const c of walkable) {
            const cell = scene.cells[c.row]?.[c.col];
            if (!cell) continue;
            const bases = getCellTokenBases(cell);
            if (bases.some((b) => AUTO_PATH_OBJECT_TOKENS.has(b))) {
                occupied.add(`${c.row},${c.col}`);
            }
        }
    }

    // In the game "A/B" means "A covers B" (B appears only when A is destroyed): spawning on a
    // terrain cell such as mud would hide the object, so spawns only go on empty floor cells.
    const spawnable = walkable.filter((c) => {
        const bases = getCellTokenBases(scene.cells[c.row]?.[c.col]).filter((b) => b && b !== '-');
        return bases.length === 0;
    });
    if (!spawnable.length) {
        setStatus('Nessuna cella libera per gli spawn: tutte le celle raggiungibili hanno già terreno o oggetti.', true);
        return;
    }

    const gemsPicked = pickDistributedCells(spawnable, gemCount, 4);
    let addedGems = 0;
    gemsPicked.forEach((c) => {
        const cell = scene.cells[c.row]?.[c.col];
        if (!cell) return;
        if (occupied.has(`${c.row},${c.col}`)) return;
        if (addObjectTokenToCell(cell, 'g')) {
            occupied.add(`${c.row},${c.col}`);
            addedGems++;
        }
    });

    const addedEnemies = { ghost: 0, bat: 0, snake: 0, spider: 0 };
    for (const enemy of AUTO_PATH_ENEMY_TOKENS) {
        const requested = enemyCounts[enemy] || 0;
        if (!requested) continue;

        const candidates = chooseEnemyCandidates(spawnable, neighborsByKey, enemy)
            .filter((c) => !occupied.has(`${c.row},${c.col}`))
            .filter((c) => c.dist >= 4);

        const picked = pickDistributedCells(candidates, requested, enemy === 'ghost' ? 5 : 4);
        picked.forEach((c) => {
            const cell = scene.cells[c.row]?.[c.col];
            if (!cell) return;
            if (addObjectTokenToCell(cell, enemy)) {
                occupied.add(`${c.row},${c.col}`);
                addedEnemies[enemy]++;
            }
        });
    }

    const totalGems = countTokenInScene(scene, 'g');
    const totalEnemies = {
        ghost: countTokenInScene(scene, 'ghost'),
        bat: countTokenInScene(scene, 'bat'),
        snake: countTokenInScene(scene, 'snake'),
        spider: countTokenInScene(scene, 'spider')
    };

    // Keep form counts aligned to what has been effectively placed.
    if (el('ghostCount')) el('ghostCount').value = String(totalEnemies.ghost);
    if (el('batCount')) el('batCount').value = String(totalEnemies.bat);
    if (el('snakeCount')) el('snakeCount').value = String(totalEnemies.snake);
    if (el('spiderCount')) el('spiderCount').value = String(totalEnemies.spider);

    scene.renderGrid();
    drawMiniMapPreview(scene);
    setStatus(`Auto spawn completato su ${dist.size} celle raggiungibili dal player (largo ${GAME_PLAYER_RADIUS * 2} px). Aggiunti Gemme:${addedGems} Ghost:${addedEnemies.ghost} Bat:${addedEnemies.bat} Snake:${addedEnemies.snake} Spider:${addedEnemies.spider}. Totali Gemme:${totalGems} Ghost:${totalEnemies.ghost} Bat:${totalEnemies.bat} Snake:${totalEnemies.snake} Spider:${totalEnemies.spider}.`);
}

async function autoPopulateTilesFromLayers() {
    const scene = getScene();
    if (!scene) {
        setStatus('Scene editor non disponibile.', true);
        return;
    }

    const cols = Number(scene.cols) || 0;
    const rows = Number(scene.rows) || 0;
    if (cols <= 0 || rows <= 0) {
        setStatus('Griglia non valida.', true);
        return;
    }

    const bgLayers = readBackgroundLayersFromDOM().filter((l) => l && l.enabled !== false && String(l.src || '').trim());
    const fgLayers = readForegroundLayersFromDOM().filter((l) => l && l.enabled !== false && String(l.src || '').trim());

    const sources = [];
    if (bgLayers[0]) {
        sources.push({
            type: 'bg',
            layer: bgLayers[0],
            src: resolveLayerToImagePath(bgLayers[0].src, 'bg'),
            alpha: clamp(parseNumber(bgLayers[0].parallaxBgAlpha, 1), 0, 1),
            rawSrc: String(bgLayers[0].src || '')
        });
    }
    if (fgLayers[0]) {
        sources.push({
            type: 'fg',
            layer: fgLayers[0],
            src: resolveLayerToImagePath(fgLayers[0].src, 'fg'),
            alpha: clamp(parseNumber(fgLayers[0].parallaxFgAlpha, 1), 0, 1),
            rawSrc: String(fgLayers[0].src || '')
        });
    }

    const usableSources = sources.filter((s) => !!s.src);
    if (!usableSources.length) {
        setStatus('Nessun layer BG/FG valido da analizzare.', true);
        return;
    }

    // Draw the layers as the game does (size, offset, repeats), SAMPLE px per cell, then average each cell
    const SAMPLE = 8;
    const canvas = document.createElement('canvas');
    canvas.width = cols * SAMPLE;
    canvas.height = rows * SAMPLE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        setStatus('Canvas di analisi non disponibile.', true);
        return;
    }

    let loadedCount = 0;
    for (const layer of usableSources) {
        try {
            const img = await loadImageElement(layer.src);
            ctx.globalAlpha = layer.alpha;
            const lay = computeGameLayerLayout(layer.layer || {}, cols, rows, img.naturalWidth, img.naturalHeight);
            const scale = SAMPLE / GAME_TILE_SIZE;
            for (let iy = 0; iy < lay.countY; iy++) {
                for (let ix = 0; ix < lay.countX; ix++) {
                    drawLayerInstance(ctx, img,
                        (lay.offsetX + lay.stepX * ix) * scale, (lay.offsetY + lay.stepY * iy) * scale,
                        lay.layerW * scale, lay.layerH * scale, layerTransformFromJson(layer.layer));
                }
            }
            loadedCount++;
        } catch (_e) {
            // Continue with other layers.
        }
    }
    ctx.globalAlpha = 1;

    if (!loadedCount) {
        setStatus('Impossibile caricare i layer selezionati per l\'analisi.', true);
        return;
    }

    const joinedSrc = usableSources.map((s) => `${s.rawSrc} ${s.src}`).join(' ').toLowerCase();
    const structureBias = /(rock|stone|staccion|palo|pole|house|home|miner_house|column|wall|brick)/i.test(joinedSrc);
    const settings = getAutoTileSensitivitySettings();

    const raw = ctx.getImageData(0, 0, cols * SAMPLE, rows * SAMPLE).data;
    const cellColor = (x, y) => {
        let r = 0, g = 0, b = 0, a = 0;
        for (let sy = 0; sy < SAMPLE; sy++) {
            const rowStart = ((y * SAMPLE + sy) * cols * SAMPLE + x * SAMPLE) * 4;
            for (let sx = 0; sx < SAMPLE; sx++) {
                const i = rowStart + sx * 4;
                r += raw[i]; g += raw[i + 1]; b += raw[i + 2]; a += raw[i + 3];
            }
        }
        const n = SAMPLE * SAMPLE;
        return { r: r / n, g: g / n, b: b / n, a: a / n };
    };
    const colors = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) colors.push(cellColor(x, y));

    // Dominant colour (most frequent 32-level bucket) = walkable floor
    const buckets = new Map();
    colors.forEach((c) => {
        if (c.a < 20) return;
        const key = `${c.r >> 5},${c.g >> 5},${c.b >> 5}`;
        const bk = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
        bk.n++; bk.r += c.r; bk.g += c.g; bk.b += c.b;
        buckets.set(key, bk);
    });
    let floor = null;
    for (const bk of buckets.values()) {
        if (!floor || bk.n > floor.n) floor = bk;
    }
    if (floor) floor = { n: floor.n, r: floor.r / floor.n, g: floor.g / floor.n, b: floor.b / floor.n };

    let placedWalls = 0;
    let placedWater = 0;
    let placedMud = 0;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const { r, g, b, a } = colors[y * cols + x];

            const detected = classifyAutoTileFromPixel(r, g, b, a, structureBias, settings, floor);
            if (!detected) continue;

            const cell = scene.cells[y]?.[x];
            if (!cell) continue;

            const token = detected === 'wall' ? randomWallVariantToken() : detected;
            const changed = applyAutoTileToCell(cell, token);
            if (!changed) continue;

            if (detected === 'wall') placedWalls++;
            if (detected === 'water') placedWater++;
            if (detected === 'mud') placedMud++;
        }
    }

    scene.renderGrid();
    drawMiniMapPreview(scene);
    setStatus(`Auto tiles completato. Wall: ${placedWalls}, Water: ${placedWater}, Mud: ${placedMud}. Sens: W${settings.wallSensitivity}/L${settings.liquidSensitivity}`);
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

let MAPPINGS_EDITOR_STATE = {
    currentType: 'entities',
    loadedDocuments: {
        entities: null,
        tiles: null,
        effects: null
    },
    currentItemKey: ''
};

function setConfigStatus(message, isError = false) {
    const target = el('configStatusText');
    if (!target) return;
    target.style.color = isError ? '#e5604d' : '#59b97c';
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
    try {
        const resp = await fetch(CONFIG_JSON_PATH, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const cfg = await resp.json();
        buildConfigEditorUI(cfg);
        setConfigStatus('Configurazione caricata.');
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
    if (normalized === 'spider') return '#d17f57';
    if (normalized === 'snake') return '#7bc96f';
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

// ---- per-object transform stored in the token: g(transform{scale:1.5;rot:90;flipX:1}) ----
// The game applies the same transform (kit/gameplay/scene/effects.js), so what you see is
// what you play. Walls keep their native rotation/mirror (w<r><c><rot><flip>).
const TRANSFORM_FX = 'transform';
const IDENTITY_TRANSFORM = { scale: 1, rot: 0, flipX: false, flipY: false };

function readTransformOptions(options) {
    const o = {};
    Object.entries(options || {}).forEach(([k, v]) => { o[String(k).toLowerCase()] = v; });
    const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const bool = (v) => v === true || /^(1|true|yes)$/i.test(String(v ?? ''));
    return {
        scale: Math.max(0.1, Math.min(8, num(o.scale ?? o.s, 1))),
        rot: ((num(o.rot ?? o.rotation ?? o.angle, 0) % 360) + 360) % 360,
        flipX: bool(o.flipx ?? o.fx),
        flipY: bool(o.flipy ?? o.fy)
    };
}

function parseTokenTransform(token) {
    const meta = parseDecoratedToken(token);
    const entry = splitEffectsList(meta.effects).map(parseEffectEntry).find((e) => e.name === TRANSFORM_FX);
    return entry ? readTransformOptions(entry.options) : { ...IDENTITY_TRANSFORM };
}

function withTokenTransform(token, tf) {
    const meta = parseDecoratedToken(token);
    if (!meta.base) return token;
    const others = splitEffectsList(meta.effects).filter((e) => parseEffectEntry(e).name !== TRANSFORM_FX);
    const t = { ...IDENTITY_TRANSFORM, ...tf };
    const opts = {};
    if (Math.abs(t.scale - 1) > 1e-3) opts.scale = String(Math.round(t.scale * 100) / 100);
    if (t.rot) opts.rot = String(t.rot);
    if (t.flipX) opts.flipX = '1';
    if (t.flipY) opts.flipY = '1';
    if (Object.keys(opts).length) others.unshift(buildEffectEntry(TRANSFORM_FX, opts));
    return composeDecoratedToken({ ...meta, effects: others.join(',') });
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

// Zone type definitions – each maps to an invisible in-game effect/token
const ZONE_TYPE_DEFS = [
    { id: 'wall',  label: 'Muro',   color: 0xff2222, hex: '#ff2222', alpha: 0.38, stroke: 0xff5555 },
    { id: 'hole',  label: 'Buca',   color: 0x3355ff, hex: '#3355ff', alpha: 0.38, stroke: 0x6688ff },
    { id: 'sand',  label: 'Sabbia', color: 0xddaa11, hex: '#ddaa11', alpha: 0.38, stroke: 0xffcc44 },
    { id: 'mud',   label: 'Fango',  color: 0x995533, hex: '#995533', alpha: 0.38, stroke: 0xbb7744 },
    { id: 'water', label: 'Acqua',  color: 0x1199cc, hex: '#1199cc', alpha: 0.38, stroke: 0x44bbff },
    // platform games (kit/platform): one-way platform, ladder, hazard
    { id: 'plat',   label: 'Piattaforma', color: 0xc58a4a, hex: '#c58a4a', alpha: 0.45, stroke: 0xffb066, platform: true },
    { id: 'ladder', label: 'Scala',       color: 0x59b97c, hex: '#59b97c', alpha: 0.40, stroke: 0x8be0a8, platform: true },
    { id: 'hazard', label: 'Pericolo',    color: 0xff00aa, hex: '#ff00aa', alpha: 0.40, stroke: 0xff66cc, platform: true },
];

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
        // Multi-type zone system: Map<zoneId, Set<"col,row">> for tile-level, Map<zoneId, Set<"gsc,gsr">> for sub-cell
        this.zoneCells = new Map(ZONE_TYPE_DEFS.map(d => [d.id, new Set()]));
        this.zoneSubCells = new Map(ZONE_TYPE_DEFS.map(d => [d.id, new Set()]));
        this.activeZoneType = 'wall'; // currently selected zone type id
        this.zoneToolActive = false;  // when true, clicks/drag paint/erase zone cells
        this._zonePaintMode = 'paint'; // 'paint' | 'erase'
        this._zoneIsDragging = false;
        this.subCellSize = 0; // sub-cell game-pixel size (0 = disabled); e.g. 16 → 4×4 sub-cells per 64px tile
    }

    preload() {
        this.load
            .spritesheet('tiles', `${COMMON_ASSETS_DIR}/tiles.png`, { frameWidth: 64, frameHeight: 64 })
            .spritesheet('wall_tiles', `${COMMON_ASSETS_DIR}/wall_completed.png`, { frameWidth: 64, frameHeight: 64 })
            .spritesheet('objects', `${COMMON_ASSETS_DIR}/obj_game.png`, { frameWidth: 64, frameHeight: 64 })
            .spritesheet('ghost_anim', `${COMMON_ASSETS_DIR}/ghost.png`, { frameWidth: 64, frameHeight: 64 })
            .spritesheet('bat_anim', `${COMMON_ASSETS_DIR}/batpng.png`, { frameWidth: 64, frameHeight: 64 });
        EDITOR_ENTITIES.forEach((ent) => {
            if (!ent.textureKey || this.textures.exists(ent.textureKey)) return;
            this.load.spritesheet(ent.textureKey, ent.icon.src, {
                frameWidth: Number(ent.icon.frameWidth) || 64, frameHeight: Number(ent.icon.frameHeight) || 64
            });
        });

        // preload possible game backgrounds so the editor can offer them
        // Fallback default background (game_bg.png is not present in this repo)
        this.load.image('game_bg', `${COMMON_ASSETS_DIR}/attract_bg.png`);
        // load all discovered numeric level backgrounds
        try {
            (AVAILABLE_BG_LEVELS || []).forEach((n) => {
                this.load.image(`game_bg_${String(n)}`, `${COMMON_ASSETS_DIR}/level${String(n)}.png`);
            });
        } catch (e) { /* ignore */ }
    }

    create() {
        try { makePlatformTextures(this, 32); } catch (e) { /* platform pieces only */ }
        this.input.mouse?.disableContextMenu();
        // Darker background to increase tile visibility
        this.cameras.main.setBackgroundColor('#03050a');

        this.gridLayer = this.add.container(0, 0);
        this.paletteLayer = this.add.container(0, 0);
        this.selectionLayer = this.add.container(0, 0);
        this.zoneLayer = this.add.container(0, 0);

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
                        try { this._updateSubCellLabel(); } catch (e) {}
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

        // initialize sub-cell size slider
        try {
            const subCellSlider = el('subCellSizeSlider');
            if (subCellSlider) {
                subCellSlider.value = String(this.subCellSize || 0);
                this._updateSubCellLabel();
                subCellSlider.addEventListener('input', () => {
                    try { this.setSubCellSize(Number(subCellSlider.value) || 0); } catch (e) {}
                });
            }
        } catch (e) {}

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
                    const frame = this.textures.getFrame(textureKey, 0);
                    const natW = frame?.realWidth ?? frame?.width ?? 0;
                    const natH = frame?.realHeight ?? frame?.height ?? 0;
                    const lay = computeGameLayerLayout(layer, this.cols, this.rows, natW, natH);
                    const scale = this.cellSize / GAME_TILE_SIZE;
                    const dispW = lay.layerW * scale;
                    const dispH = lay.layerH * scale;

                    for (let iy = 0; iy < lay.countY; iy++) {
                        for (let ix = 0; ix < lay.countX; ix++) {
                            const img = this.add.image(0, 0, textureKey).setDepth(-500 - idx);
                            placeEditorLayerImage(img, this.gridOffsetX + (lay.offsetX + lay.stepX * ix) * scale,
                                this.gridOffsetY + (lay.offsetY + lay.stepY * iy) * scale, dispW, dispH, layer);
                            img.__bhLayer = { type: 'bg', index: idx, ix, iy, row: layer.__row || null };
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
            const frame = this.textures.getFrame(textureKey, 0);
            const natW = frame?.realWidth ?? frame?.width ?? 0;
            const natH = frame?.realHeight ?? frame?.height ?? 0;
            const lay = computeGameLayerLayout(layer, this.cols, this.rows, natW, natH);
            const scale = this.cellSize / GAME_TILE_SIZE;
            const dispW = lay.layerW * scale;
            const dispH = lay.layerH * scale;

            for (let iy = 0; iy < lay.countY; iy++) {
                for (let ix = 0; ix < lay.countX; ix++) {
                    const img = this.add.image(0, 0, textureKey).setDepth(500 + idx);
                    placeEditorLayerImage(img, this.gridOffsetX + (lay.offsetX + lay.stepX * ix) * scale,
                        this.gridOffsetY + (lay.offsetY + lay.stepY * iy) * scale, dispW, dispH, layer);
                    img.__bhLayer = { type: 'fg', index: idx, ix, iy, row: layer.__row || null };
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

        this.cols = clamp(Math.floor(cols), 4, 120);
        this.rows = clamp(Math.floor(rows), 4, 120);

        // Compute available area from actual canvas size. Reserve a palette column on the right.
        const totalW = Math.max(200, Math.floor(this.scale.width || this.sys.game.config.width || 1000));
        const totalH = Math.max(100, Math.floor(this.scale.height || this.sys.game.config.height || 700));

        // Candidate palette width: clamp between 180 and 440 or 28% of width
        const hasDomPalette = typeof document !== 'undefined' && !!document.getElementById('domPalette-tiles');
        const paletteWidth = hasDomPalette ? 0 : Math.floor(Math.min(440, Math.max(180, totalW * 0.28)));
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
        this.gridOffsetX = Math.max(padding, Math.floor((Math.max(64, totalW - (this.paletteArea?.width ?? 360) - padding * 3) - gridW) / 2) + padding);
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
        this.gridOffsetX = Math.max(padding, Math.floor((Math.max(64, totalW - (this.paletteArea?.width ?? 360) - padding * 3) - gridW) / 2) + padding);
        this.gridOffsetY = Math.max(padding, Math.floor((totalH - gridH) / 2));
        try { this.updateEditorBackgroundImage(); } catch (e) {}
        this._updateSubCellLabel();
        this.renderGrid();
        try { this.updateScrollbars(); } catch (e) { }
    }

    setSubCellSize(size) {
        this.subCellSize = Math.max(0, Math.floor(Number(size) || 0));
        this._updateSubCellLabel();
        this.renderGrid();
    }

    _updateSubCellLabel() {
        const valEl = el('subCellSizeValue');
        if (!valEl) return;
        const s = this.subCellSize;
        const baseTile = this.baseCellSize || 64;
        if (s > 0 && s < baseTile && Math.floor(baseTile / s) > 1) {
            const N = Math.floor(baseTile / s);
            valEl.textContent = `${s}px \u2192 ${N}\u00d7${N} / tile`;
        } else {
            valEl.textContent = 'off';
        }
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
        installLayerTool(this);
        installObjectTool(this);
        installDecorTool(this);
        this.input.on('pointerdown', (pointer) => {
            if (this.layerToolActive || this.decorToolActive) return;
            const cell = this.getGridCellFromPointer(pointer.worldX, pointer.worldY);
            if (!cell) return;

            // Select mode: click picks the object (topmost token) without painting
            if (this.selectToolActive) {
                const parts = editorCellParts(this.cells[cell.row]?.[cell.col]);
                const same = this.selectedCell && this.selectedCell.row === cell.row && this.selectedCell.col === cell.col;
                this.selectedCell = cell;
                // clicking again on the same cell cycles through its stacked tokens (A/B)
                this.selectedTokenIndex = same && parts.length > 1
                    ? (this.selectedTokenIndex + parts.length - 1) % parts.length
                    : Math.max(0, parts.length - 1);
                this.updateSelectedCellInfo();
                this.renderGrid();
                this.objectTool?.sync();
                return;
            }

            // Zone tool mode: brush (size N) or Shift + drag rectangle; Alt erases
            if (this.zoneToolActive) {
                const unit = this.zoneUnitAt(pointer.worldX, pointer.worldY);
                if (!unit) return;
                const ztype = this.activeZoneType || 'wall';
                const ev = pointer.event || {};
                this._zonePaintMode = (ev.altKey || this.zoneBag(unit.sub, ztype).has(`${unit.x},${unit.y}`)) ? 'erase' : 'paint';
                if (ev.shiftKey) {
                    this._zoneRect = { start: unit, end: unit, type: ztype };
                    this.drawZoneRectPreview();
                } else {
                    this.applyZoneBrush(unit, ztype, this._zonePaintMode);
                }
                this._zoneIsDragging = true;
                this.renderGrid();
                return;
            }

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

        this.input.on('pointermove', (pointer) => {
            if (!this._zoneIsDragging || !this.zoneToolActive) return;
            if (!pointer.isDown) { this._zoneIsDragging = false; return; }
            const unit = this.zoneUnitAt(pointer.worldX, pointer.worldY);
            if (!unit) return;
            if (this._zoneRect) {
                if (unit.sub !== this._zoneRect.start.sub) return;
                this._zoneRect.end = unit;
                this.drawZoneRectPreview();
                return;
            }
            if (this.applyZoneBrush(unit, this.activeZoneType || 'wall', this._zonePaintMode)) this.renderGrid();
        });

        this.input.on('pointerup', () => {
            this._zoneIsDragging = false;
            if (this._zoneRect) {
                const r = this._zoneRect;
                this._zoneRect = null;
                this.drawZoneRectPreview();
                this.applyZoneRect(r.start, r.end, r.type, this._zonePaintMode);
                this.renderGrid();
            }
        });

        this.input.on('wheel', (pointer, _gameObjects, _deltaX, deltaY) => {
            if (this.decorToolActive || this.layerToolActive) return;
            const cell = this.getGridCellFromPointer(pointer.worldX, pointer.worldY);
            if (!cell) return;
            this.selectedCell = cell;
            this.rotateSelectedCell(deltaY > 0 ? 1 : -1);
            this.renderGrid();
        });

        this.input.keyboard.on('keydown-LEFT', () => {
            if (this.layerToolActive || this.selectToolActive || this.decorToolActive) return;
            this.rotateSelectedCell(-1);
            this.renderGrid();
        });

        this.input.keyboard.on('keydown-RIGHT', () => {
            if (this.layerToolActive || this.selectToolActive || this.decorToolActive) return;
            this.rotateSelectedCell(1);
            this.renderGrid();
        });

        // Mirror: 'H' = horizontal flip (flipX), 'V' = vertical flip (flipY)
        this.input.keyboard.on('keydown-H', () => {
            if (this.layerToolActive || this.selectToolActive || this.decorToolActive) return;
            this.mirrorSelectedCell('h');
            this.renderGrid();
        });

        this.input.keyboard.on('keydown-V', () => {
            if (this.layerToolActive || this.selectToolActive || this.decorToolActive) return;
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
            if (this.layerToolActive) return;
            this.toggleWallVariantPicker();
        });

        this.input.keyboard.on('keydown-DELETE', () => {
            if (this.layerToolActive || this.selectToolActive || this.decorToolActive) return;
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
            this.clearSelectedCell();
        });

        this.input.keyboard.on('keydown-BACKSPACE', (event) => {
            if (this.layerToolActive || this.selectToolActive || this.decorToolActive) return;
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
            event?.preventDefault?.();
            this.clearSelectedCell();
        });
    }

    createPalette() {
        // If DOM palette exists, skip drawing the in-canvas palette to avoid duplication.
        if (typeof document !== 'undefined' && document.getElementById('domPalette-tiles')) {
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

            const box = this.add.rectangle(0, 0, 116, 48, 0x28292c, 0.95).setStrokeStyle(1, 0x3a3b3e, 1);
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

    // ---- zone brush: a "unit" is a sub-cell when the sub-grid is on, otherwise a cell ----
    zoneUnitAt(worldX, worldY) {
        const sub = this.getSubCellFromPointer(worldX, worldY);
        if (sub) return { sub: true, x: sub.gsc, y: sub.gsr, N: sub.N };
        const cell = this.getGridCellFromPointer(worldX, worldY);
        return cell ? { sub: false, x: cell.col, y: cell.row, N: 1 } : null;
    }

    zoneBag(sub, type) {
        const store = sub ? this.zoneSubCells : this.zoneCells;
        if (!store.has(type)) store.set(type, new Set());
        return store.get(type);
    }

    /** sets/clears every unit of the rectangle a..b (inclusive); returns true if something changed */
    applyZoneRect(a, b, type, mode) {
        const bag = this.zoneBag(a.sub, type);
        const N = a.sub ? a.N : 1;
        const maxX = this.cols * N - 1, maxY = this.rows * N - 1;
        const x0 = Math.max(0, Math.min(a.x, b.x)), x1 = Math.min(maxX, Math.max(a.x, b.x));
        const y0 = Math.max(0, Math.min(a.y, b.y)), y1 = Math.min(maxY, Math.max(a.y, b.y));
        let changed = false;
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const key = `${x},${y}`;
                if (mode === 'erase') { if (bag.delete(key)) changed = true; }
                else if (!bag.has(key)) { bag.add(key); changed = true; }
            }
        }
        return changed;
    }

    /** square brush of zoneBrush units centred on the pointer */
    applyZoneBrush(unit, type, mode) {
        const n = Math.max(1, Number(this.zoneBrush) || 1);
        const off = Math.floor((n - 1) / 2);
        const a = { ...unit, x: unit.x - off, y: unit.y - off };
        const b = { ...unit, x: unit.x - off + n - 1, y: unit.y - off + n - 1 };
        return this.applyZoneRect(a, b, type, mode);
    }

    drawZoneRectPreview() {
        if (!this._zoneRectGfx) this._zoneRectGfx = this.add.graphics().setDepth(4000);
        const g = this._zoneRectGfx;
        g.clear();
        const r = this._zoneRect;
        if (!r) return;
        const unitPx = this.cellSize / (r.start.sub ? r.start.N : 1);
        const x0 = Math.min(r.start.x, r.end.x), x1 = Math.max(r.start.x, r.end.x);
        const y0 = Math.min(r.start.y, r.end.y), y1 = Math.max(r.start.y, r.end.y);
        const def = ZONE_TYPE_DEFS.find((d) => d.id === r.type) || ZONE_TYPE_DEFS[0];
        const erase = this._zonePaintMode === 'erase';
        g.fillStyle(erase ? 0x000000 : def.color, erase ? 0.35 : 0.3);
        g.lineStyle(2, erase ? 0xffffff : def.stroke, 0.95);
        const X = this.gridOffsetX + x0 * unitPx, Y = this.gridOffsetY + y0 * unitPx;
        const W = (x1 - x0 + 1) * unitPx, H = (y1 - y0 + 1) * unitPx;
        g.fillRect(X, Y, W, H).strokeRect(X, Y, W, H);
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

    // Returns the sub-cell under the pointer when sub-grid is active (N > 1).
    // Result: { gsc, gsr, N } where gsc/gsr are global sub-cell indices.
    // Returns null when sub-grid is off or pointer is outside the grid.
    getSubCellFromPointer(worldX, worldY) {
        const _s = this.subCellSize;
        const _b = this.baseCellSize || 64;
        if (!_s || _s <= 0) return null;
        const N = Math.floor(_b / _s);
        if (N <= 1) return null;
        const localX = worldX - this.gridOffsetX;
        const localY = worldY - this.gridOffsetY;
        if (localX < 0 || localY < 0) return null;
        const subPx = this.cellSize / N;
        const gsc = Math.floor(localX / subPx);
        const gsr = Math.floor(localY / subPx);
        if (gsc < 0 || gsr < 0 || gsc >= this.cols * N || gsr >= this.rows * N) return null;
        return { gsc, gsr, N };
    }

    placeToken(col, row, token, opts = {}) {
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
        const bg = this.add.rectangle(0, 0, bgW, bgH, 0x1f2123, 0.97).setOrigin(0);
        bg.setStrokeStyle(2, 0x3a3b3e, 1);
        picker.add(bg);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const px = padding + c * (iconSize + padding);
                const py = padding + r * (iconSize + padding);
                const token = `w${r}${c}00`;
                const cellBox = this.add.container(px + iconSize / 2, py + iconSize / 2);
                const box = this.add.rectangle(0, 0, iconSize, iconSize, 0x28292c, 0.95).setStrokeStyle(1, 0x3a3b3e, 1);
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
            case 'sand': return { kind: 'tile', texture: 'tiles', frame: 0 };
            case 'water': return { kind: 'tile', texture: 'tiles', frame: 3 };
            case 'mud': return { kind: 'tile', texture: 'tiles', frame: 4 };
            case 'f': return { kind: 'tile', texture: 'tiles', frame: 3 };
            case 'h': return { kind: 'tile', texture: 'tiles', frame: 1 };
            case 's': return { kind: 'tile', texture: 'tiles', frame: 5 };
            case 'g': return { kind: 'obj', frame: OBJECT_FRAMES.gem };
            case 'd': return { kind: 'obj', frame: OBJECT_FRAMES.door };
            case 'k': return { kind: 'obj', frame: OBJECT_FRAMES.key };
            case 'p': return { kind: 'obj', frame: OBJECT_FRAMES.pepita };
            case 'b': return { kind: 'obj', frame: OBJECT_FRAMES.dynamite_chest };
            case 'c': return { kind: 'obj', frame: OBJECT_FRAMES.cart };
            case 'stones': return { kind: 'obj', frame: OBJECT_FRAMES.stones };
            case 'wooden': return { kind: 'obj', frame: OBJECT_FRAMES.wooden };
            case 'l': return { kind: 'obj', frame: OBJECT_FRAMES.heart };
            case 'heart': return { kind: 'obj', frame: OBJECT_FRAMES.heart };
            case 'helmet': return { kind: 'obj', frame: OBJECT_FRAMES.helmet };
            case 'm': return { kind: 'obj', frame: OBJECT_FRAMES.skeleton };
            case 'ghost': return { kind: 'ghost' };
            case 'bat': return { kind: 'bat' };
            case 'spider': return { kind: 'obj', frame: OBJECT_FRAMES.spider };
            case 'snake': return { kind: 'obj', frame: OBJECT_FRAMES.snake };
            case 'block': case 'plat': case 'ladder': case 'spikes': case 'cp':
                return { kind: 'pf', texture: PLATFORM_TOKEN_TEXTURES[normalized] };
            case 'player': return { kind: 'obj', frame: OBJECT_FRAMES.player };
            default: {
                const ent = editorEntityFor(normalized);
                if (ent && ent.textureKey) return { kind: 'entity', entity: ent };
                return { kind: 'text', text: normalized };
            }
        }
    }

    addTokenVisual(container, token, x, y, size) {
        const before = container.list ? container.list.length : 0;
        this.addTokenVisualRaw(container, token, x, y, size);
        // per-object transform of the topmost token (scale / rotation / mirror)
        let top = String(token ?? '-').split('/').map((t) => t.trim()).filter(Boolean).pop() || '-';
        const tf = parseTokenTransform(top);
        if (tf.scale === 1 && !tf.rot && !tf.flipX && !tf.flipY) return;
        (container.list || []).slice(before).forEach((obj) => {
            if (obj.type !== 'Sprite' && obj.type !== 'Image') return;
            obj.setScale(obj.scaleX * tf.scale, obj.scaleY * tf.scale);
            obj.setAngle((obj.angle || 0) + tf.rot);
            if (tf.flipX) obj.setFlipX(!obj.flipX);
            if (tf.flipY) obj.setFlipY(!obj.flipY);
        });
    }

    addTokenVisualRaw(container, token, x, y, size) {
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
            const marker = this.add.rectangle(x, y, size * 0.8, size * 0.8, 0x28292c, 0.25).setStrokeStyle(1, 0x46474b, 0.8);
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
            const obj = this.add.sprite(x, y, 'objects', info.frame);
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

        if (info.kind === 'pf' && this.textures.exists(info.texture)) {
            const spr = this.add.image(x, y, info.texture);
            if (info.texture === 'pf_plat') { spr.setDisplaySize(size, size * 0.32); spr.y = y - size / 2 + size * 0.16; }
            else spr.setDisplaySize(size, size);
            if (invisible) spr.setAlpha(0.35);
            container.add(spr);
            return;
        }

        if (info.kind === 'entity' && this.textures.exists(info.entity.textureKey)) {
            const ent = info.entity;
            const spr = this.add.sprite(x, y, ent.textureKey, Number(ent.icon?.frame) || 0);
            spr.setScale((size / Math.max(spr.width, spr.height, 1)) * 0.9);
            if (ent.tint != null) spr.setTint(ent.tint);
            if (invisible) spr.setAlpha(0.35);
            container.add(spr);
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
        if (this.zoneLayer) this.zoneLayer.removeAll(true);

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
                    .setStrokeStyle(1, 0x5a5b5f, 0.45);
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
        // draw zone overlays (all types, each with its own color)
        if (this.zoneLayer) {
            const _bscNz = Math.floor((this.baseCellSize || 64) / Math.max(1, this.subCellSize || 1));
            const _subActive = _bscNz > 1 && this.subCellSize > 0;
            const _subPxZ = _subActive ? (this.cellSize / _bscNz) : 0;
            ZONE_TYPE_DEFS.forEach((def) => {
                const cells = this.zoneCells.get(def.id);
                if (cells && cells.size > 0) {
                    cells.forEach((key) => {
                        const [zcol, zrow] = key.split(',').map(Number);
                        if (zcol < 0 || zrow < 0 || zcol >= this.cols || zrow >= this.rows) return;
                        const zcx = this.gridOffsetX + zcol * this.cellSize + this.cellSize / 2;
                        const zcy = this.gridOffsetY + zrow * this.cellSize + this.cellSize / 2;
                        const zr = this.add.rectangle(zcx, zcy, this.cellSize, this.cellSize, def.color, def.alpha)
                            .setStrokeStyle(1, def.stroke, 0.9);
                        this.zoneLayer.add(zr);
                    });
                }
                const subs = this.zoneSubCells.get(def.id);
                if (subs && subs.size > 0 && _subActive) {
                    subs.forEach((key) => {
                        const [gsc, gsr] = key.split(',').map(Number);
                        if (gsc < 0 || gsr < 0 || gsc >= this.cols * _bscNz || gsr >= this.rows * _bscNz) return;
                        const bx = this.gridOffsetX + gsc * _subPxZ + _subPxZ / 2;
                        const by = this.gridOffsetY + gsr * _subPxZ + _subPxZ / 2;
                        const zr = this.add.rectangle(bx, by, _subPxZ, _subPxZ, def.color, 0.55)
                            .setStrokeStyle(0.5, def.stroke, 0.9);
                        this.zoneLayer.add(zr);
                    });
                }
            });
        }

        // Sub-cell grid overlay
        const _subSz = this.subCellSize;
        const _baseTile = this.baseCellSize || 64;
        if (_subSz > 0 && _subSz < _baseTile) {
            const _N = Math.floor(_baseTile / _subSz);
            if (_N > 1) {
                const _subPx = this.cellSize / _N;
                const _gW = this.cols * this.cellSize;
                const _gH = this.rows * this.cellSize;
                const _sg = this.add.graphics();
                _sg.lineStyle(0.5, 0x6699bb, 0.25);
                for (let _c = 0; _c < this.cols; _c++) {
                    for (let _si = 1; _si < _N; _si++) {
                        const _lx = this.gridOffsetX + _c * this.cellSize + _si * _subPx;
                        _sg.moveTo(_lx, this.gridOffsetY);
                        _sg.lineTo(_lx, this.gridOffsetY + _gH);
                    }
                }
                for (let _r = 0; _r < this.rows; _r++) {
                    for (let _si = 1; _si < _N; _si++) {
                        const _ly = this.gridOffsetY + _r * this.cellSize + _si * _subPx;
                        _sg.moveTo(this.gridOffsetX, _ly);
                        _sg.lineTo(this.gridOffsetX + _gW, _ly);
                    }
                }
                _sg.strokePath();
                this.gridLayer.add(_sg);
            }
        }

        const border = this.add.rectangle(
            this.gridOffsetX + borderW / 2,
            this.gridOffsetY + borderH / 2,
            borderW,
            borderH,
            0x000000,
            0
        ).setStrokeStyle(2, 0xc9973f, 0.9);
        this.selectionLayer.add(border);

        if (this.selectedCell) {
            const sx = this.gridOffsetX + this.selectedCell.col * this.cellSize + this.cellSize / 2;
            const sy = this.gridOffsetY + this.selectedCell.row * this.cellSize + this.cellSize / 2;
            const s = this.add.rectangle(sx, sy, this.cellSize, this.cellSize, 0xc9973f, 0.16)
                .setStrokeStyle(2, 0xdba84e, 1);
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
        this.decorations = Array.isArray(levelData.decorations) ? levelData.decorations.map((d) => ({ ...d })) : [];
        try { this.decorTool?.select(null); this.decorTool?.redraw(); } catch (e) { }
        const mapObj = levelData.map || {};
        const tiles = Array.isArray(mapObj.tiles) ? mapObj.tiles : [];
        const rows = clamp(Number(mapObj.rows) || tiles.length || 12, 4, 120);
        const cols = clamp(Number(mapObj.cols) || tiles[0]?.length || 12, 4, 120);
        // Restore multi-type zones
        this.zoneCells = new Map(ZONE_TYPE_DEFS.map(d => [d.id, new Set()]));
        this.zoneSubCells = new Map(ZONE_TYPE_DEFS.map(d => [d.id, new Set()]));
        const rawZonesMap = mapObj.zones ?? levelData.zones ?? {};
        ZONE_TYPE_DEFS.forEach((def) => {
            const arr = rawZonesMap[def.id];
            if (Array.isArray(arr)) {
                arr.forEach((z) => {
                    if (Array.isArray(z) && z.length >= 2 && Number.isFinite(z[0]) && Number.isFinite(z[1])) {
                        this.zoneCells.get(def.id).add(`${Math.round(z[0])},${Math.round(z[1])}`);
                    }
                });
            }
        });
        // Backward compat: old blockedZones → wall
        const rawLegacyZones = mapObj.blockedZones ?? levelData.blockedZones;
        if (Array.isArray(rawLegacyZones)) {
            rawLegacyZones.forEach((z) => {
                if (Array.isArray(z) && z.length >= 2 && Number.isFinite(z[0]) && Number.isFinite(z[1])) {
                    this.zoneCells.get('wall').add(`${Math.round(z[0])},${Math.round(z[1])}`);
                }
            });
        }
        // Sub-cell variants
        const rawZoneSubsMap = mapObj.zoneSubs ?? levelData.zoneSubs ?? {};
        ZONE_TYPE_DEFS.forEach((def) => {
            const arr = rawZoneSubsMap[def.id];
            if (Array.isArray(arr)) {
                arr.forEach((z) => {
                    if (Array.isArray(z) && z.length >= 2 && Number.isFinite(z[0]) && Number.isFinite(z[1])) {
                        this.zoneSubCells.get(def.id).add(`${Math.round(z[0])},${Math.round(z[1])}`);
                    }
                });
            }
        });
        // Backward compat: old blockedSubCells → wall
        const rawLegacySubs = mapObj.blockedSubCells ?? levelData.blockedSubCells;
        if (Array.isArray(rawLegacySubs)) {
            rawLegacySubs.forEach((z) => {
                if (Array.isArray(z) && z.length >= 2 && Number.isFinite(z[0]) && Number.isFinite(z[1])) {
                    this.zoneSubCells.get('wall').add(`${Math.round(z[0])},${Math.round(z[1])}`);
                }
            });
        }
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
    backgroundColor: '#17181a',
    scale: {
        mode: Phaser.Scale.RESIZE
    },
    scene: [LevelEditorScene]
};

// boot after the data entities are known (their icons are loaded in preload)
Promise.all([editorEntitiesReady, gameManifestReady]).then(() => new Phaser.Game(phaserConfig));

function getScene() {
    return window.__levelEditorScene || null;
}

// Used by js/editor-layout.js (topbar status, menus, shortcuts)
// "▶ Prova livello": the game reads this level from localStorage (index.html?testLevel=1)
function playTestLevel() {
    let level;
    try { level = readLevelFromForm(); } catch (e) { setStatus(`Livello non valido: ${e.message}`, true); return; }
    try {
        localStorage.setItem(storageKey('TestLevel'), JSON.stringify(level));
    } catch (e) { setStatus(`Impossibile preparare la prova: ${e.message}`, true); return; }
    const win = window.open('index.html?testLevel=1', storageKey('Test'));
    if (!win) { setStatus('Il browser ha bloccato la nuova scheda: consenti i popup per provare il livello.', true); return; }
    try { win.focus(); } catch (e) { }
    setStatus('Livello aperto nel gioco (scheda "Prova livello"). Modifica e premi di nuovo ▶ per riprovarlo.');
}

window.LevelEditorAPI = {
    getScene, readLevelFromForm, importLevelFromText, setStatus, playTestLevel,
    gameTileSize: () => GAME_TILE_SIZE,
    setLayerTool: (on) => getScene()?.layerTool?.setActive(on),
    setSelectTool: (on) => getScene()?.objectTool?.setActive(on),
    setDecorTool: (on) => getScene()?.decorTool?.setActive(on),
    toggleSnap: () => setSnap(!EDITOR_SNAP.on),
    objectAction: (act) => getScene()?.objectTool?.run(act),
    refreshLayerPalette: () => buildLayerPalette()
};

// Once the real game tile size is known, redraw bg/fg previews so they match the game.
gameConfigReady.then(() => {
    const scene = getScene();
    if (!scene) return;
    try { scene.updateEditorBackgroundImage(true); } catch (e) { /* ignore */ }
    try { drawMiniMapPreview(scene); } catch (e) { /* ignore */ }
});

function setStatus(message, isError = false) {
    const target = el('statusText');
    if (!target) return;
    target.style.color = isError ? '#e5604d' : '#59b97c';
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

    if (opts.tint) {
        // multiply the frame by the tint colour, keeping its alpha (like Phaser setTint)
        const off = document.createElement('canvas');
        off.width = frame.cutWidth; off.height = frame.cutHeight;
        const o = off.getContext('2d');
        o.drawImage(sourceImage, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, off.width, off.height);
        o.globalCompositeOperation = 'multiply';
        o.fillStyle = opts.tint;
        o.fillRect(0, 0, off.width, off.height);
        o.globalCompositeOperation = 'destination-in';
        o.drawImage(sourceImage, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, off.width, off.height);
        ctx.drawImage(off, -size / 2, -size / 2, size, size);
    } else {
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
    }

    ctx.restore();
    return true;
}

function drawMiniMapToken(scene, ctx, token, x, y, size, opts = {}) {
    const baseToken = getRenderableTokenBase(token);
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
        case 'stones':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.stones, x, y, size, { alpha: opts.alpha });
        case 'm':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.skeleton, x, y, size, { alpha: opts.alpha });
        case 'helmet':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.helmet, x, y, size, { alpha: opts.alpha });
        case 'ghost':
            return drawMiniMapFrame(scene, ctx, 'ghost_anim', 0, x, y, size, { alpha: opts.alpha });
        case 'bat':
            return drawMiniMapFrame(scene, ctx, 'bat_anim', 0, x, y, size, { alpha: opts.alpha });
        case 'spider':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.spider, x, y, size, { alpha: opts.alpha });
        case 'snake':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.snake, x, y, size, { alpha: opts.alpha });
        case 'block': case 'plat': case 'ladder': case 'spikes': case 'cp':
            return drawMiniMapFrame(scene, ctx, PLATFORM_TOKEN_TEXTURES[normalized], undefined, x, y, size, { alpha: opts.alpha });
        case 'player':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.player, x, y, size, { alpha: opts.alpha });
        default: {
            const ent = editorEntityFor(normalized);
            if (ent && ent.textureKey) {
                return drawMiniMapFrame(scene, ctx, ent.textureKey, Number(ent.icon?.frame) || 0, x, y, size, { alpha: opts.alpha, tint: ent.tintCss });
            }
            return false;
        }
    }
}

function updateGemsInMapCount(scene) {
    const span = el('gemsInMapCount');
    if (!span) return;
    const count = scene ? countTokenInScene(scene, 'g') : 0;
    span.textContent = `/ ${count}`;
}

function drawMiniMapPreview(scene) {
    if (!scene) return;
    updateGemsInMapCount(scene);
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
                bgLayers = [{ src: `${COMMON_ASSETS_DIR}/level${bgVal}.png`, parallaxBgFactor: 1.0, parallaxBgAlpha: 1.0 }];
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
        const lay = computeGameLayerLayout(layer, cols, rows, img.naturalWidth, img.naturalHeight);
        const scale = cell / GAME_TILE_SIZE;
        try {
            ctx.save();
            // clip to map rectangle so image stays inside blue mini-map
            ctx.beginPath();
            ctx.rect(offX, offY, mapW, mapH);
            ctx.clip();
            ctx.globalAlpha = alpha;
            for (let iy = 0; iy < lay.countY; iy++) {
                for (let ix = 0; ix < lay.countX; ix++) {
                    const dx = offX + (lay.offsetX + lay.stepX * ix) * scale;
                    const dy = offY + (lay.offsetY + lay.stepY * iy) * scale;
                    drawLayerInstance(ctx, img, dx, dy, lay.layerW * scale, lay.layerH * scale, layerTransformFromJson(layer));
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

    // draw zone overlays on minimap (all types)
    if (scene && scene.zoneCells) {
        const _mmNz = Math.floor((scene.baseCellSize || 64) / Math.max(1, scene.subCellSize || 1));
        const _mmSubActive = _mmNz > 1 && scene.subCellSize > 0;
        const _mmSubCell = _mmSubActive ? (cell / _mmNz) : 0;
        ctx.save();
        ctx.beginPath();
        ctx.rect(offX, offY, mapW, mapH);
        ctx.clip();
        ZONE_TYPE_DEFS.forEach((def) => {
            const hexFill = def.hex + '66'; // ~40% opacity
            const hexStroke = def.hex + 'bb';
            const cells = scene.zoneCells.get(def.id);
            if (cells && cells.size > 0) {
                ctx.fillStyle = hexFill;
                ctx.strokeStyle = hexStroke;
                ctx.lineWidth = 0.5;
                cells.forEach((key) => {
                    const [zcol, zrow] = key.split(',').map(Number);
                    if (zcol >= 0 && zrow >= 0 && zcol < cols && zrow < rows) {
                        ctx.fillRect(offX + zcol * cell, offY + zrow * cell, cell, cell);
                        ctx.strokeRect(offX + zcol * cell, offY + zrow * cell, cell, cell);
                    }
                });
            }
            if (_mmSubActive) {
                const subs = scene.zoneSubCells.get(def.id);
                if (subs && subs.size > 0) {
                    ctx.fillStyle = hexFill;
                    ctx.strokeStyle = hexStroke;
                    ctx.lineWidth = 0.3;
                    subs.forEach((key) => {
                        const [gsc, gsr] = key.split(',').map(Number);
                        ctx.fillRect(offX + gsc * _mmSubCell, offY + gsr * _mmSubCell, _mmSubCell, _mmSubCell);
                        ctx.strokeRect(offX + gsc * _mmSubCell, offY + gsr * _mmSubCell, _mmSubCell, _mmSubCell);
                    });
                }
            }
        });
        ctx.restore();
    }


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
            const lay = computeGameLayerLayout(ly, cols, rows, entry.img.naturalWidth, entry.img.naturalHeight);
            const scale = cell / GAME_TILE_SIZE;
            try {
                ctx.save();
                // clip to map rectangle so fg stays inside mini-map
                ctx.beginPath();
                ctx.rect(offX, offY, mapW, mapH);
                ctx.clip();
                ctx.globalAlpha = Number.isFinite(ly.parallaxFgAlpha) ? ly.parallaxFgAlpha : 1.0;
                for (let iy = 0; iy < lay.countY; iy++) {
                    for (let ix = 0; ix < lay.countX; ix++) {
                        const dx = offX + (lay.offsetX + lay.stepX * ix) * scale;
                        const dy = offY + (lay.offsetY + lay.stepY * iy) * scale;
                        drawLayerInstance(ctx, entry.img, dx, dy, lay.layerW * scale, lay.layerH * scale, layerTransformFromJson(ly));
                    }
                }
                ctx.restore();
            } catch (e) { /* ignore */ }
        });
    }
}

function readLevelFromForm() {
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

    // Collect multi-type zone data from scene
    const _zonesObj = (() => {
        try {
            if (!scene || !scene.zoneCells) return {};
            const obj = {};
            ZONE_TYPE_DEFS.forEach((def) => {
                const bag = scene.zoneCells.get(def.id);
                if (bag && bag.size > 0) {
                    obj[def.id] = Array.from(bag).map((k) => { const [c, r] = k.split(',').map(Number); return [c, r]; });
                }
            });
            return obj;
        } catch (e) { return {}; }
    })();
    const _zoneSubsObj = (() => {
        try {
            if (!scene || !scene.zoneSubCells) return {};
            const obj = {};
            ZONE_TYPE_DEFS.forEach((def) => {
                const bag = scene.zoneSubCells.get(def.id);
                if (bag && bag.size > 0) {
                    obj[def.id] = Array.from(bag).map((k) => { const [c, r] = k.split(',').map(Number); return [c, r]; });
                }
            });
            return obj;
        } catch (e) { return {}; }
    })();
    const subCellN = (() => {
        try {
            if (scene && scene.subCellSize > 0) {
                const N = Math.floor((scene.baseCellSize || 64) / scene.subCellSize);
                return N > 1 ? N : undefined;
            }
        } catch (e) {}
        return undefined;
    })();
    const _hasZones = Object.keys(_zonesObj).length > 0;
    const _hasZoneSubs = Object.keys(_zoneSubsObj).length > 0;
    // Backward compat: also emit blockedZones (wall) so old game versions still work
    const _legacyBlockedZones = _zonesObj.wall && _zonesObj.wall.length > 0 ? _zonesObj.wall : undefined;
    const _legacyBlockedSubCells = _zoneSubsObj.wall && _zoneSubsObj.wall.length > 0 ? _zoneSubsObj.wall : undefined;

    const level = {
        id: String(el('levelId')?.value ?? '1.0').trim() || '1.0',
        map: {
            cols,
            rows,
            timer: parseNumber(el('mapTimer')?.value, 120),
            tiles: scene ? scene.toTilesMatrix() : [],
            ...(_hasZones ? { zones: _zonesObj } : {}),
            ...(_hasZoneSubs ? { zoneSubs: _zoneSubsObj, subCellN } : {}),
            ...(_legacyBlockedZones ? { blockedZones: _legacyBlockedZones } : {}),
            ...(_legacyBlockedSubCells ? { blockedSubCells: _legacyBlockedSubCells } : {})
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
        ghost: parseNumber(el('ghostCount')?.value, 0),
        bat: parseNumber(el('batCount')?.value, 0),
        spider: parseNumber(el('spiderCount')?.value, 0),
        snake: parseNumber(el('snakeCount')?.value, 0),
        ghostSpeed: parseNumber(el('ghostSpeed')?.value, 80),
        batSpeed: parseNumber(el('batSpeed')?.value, 90),
        spiderSpeed: parseNumber(el('spiderSpeed')?.value, 100),
        snakeSpeed: parseNumber(el('snakeSpeed')?.value, 95),
        batFlightsBeforeRest: parseNumber(el('batFlightsBeforeRest')?.value, 4),
        batRestSeconds: parseNumber(el('batRestSeconds')?.value, 2),
        batRestIntervalSeconds: parseNumber(el('batRestIntervalSeconds')?.value, 0),
        jumpEnabled: el('jumpEnabled') ? !!el('jumpEnabled').checked : true,
        requiredGems: parseNumber(el('requiredGems')?.value, 0)
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

    // free decorations (mode "Decorazioni"): frames of the spritesheets, game pixels from the map corner
    if (scene && Array.isArray(scene.decorations) && scene.decorations.length) {
        level.decorations = scene.decorations.map((d) => {
            const r2 = (v) => Math.round(Number(v) * 100) / 100;
            const out = { texture: d.texture, frame: d.frame, x: r2(d.x), y: r2(d.y), w: r2(d.w), h: r2(d.h) };
            if (d.rotation) out.rotation = r2(d.rotation);
            if (d.flipX) out.flipX = true;
            if (d.flipY) out.flipY = true;
            if (d.alpha != null && Number(d.alpha) !== 1) out.alpha = r2(d.alpha);
            if (d.front) out.front = true;
            return out;
        });
    }

    const result = { ...level, ...extra, map: level.map, playerStart: level.playerStart };
    // the editor's decorations win over the ones kept from the imported file (extra)
    if (level.decorations) result.decorations = level.decorations; else delete result.decorations;
    return result;
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
    el('ghostCount').value = data.ghost ?? DEFAULT_LEVEL.ghost;
    el('batCount').value = data.bat ?? DEFAULT_LEVEL.bat;
    el('spiderCount').value = data.spider ?? DEFAULT_LEVEL.spider;
    el('snakeCount').value = data.snake ?? DEFAULT_LEVEL.snake;
    el('ghostSpeed').value = data.ghostSpeed ?? DEFAULT_LEVEL.ghostSpeed;
    el('batSpeed').value = data.batSpeed ?? DEFAULT_LEVEL.batSpeed;
    el('spiderSpeed').value = data.spiderSpeed ?? DEFAULT_LEVEL.spiderSpeed;
    el('snakeSpeed').value = data.snakeSpeed ?? DEFAULT_LEVEL.snakeSpeed;
    el('batFlightsBeforeRest').value = data.batFlightsBeforeRest ?? DEFAULT_LEVEL.batFlightsBeforeRest;
    el('batRestSeconds').value = data.batRestSeconds ?? DEFAULT_LEVEL.batRestSeconds;
    el('batRestIntervalSeconds').value = data.batRestIntervalSeconds ?? DEFAULT_LEVEL.batRestIntervalSeconds;
    try { if (el('ghostSpeedRange')) el('ghostSpeedRange').value = el('ghostSpeed').value; } catch (e) {}
    try { if (el('batSpeedRange')) el('batSpeedRange').value = el('batSpeed').value; } catch (e) {}
    try { if (el('spiderSpeedRange')) el('spiderSpeedRange').value = el('spiderSpeed').value; } catch (e) {}
    try { if (el('snakeSpeedRange')) el('snakeSpeedRange').value = el('snakeSpeed').value; } catch (e) {}
    try { if (el('jumpEnabled')) el('jumpEnabled').checked = (data.jumpEnabled !== undefined ? !!data.jumpEnabled : (mapData.jumpEnabled !== undefined ? !!mapData.jumpEnabled : true)); } catch (e) {}
    try { if (el('requiredGems')) el('requiredGems').value = data.requiredGems ?? data.gemsRequired ?? mapData.requiredGems ?? 0; } catch (e) {}
    el('objectiveLabel').value = data.objectiveLabel ?? DEFAULT_LEVEL.objectiveLabel;
    el('lightMode').value = resolvedLight;
    el('escapeRoute').value = String(!!data.escapeRoute);
    // legacy background/foreground selects are optional; layers DOM is authoritative

    el('playerRow').value = data.playerStart?.row ?? DEFAULT_LEVEL.playerStart.row;
    el('playerCol').value = data.playerStart?.col ?? DEFAULT_LEVEL.playerStart.col;

    // background/foreground toggles
    if (el('showBackground')) el('showBackground').checked = data.backgroundEnabled !== undefined ? !!data.backgroundEnabled : true;
    if (el('showForeground')) el('showForeground').checked = data.foregroundEnabled !== undefined ? !!data.foregroundEnabled : true;
    // Do NOT force autoGridFromBg=true: loading a JSON with explicit cols/rows must not be
    // overridden by the background-image auto-size logic (which fires inside updateEditorBackgroundImage).
    if (el('autoGridFromBg')) el('autoGridFromBg').checked = false;
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
        'spider', 'spiderSpeed', 'snake', 'snakeSpeed', 'batFlightsBeforeRest', 'batRestSeconds', 'batRestIntervalSeconds',
        'background', 'foreground', 'backgroundEnabled', 'foregroundEnabled', 'rain', 'fog', 'music',
        'gemsOneByOne', 'requiredGems', 'gemsRequired', 'playerStart2', 'timer', 'jumpEnabled',
        'blockedZones'
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
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking synchronously can cancel the download in Chrome: give it time to start
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function importLevelFromText(text, filename) {
    try {
        const parsed = JSON.parse(text);
        applyLevelToForm(parsed);
        const scene = getScene();
        scene?.loadFromJson(parsed);
        // skipAutoGrid=true: the JSON has explicit cols/rows that must not be overridden by bg dimensions
        scene?.updateEditorBackgroundImage?.(true);
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
        const rawW = it.querySelector('.bg-width')?.value;
        const rawH = it.querySelector('.bg-height')?.value;
        const layerWidth = (rawW !== undefined && rawW !== '') ? Math.max(0, parseNumber(rawW, 0)) : 0;
        const layerHeight = (rawH !== undefined && rawH !== '') ? Math.max(0, parseNumber(rawH, 0)) : 0;
        const repeatX = parseRepeatValue(it.querySelector('.bg-repeat-x')?.value, 1);
        const repeatY = parseRepeatValue(it.querySelector('.bg-repeat-y')?.value, 1);
        const stepX = parseNumber(it.querySelector('.bg-step-x')?.value, 0);
        const stepY = parseNumber(it.querySelector('.bg-step-y')?.value, 0);
        const layerObj = {
            src,
            enabled,
            parallaxBgFactor: factor,
            parallaxBgAlpha: alpha,
            offsetX,
            offsetY,
            left: offsetX,
            top: offsetY,
            width: layerWidth,
            height: layerHeight,
            repeatX,
            repeatY,
            repeatStepX: stepX,
            repeatStepY: stepY,
            ...readLayerTransform(it, it.classList.contains('fg-layer') ? 'fg' : 'bg')
        };
        Object.defineProperty(layerObj, '__row', { value: it, enumerable: false });
        layers.push(layerObj);
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
        const rawW = it.querySelector('.fg-width')?.value;
        const rawH = it.querySelector('.fg-height')?.value;
        const layerWidth = (rawW !== undefined && rawW !== '') ? Math.max(0, parseNumber(rawW, 0)) : 0;
        const layerHeight = (rawH !== undefined && rawH !== '') ? Math.max(0, parseNumber(rawH, 0)) : 0;
        const repeatX = parseRepeatValue(it.querySelector('.fg-repeat-x')?.value, 1);
        const repeatY = parseRepeatValue(it.querySelector('.fg-repeat-y')?.value, 1);
        const stepX = parseNumber(it.querySelector('.fg-step-x')?.value, 0);
        const stepY = parseNumber(it.querySelector('.fg-step-y')?.value, 0);
        const layerObj = {
            src,
            enabled,
            parallaxFgFactor: factor,
            parallaxFgAlpha: alpha,
            offsetX,
            offsetY,
            left: offsetX,
            top: offsetY,
            width: layerWidth,
            height: layerHeight,
            repeatX,
            repeatY,
            repeatStepX: stepX,
            repeatStepY: stepY,
            ...readLayerTransform(it, it.classList.contains('fg-layer') ? 'fg' : 'bg')
        };
        Object.defineProperty(layerObj, '__row', { value: it, enumerable: false });
        layers.push(layerObj);
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
        const width = layer?.width ?? layer?.w ?? layer?.displayWidth ?? layer?.layerWidth ?? undefined;
        const height = layer?.height ?? layer?.h ?? layer?.displayHeight ?? layer?.layerHeight ?? undefined;
        const repeatX = layer?.repeatX ?? layer?.replicaX ?? layer?.repeatCountX ?? layer?.replicaCountX ?? 1;
        const repeatY = layer?.repeatY ?? layer?.replicaY ?? layer?.repeatCountY ?? layer?.replicaCountY ?? 1;
        const stepX = layer?.repeatStepX ?? layer?.replicaStepX ?? layer?.repeatOffsetX ?? layer?.replicaOffsetX ?? 0;
        const stepY = layer?.repeatStepY ?? layer?.replicaStepY ?? layer?.repeatOffsetY ?? layer?.replicaOffsetY ?? 0;
        const elRow = createBgLayerElement({ src, enabled, factor, alpha, offsetX, offsetY, width, height, repeatX, repeatY, stepX, stepY, idx, ...layerTransformFromJson(layer) });
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
        const width = layer?.width ?? layer?.w ?? layer?.displayWidth ?? layer?.layerWidth ?? undefined;
        const height = layer?.height ?? layer?.h ?? layer?.displayHeight ?? layer?.layerHeight ?? undefined;
        const repeatX = layer?.repeatX ?? layer?.replicaX ?? layer?.repeatCountX ?? layer?.replicaCountX ?? 1;
        const repeatY = layer?.repeatY ?? layer?.replicaY ?? layer?.repeatCountY ?? layer?.replicaCountY ?? 1;
        const stepX = layer?.repeatStepX ?? layer?.replicaStepX ?? layer?.repeatOffsetX ?? layer?.replicaOffsetX ?? 0;
        const stepY = layer?.repeatStepY ?? layer?.replicaStepY ?? layer?.repeatOffsetY ?? layer?.replicaOffsetY ?? 0;
        container.appendChild(createFgLayerElement({ src, enabled, factor, alpha, offsetX, offsetY, width, height, repeatX, repeatY, stepX, stepY, idx, ...layerTransformFromJson(layer) }));
    });
}

// Rotation (degrees, around the image centre) and mirroring of a bg/fg layer.
// Stored in the level JSON as rotation / flipX / flipY; GameScene applies the same transform.
function readLayerTransform(row, prefix) {
    const out = {};
    const rot = parseNumber(row.querySelector(`.${prefix}-rotation`)?.value, 0);
    if (rot) out.rotation = ((rot % 360) + 360) % 360;
    if (row.querySelector(`.${prefix}-flip-x`)?.checked) out.flipX = true;
    if (row.querySelector(`.${prefix}-flip-y`)?.checked) out.flipY = true;
    return out;
}

function layerTransformFromJson(layer) {
    return {
        rotation: parseNumber(layer?.rotation ?? layer?.angle, 0),
        flipX: layer?.flipX === true,
        flipY: layer?.flipY === true
    };
}

function appendLayerTransformRow(wrapper, prefix, cfg = {}) {
    const row = document.createElement('div');
    row.className = 'layer-transform-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr auto auto';
    row.style.gap = '6px';
    row.style.alignItems = 'center';

    const rot = document.createElement('input');
    rot.type = 'number'; rot.step = '1'; rot.className = `${prefix}-rotation`;
    rot.value = String(parseNumber(cfg.rotation, 0)); rot.title = 'Rotazione in gradi (attorno al centro)'; rot.placeholder = 'rotazione°';
    const mk = (cls, label, checked, title) => {
        const lab = document.createElement('label');
        lab.style.display = 'flex'; lab.style.alignItems = 'center'; lab.style.gap = '4px'; lab.style.margin = '0'; lab.title = title;
        const c = document.createElement('input'); c.type = 'checkbox'; c.className = cls; c.checked = !!checked;
        lab.appendChild(c); lab.appendChild(document.createTextNode(label));
        return lab;
    };
    row.appendChild(rot);
    row.appendChild(mk(`${prefix}-flip-x`, '↔', cfg.flipX, 'Specchia orizzontalmente'));
    row.appendChild(mk(`${prefix}-flip-y`, '↕', cfg.flipY, 'Specchia verticalmente'));
    const refresh = () => { try { refreshLayerPreviews(); } catch (e) { } };
    rot.addEventListener('change', refresh);
    row.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', refresh));
    wrapper.appendChild(row);
}

// Draws one layer instance on a 2D canvas: (x, y, w, h) is the unrotated box, like GameScene.
function drawLayerInstance(ctx, img, x, y, w, h, tf = {}) {
    const rot = parseNumber(tf.rotation, 0);
    if (!rot && !tf.flipX && !tf.flipY) { ctx.drawImage(img, x, y, w, h); return; }
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (rot) ctx.rotate(rot * Math.PI / 180);
    ctx.scale(tf.flipX ? -1 : 1, tf.flipY ? -1 : 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
}

function createBgLayerElement(cfg = {}) {
    const src = cfg.src || '';
    const factor = cfg.factor ?? 1.0;
    const alpha = cfg.alpha ?? 1.0;
    const enabled = cfg.enabled !== false;
    const offsetX = cfg.offsetX ?? 0;
    const offsetY = cfg.offsetY ?? 0;
    const layerWidth = cfg.width ?? cfg.layerWidth ?? '';
    const layerHeight = cfg.height ?? cfg.layerHeight ?? '';
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

    const ox = document.createElement('input'); ox.className = 'bg-offset-x'; ox.type = 'number'; ox.step = '1'; ox.value = String(offsetX); ox.title = 'offsetX (left)'; ox.placeholder = 'left/offX';
    const oy = document.createElement('input'); oy.className = 'bg-offset-y'; oy.type = 'number'; oy.step = '1'; oy.value = String(offsetY); oy.title = 'offsetY (top)'; oy.placeholder = 'top/offY';

    const rowSize = document.createElement('div');
    rowSize.style.display = 'grid';
    rowSize.style.gridTemplateColumns = 'repeat(4, 1fr)';
    rowSize.style.gap = '6px';
    const bw = document.createElement('input'); bw.className = 'bg-width'; bw.type = 'number'; bw.step = '1'; bw.min = '0'; bw.value = layerWidth !== '' ? String(layerWidth) : ''; bw.title = 'width (0=auto)'; bw.placeholder = 'width';
    const bh = document.createElement('input'); bh.className = 'bg-height'; bh.type = 'number'; bh.step = '1'; bh.min = '0'; bh.value = layerHeight !== '' ? String(layerHeight) : ''; bh.title = 'height (0=auto)'; bh.placeholder = 'height';
    const lblWH = document.createElement('div'); lblWH.style.gridColumn = 'span 2'; lblWH.style.fontSize = '8px'; lblWH.style.color = '#9fb8df'; lblWH.style.alignSelf = 'center'; lblWH.textContent = 'width / height (px, 0=auto)';
    // Proportional auto-fill: set only one dimension, the other is auto-computed from the image aspect ratio
    const _getBgSrc = () => {
        if (inp instanceof HTMLSelectElement) { const v = String(inp.value || '').trim(); return v ? `${BG_ASSETS_DIR}/${v}` : ''; }
        return normalizeLayerSrc(inp.value, 'bg');
    };
    const _syncBgProp = (changedW) => {
        const w = parseNumber(bw.value, 0); const h = parseNumber(bh.value, 0);
        if (changedW ? !(w > 0 && h === 0) : !(h > 0 && w === 0)) return;
        const s = _getBgSrc(); if (!s) return;
        loadImageElement(s).then((im) => {
            if (!(im.naturalWidth > 0 && im.naturalHeight > 0)) return;
            if (changedW) bh.value = String(Math.round(w * im.naturalHeight / im.naturalWidth));
            else bw.value = String(Math.round(h * im.naturalWidth / im.naturalHeight));
        }).catch(() => {});
    };
    bw.addEventListener('change', () => _syncBgProp(true));
    bh.addEventListener('change', () => _syncBgProp(false));

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

    rowSize.appendChild(bw);
    rowSize.appendChild(bh);
    rowSize.appendChild(lblWH);

    rowBottom.appendChild(rx);
    rowBottom.appendChild(ry);
    rowBottom.appendChild(sx);
    rowBottom.appendChild(sy);

    wrapper.appendChild(rowTop);
    wrapper.appendChild(rowMid);
    wrapper.appendChild(rowSize);
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

    appendLayerTransformRow(wrapper, wrapper.className === 'fg-layer' ? 'fg' : 'bg', cfg);
    return wrapper;
}

function createFgLayerElement(cfg = {}) {
    const src = cfg.src || '';
    const factor = cfg.factor ?? 1.0;
    const alpha = cfg.alpha ?? 1.0;
    const enabled = cfg.enabled !== false;
    const offsetX = cfg.offsetX ?? 0;
    const offsetY = cfg.offsetY ?? 0;
    const layerWidth = cfg.width ?? cfg.layerWidth ?? '';
    const layerHeight = cfg.height ?? cfg.layerHeight ?? '';
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

    const ox = document.createElement('input'); ox.className = 'fg-offset-x'; ox.type = 'number'; ox.step = '1'; ox.value = String(offsetX); ox.title = 'offsetX (left)'; ox.placeholder = 'left/offX';
    const oy = document.createElement('input'); oy.className = 'fg-offset-y'; oy.type = 'number'; oy.step = '1'; oy.value = String(offsetY); oy.title = 'offsetY (top)'; oy.placeholder = 'top/offY';

    const rowSize = document.createElement('div');
    rowSize.style.display = 'grid';
    rowSize.style.gridTemplateColumns = 'repeat(4, 1fr)';
    rowSize.style.gap = '6px';
    const fw = document.createElement('input'); fw.className = 'fg-width'; fw.type = 'number'; fw.step = '1'; fw.min = '0'; fw.value = layerWidth !== '' ? String(layerWidth) : ''; fw.title = 'width (0=auto)'; fw.placeholder = 'width';
    const fh = document.createElement('input'); fh.className = 'fg-height'; fh.type = 'number'; fh.step = '1'; fh.min = '0'; fh.value = layerHeight !== '' ? String(layerHeight) : ''; fh.title = 'height (0=auto)'; fh.placeholder = 'height';
    const flblWH = document.createElement('div'); flblWH.style.gridColumn = 'span 2'; flblWH.style.fontSize = '8px'; flblWH.style.color = '#9fb8df'; flblWH.style.alignSelf = 'center'; flblWH.textContent = 'width / height (px, 0=auto)';
    // Proportional auto-fill: set only one dimension, the other is auto-computed from the image aspect ratio
    const _getFgSrc = () => {
        if (inp instanceof HTMLSelectElement) { const v = String(inp.value || '').trim(); return v ? `${FG_ASSETS_DIR}/${v}` : ''; }
        return normalizeLayerSrc(inp.value, 'fg');
    };
    const _syncFgProp = (changedW) => {
        const w = parseNumber(fw.value, 0); const h = parseNumber(fh.value, 0);
        if (changedW ? !(w > 0 && h === 0) : !(h > 0 && w === 0)) return;
        const s = _getFgSrc(); if (!s) return;
        loadImageElement(s).then((im) => {
            if (!(im.naturalWidth > 0 && im.naturalHeight > 0)) return;
            if (changedW) fh.value = String(Math.round(w * im.naturalHeight / im.naturalWidth));
            else fw.value = String(Math.round(h * im.naturalWidth / im.naturalHeight));
        }).catch(() => {});
    };
    fw.addEventListener('change', () => _syncFgProp(true));
    fh.addEventListener('change', () => _syncFgProp(false));

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

    rowSize.appendChild(fw);
    rowSize.appendChild(fh);
    rowSize.appendChild(flblWH);

    rowBottom.appendChild(rx);
    rowBottom.appendChild(ry);
    rowBottom.appendChild(sx);
    rowBottom.appendChild(sy);

    wrapper.appendChild(rowTop);
    wrapper.appendChild(rowMid);
    wrapper.appendChild(rowSize);
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

    appendLayerTransformRow(wrapper, wrapper.className === 'fg-layer' ? 'fg' : 'bg', cfg);
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
    header.textContent = 'BG: [enabled][active][image] | [factor,alpha,left/offX,top/offY] | [width,height] | [repX,repY,stepX,stepY]';
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
    header.textContent = 'FG: [enabled][image] | [factor,alpha,left/offX,top/offY] | [width,height] | [repX,repY,stepX,stepY]';
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

function setAssetsStatus(message, isError = false) {
    const target = el('assetsStatusText');
    if (!target) return;
    target.style.color = isError ? '#e5604d' : '#59b97c';
    target.textContent = message;
}

function setDictionaryStatus(message, isError = false) {
    const target = el('dictionaryStatusText');
    if (!target) return;
    target.style.color = isError ? '#e5604d' : '#59b97c';
    target.textContent = message;
}

function setMappingsStatus(message, isError = false) {
    const target = el('mappingsStatusText');
    if (!target) return;
    target.style.color = isError ? '#e5604d' : '#59b97c';
    target.textContent = message;
}

function getDefaultMappingDocument(type) {
    if (type === 'effects') {
        return {
            meta: {
                name: 'Block Hunter Effects Mapping',
                version: '1.0.0'
            },
            effectProfiles: {}
        };
    }
    if (type === 'tiles') {
        return {
            meta: {
                name: 'Block Hunter Tiles Mapping',
                version: '1.0.0'
            },
            tileSets: {},
            tiles: {}
        };
    }
    return {
        meta: {
            name: 'Block Hunter Entity Mapping',
            version: '1.0.0'
        },
        includes: {
            effects: 'data/game-effects-mapping.json',
            tiles: 'data/game-tiles-mapping.json'
        },
        entities: {}
    };
}

function getMappingItemRootKey(type) {
    if (type === 'effects') return 'effectProfiles';
    if (type === 'tiles') return 'tiles';
    return 'entities';
}

function getMappingCollection(type) {
    const doc = MAPPINGS_EDITOR_STATE.loadedDocuments[type];
    const rootKey = getMappingItemRootKey(type);
    if (!doc || !isPlainObject(doc[rootKey])) return {};
    return doc[rootKey];
}

function buildDefaultMappingItem(type, name) {
    if (type === 'effects') {
        return {
            description: `Nuovo profilo effetto ${name}`
        };
    }

    return {
        category: type === 'tiles' ? 'tile' : 'entity',
        tokens: [name],
        scoring: {},
        effects: {},
        audio: {},
        sprite: {
            animated: false,
            texture: type === 'tiles' ? 'tiles' : 'objects',
            frame: 0,
            animations: {
                idle: [],
                move: []
            }
        }
    };
}

async function fetchMappingDocument(type) {
    const resp = await fetch(`${buildApiUrl(MAPPINGS_API_PATH)}?type=${encodeURIComponent(type)}`, { cache: 'no-store' });
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${resp.status}`);
    }
    return payload;
}

async function saveMappingDocument(type, data) {
    const resp = await fetch(`${buildApiUrl(MAPPINGS_API_PATH)}?type=${encodeURIComponent(type)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
    });
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${resp.status}`);
    }
    return payload;
}

function createTextureFrameCanvas(textureKey, frameIndex, size = 96, drawOptions = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const scene = getScene();
    if (!scene) return canvas;

    const ok = drawMiniMapFrame(scene, ctx, textureKey, frameIndex, 0, 0, size, drawOptions);
    if (!ok) {
        ctx.fillStyle = '#11203c';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#395a88';
        ctx.strokeRect(1, 1, size - 2, size - 2);
        ctx.fillStyle = '#90b7ec';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('n/a', size / 2, size / 2 + 4);
    }
    return canvas;
}

function summarizeMappingItem(type, item) {
    if (!item || typeof item !== 'object') return 'record vuoto';
    if (type === 'effects') return String(item.description || 'profilo effetto');
    const tokenCount = Array.isArray(item.tokens) ? item.tokens.length : 0;
    const texture = item?.sprite?.texture || 'no-texture';
    const frame = item?.sprite?.frame ?? 'n/a';
    return `${item.category || 'n/a'} | token=${tokenCount} | ${texture}:${frame}`;
}

function refreshMappingItemList(preferredKey = '') {
    const type = MAPPINGS_EDITOR_STATE.currentType;
    const listEl = el('mappingItemList');
    const metaEl = el('mappingMetaInfo');
    if (!listEl || !metaEl) return;

    const doc = MAPPINGS_EDITOR_STATE.loadedDocuments[type] || getDefaultMappingDocument(type);
    const rootKey = getMappingItemRootKey(type);
    const collection = getMappingCollection(type);
    const keys = Object.keys(collection).sort((a, b) => a.localeCompare(b));
    listEl.innerHTML = '';

    metaEl.textContent = `Tipo: ${type} | root: ${rootKey} | elementi: ${keys.length}`;

    if (!keys.length) {
        const empty = document.createElement('div');
        empty.className = 'tiny';
        empty.style.color = '#9fc5f3';
        empty.textContent = 'Nessun record presente. Usa Aggiungi per crearne uno.';
        listEl.appendChild(empty);
        MAPPINGS_EDITOR_STATE.currentItemKey = '';
        const editor = el('mappingItemEditor');
        if (editor) editor.value = '{}';
        renderMappingPreview(null);
        return;
    }

    const targetKey = preferredKey && collection[preferredKey] ? preferredKey : (collection[MAPPINGS_EDITOR_STATE.currentItemKey] ? MAPPINGS_EDITOR_STATE.currentItemKey : keys[0]);
    MAPPINGS_EDITOR_STATE.currentItemKey = targetKey;

    keys.forEach((key) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = `mapping-item-row${key === targetKey ? ' active' : ''}`;
        row.dataset.mappingKey = key;

        const title = document.createElement('div');
        title.className = 'mapping-item-name';
        title.textContent = key;

        const meta = document.createElement('div');
        meta.className = 'mapping-item-meta';
        meta.textContent = summarizeMappingItem(type, collection[key]);

        row.appendChild(title);
        row.appendChild(meta);
        row.addEventListener('click', () => selectMappingItem(key));
        listEl.appendChild(row);
    });

    selectMappingItem(targetKey);
}

function collectScenarioEntries(item) {
    if (!item || typeof item !== 'object') return [];
    const scenarios = [];
    const scoring = isPlainObject(item.scoring) ? item.scoring : {};
    const effects = isPlainObject(item.effects) ? item.effects : {};
    const audio = isPlainObject(item.audio) ? item.audio : {};
    const events = new Set([...Object.keys(scoring), ...Object.keys(effects), ...Object.keys(audio)]);

    events.forEach((eventName) => {
        scenarios.push({
            title: eventName,
            body: [
                `score: ${JSON.stringify(scoring[eventName] ?? null)}`,
                `effects: ${JSON.stringify(effects[eventName] ?? [])}`,
                `audio: ${JSON.stringify(audio[eventName] ?? [])}`
            ].join(' | ')
        });
    });

    if (!scenarios.length && item.description) {
        scenarios.push({
            title: 'Descrizione',
            body: String(item.description)
        });
    }

    return scenarios;
}

function normalizeAnimationFrames(frames) {
    if (!Array.isArray(frames)) return [];
    return frames
        .map((entry) => {
            if (typeof entry === 'number') return { frame: entry };
            if (isPlainObject(entry) && typeof entry.frame === 'number') return { frame: entry.frame };
            return null;
        })
        .filter(Boolean);
}

function renderAnimationGroups(item) {
    const host = el('mappingAnimationGroups');
    if (!host) return;
    host.innerHTML = '';

    if (!item || typeof item !== 'object') {
        host.textContent = 'Nessun record selezionato.';
        return;
    }

    const sprite = item.sprite || {};
    const animations = isPlainObject(sprite.animations) ? sprite.animations : {};
    const texture = sprite.texture;
    const entries = Object.entries(animations);

    if (!texture || !entries.length) {
        const empty = document.createElement('div');
        empty.className = 'tiny';
        empty.textContent = 'Nessuna sequenza animata definita.';
        host.appendChild(empty);
        return;
    }

    entries.forEach(([name, rawFrames]) => {
        const frames = normalizeAnimationFrames(rawFrames);
        const group = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'mapping-scenario-title';
        title.textContent = `${name} (${frames.length} frame)`;
        group.appendChild(title);

        const strip = document.createElement('div');
        strip.className = 'mapping-animation-strip';

        if (!frames.length) {
            const empty = document.createElement('div');
            empty.className = 'tiny';
            empty.textContent = 'Sequenza vuota';
            strip.appendChild(empty);
        } else {
            frames.forEach((entry, index) => {
                const frameBox = document.createElement('div');
                frameBox.className = 'mapping-animation-frame';
                frameBox.appendChild(createTextureFrameCanvas(texture, entry.frame, 54));
                const label = document.createElement('div');
                label.className = 'mapping-animation-label';
                label.textContent = `#${index} -> ${entry.frame}`;
                frameBox.appendChild(label);
                strip.appendChild(frameBox);
            });
        }

        group.appendChild(strip);
        host.appendChild(group);
    });
}

function renderMappingPreview(item) {
    const stage = el('mappingPreviewStage');
    const meta = el('mappingPreviewMeta');
    const scenarios = el('mappingScenarioList');
    if (!stage || !meta || !scenarios) return;

    stage.innerHTML = '';
    meta.innerHTML = '';
    scenarios.innerHTML = '';

    if (!item || typeof item !== 'object') {
        meta.textContent = 'Nessun record selezionato.';
        renderAnimationGroups(null);
        return;
    }

    const type = MAPPINGS_EDITOR_STATE.currentType;
    const sprite = item.sprite || {};
    const texture = sprite.texture;
    const frame = sprite.frame;

    if (texture && typeof frame === 'number') {
        stage.appendChild(createTextureFrameCanvas(texture, frame, 144, {
            flipX: !!sprite.flipX,
            flipY: !!sprite.flipY,
            rotation: Number(sprite.rotation || 0) * (Math.PI / 180)
        }));
    } else {
        const empty = document.createElement('div');
        empty.className = 'tiny';
        empty.style.color = '#9fc5f3';
        empty.textContent = type === 'effects' ? 'Gli effect profile non hanno sprite diretto.' : 'Record senza texture/frame numerico previewabile.';
        stage.appendChild(empty);
    }

    [
        `Categoria: ${item.category || (type === 'effects' ? 'effectProfile' : 'n/a')}`,
        `Token: ${JSON.stringify(item.tokens || [])}`,
        `Texture: ${texture || 'n/a'}`,
        `Frame usato: ${frame ?? 'n/a'}`,
        `Animato: ${sprite.animated === true ? 'si' : 'no'}`
    ].forEach((text) => {
        const row = document.createElement('div');
        row.textContent = text;
        meta.appendChild(row);
    });

    const scenarioEntries = collectScenarioEntries(item);
    if (!scenarioEntries.length) {
        const empty = document.createElement('div');
        empty.className = 'tiny';
        empty.textContent = 'Nessuna situazione configurata.';
        scenarios.appendChild(empty);
    } else {
        scenarioEntries.forEach((entry) => {
            const box = document.createElement('div');
            box.className = 'mapping-scenario-item';
            const title = document.createElement('div');
            title.className = 'mapping-scenario-title';
            title.textContent = entry.title;
            const body = document.createElement('div');
            body.className = 'mapping-scenario-body';
            body.textContent = entry.body;
            box.appendChild(title);
            box.appendChild(body);
            scenarios.appendChild(box);
        });
    }

    renderAnimationGroups(item);
}

function previewMappingEditorValue() {
    const raw = String(el('mappingItemEditor')?.value || '').trim();
    if (!raw) {
        renderMappingPreview(null);
        return;
    }
    try {
        const parsed = JSON.parse(raw);
        renderMappingPreview(parsed);
        setMappingsStatus('Preview aggiornata dal record JSON.');
    } catch (e) {
        setMappingsStatus(`JSON record non valido: ${e.message}`, true);
    }
}

function selectMappingItem(key) {
    const type = MAPPINGS_EDITOR_STATE.currentType;
    const collection = getMappingCollection(type);
    const item = collection[key];
    MAPPINGS_EDITOR_STATE.currentItemKey = key;
    document.querySelectorAll('.mapping-item-row').forEach((node) => {
        node.classList.toggle('active', String(node.dataset.mappingKey || '') === key);
    });
    const editor = el('mappingItemEditor');
    if (editor) editor.value = JSON.stringify(item || {}, null, 2);
    renderMappingPreview(item || null);
}

async function loadMappingsEditor(preferredType = null) {
    const type = preferredType || String(el('mappingTypeSelect')?.value || MAPPINGS_EDITOR_STATE.currentType || 'entities');
    MAPPINGS_EDITOR_STATE.currentType = type;
    try {
        const payload = await fetchMappingDocument(type);
        MAPPINGS_EDITOR_STATE.loadedDocuments[type] = payload.data || getDefaultMappingDocument(type);
        refreshMappingItemList();
        setMappingsStatus(`Mapping ${type} caricato.`);
    } catch (e) {
        MAPPINGS_EDITOR_STATE.loadedDocuments[type] = getDefaultMappingDocument(type);
        refreshMappingItemList();
        setMappingsStatus(`Errore caricamento mapping ${type}: ${e.message}`, true);
    }
}

function applyCurrentMappingRecord() {
    const type = MAPPINGS_EDITOR_STATE.currentType;
    const key = String(MAPPINGS_EDITOR_STATE.currentItemKey || '').trim();
    const raw = String(el('mappingItemEditor')?.value || '').trim();
    if (!key) {
        setMappingsStatus('Seleziona o crea un record.', true);
        return false;
    }
    try {
        const parsed = raw ? JSON.parse(raw) : {};
        const doc = MAPPINGS_EDITOR_STATE.loadedDocuments[type] || getDefaultMappingDocument(type);
        const rootKey = getMappingItemRootKey(type);
        if (!isPlainObject(doc[rootKey])) doc[rootKey] = {};
        doc[rootKey][key] = parsed;
        MAPPINGS_EDITOR_STATE.loadedDocuments[type] = doc;
        refreshMappingItemList(key);
        renderMappingPreview(parsed);
        setMappingsStatus(`Record applicato: ${key}`);
        return true;
    } catch (e) {
        setMappingsStatus(`Errore parsing record: ${e.message}`, true);
        return false;
    }
}

function addMappingItem() {
    const type = MAPPINGS_EDITOR_STATE.currentType;
    const input = el('newMappingItemName');
    const name = String(input?.value || '').trim();
    if (!name) {
        setMappingsStatus('Inserisci il nome del nuovo record.', true);
        return;
    }
    const doc = MAPPINGS_EDITOR_STATE.loadedDocuments[type] || getDefaultMappingDocument(type);
    const rootKey = getMappingItemRootKey(type);
    if (!isPlainObject(doc[rootKey])) doc[rootKey] = {};
    if (doc[rootKey][name]) {
        setMappingsStatus(`Il record ${name} esiste gia.`, true);
        return;
    }
    doc[rootKey][name] = buildDefaultMappingItem(type, name);
    MAPPINGS_EDITOR_STATE.loadedDocuments[type] = doc;
    MAPPINGS_EDITOR_STATE.currentItemKey = name;
    if (input) input.value = '';
    refreshMappingItemList(name);
    setMappingsStatus(`Creato record: ${name}`);
}

async function persistCurrentMappingDocument() {
    if (!applyCurrentMappingRecord()) return;
    const type = MAPPINGS_EDITOR_STATE.currentType;
    const doc = MAPPINGS_EDITOR_STATE.loadedDocuments[type] || getDefaultMappingDocument(type);
    try {
        const payload = await saveMappingDocument(type, doc);
        const backup = payload.backupFile ? ` Backup: ${payload.backupFile}` : '';
        setMappingsStatus(`File ${type} salvato.${backup}`);
    } catch (e) {
        setMappingsStatus(`Errore salvataggio mapping ${type}: ${e.message}`, true);
    }
}

async function refreshMusicSelectOptions() {
    const list = await fetchJsonListWithFallback(buildApiUrl('music'), MUSIC_MANIFEST_PATH);
    const sel = el('levelMusic');
    if (!sel) return;
    const current = String(sel.value || '').trim();
    sel.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '(none)';
    sel.appendChild(noneOpt);
    list.forEach((p) => {
        const name = String(p).split('/').pop();
        const o = document.createElement('option');
        o.value = p;
        o.textContent = name;
        sel.appendChild(o);
    });
    if (current) sel.value = current;
}

async function refreshImageSelectOptions() {
    const [bgList, fgList] = await Promise.all([
        fetchJsonListWithFallback(buildApiUrl('images/background'), BG_MANIFEST_PATH),
        fetchJsonListWithFallback(buildApiUrl('images/foreground'), FG_MANIFEST_PATH)
    ]);

    const bgSel = el('bgImageSelect');
    const fgSel = el('fgImageSelect');

    if (bgSel) {
        bgSel.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- scegli immagine background --';
        bgSel.appendChild(placeholder);
        bgList.forEach((p) => {
            const name = String(p).split('/').pop();
            const o = document.createElement('option');
            o.value = name;
            o.textContent = name;
            bgSel.appendChild(o);
        });
    }

    if (fgSel) {
        fgSel.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- scegli immagine foreground --';
        fgSel.appendChild(placeholder);
        fgList.forEach((p) => {
            const name = String(p).split('/').pop();
            const o = document.createElement('option');
            o.value = name;
            o.textContent = name;
            fgSel.appendChild(o);
        });
    }
}

async function refreshAssetsTable() {
    const type = String(el('assetTypeSelect')?.value || 'background');
    const body = el('assetTableBody');
    if (!body) return;

    body.innerHTML = '';
    try {
        const resp = await fetch(`${buildApiUrl(ASSETS_API_PATH)}?type=${encodeURIComponent(type)}`, { cache: 'no-store' });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${resp.status}`);

        const list = Array.isArray(payload.assets) ? payload.assets : [];
        if (!list.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 3;
            td.textContent = 'Nessun asset trovato.';
            tr.appendChild(td);
            body.appendChild(tr);
            setAssetsStatus('Elenco asset aggiornato.');
            return;
        }

        list.forEach((item) => {
            const tr = document.createElement('tr');

            const nameTd = document.createElement('td');
            nameTd.textContent = String(item.name || item.path || '');

            const usedTd = document.createElement('td');
            const badge = document.createElement('span');
            const used = !!item.used;
            badge.className = `used-flag ${used ? 'yes' : 'no'}`;
            badge.textContent = used ? 'SI' : 'NO';
            usedTd.appendChild(badge);

            const actionTd = document.createElement('td');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = 'Delete';
            btn.disabled = used;
            btn.title = used ? 'Asset in uso: non eliminabile' : 'Elimina asset';
            btn.addEventListener('click', async () => {
                try {
                    const delResp = await fetch(buildApiUrl(ASSETS_API_PATH), {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type, fileName: item.name })
                    });
                    const delPayload = await delResp.json().catch(() => ({}));
                    if (!delResp.ok || delPayload.ok === false) {
                        throw new Error(delPayload.error || `HTTP ${delResp.status}`);
                    }
                    setAssetsStatus(`Eliminato: ${item.name}`);
                    await refreshAssetsTable();
                    await refreshImageSelectOptions();
                    await refreshMusicSelectOptions();
                } catch (e) {
                    setAssetsStatus(`Errore delete: ${e.message}`, true);
                }
            });
            actionTd.appendChild(btn);

            tr.appendChild(nameTd);
            tr.appendChild(usedTd);
            tr.appendChild(actionTd);
            body.appendChild(tr);
        });

        setAssetsStatus('Elenco asset aggiornato.');
    } catch (e) {
        setAssetsStatus(`Errore lettura asset: ${e.message}`, true);
    }
}

async function uploadSelectedAsset() {
    const type = String(el('assetTypeSelect')?.value || 'background');
    const fileInput = el('assetUploadInput');
    const file = fileInput?.files?.[0];
    if (!file) {
        setAssetsStatus('Seleziona un file da caricare.', true);
        return;
    }

    try {
        const base64Content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const raw = String(reader.result || '');
                const idx = raw.indexOf(',');
                resolve(idx >= 0 ? raw.slice(idx + 1) : raw);
            };
            reader.onerror = () => reject(new Error('Lettura file fallita'));
            reader.readAsDataURL(file);
        });

        const resp = await fetch(buildApiUrl(`${ASSETS_API_PATH}/upload`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                fileName: file.name,
                contentBase64: base64Content
            })
        });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${resp.status}`);

        if (fileInput) fileInput.value = '';
        setAssetsStatus(`Upload completato: ${file.name}`);
        await refreshAssetsTable();
        await refreshImageSelectOptions();
        await refreshMusicSelectOptions();
    } catch (e) {
        setAssetsStatus(`Errore upload: ${e.message}`, true);
    }
}

async function refreshDictionaryList() {
    const sel = el('dictionarySelect');
    if (!sel) return;
    const current = String(sel.value || '').trim();
    sel.innerHTML = '';

    try {
        const resp = await fetch(buildApiUrl(DICTIONARIES_API_PATH), { cache: 'no-store' });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${resp.status}`);
        const list = Array.isArray(payload.items) ? payload.items : [];
        list.forEach((name) => {
            const o = document.createElement('option');
            o.value = String(name);
            o.textContent = String(name);
            sel.appendChild(o);
        });

        if (current && list.includes(current)) {
            sel.value = current;
        }

        if (sel.value) {
            await loadDictionary(sel.value);
        } else {
            const editor = el('dictionaryEditor');
            if (editor) editor.value = '{}';
        }

        setDictionaryStatus('Lista dizionari aggiornata.');
    } catch (e) {
        setDictionaryStatus(`Errore caricamento dizionari: ${e.message}`, true);
    }
}

async function loadDictionary(name) {
    if (!name) return;
    try {
        const resp = await fetch(`${buildApiUrl(DICTIONARIES_API_PATH)}?name=${encodeURIComponent(name)}`, { cache: 'no-store' });
        const payload = await resp.json().catch(() => ({}));
        if (!resp.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${resp.status}`);
        const editor = el('dictionaryEditor');
        if (editor) editor.value = JSON.stringify(payload.data || {}, null, 2);
        setDictionaryStatus(`Dizionario caricato: ${name}`);
    } catch (e) {
        setDictionaryStatus(`Errore caricamento dizionario: ${e.message}`, true);
    }
}

async function saveDictionary(name, data) {
    const resp = await fetch(buildApiUrl(DICTIONARIES_API_PATH), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data })
    });
    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${resp.status}`);
    }
    return payload;
}

function bindUI() {
    const applyGridBtn = el('applyGridBtn');
    const clearGridBtn = el('clearGridBtn');
    const autoPopulateFromImageBtn = el('autoPopulateFromImageBtn');
    const autoPopulatePathSpawnsBtn = el('autoPopulatePathSpawnsBtn');
    const autoWallSensitivity = el('autoWallSensitivity');
    const autoLiquidSensitivity = el('autoLiquidSensitivity');
    const exportBtn = el('exportBtn');
    const copyJsonBtn = el('copyJsonBtn');
    const saveLocalBtn = el('saveLocalBtn');
    const loadLocalBtn = el('loadLocalBtn');
    const importJsonFile = el('importJsonFile');
    const openConfigDialogBtn = el('openConfigDialogBtn');
    const openAssetsDialogBtn = el('openAssetsDialogBtn');
    const closeAssetsDialogBtn = el('closeAssetsDialogBtn');
    const refreshAssetsBtn = el('refreshAssetsBtn');
    const uploadAssetBtn = el('uploadAssetBtn');
    const assetTypeSelect = el('assetTypeSelect');
    const assetsModal = el('assetsModal');
    const openDictionaryDialogBtn = el('openDictionaryDialogBtn');
    const openMappingsDialogBtn = el('openMappingsDialogBtn');
    const closeDictionaryDialogBtn = el('closeDictionaryDialogBtn');
    const refreshDictionaryBtn = el('refreshDictionaryBtn');
    const createDictionaryBtn = el('createDictionaryBtn');
    const saveDictionaryBtn = el('saveDictionaryBtn');
    const dictionarySelect = el('dictionarySelect');
    const dictionaryModal = el('dictionaryModal');
    const closeMappingsDialogBtn = el('closeMappingsDialogBtn');
    const reloadMappingsBtn = el('reloadMappingsBtn');
    const saveMappingsFileBtn = el('saveMappingsFileBtn');
    const addMappingItemBtn = el('addMappingItemBtn');
    const saveMappingItemBtn = el('saveMappingItemBtn');
    const mappingTypeSelect = el('mappingTypeSelect');
    const mappingsModal = el('mappingsModal');
    const closeConfigDialogBtn = el('closeConfigDialogBtn');
    const reloadConfigBtn = el('reloadConfigBtn');
    const saveConfigBtn = el('saveConfigBtn');
    const configModal = el('configModal');

    autoWallSensitivity?.addEventListener('input', refreshAutoTileSensitivityLabels);
    autoLiquidSensitivity?.addEventListener('input', refreshAutoTileSensitivityLabels);
    refreshAutoTileSensitivityLabels();

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

    if (openAssetsDialogBtn) {
        openAssetsDialogBtn.addEventListener('click', async () => {
            if (assetsModal) assetsModal.classList.add('open');
            await refreshAssetsTable();
        });
    }

    if (closeAssetsDialogBtn) {
        closeAssetsDialogBtn.addEventListener('click', () => {
            if (assetsModal) assetsModal.classList.remove('open');
        });
    }

    if (assetsModal) {
        assetsModal.addEventListener('click', (ev) => {
            if (ev.target === assetsModal) {
                assetsModal.classList.remove('open');
            }
        });
    }

    if (refreshAssetsBtn) refreshAssetsBtn.addEventListener('click', refreshAssetsTable);
    if (uploadAssetBtn) uploadAssetBtn.addEventListener('click', uploadSelectedAsset);
    if (assetTypeSelect) assetTypeSelect.addEventListener('change', refreshAssetsTable);

    if (openDictionaryDialogBtn) {
        openDictionaryDialogBtn.addEventListener('click', async () => {
            if (dictionaryModal) dictionaryModal.classList.add('open');
            await refreshDictionaryList();
        });
    }

    if (closeDictionaryDialogBtn) {
        closeDictionaryDialogBtn.addEventListener('click', () => {
            if (dictionaryModal) dictionaryModal.classList.remove('open');
        });
    }

    if (dictionaryModal) {
        dictionaryModal.addEventListener('click', (ev) => {
            if (ev.target === dictionaryModal) {
                dictionaryModal.classList.remove('open');
            }
        });
    }

    if (openMappingsDialogBtn) {
        openMappingsDialogBtn.addEventListener('click', async () => {
            if (mappingsModal) mappingsModal.classList.add('open');
            await loadMappingsEditor(String(mappingTypeSelect?.value || 'entities'));
        });
    }

    if (closeMappingsDialogBtn) {
        closeMappingsDialogBtn.addEventListener('click', () => {
            if (mappingsModal) mappingsModal.classList.remove('open');
        });
    }

    if (mappingsModal) {
        mappingsModal.addEventListener('click', (ev) => {
            if (ev.target === mappingsModal) {
                mappingsModal.classList.remove('open');
            }
        });
    }

    if (mappingTypeSelect) {
        mappingTypeSelect.addEventListener('change', async () => {
            await loadMappingsEditor(String(mappingTypeSelect.value || 'entities'));
        });
    }

    if (reloadMappingsBtn) {
        reloadMappingsBtn.addEventListener('click', async () => {
            await loadMappingsEditor();
        });
    }

    if (saveMappingsFileBtn) {
        saveMappingsFileBtn.addEventListener('click', async () => {
            await persistCurrentMappingDocument();
        });
    }

    if (addMappingItemBtn) {
        addMappingItemBtn.addEventListener('click', addMappingItem);
    }

    if (saveMappingItemBtn) {
        saveMappingItemBtn.addEventListener('click', () => {
            applyCurrentMappingRecord();
        });
    }

    const mappingItemEditor = el('mappingItemEditor');
    if (mappingItemEditor) {
        mappingItemEditor.addEventListener('input', previewMappingEditorValue);
    }

    if (refreshDictionaryBtn) {
        refreshDictionaryBtn.addEventListener('click', refreshDictionaryList);
    }

    if (dictionarySelect) {
        dictionarySelect.addEventListener('change', async () => {
            await loadDictionary(String(dictionarySelect.value || '').trim());
        });
    }

    if (createDictionaryBtn) {
        createDictionaryBtn.addEventListener('click', async () => {
            const input = el('newDictionaryName');
            const name = String(input?.value || '').trim();
            if (!name) {
                setDictionaryStatus('Inserisci il nome del nuovo dizionario.', true);
                return;
            }
            try {
                await saveDictionary(name, {});
                if (input) input.value = '';
                await refreshDictionaryList();
                if (dictionarySelect) dictionarySelect.value = name;
                await loadDictionary(name);
                setDictionaryStatus(`Creato dizionario: ${name}`);
            } catch (e) {
                setDictionaryStatus(`Errore creazione dizionario: ${e.message}`, true);
            }
        });
    }

    if (saveDictionaryBtn) {
        saveDictionaryBtn.addEventListener('click', async () => {
            const name = String(dictionarySelect?.value || '').trim();
            const raw = String(el('dictionaryEditor')?.value || '').trim();
            if (!name) {
                setDictionaryStatus('Seleziona un dizionario.', true);
                return;
            }
            try {
                const parsed = raw ? JSON.parse(raw) : {};
                if (!isPlainObject(parsed)) {
                    throw new Error('Il dizionario deve essere un oggetto JSON');
                }
                await saveDictionary(name, parsed);
                setDictionaryStatus(`Dizionario salvato: ${name}`);
            } catch (e) {
                setDictionaryStatus(`Errore salvataggio dizionario: ${e.message}`, true);
            }
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

    autoPopulateFromImageBtn?.addEventListener('click', async () => {
        try {
            await autoPopulateTilesFromLayers();
        } catch (error) {
            setStatus(`Errore auto tiles: ${error.message}`, true);
        }
    });

    autoPopulatePathSpawnsBtn?.addEventListener('click', async () => {
        try {
            await autoPopulatePathSpawns();
        } catch (error) {
            setStatus(`Errore auto spawn percorso: ${error.message}`, true);
        }
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
            localStorage.setItem(storageKey('LevelEditorState'), JSON.stringify(level));
            setStatus('Livello salvato in localStorage.');
        } catch (error) {
            setStatus(`Errore salvataggio: ${error.message}`, true);
        }
    });

    loadLocalBtn?.addEventListener('click', () => {
        try {
            const raw = localStorage.getItem(storageKey('LevelEditorState'));
            if (!raw) {
                setStatus('Nessun livello salvato trovato.', true);
                return;
            }
            const parsed = JSON.parse(raw);
            applyLevelToForm(parsed);
            const scene = getScene();
            scene?.loadFromJson(parsed);
            // skipAutoGrid=true: preserve explicit cols/rows from the JSON
            scene?.updateEditorBackgroundImage?.(true);
            setStatus('Livello caricato da localStorage.');
        } catch (error) {
            setStatus(`Errore caricamento: ${error.message}`, true);
        }
    });

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
        'levelId', 'levelSpeed', 'ghostCount', 'batCount', 'spiderCount', 'snakeCount', 'ghostSpeed', 'batSpeed', 'spiderSpeed', 'snakeSpeed',
        'batFlightsBeforeRest', 'batRestSeconds', 'batRestIntervalSeconds',
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

    try { populateMusicOptions(); } catch (e) {}

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
        } catch (e) {
            // ignore
        }
    }

    try { populateImageOptions(); } catch (e) {}
    
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
    // sync range sliders with numeric inputs for speeds
    const ghostRange = el('ghostSpeedRange');
    const ghostNum = el('ghostSpeed');
    if (ghostRange && ghostNum) {
        ghostRange.addEventListener('input', () => { ghostNum.value = ghostRange.value; drawMiniMapPreview(getScene()); });
        ghostNum.addEventListener('input', () => { ghostRange.value = ghostNum.value; drawMiniMapPreview(getScene()); });
    }
    const batRange = el('batSpeedRange');
    const batNum = el('batSpeed');
    if (batRange && batNum) {
        batRange.addEventListener('input', () => { batNum.value = batRange.value; drawMiniMapPreview(getScene()); });
        batNum.addEventListener('input', () => { batRange.value = batNum.value; drawMiniMapPreview(getScene()); });
    }
    const spiderRange = el('spiderSpeedRange');
    const spiderNum = el('spiderSpeed');
    if (spiderRange && spiderNum) {
        spiderRange.addEventListener('input', () => { spiderNum.value = spiderRange.value; drawMiniMapPreview(getScene()); });
        spiderNum.addEventListener('input', () => { spiderRange.value = spiderNum.value; drawMiniMapPreview(getScene()); });
    }
    const snakeRange = el('snakeSpeedRange');
    const snakeNum = el('snakeSpeed');
    if (snakeRange && snakeNum) {
        snakeRange.addEventListener('input', () => { snakeNum.value = snakeRange.value; drawMiniMapPreview(getScene()); });
        snakeNum.addEventListener('input', () => { snakeRange.value = snakeNum.value; drawMiniMapPreview(getScene()); });
    }
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

    // Zone tool buttons
    const toggleZoneBtn = el('toggleZoneTool');
    if (toggleZoneBtn) {
        toggleZoneBtn.addEventListener('click', () => {
            const scene = getScene();
            if (!scene) return;
            scene.zoneToolActive = !scene.zoneToolActive;
            if (scene.zoneToolActive && scene.selectToolActive) scene.objectTool?.setActive(false);
            if (scene.zoneToolActive && scene.decorToolActive) scene.decorTool?.setActive(false);
            toggleZoneBtn.textContent = scene.zoneToolActive ? '\uD83D\uDEAB Zone: ON' : '\uD83D\uDEAB Zone: OFF';
            toggleZoneBtn.classList.toggle('on', scene.zoneToolActive);
            toggleZoneBtn.setAttribute('aria-pressed', String(scene.zoneToolActive));
            document.dispatchEvent(new CustomEvent('leveleditor:zonetool', { detail: { active: scene.zoneToolActive } }));
        });
    }

    // Zone type selector buttons
    const _updateZoneTypeBtns = (activeType) => {
        const btns = document.querySelectorAll('.zone-type-btn');
        btns.forEach((btn) => {
            const isActive = btn.dataset.zone === activeType;
            btn.classList.toggle('on', isActive);
            btn.setAttribute('aria-pressed', String(isActive));
        });
    };
    document.querySelectorAll('.zone-type-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const scene = getScene();
            const ztype = btn.dataset.zone || 'wall';
            if (scene) scene.activeZoneType = ztype;
            _updateZoneTypeBtns(ztype);
        });
    });
    _updateZoneTypeBtns('wall'); // highlight default
    // platform zone types only for platform games
    gameManifestReady.then(() => {
        document.querySelectorAll('.zone-type-btn[data-platform]').forEach((btn) => { btn.hidden = !isPlatformGame(); });
    });
    const zoneBrushSel = el('zoneBrushSize');
    if (zoneBrushSel) {
        zoneBrushSel.addEventListener('change', () => {
            const scene = getScene();
            if (scene) scene.zoneBrush = Number(zoneBrushSel.value) || 1;
        });
    }
    const clearZonesBtn = el('clearAllZones');
    if (clearZonesBtn) {
        clearZonesBtn.addEventListener('click', () => {
            const scene = getScene();
            if (!scene) return;
            scene.zoneCells.forEach((s) => s.clear());
            scene.zoneSubCells.forEach((s) => s.clear());
            scene.renderGrid();
            setStatus('Zone di blocco cancellate.');
        });
    }

    const clearActiveZonesBtn = el('clearActiveZones');
    if (clearActiveZonesBtn) {
        clearActiveZonesBtn.addEventListener('click', () => {
            const scene = getScene();
            if (!scene) return;
            const ztype = scene.activeZoneType || 'wall';
            scene.zoneCells.get(ztype)?.clear();
            scene.zoneSubCells.get(ztype)?.clear();
            scene.renderGrid();
            setStatus(`Zone tipo "${ztype}" cancellate.`);
        });
    }

    const bgLayerContainer = el('bgLayersContainer');
    if (bgLayerContainer) {
        const onBgLayerChange = () => {
            const scene = getScene();
            scene?.updateEditorBackgroundImage?.(true);
            drawMiniMapPreview(scene);
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
        };
        fgLayerContainer.addEventListener('input', onFgLayerChange);
        fgLayerContainer.addEventListener('change', onFgLayerChange);
    }

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

window.addEventListener('level-editor-ready', () => {
    applyLevelToForm(DEFAULT_LEVEL);
    const scene = getScene();
    if (scene) {
        scene.loadFromJson(DEFAULT_LEVEL);
    }
    // Build DOM palette (left column) and wire drag/drop handlers
    try { buildDomPalette(); } catch (e) { /* ignore */ }
    try { setupDomDragAndDrop(); } catch (e) { /* ignore */ }
    try { setupRightAccordion(); } catch (e) { /* ignore */ }
    bindUI();
    drawMiniMapPreview(scene);
    setStatus('Editor pronto.');
});

// Convert right-panel sections into accordions and bind toggles
function setupRightAccordion() {
    if (typeof document === 'undefined') return;
    const panel = document.querySelector('.panel');
    if (!panel) return;
    // Tabbed panel (Spike layout): sections are always open, the tabs do the grouping
    if (document.getElementById('panelTabs')) return;
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
    const tilesContainer = el('domPalette-tiles');
    const objectsContainer = el('domPalette-objects');
    const wallsContainer = el('domPalette-walls');
    if (!tilesContainer && !objectsContainer && !wallsContainer) return;

    // classify tokens
    const tileKeys = new Set(['-', '.', '#', 'f', 'h', 's', 'sand', 'water', 'mud', 'back']);
    const wallKeys = new Set(WALL_PALETTE_ITEMS.map(i => normalizeToken(i.token)));

    // populate tiles
    PALETTE_ITEMS.forEach((it) => {
        const tokenNorm = normalizeToken(it.token);
        if (tileKeys.has(it.token) || tileKeys.has(tokenNorm)) {
            if (!tilesContainer) return;
            const elItem = makePaletteItem(it.label || it.token, tokenNorm);
            tilesContainer.appendChild(elItem);
        }
    });

    // populate objects (exclude walls and tile keys)
    PALETTE_ITEMS.forEach((it) => {
        const tokenNorm = normalizeToken(it.token);
        if (wallKeys.has(tokenNorm)) return;
        if (tileKeys.has(it.token) || tileKeys.has(tokenNorm)) return;
        if (!objectsContainer) return;
        const elItem = makePaletteItem(it.label || it.token, tokenNorm);
        objectsContainer.appendChild(elItem);
    });

    // platform pieces (only for platform games: game.manifest.json → "gameplay": "platform")
    const platformContainer = el('domPalette-platform');
    if (platformContainer) {
        const show = isPlatformGame();
        platformContainer.closest('.accordion')?.toggleAttribute('hidden', !show);
        if (show) PLATFORM_PALETTE_ITEMS.forEach((it) => platformContainer.appendChild(makePaletteItem(it.label, it.token)));
    }

    try { buildDecorPalette(); } catch (e) { /* decorations palette */ }

    // data-driven entities (enemies / characters declared in data/game-entities-mapping.json)
    if (objectsContainer) {
        EDITOR_ENTITIES.forEach((ent) => {
            const elItem = makePaletteItem(ent.label, ent.token);
            elItem.classList.add('palette-entity');
            elItem.title = `Entità definita nei dati (${ent.id})`;
            objectsContainer.appendChild(elItem);
        });
    }

    // populate walls
    if (wallsContainer) {
        WALL_PALETTE_ITEMS.forEach((it) => {
            const tokenNorm = normalizeToken(it.token);
            const elItem = makePaletteItem(it.label || it.token, tokenNorm);
            wallsContainer.appendChild(elItem);
        });
    }

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
        h.addEventListener('click', () => {
            const content = h.nextElementSibling;
            if (!content) return;
            const isNowVisible = content.style.display === 'block' ? false : true;
            content.style.display = isNowVisible ? 'block' : 'none';
            try { ind.textContent = isNowVisible ? '-' : '+'; } catch (e) {}
        });
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

// ===== Responsive Design: Mobile Panel Toggle =====
function initResponsiveDesign() {
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.panel');
    const panelOverlay = document.getElementById('panelOverlay');
    const toggleLeftBtn = document.getElementById('toggleLeftPanel');
    const toggleRightBtn = document.getElementById('toggleRightPanel');
    
    if (!leftPanel || !rightPanel || !toggleLeftBtn || !toggleRightBtn) return;

    // Close panels when overlay is clicked
    if (panelOverlay) {
        panelOverlay.addEventListener('click', () => {
            leftPanel.classList.remove('open');
            rightPanel.classList.remove('open');
            panelOverlay.classList.remove('active');
        });
    }

    // Toggle left panel
    toggleLeftBtn.addEventListener('click', () => {
        const isOpen = leftPanel.classList.toggle('open');
        panelOverlay?.classList.toggle('active', isOpen);
    });

    // Toggle right panel
    toggleRightBtn.addEventListener('click', () => {
        const isOpen = rightPanel.classList.toggle('open');
        panelOverlay?.classList.toggle('active', isOpen);
    });

    // Close panels when clicking outside on different size changes
    function handleResize() {
        const isMobile = window.innerWidth <= 640;
        if (!isMobile) {
            leftPanel.classList.remove('open');
            rightPanel.classList.remove('open');
            panelOverlay?.classList.remove('active');
        }
        // Recompute fluid panel widths if in desktop mode
        if (!isMobile) {
            computeFluidPanelWidths();
        }
    }

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
}

// ===== Fluid 3-Column Layout: Auto-fit panel widths for any 4:3 and wide screens =====
function computeFluidPanelWidths() {
    const root = document.documentElement;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspectRatio = w / h;
    
    // Min/max thresholds for panel widths
    const minLeftWidth = 140;    // Absolute minimum left panel
    const maxLeftWidth = 380;    // Maximum left panel width
    const minRightWidth = 180;   // Absolute minimum right panel
    const maxRightWidth = 450;   // Maximum right panel width
    const minEditorWidth = 200;  // Minimum editor area
    
    let leftWidth = 320;
    let rightWidth = 420;
    
    // Dynamic adjustment based on aspect ratio and window size
    if (aspectRatio < 1.4) {
        // Narrow/square aspect (e.g., 4:3 or worse)
        const scale = Math.max(0.4, Math.min(1, (aspectRatio - 1) / 0.4));
        leftWidth = minLeftWidth + (maxLeftWidth - minLeftWidth) * scale * 0.6;
        rightWidth = minRightWidth + (maxRightWidth - minRightWidth) * scale * 0.65;
    } else if (aspectRatio > 2) {
        // Very wide (ultrawide)
        leftWidth = Math.min(maxLeftWidth, 320 + (w - 1200) * 0.05);
        rightWidth = Math.min(maxRightWidth, 420 + (w - 1200) * 0.05);
    } else {
        // Widescreen (16:9, etc) - use comfortable defaults with slight scaling
        leftWidth = Math.min(maxLeftWidth, Math.max(minLeftWidth, 280 + (w - 1024) * 0.02));
        rightWidth = Math.min(maxRightWidth, Math.max(minRightWidth, 360 + (w - 1024) * 0.025));
    }
    
    // Ensure enough space for editor
    const totalSidePanels = leftWidth + rightWidth;
    if (totalSidePanels + minEditorWidth > w) {
        const scale = (w - minEditorWidth) / totalSidePanels;
        leftWidth *= scale;
        rightWidth *= scale;
    }
    
    // Apply computed widths to CSS variables
    root.style.setProperty('--left-panel-width', Math.floor(leftWidth) + 'px');
    root.style.setProperty('--right-panel-width', Math.floor(rightWidth) + 'px');
    root.style.setProperty('--editor-min-width', Math.floor(minEditorWidth) + 'px');
}

// Initialize fluid layout on load and bind to resize
window.addEventListener('load', () => {
    const isMobile = window.innerWidth <= 640;
    if (!isMobile) {
        computeFluidPanelWidths();
    }
});

window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 640;
    if (!isMobile) {
        // Debounce: only recompute every 100ms max
        if (window.__fluidResizeDebounce) clearTimeout(window.__fluidResizeDebounce);
        window.__fluidResizeDebounce = setTimeout(computeFluidPanelWidths, 100);
    }
});

function initEditorLoadingOverlay() {
    if (window.__levelEditorLoadingInit) return;
    window.__levelEditorLoadingInit = true;

    const overlay = document.getElementById('editorLoading');
    const loadingText = document.getElementById('editorLoadingText');
    if (!overlay) return;

    let isDone = false;

    const setText = (value) => {
        if (loadingText) loadingText.textContent = value;
    };

    const hide = () => {
        if (isDone) return;
        isDone = true;
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-busy', 'false');
        setTimeout(() => {
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 260);
    };

    setText('Preparazione interfaccia...');

    window.addEventListener('level-editor-ready', () => {
        setText('Quasi pronto...');
        hide();
    }, { once: true });

    // Fallback: non bloccare mai l'interfaccia se l'evento non arriva.
    setTimeout(() => {
        if (!isDone) {
            setText('Apertura editor...');
            hide();
        }
    }, 8000);
}

// Initialize responsive design on page load
document.addEventListener('DOMContentLoaded', () => {
    initEditorLoadingOverlay();
    setTimeout(initResponsiveDesign, 100);
});

// Also initialize if the script loads after DOM is ready
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initEditorLoadingOverlay();
    setTimeout(initResponsiveDesign, 100);
}


// =====================================================================================
// LAYER TOOL — background/foreground direct manipulation on the map
//   click = select · drag = move · corner handles = resize (Shift = free aspect)
//   edge handles = stretch one side · top handle = rotate (Shift = 15° steps)
//   floating bar: mirror ↔ ↕, rotate ±15°, opacity, fit to map, original size,
//   bring forward/back, delete. Values are written to the layer row in the panel
//   (offsetX/Y, width/height, rotation, flipX/Y, alpha), so export, undo by editing
//   the fields and the game all use the same data.
// =====================================================================================
function layerRowPrefix(row) {
    return row?.classList?.contains('fg-layer') ? 'fg' : 'bg';
}

function setRowValue(row, cls, value) {
    const input = row?.querySelector(`.${cls}`);
    if (!input) return;
    if (input.type === 'checkbox') input.checked = !!value;
    else input.value = String(value);
}

function installLayerTool(scene) {
    if (scene.layerTool) return;
    const HANDLE = 7;
    const ROT_OFFSET = 26;
    const gfx = scene.add.graphics().setDepth(5000);
    const tool = {
        active: false,
        selectedRow: null,
        drag: null,
        bar: null
    };
    scene.layerTool = tool;
    scene.layerToolActive = false;

    const scale = () => scene.cellSize / GAME_TILE_SIZE;
    const layerImages = () => [...(scene.editorFgImages || []), ...(scene.editorBgImages || [])]
        .filter((img) => img && img.active && img.__bhLayer);
    // the first instance (no repeat offset) is the one that carries the handles
    const masterImage = (row) => layerImages().find((img) => img.__bhLayer.row === row && img.__bhLayer.ix === 0 && img.__bhLayer.iy === 0)
        || layerImages().find((img) => img.__bhLayer.row === row);

    const boxOf = (img) => ({ cx: img.x, cy: img.y, w: img.displayWidth, h: img.displayHeight, a: Phaser.Math.DegToRad(img.angle || 0) });
    const toWorld = (b, lx, ly) => ({
        x: b.cx + lx * Math.cos(b.a) - ly * Math.sin(b.a),
        y: b.cy + lx * Math.sin(b.a) + ly * Math.cos(b.a)
    });
    const toLocal = (b, x, y) => {
        const dx = x - b.cx, dy = y - b.cy;
        return { x: dx * Math.cos(-b.a) - dy * Math.sin(-b.a), y: dx * Math.sin(-b.a) + dy * Math.cos(-b.a) };
    };
    const handles = (b) => {
        const list = [];
        for (const sy of [-1, 0, 1]) {
            for (const sx of [-1, 0, 1]) {
                if (!sx && !sy) continue;
                list.push({ sx, sy, ...toWorld(b, sx * b.w / 2, sy * b.h / 2) });
            }
        }
        list.push({ rotate: true, ...toWorld(b, 0, -b.h / 2 - ROT_OFFSET) });
        return list;
    };

    const draw = () => {
        gfx.clear();
        if (!tool.active || !tool.selectedRow) return;
        const img = masterImage(tool.selectedRow);
        if (!img) return;
        const b = boxOf(img);
        const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => toWorld(b, sx * b.w / 2, sy * b.h / 2));
        gfx.lineStyle(2, 0xc9973f, 1);
        gfx.strokePoints([...c, c[0]], false);
        const top = toWorld(b, 0, -b.h / 2);
        const rot = toWorld(b, 0, -b.h / 2 - ROT_OFFSET);
        gfx.lineBetween(top.x, top.y, rot.x, rot.y);
        handles(b).forEach((h) => {
            gfx.fillStyle(h.rotate ? 0xc9973f : 0xe9e6df, 1);
            if (h.rotate) gfx.fillCircle(h.x, h.y, HANDLE);
            else gfx.fillRect(h.x - HANDLE / 2 - 1, h.y - HANDLE / 2 - 1, HANDLE + 2, HANDLE + 2);
            gfx.lineStyle(1, 0x17181a, 1);
            if (!h.rotate) gfx.strokeRect(h.x - HANDLE / 2 - 1, h.y - HANDLE / 2 - 1, HANDLE + 2, HANDLE + 2);
        });
        // other instances of a repeated layer: thin outline
        gfx.lineStyle(1, 0xc9973f, 0.45);
        layerImages().filter((i) => i.__bhLayer.row === tool.selectedRow && i !== img).forEach((i) => {
            const bb = boxOf(i);
            const cc = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => toWorld(bb, sx * bb.w / 2, sy * bb.h / 2));
            gfx.strokePoints([...cc, cc[0]], false);
        });
    };
    tool.draw = draw;

    // ---- read / write the layer row (game pixels) ----
    const readRow = (row) => {
        const p = layerRowPrefix(row);
        const num = (cls, d = 0) => parseNumber(row.querySelector(`.${p}-${cls}`)?.value, d);
        return {
            offsetX: num('offset-x'), offsetY: num('offset-y'), width: num('width'), height: num('height'),
            rotation: num('rotation'), alpha: num('alpha', 1),
            flipX: !!row.querySelector(`.${p}-flip-x`)?.checked, flipY: !!row.querySelector(`.${p}-flip-y`)?.checked
        };
    };
    const writeRow = (row, vals) => {
        const p = layerRowPrefix(row);
        const map = { offsetX: 'offset-x', offsetY: 'offset-y', width: 'width', height: 'height', rotation: 'rotation', alpha: 'alpha', flipX: 'flip-x', flipY: 'flip-y' };
        Object.entries(vals).forEach(([k, v]) => {
            if (!(k in map)) return;
            // pixels are integers in the level JSON; opacity keeps two decimals
            const val = (typeof v !== 'number') ? v : (k === 'alpha' ? Math.round(v * 100) / 100 : Math.round(v));
            setRowValue(row, `${p}-${map[k]}`, val);
        });
        refreshLayerPreviews();
        draw();
        syncBar();
    };
    tool.readRow = readRow;
    tool.writeRow = writeRow;

    // current game-pixel box of the selected layer, from its master image
    const gameBox = (img) => {
        const k = scale();
        const w = img.displayWidth / k, h = img.displayHeight / k;
        const cx = (img.x - scene.gridOffsetX) / k, cy = (img.y - scene.gridOffsetY) / k;
        return { cx, cy, w, h };
    };
    const writeBox = (row, cx, cy, w, h) => writeRow(row, { offsetX: cx - w / 2, offsetY: cy - h / 2, width: w, height: h });

    // ---- selection ----
    tool.select = (row) => {
        tool.selectedRow = row || null;
        document.querySelectorAll('.bg-layer.layer-selected, .fg-layer.layer-selected').forEach((r) => r.classList.remove('layer-selected'));
        if (row) {
            row.classList.add('layer-selected');
            try { window.EditorLayout?.showPanelTab('level'); } catch (e) { }
            try { row.scrollIntoView({ block: 'nearest' }); } catch (e) { }
        }
        draw();
        syncBar();
    };

    tool.setActive = (on) => {
        tool.active = !!on;
        scene.layerToolActive = tool.active;
        if (tool.active && scene.zoneToolActive) el('toggleZoneTool')?.click();
        if (tool.active && scene.selectToolActive) scene.objectTool?.setActive(false);
        if (tool.active && scene.decorToolActive) scene.decorTool?.setActive(false);
        if (!tool.active) tool.select(null);
        try { scene.input.setDefaultCursor(tool.active ? 'default' : ''); } catch (e) { }
        draw();
        syncBar();
        document.dispatchEvent(new CustomEvent('leveleditor:layertool', { detail: { active: tool.active } }));
        if (tool.active) setStatus('Layer: clicca un background o foreground per selezionarlo, trascinalo per spostarlo, usa le maniglie per ridimensionarlo e ruotarlo.');
    };

    const pickImage = (x, y) => {
        // foreground first (drawn on top), highest depth first
        const imgs = layerImages().sort((a, b) => b.depth - a.depth);
        return imgs.find((img) => {
            const b = boxOf(img);
            const l = toLocal(b, x, y);
            return Math.abs(l.x) <= b.w / 2 && Math.abs(l.y) <= b.h / 2;
        }) || null;
    };

    scene.input.on('pointerdown', (pointer) => {
        if (!tool.active) return;
        const x = pointer.worldX, y = pointer.worldY;
        const sel = tool.selectedRow ? masterImage(tool.selectedRow) : null;
        if (sel) {
            const b = boxOf(sel);
            const hit = handles(b).find((h) => Math.hypot(h.x - x, h.y - y) <= HANDLE + 3);
            if (hit) {
                tool.drag = { kind: hit.rotate ? 'rotate' : 'resize', sx: hit.sx, sy: hit.sy, start: { x, y }, box: b, game: gameBox(sel), vals: readRow(tool.selectedRow) };
                return;
            }
        }
        const img = pickImage(x, y);
        if (!img) { tool.select(null); return; }
        if (img.__bhLayer.row !== tool.selectedRow) tool.select(img.__bhLayer.row);
        const master = masterImage(tool.selectedRow);
        tool.drag = { kind: 'move', start: { x, y }, vals: readRow(tool.selectedRow), box: master ? boxOf(master) : null };
    });

    scene.input.on('pointermove', (pointer) => {
        const d = tool.drag;
        if (!tool.active || !d || !pointer.isDown) return;
        const row = tool.selectedRow;
        if (!row) return;
        const x = pointer.worldX, y = pointer.worldY;
        const k = scale();
        const shift = !!pointer.event?.shiftKey;
        if (d.kind === 'move') {
            writeRow(row, { offsetX: snapPx(d.vals.offsetX + (x - d.start.x) / k), offsetY: snapPx(d.vals.offsetY + (y - d.start.y) / k) });
        } else if (d.kind === 'rotate') {
            let deg = Phaser.Math.RadToDeg(Math.atan2(y - d.box.cy, x - d.box.cx)) + 90;
            deg = shift ? Math.round(deg / 15) * 15 : snapDeg(deg);
            writeRow(row, { rotation: ((deg % 360) + 360) % 360 });
        } else if (d.kind === 'resize') {
            const local = toLocal({ ...d.box, cx: 0, cy: 0 }, x - d.start.x, y - d.start.y); // delta in the layer's own axes
            let w = d.game.w, h = d.game.h;
            if (d.sx) w = Math.max(4, d.game.w + d.sx * local.x / k);
            if (d.sy) h = Math.max(4, d.game.h + d.sy * local.y / k);
            if (d.sx && d.sy && !shift) {
                const f = Math.max(w / d.game.w, h / d.game.h);
                w = d.game.w * f; h = d.game.h * f;
            }
            if (EDITOR_SNAP.on) { const r = h / w; if (d.sx) w = snapSize(w); h = (d.sx && d.sy && !shift) ? w * r : (d.sy ? snapSize(h) : h); }
            // keep the opposite side fixed: move the centre by half the growth, along the layer's axes
            const gx = (d.sx || 0) * (w - d.game.w) / 2, gy = (d.sy || 0) * (h - d.game.h) / 2;
            const shiftW = toWorld({ ...d.box, cx: 0, cy: 0 }, gx, gy);
            writeBox(row, d.game.cx + shiftW.x, d.game.cy + shiftW.y, w, h);
        }
    });

    const endDrag = () => { if (tool.drag) { tool.drag = null; drawMiniMapPreview(scene); } };
    scene.input.on('pointerup', endDrag);
    scene.input.on('pointerupoutside', endDrag);

    // keep handles in sync with redraws (zoom, scroll, panel edits)
    const origUpdate = scene.updateEditorBackgroundImage.bind(scene);
    scene.updateEditorBackgroundImage = (...args) => { const r = origUpdate(...args); draw(); return r; };

    // ---- floating bar ----
    const bar = document.createElement('div');
    bar.className = 'layer-bar';
    bar.hidden = true;
    bar.innerHTML = `
        <span class="lb-name"></span>
        <button type="button" data-act="flipX" title="Specchia orizzontalmente">↔</button>
        <button type="button" data-act="flipY" title="Specchia verticalmente">↕</button>
        <button type="button" data-act="rotL" title="Ruota di −15°">⟲</button>
        <span class="lb-rot"></span>
        <button type="button" data-act="rotR" title="Ruota di +15°">⟳</button>
        <label title="Opacità">◐ <input type="range" min="0" max="1" step="0.05" data-act="alpha"></label>
        <button type="button" data-act="fit" title="Adatta alla mappa">⤢</button>
        <button type="button" data-act="natural" title="Dimensione originale dell'immagine">1:1</button>
        <button type="button" data-act="up" title="Porta indietro (disegnato prima)">▲</button>
        <button type="button" data-act="down" title="Porta avanti (disegnato dopo)">▼</button>
        <button type="button" data-act="delete" title="Elimina il layer">✕</button>`;
    el('editor-game')?.appendChild(bar);
    tool.bar = bar;

    function syncBar() {
        const row = tool.selectedRow;
        bar.hidden = !(tool.active && row && row.isConnected);
        if (bar.hidden) return;
        const v = readRow(row);
        const p = layerRowPrefix(row);
        const sel = row.querySelector(`.${p}-src`);
        const name = sel ? String(sel.value || '') : '';
        bar.querySelector('.lb-name').textContent = `${p === 'fg' ? 'Foreground' : 'Background'} · ${name.split('/').pop()}`;
        bar.querySelector('.lb-rot').textContent = `${Math.round(v.rotation)}°`;
        const a = bar.querySelector('[data-act=alpha]');
        if (document.activeElement !== a) a.value = String(v.alpha);
        bar.querySelector('[data-act=flipX]').classList.toggle('on', v.flipX);
        bar.querySelector('[data-act=flipY]').classList.toggle('on', v.flipY);
    }
    tool.syncBar = syncBar;

    const naturalSize = (row) => new Promise((resolve) => {
        const p = layerRowPrefix(row);
        const sel = row.querySelector(`.${p}-src`);
        const v = String(sel?.value || '').trim();
        if (!v) return resolve(null);
        const src = sel.tagName === 'SELECT' ? `${p === 'fg' ? FG_ASSETS_DIR : BG_ASSETS_DIR}/${v}` : normalizeLayerSrc(v, p);
        loadImageElement(src).then((im) => resolve({ w: im.naturalWidth, h: im.naturalHeight })).catch(() => resolve(null));
    });

    bar.addEventListener('input', (e) => {
        if (e.target.dataset.act === 'alpha' && tool.selectedRow) writeRow(tool.selectedRow, { alpha: parseNumber(e.target.value, 1) });
    });
    bar.addEventListener('click', async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        const row = tool.selectedRow;
        if (!act || !row || act === 'alpha') return;
        const v = readRow(row);
        const img = masterImage(row);
        const g = img ? gameBox(img) : null;
        if (act === 'flipX') writeRow(row, { flipX: !v.flipX });
        else if (act === 'flipY') writeRow(row, { flipY: !v.flipY });
        else if (act === 'rotL') writeRow(row, { rotation: ((v.rotation - 15) % 360 + 360) % 360 });
        else if (act === 'rotR') writeRow(row, { rotation: (v.rotation + 15) % 360 });
        else if (act === 'fit') writeRow(row, { offsetX: 0, offsetY: 0, width: scene.cols * GAME_TILE_SIZE, height: scene.rows * GAME_TILE_SIZE, rotation: 0 });
        else if (act === 'natural') {
            const n = await naturalSize(row);
            if (n && g) writeBox(row, g.cx, g.cy, n.w, n.h);
        } else if (act === 'up' || act === 'down') {
            row.querySelector(act === 'up' ? '.layer-move-up' : '.layer-move-down')?.click();
            draw();
        } else if (act === 'delete') {
            if (!window.confirm('Eliminare questo layer?')) return;
            row.remove();
            tool.select(null);
            refreshLayerPreviews();
        }
    });
}

// ---- palette: background / foreground images, draggable onto the map ----
function buildLayerPalette() {
    const groups = [
        { type: 'bg', select: 'bgImageSelect', target: 'domPalette-backgrounds', dir: BG_ASSETS_DIR },
        { type: 'fg', select: 'fgImageSelect', target: 'domPalette-foregrounds', dir: FG_ASSETS_DIR }
    ];
    groups.forEach((g) => {
        const box = el(g.target);
        const sel = el(g.select);
        if (!box || !sel) return;
        const files = Array.from(sel.options).map((o) => o.value).filter(Boolean);
        if (box.dataset.files === files.join('|')) return;
        box.dataset.files = files.join('|');
        box.innerHTML = '';
        files.forEach((file) => {
            const item = document.createElement('div');
            item.className = 'palette-item layer-item';
            item.draggable = true;
            item.title = `Trascina sulla mappa per aggiungere un ${g.type === 'fg' ? 'foreground' : 'background'}`;
            const im = document.createElement('img');
            im.src = `${g.dir}/${file}`;
            im.alt = '';
            im.loading = 'lazy';
            const label = document.createElement('span');
            label.textContent = file.replace(/\.[a-z0-9]+$/i, '');
            item.appendChild(im);
            item.appendChild(label);
            item.addEventListener('dragstart', (ev) => {
                ev.dataTransfer.setData('application/x-bh-layer', JSON.stringify({ type: g.type, file }));
                ev.dataTransfer.setData('text/plain', '');
                ev.dataTransfer.effectAllowed = 'copy';
            });
            box.appendChild(item);
        });
    });
}

async function addLayerAtCanvasPoint(type, file, canvasX, canvasY) {
    const scene = getScene();
    if (!scene) return;
    const dir = type === 'fg' ? FG_ASSETS_DIR : BG_ASSETS_DIR;
    let natW = 0, natH = 0;
    try { const im = await loadImageElement(`${dir}/${file}`); natW = im.naturalWidth; natH = im.naturalHeight; } catch (e) { }
    if (!natW || !natH) { setStatus(`Immagine non caricabile: ${file}`, true); return; }
    const k = scene.cellSize / GAME_TILE_SIZE;
    const gx = (canvasX - scene.gridOffsetX) / k;
    const gy = (canvasY - scene.gridOffsetY) / k;
    // large images start at most half the map wide/high (aspect kept) so all handles are reachable
    const fit = Math.min(1, (scene.cols * GAME_TILE_SIZE * 0.5) / natW, (scene.rows * GAME_TILE_SIZE * 0.5) / natH);
    const w = Math.max(8, Math.round(natW * fit)), h = Math.max(8, Math.round(natH * fit));
    const cfg = {
        src: `${dir}/${file}`, enabled: true, factor: 1.0, alpha: 1.0,
        offsetX: Math.round(gx - w / 2), offsetY: Math.round(gy - h / 2),
        width: w, height: h, repeatX: 1, repeatY: 1, stepX: 0, stepY: 0
    };
    const container = el(type === 'fg' ? 'fgLayersContainer' : 'bgLayersContainer');
    if (!container) return;
    try { (type === 'fg' ? ensureFgHeader : ensureBgHeader)(); } catch (e) { }
    const row = (type === 'fg' ? createFgLayerElement : createBgLayerElement)(cfg);
    container.appendChild(row);
    refreshLayerPreviews();
    window.EditorLayout?.setMode?.('layers');
    scene.layerTool?.setActive(true);
    // wait for the texture to load before selecting (the handles follow the image)
    setTimeout(() => scene.layerTool?.select(row), 350);
    setStatus(`${type === 'fg' ? 'Foreground' : 'Background'} aggiunto: ${file}. Trascinalo o usa le maniglie per sistemarlo.`);
}

function setupLayerDrop() {
    const target = el('editor-game');
    if (!target || target.dataset.layerDrop === '1') return;
    target.dataset.layerDrop = '1';
    // capture phase: handled before the token drop handler
    target.addEventListener('drop', (ev) => {
        const raw = ev.dataTransfer?.getData('application/x-bh-layer');
        if (!raw) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        target.classList.remove('over');
        let info = null;
        try { info = JSON.parse(raw); } catch (e) { return; }
        const rect = target.getBoundingClientRect();
        addLayerAtCanvasPoint(info.type, info.file, ev.clientX - rect.left, ev.clientY - rect.top);
    }, true);
    target.addEventListener('dragenter', (ev) => {
        if ([...(ev.dataTransfer?.types || [])].includes('application/x-bh-layer')) target.classList.add('over');
    });
    target.addEventListener('dragleave', (ev) => { if (ev.target === target) target.classList.remove('over'); });
}

window.addEventListener('load', () => {
    setupLayerDrop();
    buildLayerPalette();
    // the image lists arrive from the API after load: rebuild when they change
    ['bgImageSelect', 'fgImageSelect'].forEach((id) => {
        const sel = el(id);
        if (sel) new MutationObserver(() => buildLayerPalette()).observe(sel, { childList: true });
    });
});


// =====================================================================================
// OBJECT TOOL — select a placed object on the map and transform it
//   mode "Seleziona" (key 4): click = select (click again = next stacked token)
//   floating bar / keys: ⟲ ⟳ (Q/E or ←/→) rotate 90° · ↔ ↕ (H/V) mirror
//   − + (PageDown/PageUp) scale · 1:1 reset · ✕ (Delete) remove only that object
//   Stored in the token as transform{scale;rot;flipX;flipY}; walls use their native rot/flip.
// =====================================================================================
/** all tokens of a cell: "A/B" may be kept in base ("A/B") or split in base + reveal */
function editorCellParts(cell) {
    if (!cell) return [];
    const parts = String(cell.base || '-').split('/').map((t) => t.trim()).filter(Boolean);
    if (cell.reveal) parts.push(...String(cell.reveal).split('/').map((t) => t.trim()).filter(Boolean));
    return parts;
}

function installObjectTool(scene) {
    if (scene.objectTool) return;
    const bar = document.createElement('div');
    bar.className = 'layer-bar object-bar';
    bar.hidden = true;
    bar.innerHTML = `
        <span class="lb-name"></span>
        <button type="button" data-act="rotL" title="Ruota di −90° (Q o ←)">⟲</button>
        <span class="lb-rot ob-rot"></span>
        <button type="button" data-act="rotR" title="Ruota di +90° (E o →)">⟳</button>
        <button type="button" data-act="flipX" title="Specchia orizzontalmente (H)">↔</button>
        <button type="button" data-act="flipY" title="Specchia verticalmente (V)">↕</button>
        <button type="button" data-act="smaller" title="Rimpicciolisci (PagGiù)">−</button>
        <span class="lb-rot ob-scale"></span>
        <button type="button" data-act="bigger" title="Ingrandisci (PagSu)">+</button>
        <button type="button" data-act="reset" title="Annulla le trasformazioni">1:1</button>
        <button type="button" data-act="delete" title="Elimina l'oggetto (Canc)">✕</button>`;
    el('editor-game')?.appendChild(bar);

    const selected = () => {
        const sc = scene.selectedCell;
        const cell = sc ? scene.cells[sc.row]?.[sc.col] : null;
        if (!cell) return null;
        const parts = editorCellParts(cell);
        if (!parts.length || (parts.length === 1 && parts[0] === '-')) return null;
        const index = Math.min(Math.max(0, scene.selectedTokenIndex || 0), parts.length - 1);
        return { cell, parts, index, token: parts[index] };
    };
    const isWall = (token) => WALL_TOKEN_REGEX.test(normalizeToken(getRenderableTokenBase(token)));

    const tool = {
        active: false,
        bar,
        setActive(on) {
            on = !!on;
            if (on) {
                if (scene.layerToolActive) scene.layerTool?.setActive(false);
                if (scene.zoneToolActive) el('toggleZoneTool')?.click();
                if (scene.decorToolActive) scene.decorTool?.setActive(false);
            }
            tool.active = on;
            scene.selectToolActive = on;
            document.dispatchEvent(new CustomEvent('leveleditor:selecttool', { detail: { active: on } }));
            tool.sync();
        },
        sync() {
            const s = selected();
            bar.hidden = !(tool.active && s);
            if (bar.hidden) return;
            const tf = parseTokenTransform(s.token);
            let rot = tf.rot, fx = tf.flipX, fy = tf.flipY;
            if (isWall(s.token)) {
                const m = normalizeToken(getRenderableTokenBase(s.token)).match(WALL_TOKEN_REGEX);
                rot = Number(m[3]) * 90; fx = m[4] === 'h'; fy = m[4] === 'v';
            }
            const base = getRenderableTokenBase(s.token);
            const ent = editorEntityFor(base);
            const stack = s.parts.length > 1 ? ` (${s.index + 1}/${s.parts.length})` : '';
            bar.querySelector('.lb-name').textContent = `${ent ? ent.label : base}${stack} · ${scene.selectedCell.col},${scene.selectedCell.row}`;
            bar.querySelector('.ob-rot').textContent = `${rot}°`;
            bar.querySelector('.ob-scale').textContent = `×${Math.round(tf.scale * 100) / 100}`;
            bar.querySelector('[data-act=flipX]').classList.toggle('on', fx);
            bar.querySelector('[data-act=flipY]').classList.toggle('on', fy);
        },
        run(act) {
            const s = selected();
            if (!s) return false;
            let token = s.token;
            const tf = parseTokenTransform(token);
            if (isWall(token) && (act === 'rotL' || act === 'rotR' || act === 'flipX' || act === 'flipY')) {
                const meta = parseDecoratedToken(token);
                let wall = normalizeToken(meta.base);
                if (act === 'rotL' || act === 'rotR') wall = rotateWallToken(wall, act === 'rotR' ? 1 : -1);
                else {
                    const m = wall.match(WALL_TOKEN_REGEX);
                    const want = act === 'flipX' ? 'h' : 'v';
                    wall = `w${m[1]}${m[2]}${m[3]}${m[4] === want ? '0' : want}`;
                }
                token = composeDecoratedToken({ ...meta, base: wall });
            } else if (act === 'rotL') token = withTokenTransform(token, { ...tf, rot: (tf.rot + 270) % 360 });
            else if (act === 'rotR') token = withTokenTransform(token, { ...tf, rot: (tf.rot + 90) % 360 });
            else if (act === 'flipX') token = withTokenTransform(token, { ...tf, flipX: !tf.flipX });
            else if (act === 'flipY') token = withTokenTransform(token, { ...tf, flipY: !tf.flipY });
            else if (act === 'bigger') token = withTokenTransform(token, { ...tf, scale: Math.min(4, Math.round((tf.scale + 0.25) * 100) / 100) });
            else if (act === 'smaller') token = withTokenTransform(token, { ...tf, scale: Math.max(0.25, Math.round((tf.scale - 0.25) * 100) / 100) });
            else if (act === 'reset') {
                token = withTokenTransform(token, IDENTITY_TRANSFORM);
                if (isWall(token)) {
                    const meta = parseDecoratedToken(token);
                    const m = normalizeToken(meta.base).match(WALL_TOKEN_REGEX);
                    token = composeDecoratedToken({ ...meta, base: `w${m[1]}${m[2]}00` });
                }
            } else if (act === 'delete') {
                const parts = s.parts.slice();
                parts.splice(s.index, 1);
                s.cell.base = parts.length ? parts.join('/') : '-';
                s.cell.reveal = null;
                scene.selectedTokenIndex = Math.max(0, parts.length - 1);
                scene.updateSelectedCellInfo();
                scene.renderGrid();
                tool.sync();
                return true;
            } else return false;
            const parts = s.parts.slice();
            parts[s.index] = token;
            s.cell.base = parts.join('/');
            s.cell.reveal = null;
            scene.updateSelectedCellInfo();
            scene.renderGrid();
            tool.sync();
            return true;
        }
    };
    scene.objectTool = tool;

    bar.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act) tool.run(act);
    });
    // keyboard while in select mode (capture phase: wins over the paint-mode shortcuts)
    window.addEventListener('keydown', (e) => {
        if (!tool.active || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target || {};
        if (t.matches?.('input,select,textarea') || t.isContentEditable) return;
        if (document.querySelector('.modal-overlay.open, .config-modal.open')) return;
        const map = {
            ArrowLeft: 'rotL', ArrowRight: 'rotR', q: 'rotL', Q: 'rotL', e: 'rotR', E: 'rotR',
            h: 'flipX', H: 'flipX', v: 'flipY', V: 'flipY',
            PageUp: 'bigger', PageDown: 'smaller', Delete: 'delete', Backspace: 'delete'
        };
        const act = map[e.key];
        if (!act) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        tool.run(act);
    }, true);
}


// =====================================================================================
// SNAP TO GRID — one setting for layers and decorations
//   on/off (button ⊞ in the zoom bar, key G) · step 1, ½, ¼ of a game tile
//   positions and sizes move in steps, rotations in 15° steps (Shift = 90°)
// =====================================================================================
const EDITOR_SNAP = { on: false, step: 1 };
function snapPx(v) {
    if (!EDITOR_SNAP.on) return v;
    const s = GAME_TILE_SIZE * (Number(EDITOR_SNAP.step) || 1);
    return Math.round(v / s) * s;
}
function snapSize(v) {
    if (!EDITOR_SNAP.on) return v;
    const s = GAME_TILE_SIZE * (Number(EDITOR_SNAP.step) || 1);
    return Math.max(s, Math.round(v / s) * s);
}
function snapDeg(deg, coarse = false) {
    const step = coarse ? 90 : (EDITOR_SNAP.on ? 15 : 1);
    return ((Math.round(deg / step) * step) % 360 + 360) % 360;
}
function setSnap(on, step) {
    if (on != null) EDITOR_SNAP.on = !!on;
    if (step != null) EDITOR_SNAP.step = Number(step) || 1;
    const btn = el('snapBtn');
    if (btn) { btn.classList.toggle('on', EDITOR_SNAP.on); btn.setAttribute('aria-pressed', String(EDITOR_SNAP.on)); }
    const sel = el('snapStep');
    if (sel && String(sel.value) !== String(EDITOR_SNAP.step)) sel.value = String(EDITOR_SNAP.step);
    try { localStorage.setItem('bh-editor-snap', JSON.stringify(EDITOR_SNAP)); } catch (e) { }
    try { getScene()?.decorTool?.drawGuides(); } catch (e) { }
}
window.addEventListener('load', () => {
    try { const saved = JSON.parse(localStorage.getItem('bh-editor-snap') || 'null'); if (saved) Object.assign(EDITOR_SNAP, saved); } catch (e) { }
    el('snapBtn')?.addEventListener('click', () => setSnap(!EDITOR_SNAP.on));
    el('snapStep')?.addEventListener('change', (e) => setSnap(true, e.target.value));
    setSnap();
});


// =====================================================================================
// DECORATIONS — frames of the game's spritesheets placed freely on the map
//   mode "Decorazioni" (key 5): click a frame in the palette, click on the map to place it
//   (or drag it there) · click = select · drag = move · corners = resize (Shift = free)
//   · round handle = rotate · bar: rotate, mirror, size, opacity, front/behind, duplicate, delete
//   Saved as level.decorations (game pixels from the map corner); the game draws them with
//   kit/core/decorations.js. They are scenery only: the rules stay in tiles and zones.
// =====================================================================================
const DECOR_SHEETS = [
    { texture: 'objects', label: 'Oggetti', frames: 16 },
    { texture: 'wall_tiles', label: 'Muri e arredi', frames: 24 },
    { texture: 'tiles', label: 'Terreni', frames: 6 }
];

function installDecorTool(scene) {
    if (scene.decorTool) return;
    const HANDLE = 7, ROT_OFFSET = 24;
    scene.decorations = scene.decorations || [];
    const gfx = scene.add.graphics().setDepth(5001);
    const guides = scene.add.graphics().setDepth(-90);
    let images = [];
    const k = () => scene.cellSize / GAME_TILE_SIZE;
    const toScreen = (d) => ({ cx: scene.gridOffsetX + d.x * k(), cy: scene.gridOffsetY + d.y * k(), w: d.w * k(), h: d.h * k(), a: Phaser.Math.DegToRad(d.rotation || 0) });
    const toWorld = (b, lx, ly) => ({ x: b.cx + lx * Math.cos(b.a) - ly * Math.sin(b.a), y: b.cy + lx * Math.sin(b.a) + ly * Math.cos(b.a) });
    const toLocal = (b, x, y) => { const dx = x - b.cx, dy = y - b.cy; return { x: dx * Math.cos(-b.a) - dy * Math.sin(-b.a), y: dx * Math.sin(-b.a) + dy * Math.cos(-b.a) }; };
    const handles = (b) => {
        const list = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({ sx, sy, ...toWorld(b, sx * b.w / 2, sy * b.h / 2) }));
        list.push({ rotate: true, ...toWorld(b, 0, -b.h / 2 - ROT_OFFSET) });
        return list;
    };

    const tool = {
        active: false,
        selected: -1,
        armed: null,       // { texture, frame } waiting to be placed
        drag: null,
        redraw() {
            images.forEach((i) => i.destroy());
            images = scene.decorations.map((d, i) => {
                if (!scene.textures.exists(d.texture)) return null;
                const b = toScreen(d);
                const img = scene.add.image(b.cx, b.cy, d.texture, d.frame).setDisplaySize(Math.max(1, b.w), Math.max(1, b.h));
                img.setAngle(d.rotation || 0).setFlip(!!d.flipX, !!d.flipY).setAlpha(d.alpha == null ? 1 : Number(d.alpha));
                img.setDepth((d.front ? 700 : -100) + i * 0.001); // front: above characters and foreground layers (500+)
                return img;
            }).filter(Boolean);
            tool.drawSelection();
            tool.drawGuides();
        },
        drawSelection() {
            gfx.clear();
            const d = scene.decorations[tool.selected];
            if (!tool.active || !d) return;
            const b = toScreen(d);
            const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => toWorld(b, sx * b.w / 2, sy * b.h / 2));
            gfx.lineStyle(2, 0x59b97c, 1).strokePoints([...c, c[0]], false);
            const top = toWorld(b, 0, -b.h / 2), rot = toWorld(b, 0, -b.h / 2 - ROT_OFFSET);
            gfx.lineBetween(top.x, top.y, rot.x, rot.y);
            handles(b).forEach((h) => {
                gfx.fillStyle(h.rotate ? 0x59b97c : 0xe9e6df, 1);
                if (h.rotate) gfx.fillCircle(h.x, h.y, HANDLE); else gfx.fillRect(h.x - HANDLE / 2, h.y - HANDLE / 2, HANDLE, HANDLE);
            });
        },
        /** fine grid lines for ½ and ¼ steps while snapping in this mode */
        drawGuides() {
            guides.clear();
            if (!tool.active || !EDITOR_SNAP.on || Number(EDITOR_SNAP.step) >= 1) return;
            const step = scene.cellSize * Number(EDITOR_SNAP.step);
            const W = scene.cols * scene.cellSize, H = scene.rows * scene.cellSize;
            guides.lineStyle(1, 0x59b97c, 0.18);
            for (let x = step; x < W; x += step) guides.lineBetween(scene.gridOffsetX + x, scene.gridOffsetY, scene.gridOffsetX + x, scene.gridOffsetY + H);
            for (let y = step; y < H; y += step) guides.lineBetween(scene.gridOffsetX, scene.gridOffsetY + y, scene.gridOffsetX + W, scene.gridOffsetY + y);
        },
        setActive(on) {
            on = !!on;
            if (on) {
                if (scene.layerToolActive) scene.layerTool?.setActive(false);
                if (scene.selectToolActive) scene.objectTool?.setActive(false);
                if (scene.zoneToolActive) el('toggleZoneTool')?.click();
            }
            tool.active = on;
            scene.decorToolActive = on;
            // open the "Decorazioni" group of the palette
            const pal = el('domPalette-decor');
            if (on && pal && getComputedStyle(pal).display === 'none') pal.previousElementSibling?.click();
            if (!on) { tool.selected = -1; tool.arm(null); }
            document.dispatchEvent(new CustomEvent('leveleditor:decortool', { detail: { active: on } }));
            tool.drawSelection();
            tool.drawGuides();
            tool.sync();
            if (on) setStatus('Decorazioni: scegli un frame nella palette e clicca sulla mappa, oppure trascinalo. Clic su una decorazione per spostarla, ridimensionarla o ruotarla.');
        },
        arm(spec) {
            tool.armed = spec;
            document.querySelectorAll('#domPalette-decor .decor-item').forEach((n) => n.classList.toggle('armed', !!spec && n.dataset.texture === spec.texture && Number(n.dataset.frame) === Number(spec.frame)));
        },
        /** adds a decoration centred at game pixel (gx, gy) */
        place(spec, gx, gy) {
            const f = scene.textures.getFrame(spec.texture, spec.frame);
            const nat = f ? Math.max(f.width, f.height) : 64;
            const size = GAME_TILE_SIZE * Math.max(1, Math.round(nat / 64)); // 64-px frames → 1 tile
            const ratio = f ? f.height / f.width : 1;
            const d = { texture: spec.texture, frame: spec.frame, w: size, h: size * ratio, rotation: 0, alpha: 1, front: false };
            d.x = snapPx(gx - d.w / 2) + d.w / 2;
            d.y = snapPx(gy - d.h / 2) + d.h / 2;
            scene.decorations.push(d);
            tool.selected = scene.decorations.length - 1;
            tool.redraw();
            tool.sync();
            return d;
        },
        pick(x, y) {
            for (let i = scene.decorations.length - 1; i >= 0; i--) {
                const order = scene.decorations[i];
                const b = toScreen(order);
                const l = toLocal(b, x, y);
                if (Math.abs(l.x) <= b.w / 2 && Math.abs(l.y) <= b.h / 2) return i;
            }
            return -1;
        },
        select(i) { tool.selected = (i == null) ? -1 : i; tool.drawSelection(); tool.sync(); },
        run(act) {
            const d = scene.decorations[tool.selected];
            if (!d) return;
            const coarse = EDITOR_SNAP.on;
            if (act === 'rotL') d.rotation = snapDeg((d.rotation || 0) - (coarse ? 90 : 15), coarse);
            else if (act === 'rotR') d.rotation = snapDeg((d.rotation || 0) + (coarse ? 90 : 15), coarse);
            else if (act === 'flipX') d.flipX = !d.flipX;
            else if (act === 'flipY') d.flipY = !d.flipY;
            else if (act === 'bigger' || act === 'smaller') {
                const r = d.h / d.w;
                const cx = d.x, cy = d.y;
                if (EDITOR_SNAP.on) {
                    // one grid step at a time
                    const st = GAME_TILE_SIZE * (Number(EDITOR_SNAP.step) || 1);
                    d.w = Math.max(st, snapSize(d.w) + (act === 'bigger' ? st : -st));
                } else {
                    d.w = Math.max(4, d.w * (act === 'bigger' ? 1.25 : 0.8));
                }
                d.h = d.w * r;
                d.x = cx; d.y = cy;
            } else if (act === 'front') d.front = !d.front;
            else if (act === 'dup') { scene.decorations.push({ ...d, x: d.x + GAME_TILE_SIZE / 2, y: d.y + GAME_TILE_SIZE / 2 }); tool.selected = scene.decorations.length - 1; }
            else if (act === 'snap') { d.x = snapPx(d.x - d.w / 2) + d.w / 2; d.y = snapPx(d.y - d.h / 2) + d.h / 2; d.w = snapSize(d.w); d.rotation = snapDeg(d.rotation || 0); }
            else if (act === 'delete') { scene.decorations.splice(tool.selected, 1); tool.selected = -1; }
            tool.redraw();
            tool.sync();
        },
        sync() {
            const d = scene.decorations[tool.selected];
            bar.hidden = !(tool.active && d);
            if (bar.hidden) return;
            bar.querySelector('.lb-name').textContent = `${d.texture} #${d.frame}`;
            bar.querySelector('.db-rot').textContent = `${Math.round(d.rotation || 0)}°`;
            bar.querySelector('.db-size').textContent = `${Math.round(d.w)}×${Math.round(d.h)}`;
            bar.querySelector('[data-act=flipX]').classList.toggle('on', !!d.flipX);
            bar.querySelector('[data-act=flipY]').classList.toggle('on', !!d.flipY);
            const fb = bar.querySelector('[data-act=front]');
            fb.textContent = d.front ? 'Davanti' : 'Dietro';
            fb.classList.toggle('on', !!d.front);
            const a = bar.querySelector('[data-act=alpha]');
            if (document.activeElement !== a) a.value = String(d.alpha == null ? 1 : d.alpha);
        }
    };
    scene.decorTool = tool;

    // ---- pointer ----
    scene.input.on('pointerdown', (pointer) => {
        if (!tool.active) return;
        const x = pointer.worldX, y = pointer.worldY;
        const sel = scene.decorations[tool.selected];
        if (sel) {
            const b = toScreen(sel);
            const hit = handles(b).find((h) => Math.hypot(h.x - x, h.y - y) <= HANDLE + 3);
            if (hit) { tool.drag = { kind: hit.rotate ? 'rotate' : 'resize', sx: hit.sx, sy: hit.sy, start: { x, y }, d0: { ...sel }, b }; return; }
        }
        const i = tool.pick(x, y);
        if (i >= 0) {
            tool.select(i);
            tool.drag = { kind: 'move', start: { x, y }, d0: { ...scene.decorations[i] } };
            return;
        }
        if (tool.armed && scene.getGridCellFromPointer(x, y)) {
            tool.place(tool.armed, (x - scene.gridOffsetX) / k(), (y - scene.gridOffsetY) / k());
            return;
        }
        tool.select(-1);
    });
    scene.input.on('pointermove', (pointer) => {
        const dr = tool.drag;
        const d = scene.decorations[tool.selected];
        if (!tool.active || !dr || !d || !pointer.isDown) return;
        const x = pointer.worldX, y = pointer.worldY;
        const shift = !!pointer.event?.shiftKey;
        if (dr.kind === 'move') {
            const nx = dr.d0.x + (x - dr.start.x) / k(), ny = dr.d0.y + (y - dr.start.y) / k();
            d.x = snapPx(nx - d.w / 2) + d.w / 2;
            d.y = snapPx(ny - d.h / 2) + d.h / 2;
        } else if (dr.kind === 'rotate') {
            const deg = Phaser.Math.RadToDeg(Math.atan2(y - dr.b.cy, x - dr.b.cx)) + 90;
            d.rotation = snapDeg(deg, shift);
        } else if (dr.kind === 'resize') {
            const l = toLocal({ ...dr.b, cx: 0, cy: 0 }, x - dr.start.x, y - dr.start.y);
            let w = Math.max(4, dr.d0.w + dr.sx * l.x / k());
            let h = Math.max(4, dr.d0.h + dr.sy * l.y / k());
            if (!shift) { const f = Math.max(w / dr.d0.w, h / dr.d0.h); w = dr.d0.w * f; h = dr.d0.h * f; }
            if (EDITOR_SNAP.on) { const r = h / w; w = snapSize(w); h = shift ? snapSize(h) : w * r; }
            // the opposite corner stays where it was
            const gx = dr.sx * (w - dr.d0.w) / 2, gy = dr.sy * (h - dr.d0.h) / 2;
            const off = toWorld({ ...dr.b, cx: 0, cy: 0 }, gx, gy);
            d.w = w; d.h = h;
            d.x = dr.d0.x + off.x / k(); d.y = dr.d0.y + off.y / k();
        }
        tool.redraw();
        tool.sync();
    });
    const end = () => { if (tool.drag) { tool.drag = null; try { drawMiniMapPreview(scene); } catch (e) { } } };
    scene.input.on('pointerup', end);
    scene.input.on('pointerupoutside', end);

    // keep in sync with zoom / scroll / grid redraws
    const origRender = scene.renderGrid.bind(scene);
    scene.renderGrid = (...args) => { const r = origRender(...args); try { tool.redraw(); } catch (e) { } return r; };

    // ---- floating bar ----
    const bar = document.createElement('div');
    bar.className = 'layer-bar decor-bar';
    bar.hidden = true;
    bar.innerHTML = `
        <span class="lb-name"></span>
        <button type="button" data-act="rotL" title="Ruota (Q) · con la griglia 90°">⟲</button>
        <span class="lb-rot db-rot"></span>
        <button type="button" data-act="rotR" title="Ruota (E) · con la griglia 90°">⟳</button>
        <button type="button" data-act="flipX" title="Specchia orizzontalmente (H)">↔</button>
        <button type="button" data-act="flipY" title="Specchia verticalmente (V)">↕</button>
        <button type="button" data-act="smaller" title="Rimpicciolisci (PagGiù)">−</button>
        <span class="lb-rot db-size"></span>
        <button type="button" data-act="bigger" title="Ingrandisci (PagSu)">+</button>
        <label title="Opacità">◐ <input type="range" min="0" max="1" step="0.05" data-act="alpha"></label>
        <button type="button" data-act="front" title="Davanti o dietro ai personaggi (F)">Dietro</button>
        <button type="button" data-act="snap" title="Allinea alla griglia questa decorazione">⊞</button>
        <button type="button" data-act="dup" title="Duplica (Ctrl+D)">⧉</button>
        <button type="button" data-act="delete" title="Elimina (Canc)">✕</button>`;
    el('editor-game')?.appendChild(bar);
    bar.addEventListener('click', (e) => { const act = e.target.closest('[data-act]')?.dataset.act; if (act && act !== 'alpha') tool.run(act); });
    bar.addEventListener('input', (e) => {
        if (e.target.dataset.act !== 'alpha') return;
        const d = scene.decorations[tool.selected];
        if (d) { d.alpha = Number(e.target.value); tool.redraw(); }
    });

    // ---- keyboard (capture: wins over the paint-mode shortcuts) ----
    window.addEventListener('keydown', (e) => {
        if (!tool.active) return;
        const t = e.target || {};
        if (t.matches?.('input,select,textarea') || t.isContentEditable) return;
        if (document.querySelector('.modal-overlay.open, .config-modal.open')) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); tool.run('dup'); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const d = scene.decorations[tool.selected];
        const nudge = EDITOR_SNAP.on ? GAME_TILE_SIZE * EDITOR_SNAP.step : (e.shiftKey ? 8 : 1);
        const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (arrows[e.key] && d) {
            e.preventDefault(); e.stopImmediatePropagation();
            d.x += arrows[e.key][0] * nudge; d.y += arrows[e.key][1] * nudge;
            tool.redraw(); tool.sync();
            return;
        }
        const map = { q: 'rotL', Q: 'rotL', e: 'rotR', E: 'rotR', h: 'flipX', H: 'flipX', v: 'flipY', V: 'flipY', f: 'front', F: 'front', PageUp: 'bigger', PageDown: 'smaller', Delete: 'delete', Backspace: 'delete' };
        if (e.key === 'Escape') { tool.arm(null); tool.select(-1); return; }
        const act = map[e.key];
        if (!act || !d) return;
        e.preventDefault(); e.stopImmediatePropagation();
        tool.run(act);
    }, true);

    tool.redraw();
}

/** palette "Decorazioni": the frames of the spritesheets, by sheet */
function buildDecorPalette() {
    const box = el('domPalette-decor');
    const scene = getScene();
    if (!box || !scene) return;
    box.innerHTML = '';
    const sheetSel = document.createElement('select');
    sheetSel.className = 'decor-sheet';
    DECOR_SHEETS.forEach((s) => { const o = document.createElement('option'); o.value = s.texture; o.textContent = s.label; sheetSel.appendChild(o); });
    const grid = document.createElement('div');
    grid.className = 'decor-grid';
    box.appendChild(sheetSel);
    box.appendChild(grid);
    const hint = document.createElement('p');
    hint.className = 'palette-hint';
    hint.textContent = 'Clic e poi clic sulla mappa, oppure trascina. Posizione, dimensione e rotazione libere (⊞ per allinearle alla griglia).';
    box.appendChild(hint);
    const fill = () => {
        grid.innerHTML = '';
        const sheet = DECOR_SHEETS.find((s) => s.texture === sheetSel.value) || DECOR_SHEETS[0];
        if (!scene.textures.exists(sheet.texture)) return;
        for (let f = 0; f < sheet.frames; f++) {
            const item = document.createElement('div');
            item.className = 'decor-item';
            item.draggable = true;
            item.dataset.texture = sheet.texture;
            item.dataset.frame = String(f);
            item.title = `${sheet.label} · frame ${f}`;
            const c = document.createElement('canvas');
            c.width = 40; c.height = 40;
            const ctx = c.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            try { drawMiniMapFrame(scene, ctx, sheet.texture, f, 0, 0, 40); } catch (e) { }
            item.appendChild(c);
            item.addEventListener('click', () => {
                const sc = getScene();
                if (!sc?.decorTool) return;
                if (!sc.decorToolActive) window.EditorLayout?.setMode('decor');
                sc.decorTool.arm({ texture: sheet.texture, frame: f });
            });
            item.addEventListener('dragstart', (ev) => {
                try { ev.dataTransfer.setData('application/x-spike-decor', JSON.stringify({ texture: sheet.texture, frame: f })); } catch (e) { }
            });
            grid.appendChild(item);
        }
    };
    sheetSel.addEventListener('change', fill);
    fill();
}

function setupDecorDrop() {
    const target = el('editor-game');
    if (!target || target.dataset.decorDrop === '1') return;
    target.dataset.decorDrop = '1';
    target.addEventListener('drop', (ev) => {
        const raw = ev.dataTransfer?.getData('application/x-spike-decor');
        if (!raw) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        const scene = getScene();
        if (!scene?.decorTool) return;
        let spec = null;
        try { spec = JSON.parse(raw); } catch (e) { return; }
        const rect = target.getBoundingClientRect();
        const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
        if (!scene.getGridCellFromPointer(x, y)) { setStatus('Rilascia la decorazione dentro la mappa', true); return; }
        if (!scene.decorToolActive) window.EditorLayout?.setMode('decor');
        const k = scene.cellSize / GAME_TILE_SIZE;
        scene.decorTool.place(spec, (x - scene.gridOffsetX) / k, (y - scene.gridOffsetY) / k);
    }, true);
}
window.addEventListener('load', () => setupDecorDrop());
