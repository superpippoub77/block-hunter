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
    cart: 7
};

const STORAGE_KEY = 'blockHunterLevelEditorState';
const WALL_TOKEN_REGEX = /^w(\d)(\d)$/i;

const PALETTE_ITEMS = [
    { token: '-', label: 'vuoto' },
    { token: 'f', label: 'floor' },
    { token: 'h', label: 'hole1' },
    { token: 's', label: 'hole2' },
    { token: 'g', label: 'gem marker' },
    { token: 'd', label: 'door' },
    { token: 'k', label: 'key' },
    { token: 'p', label: 'pepita' },
    { token: 'b', label: 'dyn chest' },
    { token: 'c', label: 'cart' },
    { token: 'm', label: 'skeleton' },
    { token: 'ghost', label: 'ghost spawn' },
    { token: 'bat', label: 'bat spawn' },
    { token: 'w00', label: 'wall 0' },
    { token: 'w10', label: 'wall 1' },
    { token: 'w20', label: 'wall 2' },
    { token: 'w30', label: 'wall 3' },
    { token: 'w40', label: 'wall 4' },
    { token: 'w50', label: 'wall 5' },
    { token: 'w60', label: 'wall 6' }
];

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

function normalizeToken(token) {
    const raw = String(token ?? '-').trim();
    if (!raw) return '-';
    if (raw === 'w') return 'w00';
    const wallMatch = raw.match(WALL_TOKEN_REGEX);
    if (wallMatch) {
        const frame = clamp(Number(wallMatch[1]), 0, 6);
        const rot = ((Number(wallMatch[2]) % 4) + 4) % 4;
        return `w${frame}${rot}`;
    }
    return raw;
}

