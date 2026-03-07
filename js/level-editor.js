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
    light: 'piena',
    ghost: 2,
    bat: 2,
    ghostSpeed: 80,
    batSpeed: 90
    ,
    background: 1,
    backgroundEnabled: true
    ,
    rain: {
        enabled: false,
        intensity: 1,
        frequency: 180,
        wind: 0,
        direction: 'down'
    }
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

function tokenToMiniMapColor(token) {
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

class LevelEditorScene extends Phaser.Scene {
    constructor() {
        super('LevelEditorScene');
        this.cols = 12;
        this.rows = 12;
        this.cellSize = 48;
        this.baseCellSize = 48; // cell size without zoom
        this.zoom = 2; // default start zoom (2x) to show enlarged map
        this.gridOffsetX = 18;
        this.gridOffsetY = 18;
        this.gridPadding = 18; // fixed padding used for layout and scrolling math
        // these will be computed from the actual canvas size on create / resize
        this.gridAreaWidth = 0;
        this.gridAreaHeight = 0;
        this.cells = [];
        this.selectedCell = null;
        this.paletteItems = [];
        this.lastBrushToken = 'w0000';
    }

    preload() {
        this.load
            .spritesheet('tiles', 'images/tiles.png', { frameWidth: 64, frameHeight: 64 })
            .spritesheet('wall_tiles', 'images/wall_completed.png', { frameWidth: 64, frameHeight: 64 })
            .spritesheet('objects', 'images/obj_game.png', { frameWidth: 64, frameHeight: 64 })
            .spritesheet('ghost_anim', 'images/ghost.png', { frameWidth: 64, frameHeight: 64 })
            .spritesheet('bat_anim', 'images/batpng.png', { frameWidth: 64, frameHeight: 64 });

        // preload possible game backgrounds so the editor can offer them
        this.load.image('game_bg', 'images/game_bg.png');
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

    updateEditorBackgroundImage() {
        const show = !!el('showBackground')?.checked;
        // First prefer active bg row from DOM (radio). Fallback to single select value.
        let key = null;
        try {
            const activeRadio = document.querySelector('#bgLayersContainer input.bg-active-radio:checked');
            if (activeRadio) {
                const row = activeRadio.closest('.bg-layer');
                if (row) {
                    const sel = row.querySelector('select.bg-src');
                    let src = '';
                    if (sel) {
                        const v = String(sel.value || '').trim();
                        src = v ? `images/${v}` : '';
                    } else {
                        src = String(row.querySelector('.bg-src')?.value || '').trim();
                    }
                    if (src) {
                        // create a stable key for this src
                        const safeKey = `editor_bg_${src.replace(/[^a-z0-9_.-]+/gi, '_')}`;
                        // if texture exists, use it; otherwise load dynamically
                        if (this.textures.exists(safeKey)) {
                            key = safeKey;
                        } else {
                            try {
                                // start loader for this key
                                this.load.image(safeKey, src);
                                this.load.once('complete', () => {
                                    try {
                                        if (!this.editorBgImage) this.editorBgImage = this.add.image(0, 0, safeKey).setDepth(-500);
                                        this.editorBgImage.setTexture(safeKey);
                                        this.editorBgImage.setDisplaySize(this.cellSize * this.cols, this.cellSize * this.rows);
                                        this.editorBgImage.setPosition(this.gridOffsetX + (this.cellSize * this.cols) / 2, this.gridOffsetY + (this.cellSize * this.rows) / 2);
                                        this.editorBgImage.setVisible(show);
                                    } catch (e) { /* ignore */ }
                                });
                                this.load.start();
                                // fallthrough: keep key so it will be applied if/when ready
                                key = safeKey;
                            } catch (e) {
                                // ignore loader errors and fallback
                            }
                        }
                    }
                }
            }
        } catch (e) { /* ignore DOM access issues */ }

        if (!key) {
            const val = String(el('levelBackground')?.value ?? '').trim();
            key = this.getBackgroundKeyFromValue(val);
        }

        if (!show || !key) {
            if (this.editorBgImage) {
                try { this.editorBgImage.setVisible(false); } catch (e) {}
            }
            return;
        }

        // If an actual texture frame exists and the user requested auto-grid-from-bg,
        // compute cols/rows from the natural background size assuming 64x64 cells.
        try {
            const autoChk = el('autoGridFromBg');
            if (autoChk && autoChk.checked) {
                const frame = this.textures.getFrame(key, 0);
                if (frame && Number.isFinite(frame.cutWidth) && Number.isFinite(frame.cutHeight)) {
                    const nCols = clamp(Math.floor(Number(frame.cutWidth) / 64), 4, 40);
                    const nRows = clamp(Math.floor(Number(frame.cutHeight) / 64), 4, 40);
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
        const cx = this.gridOffsetX + gridW / 2;
        const cy = this.gridOffsetY + gridH / 2;

        if (!this.editorBgImage) {
            this.editorBgImage = this.add.image(cx, cy, key).setDepth(-500);
        }
        try {
            this.editorBgImage.setTexture(key);
            this.editorBgImage.setDisplaySize(gridW, gridH);
            this.editorBgImage.setPosition(cx, cy);
            this.editorBgImage.setVisible(true);
        } catch (e) {
            // ignore
        }
    }

    resetGrid(cols, rows, skipBgUpdate = false) {
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

        this.cells = Array.from({ length: this.rows }, () => Array.from({ length: this.cols }, () => ({
            base: '-',
            reveal: null
        })));
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
        try { this.updateEditorBackgroundImage(); } catch (e) {}
        this.renderGrid();
        // update scrollbar ranges after zooming/resizing cells
        try { this.updateScrollbars(); } catch (e) { /* ignore */ }
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
            this.updateSelectedCellInfo();

            if (pointer.rightButtonDown()) {
                this.rotateSelectedCell(1);
            } else if (this.lastBrushToken) {
                this.placeToken(cell.col, cell.row, this.lastBrushToken);
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
                        this.placeToken(cell.col, cell.row, container.getData('token'));
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

    placeToken(col, row, token) {
        if (!this.cells[row] || !this.cells[row][col]) return;
        const cell = this.cells[row][col];
        const useReveal = !!el('revealMode')?.checked;
        const normalized = normalizeToken(token);

        if (useReveal) {
            cell.reveal = normalized === '-' ? null : normalized;
            return;
        }

        cell.base = normalized;
        if (normalized === '-') {
            cell.reveal = null;
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
        const normalized = normalizeToken(token);
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
        const info = this.tokenToRenderInfo(token);
        const scale = size / 64;

        if (info.kind === 'empty') {
            const marker = this.add.rectangle(x, y, size * 0.8, size * 0.8, 0x20345a, 0.25).setStrokeStyle(1, 0x486aa2, 0.8);
            container.add(marker);
            return;
        }

        if (info.kind === 'tile') {
            const tile = this.add.sprite(x, y, info.texture, info.frame);
            tile.setScale(scale);
            container.add(tile);
            return;
        }

        if (info.kind === 'wall') {
            const wall = this.add.sprite(x, y, 'wall_tiles', info.frame);
            wall.setScale(scale);
            if (info.flip === 'h') wall.setFlipX(true);
            else if (info.flip === 'v') wall.setFlipY(true);
            else wall.setAngle((info.rot || 0) * 90);
            container.add(wall);
            return;
        }

        if (info.kind === 'obj') {
            const obj = this.add.sprite(x, y, 'objects', info.frame);
            obj.setScale(scale * 0.9);
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

                const bg = this.add.rectangle(cx, cy, this.cellSize, this.cellSize, 0x0f1f3e, 0)
                    .setStrokeStyle(1, 0x304f83, 0.35);
                this.gridLayer.add(bg);

                const cell = this.cells[row][col];
                this.addTokenVisual(this.gridLayer, cell.base, cx, cy, this.cellSize);

                if (cell.reveal) {
                    const tag = this.add.text(
                        x + this.cellSize - 2,
                        y + 2,
                        `/${cell.reveal}`,
                        {
                            fontFamily: 'monospace',
                            fontSize: `${Math.max(8, Math.floor(this.cellSize * 0.19))}px`,
                            color: '#ffd76a',
                            backgroundColor: '#1f1300'
                        }
                    ).setOrigin(1, 0);
                    this.gridLayer.add(tag);
                }
            }
        }

        const borderW = this.cols * this.cellSize;
        const borderH = this.rows * this.cellSize;
        // ensure editor background (if present) matches current grid position/size so it scrolls with tiles
        try {
            if (this.editorBgImage) {
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
        const reveal = cell?.reveal ? ` / ${cell.reveal}` : '';
        infoEl.textContent = `Cella ${row},${col}: ${cell?.base || '-'}${reveal}`;
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
                const parsed = splitToken(raw);
                this.cells[y][x].base = parsed.base;
                this.cells[y][x].reveal = parsed.reveal;
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
    const normalized = normalizeToken(token);
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
        try {
            ctx.save();
            // clip to map rectangle so image stays inside blue mini-map
            ctx.beginPath();
            ctx.rect(offX, offY, mapW, mapH);
            ctx.clip();
            ctx.globalAlpha = alpha;
            ctx.drawImage(img, offX, offY, mapW, mapH);
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
            const isEmptyToken = normBase === '-' || normBase === '.' || normBase === '#';
            const reveal = cellData?.reveal;

            const x = offX + col * cell;
            const y = offY + row * cell;
            // If the base token is an empty token, don't draw a tile so the background remains fully visible.
            if (isEmptyToken) {
                // nothing to draw for empty cells (background shows through)
            } else {
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
    const domFg = readForegroundLayersFromDOM();
    let fgLayers = null;
    if (Array.isArray(domFg) && domFg.length > 0) fgLayers = domFg;
    else {
        const fgVal = String(el('levelForeground')?.value ?? '').trim();
        if (fgVal) fgLayers = [{ src: fgVal, parallaxFgFactor: 1.0, parallaxFgAlpha: 1.0 }];
    }
    if (Array.isArray(fgLayers) && fgLayers.length > 0) {
        fgLayers.forEach((ly) => {
            if (!ly || !ly.src) return;
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
            try {
                ctx.save();
                // clip to map rectangle so fg stays inside mini-map
                ctx.beginPath();
                ctx.rect(offX, offY, mapW, mapH);
                ctx.clip();
                ctx.globalAlpha = Number.isFinite(ly.parallaxFgAlpha) ? ly.parallaxFgAlpha : 1.0;
                ctx.drawImage(entry.img, offX, offY, mapW, mapH);
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
        light: String(el('lightMode')?.value || 'piena').trim(),
        ghost: parseNumber(el('ghostCount')?.value, 0),
        bat: parseNumber(el('batCount')?.value, 0),
        ghostSpeed: parseNumber(el('ghostSpeed')?.value, 80),
        batSpeed: parseNumber(el('batSpeed')?.value, 90)
    };

    // include background enabled flag
    level.backgroundEnabled = !!el('showBackground')?.checked;

    // rain/weather
    level.rain = {
        enabled: !!el('rainEnabled')?.checked,
        intensity: parseNumber(el('rainIntensity')?.value, 1),
        frequency: parseNumber(el('rainFrequency')?.value, 180),
        wind: parseNumber(el('rainWind')?.value, 0),
        direction: String(el('rainDirection')?.value || 'down'),
        interval: parseNumber(el('rainInterval')?.value, 5),
        duration: parseNumber(el('rainDuration')?.value, 0)
    };

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

    return { ...level, ...extra, map: level.map, playerStart: level.playerStart };
}

function applyLevelToForm(levelData) {
    const data = { ...DEFAULT_LEVEL, ...(levelData || {}) };
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
    el('lightMode').value = data.light ?? DEFAULT_LEVEL.light;
    el('escapeRoute').value = String(!!data.escapeRoute);
    // set background select (support single value or array)
    try {
        const bgEl = el('levelBackground');
        if (bgEl && bgEl.options) {
            const vals = Array.isArray(data.background) ? data.background : (data.background !== undefined && data.background !== null ? [data.background] : []);
            Array.from(bgEl.options).forEach(o => {
                o.selected = vals.length === 0 ? (o.value === String(data.background)) : vals.some(v => String(v) === o.value);
            });
        } else {
            el('levelBackground').value = data.background ? String(data.background) : '';
        }
    } catch (e) { el('levelBackground').value = data.background ? String(data.background) : ''; }
    // set foreground select (support single value or array)
    try {
        const fgEl = el('levelForeground');
        if (fgEl && fgEl.options) {
            const vals = Array.isArray(data.foreground) ? data.foreground : (data.foreground !== undefined && data.foreground !== null ? [data.foreground] : []);
            Array.from(fgEl.options).forEach(o => {
                o.selected = vals.length === 0 ? (o.value === String(data.foreground)) : vals.some(v => String(v) === o.value);
            });
        } else {
            if (el('levelForeground')) el('levelForeground').value = data.foreground ? String(data.foreground) : '';
        }
    } catch (e) { if (el('levelForeground')) el('levelForeground').value = data.foreground ? String(data.foreground) : ''; }

    el('playerRow').value = data.playerStart?.row ?? DEFAULT_LEVEL.playerStart.row;
    el('playerCol').value = data.playerStart?.col ?? DEFAULT_LEVEL.playerStart.col;

    // background select + enabled
    el('levelBackground').value = data.background ? String(data.background) : '';
    if (el('showBackground')) el('showBackground').checked = data.backgroundEnabled !== undefined ? !!data.backgroundEnabled : true;
    if (el('autoGridFromBg')) el('autoGridFromBg').checked = true;
    if (el('rainEnabled')) el('rainEnabled').checked = !!data.rain?.enabled;
    if (el('rainIntensity')) el('rainIntensity').value = data.rain?.intensity ?? 1;
    if (el('rainFrequency')) el('rainFrequency').value = data.rain?.frequency ?? 180;
    if (el('rainWind')) el('rainWind').value = data.rain?.wind ?? 0;
    if (el('rainDirection')) el('rainDirection').value = data.rain?.direction ?? 'down';
    if (el('rainInterval')) el('rainInterval').value = data.rain?.interval ?? 5;
    if (el('rainDuration')) el('rainDuration').value = data.rain?.duration ?? 0;

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

    const knownKeys = new Set([
        'id', 'map', 'playerStart', 'staticRocks', 'dynamicBoulders', 'speed', 'escapeRoute',
        'objectiveLabel', 'enemies', 'collectibles', 'traps', 'spawnPoints', 'timeLimit',
        'scoreRules', 'light', 'ghost', 'bat', 'ghostSpeed', 'batSpeed'
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
        let src = '';
        const sel = it.querySelector('select.bg-src');
        if (sel) {
            const v = String(sel.value || '').trim();
            src = v ? `images/${v}` : '';
        } else {
            src = String(it.querySelector('.bg-src')?.value || '').trim();
        }
        if (!src) return; // skip empty
        const factor = parseNumber(it.querySelector('.bg-factor')?.value, 1.0);
        const alpha = parseNumber(it.querySelector('.bg-alpha')?.value, 1.0);
        layers.push({ src, parallaxBgFactor: factor, parallaxBgAlpha: alpha });
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
        let src = '';
        const sel = it.querySelector('select.fg-src');
        if (sel) {
            const v = String(sel.value || '').trim();
            src = v ? `images/${v}` : '';
        } else {
            src = String(it.querySelector('.fg-src')?.value || '').trim();
        }
        if (!src) return;
        const factor = parseNumber(it.querySelector('.fg-factor')?.value, 1.0);
        const alpha = parseNumber(it.querySelector('.fg-alpha')?.value, 1.0);
        layers.push({ src, parallaxFgFactor: factor, parallaxFgAlpha: alpha });
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
        const factor = layer?.parallaxBgFactor ?? 1.0;
        const alpha = layer?.parallaxBgAlpha ?? 1.0;
        const elRow = createBgLayerElement(src, factor, alpha, idx);
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
        const factor = layer?.parallaxFgFactor ?? 1.0;
        const alpha = layer?.parallaxFgAlpha ?? 1.0;
        container.appendChild(createFgLayerElement(src, factor, alpha, idx));
    });
}

function createBgLayerElement(src, factor, alpha, idx) {
    const wrapper = document.createElement('div');
    wrapper.className = 'bg-layer';
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = '30px 1fr 60px 60px 40px';
    wrapper.style.gap = '6px';
    wrapper.style.marginBottom = '6px';
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
        // set value from src (strip images/ prefix if present)
        const current = String(src || '').replace(/^images\//, '');
        if (current) try { sel.value = current; } catch (e) {}
        inp = sel;
    } else {
        inp = document.createElement('input'); inp.className = 'bg-src'; inp.placeholder = 'src (es. images/bg_10.png)'; inp.value = src || '';
    }
    const f = document.createElement('input'); f.className = 'bg-factor'; f.type = 'number'; f.step = '0.1'; f.value = String(factor);
    const a = document.createElement('input'); a.className = 'bg-alpha'; a.type = 'number'; a.step = '0.05'; a.value = String(alpha);
    const del = document.createElement('button'); del.type = 'button'; del.textContent = '✖'; del.title = 'Rimuovi'; del.addEventListener('click', () => { wrapper.remove(); });

    wrapper.appendChild(radio);
    wrapper.appendChild(inp); wrapper.appendChild(f); wrapper.appendChild(a); wrapper.appendChild(del);
    return wrapper;
}

function createFgLayerElement(src, factor, alpha, idx) {
    const wrapper = document.createElement('div');
    wrapper.className = 'fg-layer';
    wrapper.style.display = 'grid';
    wrapper.style.gridTemplateColumns = '1fr 60px 60px 40px';
    wrapper.style.gap = '6px';
    wrapper.style.marginBottom = '6px';
    let inp;
    const masterSelect = el('fgImageSelect');
    if (masterSelect) {
        const sel = document.createElement('select'); sel.className = 'fg-src'; sel.style.width = '100%';
        Array.from(masterSelect.options).forEach((o) => {
            const opt = document.createElement('option'); opt.value = o.value; opt.textContent = o.textContent; sel.appendChild(opt);
        });
        const current = String(src || '').replace(/^images\//, '');
        if (current) try { sel.value = current; } catch (e) {}
        inp = sel;
    } else {
        inp = document.createElement('input'); inp.className = 'fg-src'; inp.placeholder = 'src (es. images/foreground2.png)'; inp.value = src || '';
    }
    const f = document.createElement('input'); f.className = 'fg-factor'; f.type = 'number'; f.step = '0.1'; f.value = String(factor);
    const a = document.createElement('input'); a.className = 'fg-alpha'; a.type = 'number'; a.step = '0.05'; a.value = String(alpha);
    const del = document.createElement('button'); del.type = 'button'; del.textContent = '✖'; del.title = 'Rimuovi'; del.addEventListener('click', () => { wrapper.remove(); });

    wrapper.appendChild(inp); wrapper.appendChild(f); wrapper.appendChild(a); wrapper.appendChild(del);
    return wrapper;
}

function ensureBgHeader() {
    const container = el('bgLayersContainer');
    if (!container) return;
    if (container.querySelector('.bg-header')) return;
    const header = document.createElement('div');
    header.className = 'bg-header';
    header.style.display = 'grid';
    header.style.gridTemplateColumns = '30px 1fr 60px 60px 40px';
    header.style.gap = '6px';
    header.style.marginBottom = '6px';
    const h0 = document.createElement('div'); h0.textContent = ''; h0.style.color = '#9fb8df';
    const h1 = document.createElement('div'); h1.textContent = 'Image'; h1.style.color = '#9fb8df';
    const h2 = document.createElement('div'); h2.textContent = 'Factor'; h2.style.color = '#9fb8df';
    const h3 = document.createElement('div'); h3.textContent = 'Alpha'; h3.style.color = '#9fb8df';
    const h4 = document.createElement('div'); h4.textContent = '';
    header.appendChild(h0); header.appendChild(h1); header.appendChild(h2); header.appendChild(h3); header.appendChild(h4);
    container.appendChild(header);
}

function ensureFgHeader() {
    const container = el('fgLayersContainer');
    if (!container) return;
    if (container.querySelector('.fg-header')) return;
    const header = document.createElement('div');
    header.className = 'fg-header';
    header.style.display = 'grid';
    header.style.gridTemplateColumns = '1fr 60px 60px 40px';
    header.style.gap = '6px';
    header.style.marginBottom = '6px';
    const h1 = document.createElement('div'); h1.textContent = 'Image'; h1.style.color = '#9fb8df';
    const h2 = document.createElement('div'); h2.textContent = 'Fac'; h2.style.color = '#9fb8df';
    const h3 = document.createElement('div'); h3.textContent = 'Alp'; h3.style.color = '#9fb8df';
    const h4 = document.createElement('div'); h4.textContent = '';
    header.appendChild(h1); header.appendChild(h2); header.appendChild(h3); header.appendChild(h4);
    container.appendChild(header);
}

function bindUI() {
    const applyGridBtn = el('applyGridBtn');
    const clearGridBtn = el('clearGridBtn');
    const exportBtn = el('exportBtn');
    const copyJsonBtn = el('copyJsonBtn');
    const saveLocalBtn = el('saveLocalBtn');
    const loadLocalBtn = el('loadLocalBtn');
    const importJsonFile = el('importJsonFile');

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
        'dbDirections', 'dbSizes', 'dbSplitRange', 'dbMaxSplitGen', 'extraRootJson'
    ];

    // include rain controls for realtime preview updates
    realtimeFields.push('rainEnabled', 'rainIntensity', 'rainFrequency', 'rainWind', 'rainDirection', 'rainInterval', 'rainDuration');

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
        if (vol) vol.addEventListener('input', () => { try { audio.volume = parseFloat(vol.value) || 0; } catch (e) {} });
    } catch (e) { /* ignore music UI errors */ }
    
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

    // background select and toggle
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
    // auto-grid-from-background toggle
    const autoGridChk = el('autoGridFromBg');
    if (autoGridChk) {
        autoGridChk.addEventListener('change', () => {
            const scene = getScene();
            scene?.updateEditorBackgroundImage?.();
            drawMiniMapPreview(scene);
        });
    }
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
    sections.forEach((sec) => {
        const h2 = sec.querySelector('h2');
        if (!h2) return;
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
        // default: expanded
        sec.classList.remove('collapsed');
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
    try {
        const addBg = el('addBgLayerBtn');
        if (addBg) addBg.addEventListener('click', () => {
            const container = el('bgLayersContainer');
            if (!container) return;
            ensureBgHeader();
            container.appendChild(createBgLayerElement('', 1.0, 1.0, Date.now()));
        });
    } catch (e) {}
    try {
        const addFg = el('addFgLayerBtn');
        if (addFg) addFg.addEventListener('click', () => {
            const container = el('fgLayersContainer');
            if (!container) return;
            ensureFgHeader();
            container.appendChild(createFgLayerElement('', 1.0, 1.0, Date.now()));
        });
    } catch (e) {}
    try {
        const addBgFrom = el('addBgFromSelectBtn');
        const bgSelect = el('bgImageSelect');
        if (addBgFrom && bgSelect) addBgFrom.addEventListener('click', () => {
            const val = String(bgSelect.value || '').trim();
            if (!val) return;
            const container = el('bgLayersContainer');
            if (!container) return;
            ensureBgHeader();
            container.appendChild(createBgLayerElement(`images/${val}`, 1.0, 1.0, Date.now()));
        });
    } catch (e) {}
    try {
        const addFgFrom = el('addFgFromSelectBtn');
        const fgSelect = el('fgImageSelect');
        if (addFgFrom && fgSelect) addFgFrom.addEventListener('click', () => {
            const val = String(fgSelect.value || '').trim();
            if (!val) return;
            const container = el('fgLayersContainer');
            if (!container) return;
            ensureFgHeader();
            container.appendChild(createFgLayerElement(`images/${val}`, 1.0, 1.0, Date.now()));
        });
    } catch (e) {}
});

// Build left DOM palette inside #domPalette-* containers. Creates simple accordion groups
function buildDomPalette() {
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
    try {
        if (objectsContainer) objectsContainer.style.display = 'block';
        // also highlight the header
        const objHead = document.querySelector('.accordion h3[data-group="objects"]');
        if (objHead) objHead.style.background = '#0b2a44';
    } catch (e) { /* ignore */ }

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
        scene.updateSelectedCellInfo();
        scene.renderGrid();
        drawMiniMapPreview(scene);
        setStatus(`Token ${token} posato in ${cell.row},${cell.col}`);
    });
}
