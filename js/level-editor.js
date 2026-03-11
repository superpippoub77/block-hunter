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
const BG_ASSETS_DIR = 'assets/images/background';
const FG_ASSETS_DIR = 'assets/images/foreground';
const API_BASE_PATH = 'api';
const BG_MANIFEST_PATH = 'data/background-images.json';
const FG_MANIFEST_PATH = 'data/foreground-images.json';
const MUSIC_MANIFEST_PATH = 'data/music-files.json';
const CONFIG_JSON_PATH = 'data/config.json';

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
    ghost: 2,
    bat: 2,
    ghostSpeed: 80,
    batSpeed: 90,
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

function buildApiUrl(path) {
    const clean = String(path ?? '').replace(/^\/+/, '');
    return `${API_BASE_PATH}/${clean}`;
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

let OBJECT_MAP_EDITOR_STATE = {
    items: []
};

function setObjectMapStatus(message, isError = false) {
    const target = el('objectMapStatusText');
    if (!target) return;
    target.style.color = isError ? '#ff8f9a' : '#8ee89f';
    target.textContent = message;
}

function createDefaultObjectMapping(seedName = '') {
    return {
        key: String(seedName || 'new_object').trim() || 'new_object',
        imageSrc: '',
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
        }
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

    return {
        ...base,
        key: String(inObj.key ?? inObj.id ?? base.key).trim() || base.key,
        imageSrc: String(inObj.imageSrc ?? inObj.image ?? '').trim(),
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
        }
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
        card.remove();
        setObjectMapStatus('Oggetto rimosso.');
    });
    titleRow.appendChild(keyInput);
    titleRow.appendChild(removeBtn);
    card.appendChild(titleRow);

    const rowA = document.createElement('div');
    rowA.className = 'objmap-grid2';
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
    rowA.appendChild(imgWrap);
    rowA.appendChild(dynWrap);
    card.appendChild(rowA);

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

    const dynamicToggle = card.querySelector('.obj-dynamic');
    const autoToggle = card.querySelector('.obj-auto');
    dynamicToggle?.addEventListener('change', () => setObjectCardVisibility(card));
    autoToggle?.addEventListener('change', () => setObjectCardVisibility(card));
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

        const mapped = normalizeObjectMapping({
            key: getVal('.obj-key'),
            imageSrc: getVal('.obj-image-src'),
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
            }
        });
        return mapped;
    }).filter((m) => m.key);

    OBJECT_MAP_EDITOR_STATE.items = out;
    return out;
}

function loadObjectMappingsToEditor(rawList) {
    const arr = Array.isArray(rawList) ? rawList : [];
    OBJECT_MAP_EDITOR_STATE.items = arr.map((it) => normalizeObjectMapping(it));
    renderObjectMapEditor();
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
        this.load
            .spritesheet('tiles', 'images/tiles.png', { frameWidth: 64, frameHeight: 64 })
            .spritesheet('wall_tiles', 'images/wall_completed.png', { frameWidth: 64, frameHeight: 64 })
            .spritesheet('objects', 'images/obj_game.png', { frameWidth: 64, frameHeight: 64 })
            .spritesheet('ghost_anim', 'images/ghost.png', { frameWidth: 64, frameHeight: 64 })
            .spritesheet('bat_anim', 'images/batpng.png', { frameWidth: 64, frameHeight: 64 });

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
        ghost: parseNumber(el('ghostCount')?.value, 0),
        bat: parseNumber(el('batCount')?.value, 0),
        ghostSpeed: parseNumber(el('ghostSpeed')?.value, 80),
        batSpeed: parseNumber(el('batSpeed')?.value, 90)
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
    el('ghostCount').value = data.ghost ?? DEFAULT_LEVEL.ghost;
    el('batCount').value = data.bat ?? DEFAULT_LEVEL.bat;
    el('ghostSpeed').value = data.ghostSpeed ?? DEFAULT_LEVEL.ghostSpeed;
    el('batSpeed').value = data.batSpeed ?? DEFAULT_LEVEL.batSpeed;
    try { if (el('ghostSpeedRange')) el('ghostSpeedRange').value = el('ghostSpeed').value; } catch (e) {}
    try { if (el('batSpeedRange')) el('batSpeedRange').value = el('batSpeed').value; } catch (e) {}
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

    try { loadObjectMappingsToEditor(data.objectMappings || []); } catch (e) {}

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
    const importJsonFile = el('importJsonFile');
    const openConfigDialogBtn = el('openConfigDialogBtn');
    const closeConfigDialogBtn = el('closeConfigDialogBtn');
    const reloadConfigBtn = el('reloadConfigBtn');
    const saveConfigBtn = el('saveConfigBtn');
    const configModal = el('configModal');
    const openObjectMapDialogBtn = el('openObjectMapDialogBtn');
    const closeObjectMapDialogBtn = el('closeObjectMapDialogBtn');
    const addObjectMapBtn = el('addObjectMapBtn');
    const saveObjectMapBtn = el('saveObjectMapBtn');
    const objectMapModal = el('objectMapModal');

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

    if (openObjectMapDialogBtn) {
        openObjectMapDialogBtn.addEventListener('click', () => {
            if (objectMapModal) objectMapModal.classList.add('open');
            renderObjectMapEditor();
            setObjectMapStatus('Editor mappaggio oggetti aperto.');
        });
    }
    if (closeObjectMapDialogBtn) {
        closeObjectMapDialogBtn.addEventListener('click', () => {
            if (objectMapModal) objectMapModal.classList.remove('open');
        });
    }
    if (addObjectMapBtn) {
        addObjectMapBtn.addEventListener('click', () => {
            OBJECT_MAP_EDITOR_STATE.items.push(createDefaultObjectMapping(`obj_${OBJECT_MAP_EDITOR_STATE.items.length + 1}`));
            renderObjectMapEditor();
            setObjectMapStatus('Nuovo oggetto aggiunto.');
        });
    }
    if (saveObjectMapBtn) {
        saveObjectMapBtn.addEventListener('click', () => {
            const items = collectObjectMappingsFromEditor();
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
        'levelId', 'levelSpeed', 'ghostCount', 'batCount', 'ghostSpeed', 'batSpeed',
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