function rotateWallToken(token, delta) {
    const normalized = normalizeToken(token);
    const match = normalized.match(WALL_TOKEN_REGEX);
    if (!match) return normalized;
    const frame = Number(match[1]);
    const rot = ((Number(match[2]) + delta) % 4 + 4) % 4;
    return `w${frame}${rot}`;
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
        this.gridAreaWidth = 920;
        this.gridAreaHeight = 820;
        this.cells = [];
        this.selectedCell = null;
        this.paletteItems = [];
        this.lastBrushToken = 'w00';
    }

    preload() {
        this.load
            .spritesheet('tiles', 'images/tiles.png', { frameWidth: 64, frameHeight: 64 })
            .spritesheet('wall_tiles', 'images/wall.png', { frameWidth: 64, frameHeight: 64 })
            .spritesheet('objects', 'images/obj_game.png', { frameWidth: 64, frameHeight: 64 })
            .spritesheet('ghost_anim', 'images/ghost.png', { frameWidth: 64, frameHeight: 64 })
            .spritesheet('bat_anim', 'images/batpng.png', { frameWidth: 64, frameHeight: 64 });
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

        window.__levelEditorScene = this;
        window.dispatchEvent(new CustomEvent('level-editor-ready'));
    }

    resetGrid(cols, rows) {
        this.cols = clamp(Math.floor(cols), 4, 40);
        this.rows = clamp(Math.floor(rows), 4, 40);
        this.cellSize = clamp(Math.floor(Math.min(this.gridAreaWidth / this.cols, this.gridAreaHeight / this.rows)), 20, 64);

        this.cells = Array.from({ length: this.rows }, () => Array.from({ length: this.cols }, () => ({
            base: '-',
            reveal: null
        })));
        this.selectedCell = null;
        this.renderGrid();
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
    }

    createPalette() {
        this.paletteLayer.removeAll(true);
        this.paletteItems = [];

        const startX = 980;
        const startY = 34;
        const colCount = 2;
        const spacingX = 175;
        const spacingY = 68;

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

            const box = this.add.rectangle(0, 0, 160, 58, 0x102449, 0.95).setStrokeStyle(1, 0x2b4f86, 1);
            const iconContainer = this.add.container(-53, 0);
            this.addTokenVisual(iconContainer, item.token, 0, 0, 34);
            const label = this.add.text(-25, -8, `${item.token}`, {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#ffffff'
            });
            const subLabel = this.add.text(-25, 10, item.label, {
                fontFamily: 'monospace',
                fontSize: '10px',
                color: '#98b6e8'
            });

            const container = this.add.container(x, y, [box, iconContainer, label, subLabel]);
            container.setSize(160, 58);
            container.setData('token', normalizeToken(item.token));
            container.setData('originX', x);
            container.setData('originY', y);

            container.setInteractive(new Phaser.Geom.Rectangle(-80, -29, 160, 58), Phaser.Geom.Rectangle.Contains);
            this.input.setDraggable(container);

            container.on('pointerdown', () => {
                this.lastBrushToken = container.getData('token');
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

    tokenToRenderInfo(token) {
        const normalized = normalizeToken(token);
        const wallMatch = normalized.match(WALL_TOKEN_REGEX);
        if (wallMatch) {
            return {
                kind: 'wall',
                frame: Number(wallMatch[1]),
                rot: Number(wallMatch[2])
            };
        }

        switch (normalized) {
            case '-': return { kind: 'empty' };
            case 'f': return { kind: 'tile', texture: 'tiles', frame: 3 };
            case 'h': return { kind: 'tile', texture: 'tiles', frame: 1 };
            case 's': return { kind: 'tile', texture: 'tiles', frame: 5 };
            case 'g': return { kind: 'obj', frame: OBJECT_FRAMES.gem };
            case 'd': return { kind: 'obj', frame: OBJECT_FRAMES.door };
            case 'k': return { kind: 'obj', frame: OBJECT_FRAMES.key };
            case 'p': return { kind: 'obj', frame: OBJECT_FRAMES.pepita };
            case 'b': return { kind: 'obj', frame: OBJECT_FRAMES.dynamite_chest };
            case 'c': return { kind: 'obj', frame: OBJECT_FRAMES.cart };
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
            wall.setAngle(info.rot * 90);
            container.add(wall);
            return;
        }

        if (info.kind === 'obj') {
            const floor = this.add.sprite(x, y, 'tiles', 3);
            floor.setScale(scale);
            floor.setAlpha(0.45);
            const obj = this.add.sprite(x, y, 'objects', info.frame);
            obj.setScale(scale * 0.9);
            container.add(floor);
            container.add(obj);
            return;
        }

        if (info.kind === 'ghost') {
            const floor = this.add.sprite(x, y, 'tiles', 3);
            floor.setScale(scale);
            floor.setAlpha(0.45);
            const ghost = this.add.sprite(x, y, 'ghost_anim', 0);
            ghost.setScale(scale * 0.9);
            container.add(floor);
            container.add(ghost);
            return;
        }

        if (info.kind === 'bat') {
            const floor = this.add.sprite(x, y, 'tiles', 3);
            floor.setScale(scale);
            floor.setAlpha(0.45);
            const bat = this.add.sprite(x, y, 'bat_anim', 0);
            bat.setScale(scale * 0.9);
            container.add(floor);
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

                const bg = this.add.rectangle(cx, cy, this.cellSize - 1, this.cellSize - 1, 0x0f1f3e, 0.65)
                    .setStrokeStyle(1, 0x304f83, 0.8);
                this.gridLayer.add(bg);

                const cell = this.cells[row][col];
                this.addTokenVisual(this.gridLayer, cell.base, cx, cy, this.cellSize - 8);

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
            const s = this.add.rectangle(sx, sy, this.cellSize - 2, this.cellSize - 2, 0x4db6ff, 0.16)
                .setStrokeStyle(2, 0xffdd77, 1);
            this.selectionLayer.add(s);
        }
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
    width: 1360,
    height: 860,
    parent: 'editor-game',
    backgroundColor: '#091022',
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
            directions: String(el('dbDirections')?.value || '').split(',').map((x) => x.trim()).filter(Boolean),
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
    el('objectiveLabel').value = data.objectiveLabel ?? DEFAULT_LEVEL.objectiveLabel;
    el('lightMode').value = data.light ?? DEFAULT_LEVEL.light;
    el('escapeRoute').value = String(!!data.escapeRoute);

    el('playerRow').value = data.playerStart?.row ?? DEFAULT_LEVEL.playerStart.row;
    el('playerCol').value = data.playerStart?.col ?? DEFAULT_LEVEL.playerStart.col;

    el('srEnabled').value = String(!!staticRocks.enabled);
    el('srDynamicSize').value = staticRocks.dynamicSize === null ? 'null' : JSON.stringify(staticRocks.dynamicSize);
    el('srRotation').value = staticRocks.rotation === null ? 'null' : JSON.stringify(staticRocks.rotation);
    el('srChaotic').value = staticRocks.chaotic === null ? 'null' : JSON.stringify(staticRocks.chaotic);
    el('srShardBurstCount').value = staticRocks.shardBurstCount ?? 0;

    el('dbEnabled').value = String(!!dynamicBoulders.enabled);
    el('dbSplitOnImpact').value = String(!!dynamicBoulders.splitOnImpact);
    el('dbDirections').value = Array.isArray(dynamicBoulders.directions) ? dynamicBoulders.directions.join(',') : 'top,bottom,left,right';
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
            setStatus(`Import completato: ${file.name}`);
        } catch (error) {
            setStatus(`Errore import: ${error.message}`, true);
        } finally {
            target.value = '';
        }
    });
}

window.addEventListener('level-editor-ready', () => {
    applyLevelToForm(DEFAULT_LEVEL);
    const scene = getScene();
    if (scene) {
        scene.loadFromJson(DEFAULT_LEVEL);
    }
    bindUI();
    setStatus('Editor pronto.');
});
