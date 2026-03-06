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
    pepita: 11,
    wall: 12,
    hole1: 13,
    hole2: 14,
    explosion: 15,
    cart: 7,
    helmet: 3
};

const STORAGE_KEY = 'blockHunterLevelEditorState';
const WALL_TOKEN_REGEX = /^w(\d)(\d)(\d)([hv0])$/i;

// Available numeric level backgrounds discovered from images/level<N>.png
const AVAILABLE_BG_LEVELS = [1,2,3,4,5,6];

const BASE_PALETTE_ITEMS = [
    { token: '-', label: 'vuoto (-)' },
    { token: '.', label: 'vuoto (.)' },
    { token: '#', label: 'vuoto (#)' },
    // tiles
    { token: 'f', label: 'floor (f)' },
    { token: 'h', label: 'hole1 (h)' },
    { token: 's', label: 'hole2 / sand (s)' },
    // objects
    { token: 'g', label: 'gem (g)' },
    { token: 'd', label: 'door (d)' },
    { token: 'k', label: 'key (k)' },
    { token: 'p', label: 'pepita / gem pickup (p)' },
    { token: 'l', label: 'cuore / life (l)' },
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
        this.gridOffsetX = 18;
        this.gridOffsetY = 18;
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
        this.cameras.main.setBackgroundColor('#091022');

        this.gridLayer = this.add.container(0, 0);
        this.paletteLayer = this.add.container(0, 0);
        this.selectionLayer = this.add.container(0, 0);

        this.resetGrid(this.cols, this.rows);
        this.createPalette();
        this.setupInputHandlers();
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
        const val = String(el('levelBackground')?.value ?? '').trim();
        const key = this.getBackgroundKeyFromValue(val);

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

        this.cellSize = clamp(Math.floor(Math.min(this.gridAreaWidth / this.cols, this.gridAreaHeight / this.rows)), 20, 64);

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
                container.setPosition(dragX, dragY);
            });

            container.on('dragend', (pointer) => {
                const cell = this.getGridCellFromPointer(pointer.worldX, pointer.worldY);
                if (cell) {
                    this.selectedCell = cell;
                    this.placeToken(cell.col, cell.row, container.getData('token'));
                    this.updateSelectedCellInfo();
                    this.renderGrid();
                }
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
            return drawMiniMapFrame(scene, ctx, 'tiles', 3, x, y, size, { alpha: opts.alpha });
        case 'h':
            return drawMiniMapFrame(scene, ctx, 'tiles', 1, x, y, size, { alpha: opts.alpha });
        case '.':
            return drawMiniMapFrame(scene, ctx, 'tiles', 1, x, y, size, { alpha: opts.alpha });
        case 's':
            return drawMiniMapFrame(scene, ctx, 'tiles', 5, x, y, size, { alpha: opts.alpha });
        case 'g':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.gem, x, y, size, { alpha: opts.alpha });
        case 'd':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.door, x, y, size, { alpha: opts.alpha });
        case 'k':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.key, x, y, size, { alpha: opts.alpha });
        case 'p':
            return drawMiniMapFrame(scene, ctx, 'objects', OBJECT_FRAMES.pepita, x, y, size, { alpha: opts.alpha });
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

    // draw background image in preview if enabled
    const showBg = !!el('showBackground')?.checked;
    const bgVal = String(el('levelBackground')?.value ?? '').trim();
    if (showBg && bgVal) {
        // map bgVal to texture key like in editor
        let bgKey = null;
        if (/^\d+$/.test(bgVal)) {
            const k = `game_bg_${bgVal}`;
            bgKey = scene.textures.exists(k) ? k : null;
        } else if (scene.textures.exists(bgVal)) {
            bgKey = bgVal;
        } else if (scene.textures.exists('game_bg')) {
            bgKey = 'game_bg';
        }
        if (bgKey) {
            // attempt to draw the full background covering the preview area
            const frame = scene?.textures?.getFrame(bgKey, 0);
            const sourceImage = frame?.source?.image;
            if (frame && sourceImage) {
                ctx.drawImage(sourceImage, 0, 0, width, height);
            }
        }
    }

    const rows = scene.rows || 1;
    const cols = scene.cols || 1;
    const cell = Math.max(2, Math.floor(Math.min(width / cols, height / rows)));
    const mapW = cell * cols;
    const mapH = cell * rows;
    const offX = Math.floor((width - mapW) / 2);
    const offY = Math.floor((height - mapH) / 2);

    ctx.fillStyle = '#060d1f';
    ctx.fillRect(0, 0, width, height);

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cellData = scene.cells?.[row]?.[col];
            const base = cellData?.base || '-';
            const reveal = cellData?.reveal;

            const x = offX + col * cell;
            const y = offY + row * cell;
            ctx.fillStyle = '#0f1f3e';
            ctx.fillRect(x, y, cell, cell);

            const rendered = drawMiniMapToken(scene, ctx, base, x, y, cell);
            if (!rendered) {
                ctx.fillStyle = tokenToMiniMapColor(base);
                ctx.fillRect(x, y, cell, cell);
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
    const bgEl = el('levelBackground');
    if (bgEl && bgEl.options) {
        const selected = Array.from(bgEl.options).filter(o => o.selected).map(o => (o.value === '' ? null : (/^\d+$/.test(o.value) ? Number(o.value) : o.value)));
        const real = selected.filter(v => v !== null);
        if (real.length === 1) level.background = real[0];
        else if (real.length > 1) level.background = real;
    }

    // foreground (optional) can be single or multiple
    const fgEl = el('levelForeground');
    if (fgEl && fgEl.options) {
        const selectedF = Array.from(fgEl.options).filter(o => o.selected).map(o => (o.value === '' ? null : o.value));
        const realF = selectedF.filter(v => v !== null);
        if (realF.length === 1) level.foreground = realF[0];
        else if (realF.length > 1) level.foreground = realF;
    }

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
            const parsed = JSON.parse(text);
            applyLevelToForm(parsed);
            const scene = getScene();
            scene?.loadFromJson(parsed);
            scene?.updateEditorBackgroundImage?.();
            setStatus(`Import completato: ${file.name}`);
        } catch (error) {
            setStatus(`Errore import: ${error.message}`, true);
        } finally {
            target.value = '';
        }
    });

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
    bindUI();
    drawMiniMapPreview(scene);
    setStatus('Editor pronto.');
});
