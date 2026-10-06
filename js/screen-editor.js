// SpikeCode screen editor: designs the screens of the game (attract, instructions, top ten,
// level select...) as data/screens/<id>.json. The preview is the game's own screen runtime
// (kit/blocks/screen) in editor mode, so what you see is what the game plays.

import { listEffects, EFFECTS, ACTIONS, effectParams, EASINGS } from '../kit/core/effects.js';
import { WIDGETS, listWidgets, widgetProps } from '../kit/core/widgets.js';
import { createScreenScene } from '../kit/blocks/screen/index.js';
import { kitFlow, configureKit } from '../kit/core/flow.js';
import { loadTranslations as loadTranslationsBase } from '../kit/core/i18n.js';
import { createLanguageCarousel } from '../kit/blocks/language/index.js';
import { isFreeplayEnabled, hasStartAccessForPlayers, consumeCreditsForPlayers } from '../kit/core/coins.js';

const APP_VERSION = '1.0';
const APP_RELEASE = 'Ott 2026';
const DESIGN = { width: 800, height: 600 };

// Images and sounds the game preloads (module/preloadUtils.js): usable by key in the screens
const TEXTURES = {
    title: 'assets/images/common/title.png',
    explorer: 'assets/images/common/explorer.png',
    title_explosion: 'assets/images/common/title_explosion.png',
    bg: 'assets/images/common/attract_bg.png',
    game_bg_1: 'assets/images/common/level1.png',
    game_bg_2: 'assets/images/common/level2.png',
    game_bg_3: 'assets/images/common/level3.png',
    game_bg_4: 'assets/images/common/level4.png',
    game_bg_5: 'assets/images/common/level5.png'
};
const AUDIO_KEYS = ['intro_bgm', 'game_bgm', 'coin_sfx', 'select_sfx', 'explosion_sfx', 'gem_sfx', 'gameover_sfx', 'level_completed_sfx', 'stone_sfx', 'step_sfx'];
const FONTS = ['"Press Start 2P"', 'Silkscreen', 'Inter', 'IBM Plex Mono', 'monospace', 'serif'];
const BASE_SCENES = ['AttractScene', 'TopTenScene', 'CreditsScene', 'ConfigScene', 'LevelSelectScene', 'GameScene', 'BonusScene', 'GameOverScene'];

// ------------------------------------------------------------------ utilities
const $ = (s, root = document) => root.querySelector(s);
const h = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
        if (k === 'class') e.className = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (v === true) e.setAttribute(k, '');
        else if (v !== false && v != null) e.setAttribute(k, v);
    });
    children.flat().forEach((c) => { if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return e;
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
const fmt = (ms) => `${(Math.max(0, ms) / 1000).toFixed(2)} s`;
const snap = (v, step = 50) => Math.round(v / step) * step;
function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}
function setStatus(msg, error = false) {
    const s = $('#statusText');
    if (!s) return;
    s.textContent = msg;
    s.style.color = error ? '#e5604d' : '#59b97c';
    s.title = msg;
}
async function api(path, opts = {}) {
    const res = await fetch(path, { cache: 'no-store', ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

// ------------------------------------------------------------------ state
const S = {
    id: null,           // current screen id (file name)
    def: null,          // screen JSON being edited
    sel: null,          // selected item (object inside def.items)
    selFx: null,        // selected effect of the selected item
    t: 0,               // timeline time (ms)
    playing: false,
    dirty: false,
    history: [],
    future: [],
    screens: [],
    manifest: null,
    manifestDirty: false,
    scene: null,
    images: []          // { key?, src?, label, url }
};

const CONFIG = {};
const GAME_STATE = { language: 'it', credits: 0, topScores: [], players: 1 };
const TRANSLATIONS = {};
const logger = { trace() { }, debug() { }, info() { }, warn() { }, error() { } };
const services = {
    Phaser: window.Phaser,
    CONFIG, GAME_STATE, TRANSLATIONS,
    GAME_FONT: '"Press Start 2P"',
    kitFlow,
    loadTranslations: (lang, cb) => loadTranslationsBase(lang, TRANSLATIONS, logger, cb),
    playLoopAudioSafely: () => { },
    createLanguageCarousel,
    isFreeplayEnabled: () => isFreeplayEnabled(CONFIG),
    hasStartAccessForPlayers: (p) => hasStartAccessForPlayers(CONFIG, GAME_STATE, p),
    consumeCreditsForPlayers: (p) => consumeCreditsForPlayers(CONFIG, GAME_STATE, p),
    resetGameStateForNewRun: () => { }
};

// ------------------------------------------------------------------ history
function pushHistory() {
    if (!S.def) return;
    S.history.push(JSON.stringify(S.def));
    if (S.history.length > 100) S.history.shift();
    S.future.length = 0;
    markDirty();
}
function restoreSnapshot(json) {
    const selIndex = S.sel ? S.def.items.indexOf(S.sel) : -1;
    S.def = JSON.parse(json);
    S.sel = selIndex >= 0 ? (S.def.items[selIndex] || null) : null;
    S.selFx = null;
    rebuild();
    renderAll();
}
function undo() {
    if (!S.history.length) return toast('Niente da annullare');
    S.future.push(JSON.stringify(S.def));
    restoreSnapshot(S.history.pop());
    markDirty();
}
function redo() {
    if (!S.future.length) return toast('Niente da ripetere');
    S.history.push(JSON.stringify(S.def));
    restoreSnapshot(S.future.pop());
    markDirty();
}
function markDirty(on = true) {
    S.dirty = on;
    const b = $('#btnReady');
    if (b) {
        b.textContent = on ? '● Modifiche non salvate' : '✓ Salvato';
        b.classList.toggle('ready', !on);
        b.classList.toggle('warn', on);
    }
}

// ------------------------------------------------------------------ preview (Phaser)
const EditScreen = createScreenScene(services, { key: 'EditScreen', id: 'editor' });

class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    preload() {
        Object.entries(TEXTURES).forEach(([k, src]) => this.load.image(k, src));
        this.load.spritesheet('flags', 'assets/images/common/flags.png', { frameWidth: 64, frameHeight: 32 });
        this.load.on('progress', (p) => { const t = $('#editorLoadingText'); if (t) t.textContent = `Caricamento immagini del gioco… ${Math.round(p * 100)}%`; });
    }
    create() { bootReady(); }
}

const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'screenCanvas',
    width: DESIGN.width,
    height: DESIGN.height,
    backgroundColor: '#000000',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, EditScreen]
});

function rebuild() {
    if (!S.def) return;
    const sc = game.scene.getScene('EditScreen');
    const data = { def: S.def, editor: true, onReady: onSceneReady };
    if (sc && sc.sys.isActive()) sc.scene.restart(data);
    else game.scene.start('EditScreen', data);
}
let rebuildTimer = null;
function rebuildSoon() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 120); }

function onSceneReady(scene) {
    S.scene = scene;
    scene.seek(S.t);
    scene.overlay = scene.add.graphics().setDepth(1e6);
    bindCanvas(scene);
    drawOverlay();
    $('#editorLoading')?.classList.add('hidden');
}

function refreshFrame() {
    if (S.scene && S.scene.sys.isActive() && S.scene.itemObjects) {
        S.scene.seek(S.t);
        drawOverlay();
    }
    renderPlayhead();
    $('#tlTime').textContent = `${fmt(S.t)} / ${fmt(timelineLength())}`;
}

// ------------------------------------------------------------------ canvas: select, move, scale, rotate
const HANDLE = 7;
function itemBox(item) {
    const obj = S.scene?.itemObjects?.get(item);
    if (obj && obj.visible) {
        const b = obj.getBounds();
        return { x: b.x, y: b.y, w: b.width, h: b.height, visible: true };
    }
    const size = item.type === 'widget' ? (WIDGETS[item.widget]?.size || { width: 120, height: 60 }) : { width: Number(item.width) || 120, height: Number(item.height) || 60 };
    const k = Number(item.scale ?? 1) || 1;
    return { x: item.x - size.width * k / 2, y: item.y - size.height * k / 2, w: size.width * k, h: size.height * k, visible: false };
}
function handlesOf(b) {
    return [
        { kind: 'scale', x: b.x, y: b.y }, { kind: 'scale', x: b.x + b.w, y: b.y },
        { kind: 'scale', x: b.x, y: b.y + b.h }, { kind: 'scale', x: b.x + b.w, y: b.y + b.h },
        { kind: 'rotate', x: b.x + b.w / 2, y: b.y - 24 }
    ];
}
function drawOverlay() {
    const g = S.scene?.overlay;
    if (!g) return;
    g.clear();
    if (!S.sel) return;
    const b = itemBox(S.sel);
    g.lineStyle(2, 0xc9973f, b.visible ? 1 : 0.5);
    g.strokeRect(b.x, b.y, b.w, b.h);
    g.lineBetween(b.x + b.w / 2, b.y, b.x + b.w / 2, b.y - 24);
    handlesOf(b).forEach((hd) => {
        g.fillStyle(hd.kind === 'rotate' ? 0xc9973f : 0xe9e6df, 1);
        if (hd.kind === 'rotate') g.fillCircle(hd.x, hd.y, HANDLE);
        else { g.fillRect(hd.x - HANDLE / 2, hd.y - HANDLE / 2, HANDLE, HANDLE); g.lineStyle(1, 0x17181a, 1); g.strokeRect(hd.x - HANDLE / 2, hd.y - HANDLE / 2, HANDLE, HANDLE); }
    });
}
function pickItem(x, y) {
    const objs = [...(S.scene?.itemObjects || new Map()).entries()]
        .filter(([, o]) => o.visible)
        .sort((a, b) => b[1].depth - a[1].depth);
    for (const [item, o] of objs) {
        if (o.getBounds().contains(x, y)) return item;
    }
    return null;
}
function bindCanvas(scene) {
    let drag = null;
    scene.input.on('pointerdown', (p) => {
        const x = p.worldX, y = p.worldY;
        if (S.sel) {
            const b = itemBox(S.sel);
            const hit = handlesOf(b).find((hd) => Math.hypot(hd.x - x, hd.y - y) <= HANDLE + 3);
            if (hit) {
                pushHistory();
                const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
                drag = { kind: hit.kind, cx, cy, d0: Math.hypot(x - cx, y - cy) || 1, scale0: Number(S.sel.scale ?? 1) || 1 };
                return;
            }
        }
        const item = pickItem(x, y);
        select(item);
        if (item) {
            pushHistory();
            drag = { kind: 'move', x0: x, y0: y, ix: Number(item.x) || 0, iy: Number(item.y) || 0 };
        }
    });
    scene.input.on('pointermove', (p) => {
        if (!drag || !p.isDown || !S.sel) return;
        const x = p.worldX, y = p.worldY, shift = !!p.event?.shiftKey;
        if (drag.kind === 'move') {
            let nx = drag.ix + (x - drag.x0), ny = drag.iy + (y - drag.y0);
            if (shift) { nx = Math.round(nx / 10) * 10; ny = Math.round(ny / 10) * 10; }
            S.sel.x = Math.round(nx); S.sel.y = Math.round(ny);
        } else if (drag.kind === 'scale') {
            const k = Math.max(0.05, drag.scale0 * Math.hypot(x - drag.cx, y - drag.cy) / drag.d0);
            S.sel.scale = Math.round(k * 100) / 100;
        } else if (drag.kind === 'rotate') {
            let deg = Phaser.Math.RadToDeg(Math.atan2(y - drag.cy, x - drag.cx)) + 90;
            deg = shift ? Math.round(deg / 15) * 15 : Math.round(deg);
            if (deg > 180) deg -= 360;
            S.sel.rotation = deg;
        }
        refreshFrame();
        renderItemPanel(true);
    });
    const end = () => { if (drag) { drag = null; renderItemList(); renderJson(); } };
    scene.input.on('pointerup', end);
    scene.input.on('pointerupoutside', end);
}

// drop images from the palette onto the preview
function bindStageDrop() {
    const stage = $('#screenStage');
    stage.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('application/x-spike-image')) { e.preventDefault(); stage.classList.add('over'); } });
    stage.addEventListener('dragleave', (e) => { if (e.target === stage) stage.classList.remove('over'); });
    stage.addEventListener('drop', (e) => {
        stage.classList.remove('over');
        const raw = e.dataTransfer.getData('application/x-spike-image');
        if (!raw) return;
        e.preventDefault();
        const img = JSON.parse(raw);
        const canvas = $('#screenCanvas canvas');
        const r = canvas.getBoundingClientRect();
        const x = Math.round((e.clientX - r.left) * DESIGN.width / r.width);
        const y = Math.round((e.clientY - r.top) * DESIGN.height / r.height);
        addItem({ type: 'image', ...(img.key ? { key: img.key } : { src: img.src }), x, y, name: img.label });
    });
}

// ------------------------------------------------------------------ items
function uniqueId(base) {
    const ids = new Set((S.def.items || []).map((i) => i.id));
    let n = 1, id = base;
    while (ids.has(id)) id = `${base}${++n}`;
    return id;
}
function addItem(partial) {
    if (!S.def) return;
    pushHistory();
    const base = { in: Math.max(0, snap(S.t)), effects: [], x: DESIGN.width / 2, y: DESIGN.height / 2 };
    const item = { ...base, ...partial };
    item.id = uniqueId(item.id || item.widget || item.type);
    item.name = item.name || ({ text: 'Testo', image: 'Immagine', rect: 'Rettangolo' }[item.type] || WIDGETS[item.widget]?.label || item.type);
    S.def.items = S.def.items || [];
    S.def.items.push(item);
    S.sel = item;
    rebuild();
    renderAll();
    showPanelTab('item');
    setStatus(`Aggiunto: ${item.name}`);
}
const addText = () => addItem({ type: 'text', text: 'NUOVO TESTO', fontSize: 28, color: '#ffffff', strokeThickness: 5, effects: [{ name: 'fadeIn', at: 0, duration: 400 }] });
const addRect = () => addItem({ type: 'rect', width: 300, height: 80, fill: '#000000', fillAlpha: 0.6, strokeColor: '#c9973f', strokeWidth: 2 });
const addWidget = (w) => addItem({ type: 'widget', widget: w, props: {} });

function select(item) {
    S.sel = item || null;
    S.selFx = null;
    drawOverlay();
    renderItemList();
    renderTimeline();
    renderItemPanel();
    renderEffectsPanel();
    const info = $('#selInfo');
    if (info) info.textContent = item ? `${item.name || item.id} · ${Math.round(item.x)}, ${Math.round(item.y)}` : '';
    const st = $('#statusSel');
    if (st) st.textContent = item ? `Selezionato: ${item.name || item.id}` : 'Nessuna selezione';
}
function deleteSelected() {
    if (!S.sel) return;
    pushHistory();
    S.def.items = S.def.items.filter((i) => i !== S.sel);
    S.sel = null;
    rebuild();
    renderAll();
}
function duplicateSelected() {
    if (!S.sel) return;
    const copy = clone(S.sel);
    copy.id = undefined;
    copy.name = `${S.sel.name || S.sel.id} (copia)`;
    copy.x = (Number(copy.x) || 0) + 20;
    copy.y = (Number(copy.y) || 0) + 20;
    addItem(copy);
}
function moveSelected(dir) {
    if (!S.sel) return;
    const arr = S.def.items, i = arr.indexOf(S.sel), j = i + dir;
    if (j < 0 || j >= arr.length) return;
    pushHistory();
    [arr[i], arr[j]] = [arr[j], arr[i]];
    if (arr[i].depth != null || arr[j].depth != null) {
        const di = arr[i].depth, dj = arr[j].depth;
        arr[i].depth = dj; arr[j].depth = di;
        if (arr[i].depth == null) delete arr[i].depth;
        if (arr[j].depth == null) delete arr[j].depth;
    }
    rebuild();
    renderAll();
}

// ------------------------------------------------------------------ timeline
function itemEnd(item) {
    if (item.out != null && item.out !== '') return Number(item.out);
    return null;
}
function timelineLength() {
    let end = Number(S.def?.duration) || 0;
    (S.def?.items || []).forEach((it) => {
        end = Math.max(end, Number(it.in) || 0, itemEnd(it) || 0);
        (it.effects || []).forEach((fx) => {
            const p = effectParams(fx);
            end = Math.max(end, (Number(it.in) || 0) + (Number(fx.at) || 0) + (Number(p.duration) || 0));
        });
    });
    return Math.max(8000, Math.ceil((end + 2000) / 1000) * 1000);
}
const pxPerMs = () => (Number($('#tlZoom')?.value) || 70) / 1000;
function fxKind(fx) { return (EFFECTS[fx.name] || ACTIONS[fx.name])?.kind || 'loop'; }
function fxLabel(fx) { return (EFFECTS[fx.name] || ACTIONS[fx.name])?.label || fx.name; }

function renderTimeline() {
    if (!S.def) return;
    const L = timelineLength(), k = pxPerMs(), width = Math.ceil(L * k) + 40;
    const ruler = $('#tlRuler');
    ruler.style.width = `${width}px`;
    ruler.innerHTML = '';
    const step = k > 0.12 ? 500 : 1000;
    for (let t = 0; t <= L; t += step) {
        const major = t % 1000 === 0;
        ruler.append(h('div', { class: `tl-tick${major ? '' : ' minor'}`, style: `left:${t * k}px` }, major ? `${t / 1000}s` : ''));
    }
    if (Number(S.def.duration) > 0) ruler.append(h('div', { class: 'tl-end', style: `left:${S.def.duration * k}px`, title: 'Fine della schermata (durata)' }));
    const rows = $('#tlRows');
    rows.innerHTML = '';
    (S.def.items || []).forEach((item) => {
        const fxs = item.effects || [];
        const rowH = Math.max(34, 22 + fxs.length * 14);
        const tin = Number(item.in) || 0, tout = itemEnd(item);
        const track = h('div', { class: 'tl-track', style: `width:${width}px;height:${rowH}px` });
        const bar = h('div', {
            class: `tl-bar${tout == null ? ' open-end' : ''}`,
            style: `left:${tin * k}px;width:${Math.max(6, ((tout ?? L) - tin) * k)}px`,
            title: `Visibile da ${fmt(tin)} ${tout == null ? 'fino alla fine' : `a ${fmt(tout)}`} · trascina per spostare, bordi per cambiare inizio/fine, doppio clic sul bordo destro = fino alla fine`
        }, h('span', { class: 'h l' }), h('span', { class: 'h r' }));
        bar.addEventListener('pointerdown', (e) => startTimelineDrag(e, item, e.target.classList.contains('l') ? 'in' : e.target.classList.contains('r') ? 'out' : 'bar'));
        bar.querySelector('.h.r').addEventListener('dblclick', () => { pushHistory(); delete item.out; afterTimelineChange(); });
        track.append(bar);
        fxs.forEach((fx, i) => {
            const p = effectParams(fx);
            const kind = fxKind(fx);
            const at = tin + (Number(fx.at) || 0);
            let dur = Number(p.duration) || 0;
            if (kind === 'loop' && !dur) dur = (tout ?? L) - at;
            const chip = h('div', {
                class: `tl-fx k-${kind}${S.selFx === fx ? ' sel' : ''}`,
                style: `left:${at * k}px;width:${Math.max(8, dur * k)}px;top:${18 + i * 14}px`,
                title: `${fxLabel(fx)} · da ${fmt(at)}${dur ? ` per ${fmt(dur)}` : ''}`
            }, kind === 'action' ? '' : fxLabel(fx), kind === 'action' ? null : h('span', { class: 'h r' }));
            chip.addEventListener('pointerdown', (e) => { e.stopPropagation(); S.selFx = fx; startTimelineDrag(e, item, e.target.classList.contains('r') ? 'fxDur' : 'fx', fx); });
            track.append(chip);
        });
        track.addEventListener('pointerdown', (e) => { if (e.target === track) { select(item); setTimeFromEvent(e); } });
        const row = h('div', { class: `tl-row${S.sel === item ? ' active' : ''}` },
            h('div', { class: 'tl-label', title: item.name || item.id, onclick: () => select(item) }, itemIcon(item), ' ', item.name || item.id),
            track);
        rows.append(row);
    });
    renderPlayhead();
}
function renderPlayhead() {
    const ph = $('#tlPlayhead'), body = $('#tlBody');
    if (!ph || !body) return;
    const labelW = $('.tl-corner')?.offsetWidth || 160;
    ph.style.left = `${labelW + S.t * pxPerMs()}px`;
    ph.style.height = `${body.scrollHeight}px`;
}
function setTimeFromEvent(e) {
    const ruler = $('#tlRuler');
    const r = ruler.getBoundingClientRect();
    S.t = Math.max(0, Math.round((e.clientX - r.left) / pxPerMs()));
    refreshFrame();
}
function startTimelineDrag(e, item, kind, fx = null) {
    e.preventDefault();
    if (S.sel !== item) select(item);
    if (fx) { S.selFx = fx; renderEffectsPanel(); showPanelTab('effects'); }
    pushHistory();
    const x0 = e.clientX, k = pxPerMs();
    const tin0 = Number(item.in) || 0, tout0 = itemEnd(item);
    const p0 = fx ? effectParams(fx) : null;
    const at0 = fx ? Number(fx.at) || 0 : 0, dur0 = fx ? Number(p0.duration) || 0 : 0;
    const move = (ev) => {
        const dt = snap((ev.clientX - x0) / k);
        if (kind === 'bar') {
            item.in = Math.max(0, tin0 + dt);
            if (tout0 != null) item.out = Math.max(item.in + 50, tout0 + (item.in - tin0));
        } else if (kind === 'in') {
            item.in = Math.max(0, Math.min(tin0 + dt, (tout0 ?? Infinity) - 50));
        } else if (kind === 'out') {
            item.out = Math.max(tin0 + 50, (tout0 ?? timelineLength()) + dt);
        } else if (kind === 'fx') {
            fx.at = Math.max(0, at0 + dt);
        } else if (kind === 'fxDur') {
            fx.duration = Math.max(0, dur0 + dt);
        }
        renderTimeline();
        refreshFrame();
    };
    const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        afterTimelineChange();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
}
function afterTimelineChange() {
    renderTimeline();
    renderItemPanel();
    renderEffectsPanel();
    renderItemList();
    renderJson();
    refreshFrame();
}
function bindTimeline() {
    $('#tlRuler').addEventListener('pointerdown', (e) => {
        setTimeFromEvent(e);
        const move = (ev) => setTimeFromEvent(ev);
        const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
    });
    $('#tlZoom').addEventListener('input', () => { store.set('se-tl-zoom', $('#tlZoom').value); renderTimeline(); });
    const z = store.get('se-tl-zoom'); if (z) $('#tlZoom').value = z;
    $('#tlPlay').addEventListener('click', togglePlay);
    $('#tlStart').addEventListener('click', () => { S.t = 0; refreshFrame(); });
}

// play the timeline in the preview
let lastFrame = 0;
function togglePlay() {
    S.playing = !S.playing;
    $('#tlPlay').textContent = S.playing ? '❚❚' : '▶';
    $('#tlPlay').classList.toggle('playing', S.playing);
    if (S.playing) { lastFrame = performance.now(); requestAnimationFrame(tick); }
}
function tick(now) {
    if (!S.playing) return;
    S.t += now - lastFrame;
    lastFrame = now;
    const dur = Number(S.def?.duration) || 0;
    const L = S.def?.loop && dur > 0 ? dur : timelineLength();
    if (S.t >= L) {
        if (S.def?.loop && dur > 0) S.t %= dur;
        else { S.t = L; togglePlay(); }
    }
    refreshFrame();
    requestAnimationFrame(tick);
}

// ------------------------------------------------------------------ forms
function field(label, input, title = '') {
    return [h('label', { title }, label), input];
}
function inputFor(spec, value, onChange) {
    const { type = 'text', options = [], min, max, step } = spec;
    if (type === 'select') {
        const s = h('select', {}, options.map((o) => {
            const [v, l] = Array.isArray(o) ? o : [o, o];
            return h('option', { value: v, selected: String(v) === String(value ?? '') }, l);
        }));
        s.addEventListener('change', () => onChange(s.value));
        return s;
    }
    if (type === 'checkbox') {
        const c = h('input', { type: 'checkbox' });
        c.checked = !!value;
        c.addEventListener('change', () => onChange(c.checked));
        return c;
    }
    if (type === 'textarea') {
        const t = h('textarea', { rows: 4 });
        t.value = value ?? '';
        t.addEventListener('change', () => onChange(t.value));
        return t;
    }
    if (type === 'color') {
        const c = h('input', { type: 'color' });
        c.value = /^#[0-9a-f]{6}$/i.test(String(value)) ? value : '#ffffff';
        c.addEventListener('change', () => onChange(c.value));
        return c;
    }
    const i = h('input', { type: type === 'number' ? 'number' : 'text' });
    if (min != null) i.min = min; if (max != null) i.max = max; if (step != null) i.step = step;
    i.value = value ?? '';
    i.placeholder = spec.placeholder || '';
    i.addEventListener('change', () => {
        if (type === 'number') onChange(i.value === '' ? null : Number(i.value));
        else onChange(i.value);
    });
    return i;
}
// change a value of the selected item: transform-only changes redraw, the others rebuild
const TRANSFORM_KEYS = new Set(['x', 'y', 'scale', 'rotation', 'alpha', 'in', 'out', 'name']);
function setItem(key, value, item = S.sel) {
    if (!item) return;
    pushHistory();
    if (value == null || value === '') delete item[key]; else item[key] = value;
    if (TRANSFORM_KEYS.has(key)) { refreshFrame(); renderTimeline(); renderItemList(); } else rebuildSoon();
    renderJson();
}

function itemIcon(item) {
    return { text: 'T', image: '🖼', rect: '▭', widget: '⚙' }[item.type] || '•';
}

function renderItemPanel(onlyTransform = false) {
    const box = $('#itemPanel');
    if (!box) return;
    if (onlyTransform && S.sel) {
        ['x', 'y', 'scale', 'rotation'].forEach((k) => { const i = box.querySelector(`[data-k="${k}"]`); if (i && document.activeElement !== i) i.value = S.sel[k] ?? (k === 'scale' ? 1 : 0); });
        return;
    }
    box.innerHTML = '';
    const it = S.sel;
    if (!it) {
        box.append(h('div', { class: 'empty-panel' }, 'Seleziona un elemento sulla schermata, nella lista a sinistra o nella timeline. Per aggiungerne uno usa il rail a sinistra o il menu Inserisci.'));
        return;
    }
    const grid = (...rows) => h('div', { class: 'prop-grid' }, rows.flat());
    const num = (k, label, def, step = 1) => {
        const i = inputFor({ type: 'number', step }, it[k] ?? def, (v) => setItem(k, v));
        i.dataset.k = k;
        return field(label, i);
    };
    const kind = it.type === 'widget' ? (WIDGETS[it.widget]?.label || it.widget) : ({ text: 'Testo', image: 'Immagine', rect: 'Rettangolo' }[it.type]);
    box.append(h('div', { class: 'section' },
        h('h2', {}, `${itemIcon(it)} ${kind}`),
        grid(field('Nome', inputFor({ type: 'text' }, it.name || '', (v) => setItem('name', v)))),
        h('div', { class: 'btn-row', style: 'grid-template-columns:repeat(4,1fr)' },
            h('button', { type: 'button', onclick: duplicateSelected, title: 'Duplica (Ctrl+D)' }, '⧉ Duplica'),
            h('button', { type: 'button', onclick: () => moveSelected(1), title: 'Porta davanti' }, '▲ Avanti'),
            h('button', { type: 'button', onclick: () => moveSelected(-1), title: 'Porta dietro' }, '▼ Dietro'),
            h('button', { type: 'button', onclick: deleteSelected, title: 'Elimina (Canc)' }, '✕ Elimina'))));
    box.append(h('div', { class: 'section' }, h('h2', {}, 'Posizione'),
        grid(num('x', 'X', 400), num('y', 'Y', 300), num('scale', 'Scala', 1, 0.05), num('rotation', 'Rotazione (°)', 0), num('alpha', 'Opacità', 1, 0.05))));
    box.append(h('div', { class: 'section' }, h('h2', {}, 'Tempo'),
        grid(num('in', 'Compare a (ms)', 0, 50),
            field('Sparisce a (ms)', inputFor({ type: 'number', step: 50, placeholder: 'fino alla fine' }, it.out ?? '', (v) => setItem('out', v)))),
        h('p', { class: 'hint' }, 'Puoi anche trascinare la barra dell\'elemento nella timeline. Gli effetti partono dall\'istante in cui l\'elemento compare.')));

    if (it.type === 'image') {
        const keyOpts = [['', '— file —'], ...Object.keys(TEXTURES).map((k) => [k, k])];
        box.append(h('div', { class: 'section' }, h('h2', {}, 'Immagine'),
            grid(field('Immagine del gioco', inputFor({ type: 'select', options: keyOpts }, it.key || '', (v) => { pushHistory(); if (v) { it.key = v; delete it.src; } else delete it.key; rebuildSoon(); renderItemPanel(); renderJson(); })),
                field('oppure file', inputFor({ type: 'text', placeholder: 'assets/images/…' }, it.src || '', (v) => { pushHistory(); if (v) { it.src = v; delete it.key; } else delete it.src; rebuildSoon(); renderJson(); })),
                num('width', 'Larghezza (0 = originale)', 0), num('height', 'Altezza (0 = originale)', 0),
                field('Specchia ↔', inputFor({ type: 'checkbox' }, it.flipX, (v) => setItem('flipX', v || null))),
                field('Specchia ↕', inputFor({ type: 'checkbox' }, it.flipY, (v) => setItem('flipY', v || null))))));
    } else if (it.type === 'text') {
        const dict = TRANSLATIONS[GAME_STATE.language] || {};
        const keyOpts = [['', '— testo fisso —'], ...Object.keys(dict).sort().map((k) => [k, k])];
        box.append(h('div', { class: 'section' }, h('h2', {}, 'Testo'),
            grid(field('Testo', inputFor({ type: 'textarea' }, it.text || '', (v) => setItem('text', v)), 'Segnaposto: {score} {credits} {lives} {level} {hiscore}'),
                field('Dal dizionario', inputFor({ type: 'select', options: keyOpts }, it.textKey || '', (v) => setItem('textKey', v)), 'Se scelto, il testo cambia con la lingua'),
                field('Carattere', inputFor({ type: 'select', options: FONTS }, it.font || FONTS[0], (v) => setItem('font', v))),
                num('fontSize', 'Dimensione', 24), field('Colore', inputFor({ type: 'color' }, it.color || '#ffffff', (v) => setItem('color', v))),
                field('Contorno', inputFor({ type: 'color' }, it.stroke || '#000000', (v) => setItem('stroke', v))), num('strokeThickness', 'Spessore contorno', 4),
                field('Allineamento', inputFor({ type: 'select', options: [['center', 'centro'], ['left', 'sinistra'], ['right', 'destra']] }, it.align || 'center', (v) => setItem('align', v))),
                num('wrap', 'A capo dopo (px, 0 = no)', 0))));
    } else if (it.type === 'rect') {
        box.append(h('div', { class: 'section' }, h('h2', {}, 'Rettangolo'),
            grid(num('width', 'Larghezza', 100), num('height', 'Altezza', 60),
                field('Colore', inputFor({ type: 'color' }, it.fill || '#000000', (v) => setItem('fill', v))), num('fillAlpha', 'Opacità riempimento', 0.6, 0.05),
                field('Bordo', inputFor({ type: 'color' }, it.strokeColor || '#c9973f', (v) => setItem('strokeColor', v))), num('strokeWidth', 'Spessore bordo', 2))));
    } else if (it.type === 'widget') {
        const def = WIDGETS[it.widget];
        const props = widgetProps(it);
        const rows = (def?.props || []).map((p) => field(p.label, inputFor(p, props[p.key], (v) => {
            pushHistory();
            it.props = it.props || {};
            it.props[p.key] = v;
            rebuildSoon();
            renderJson();
        })));
        box.append(h('div', { class: 'section' }, h('h2', {}, def?.label || it.widget), grid(...rows),
            h('p', { class: 'hint' }, 'Nell\'editor i widget non rispondono ai tasti: provali con "▶ Prova nel gioco".')));
    }
}

function renderEffectsPanel() {
    const box = $('#effectsPanel');
    if (!box) return;
    box.innerHTML = '';
    const it = S.sel;
    if (!it) { box.append(h('div', { class: 'empty-panel' }, 'Seleziona un elemento per vedere e aggiungere i suoi effetti.')); return; }
    const list = h('div', {});
    (it.effects || []).forEach((fx, i) => {
        const def = EFFECTS[fx.name] || ACTIONS[fx.name];
        const kind = def?.kind || '?';
        const params = effectParams(fx);
        const setFx = (key, v) => {
            pushHistory();
            if (key === 'at') fx.at = v ?? 0;
            else if (key === 'duration') { if (v == null) delete fx.duration; else fx.duration = v; }
            else { fx.params = fx.params || {}; fx.params[key] = v; }
            afterTimelineChange();
        };
        const rows = [field('Inizia dopo (ms)', inputFor({ type: 'number', step: 50 }, fx.at ?? 0, (v) => setFx('at', v)), 'Dall\'istante in cui l\'elemento compare')];
        (def?.params || []).forEach((p) => {
            const spec = p.key === 'ease' ? { ...p, options: Object.keys(EASINGS) } : p;
            rows.push(field(p.label + (kind === 'loop' && p.key === 'duration' ? ' (0 = sempre)' : ''), inputFor(spec, params[p.key], (v) => setFx(p.key, v))));
        });
        if (kind === 'loop' && !(def?.params || []).some((p) => p.key === 'duration')) {
            rows.push(field('Durata (ms, 0 = sempre)', inputFor({ type: 'number', step: 50 }, fx.duration ?? 0, (v) => setFx('duration', v))));
        }
        const card = h('div', { class: `fx-card${S.selFx === fx ? ' sel' : ''}` },
            h('div', { class: 'fx-head' },
                h('b', {}, def?.label || fx.name), h('span', { class: `kind k-${kind}` }, kind),
                h('button', { type: 'button', title: 'Su', onclick: () => { if (i > 0) { pushHistory(); [it.effects[i - 1], it.effects[i]] = [it.effects[i], it.effects[i - 1]]; afterTimelineChange(); } } }, '↑'),
                h('button', { type: 'button', title: 'Elimina', onclick: () => { pushHistory(); it.effects.splice(i, 1); S.selFx = null; afterTimelineChange(); } }, '✕')),
            h('div', { class: 'prop-grid' }, rows.flat()));
        list.append(card);
    });
    const groups = { in: 'Entrate', out: 'Uscite', move: 'Movimenti', loop: 'Continui', action: 'Azioni' };
    const sel = h('select', {}, Object.entries(groups).map(([kind, label]) => h('optgroup', { label },
        listEffects().filter((e) => e.kind === kind).map((e) => h('option', { value: e.id }, e.label)))));
    const add = () => {
        pushHistory();
        it.effects = it.effects || [];
        const at = Math.max(0, snap(S.t - (Number(it.in) || 0)));
        const fx = { name: sel.value, at };
        it.effects.push(fx);
        S.selFx = fx;
        afterTimelineChange();
    };
    box.append(h('div', { class: 'section' }, h('h2', {}, `Effetti di "${it.name || it.id}"`),
        (it.effects || []).length ? list : h('p', { class: 'hint' }, 'Nessun effetto: l\'elemento resta fermo.'),
        h('div', { class: 'add-fx' }, sel, h('button', { type: 'button', onclick: add }, '+ Aggiungi')),
        h('p', { class: 'hint' }, 'Il nuovo effetto parte dal punto della timeline in cui ti trovi. La libreria è in kit/effects/: puoi aggiungere i tuoi effetti in custom.js.')));
}

function sceneOptions() {
    const keys = new Set([...BASE_SCENES, ...Object.keys(S.manifest?.screens || {})]);
    return [['', '—'], ...[...keys].sort().map((k) => [k, k])];
}
function setDef(path, value, rebuildAfter = true) {
    pushHistory();
    const parts = path.split('.');
    let o = S.def;
    for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
    const last = parts[parts.length - 1];
    if (value == null || value === '') delete o[last]; else o[last] = value;
    if (rebuildAfter) rebuildSoon();
    renderTimeline();
    renderJson();
    refreshFrame();
}
function renderScreenPanel() {
    const box = $('#screenPanel');
    if (!box || !S.def) return;
    box.innerHTML = '';
    const d = S.def;
    const grid = (...rows) => h('div', { class: 'prop-grid' }, rows.flat());
    const sceneKey = Object.entries(S.manifest?.screens || {}).find(([, v]) => v.id === S.id)?.[0] || '';
    box.append(h('div', { class: 'section' }, h('h2', {}, 'Schermata'),
        grid(field('File', h('code', {}, `data/screens/${S.id}.json`)),
            field('Nome', inputFor({ type: 'text' }, d.name || '', (v) => { setDef('name', v, false); renderTabs(); $('#topScreenName').value = v; })),
            field('Durata (ms)', inputFor({ type: 'number', step: 500 }, d.duration ?? 0, (v) => setDef('duration', v, false)), '0 = senza fine'),
            field('Ricomincia (loop)', inputFor({ type: 'checkbox' }, d.loop, (v) => setDef('loop', v || null, false))),
            field('Esci dopo (ms)', inputFor({ type: 'number', step: 500, placeholder: 'mai' }, d.timeout?.after ?? '', (v) => setDef('timeout.after', v, false)), 'Senza azioni del giocatore'),
            field('…con l\'evento', inputFor({ type: 'text', placeholder: 'idle' }, d.timeout?.event ?? '', (v) => setDef('timeout.event', v, false))),
            field('Lingua all\'avvio', inputFor({ type: 'select', options: [['', '(mantieni)'], 'it', 'en', 'fr', 'de', 'es', 'us', 'ja', 'zh'] }, d.language || '', (v) => setDef('language', v, false))))));
    box.append(h('div', { class: 'section' }, h('h2', {}, 'Sfondo e musica'),
        grid(field('Colore', inputFor({ type: 'color' }, d.background?.color || '#000000', (v) => setDef('background.color', v))),
            field('Immagine del gioco', inputFor({ type: 'select', options: [['', '—'], ...Object.keys(TEXTURES)] }, d.background?.image || '', (v) => setDef('background.image', v))),
            field('oppure file', inputFor({ type: 'text', placeholder: 'assets/images/…' }, d.background?.src || '', (v) => setDef('background.src', v))),
            field('Adattamento', inputFor({ type: 'select', options: [['cover', 'riempi'], ['contain', 'contieni'], ['stretch', 'deforma']] }, d.background?.fit || 'cover', (v) => setDef('background.fit', v))),
            field('Scurisci (0-1)', inputFor({ type: 'number', step: 0.05, min: 0, max: 1 }, d.background?.overlay ?? 0, (v) => setDef('background.overlay', v))),
            field('Musica', inputFor({ type: 'select', options: [['', '—'], ...AUDIO_KEYS] }, d.music?.key || '', (v) => setDef('music.key', v, false))),
            field('Volume', inputFor({ type: 'number', step: 0.05, min: 0, max: 1 }, d.music?.volume ?? 0.35, (v) => setDef('music.volume', v, false))))));
    // events → scenes
    const events = d.events || {};
    const table = h('table', { class: 'events-table' });
    const used = new Set(Object.keys(events));
    (d.items || []).forEach((it) => {
        const p = it.type === 'widget' ? widgetProps(it) : {};
        ['startEvent', 'configEvent', 'anyKeyEvent'].forEach((k) => { if (p[k]) used.add(p[k]); });
        if (it.widget === 'menu') String(p.options || '').split('\n').forEach((l) => { const ev = (l.split('|')[2] || '').trim(); if (ev) used.add(ev); });
    });
    if (d.timeout?.event) used.add(d.timeout.event);
    [...used].forEach((ev) => {
        table.append(h('tr', {}, h('td', {}, h('code', {}, ev)), h('td', {}, inputFor({ type: 'select', options: sceneOptions() }, events[ev] || '', (v) => setDef(`events.${ev}`, v, false)))));
    });
    box.append(h('div', { class: 'section' }, h('h2', {}, 'Uscite: evento → scena'), table,
        h('p', { class: 'hint' }, 'Gli eventi arrivano dai widget (comandi arcade, menu) e dal timeout. Salvando, le uscite vengono scritte anche nel manifest del gioco.')));
    box.append(h('div', { class: 'section' }, h('h2', {}, 'Nel gioco'),
        grid(field('Scena del gioco', inputFor({ type: 'text', placeholder: 'es. AttractScene' }, sceneKey, (v) => {
            const m = S.manifest; if (!m) return;
            m.screens = m.screens || {};
            Object.keys(m.screens).forEach((k) => { if (m.screens[k].id === S.id) delete m.screens[k]; });
            if (v) m.screens[v] = { id: S.id, src: `data/screens/${S.id}.json` };
            S.manifestDirty = true; markDirty();
        }), 'Il gioco usa questa schermata al posto della scena con questa chiave (vuoto = non usata)')),
        h('p', { class: 'hint' }, 'Con la chiave di una scena esistente (es. AttractScene) la schermata la sostituisce; con una chiave nuova diventa una scena in più, da collegare alle uscite delle altre schermate.')));
}

function renderJson() {
    const a = $('#jsonArea');
    if (a && document.activeElement !== a && S.def) a.value = JSON.stringify(S.def, null, 2);
}

function renderItemList() {
    const box = $('#itemList');
    if (!box || !S.def) return;
    box.innerHTML = '';
    [...(S.def.items || [])].reverse().forEach((it) => {
        const out = itemEnd(it);
        box.append(h('div', { class: `item-row${S.sel === it ? ' active' : ''}`, onclick: () => select(it), title: it.id },
            h('span', { class: 'it-icon' }, itemIcon(it)), h('span', { class: 'it-name' }, it.name || it.id),
            h('span', { class: 'it-time' }, `${((Number(it.in) || 0) / 1000).toFixed(1)}${out != null ? `–${(out / 1000).toFixed(1)}` : '→'}`)));
    });
}

function renderImagePalette() {
    const box = $('#imagePalette');
    box.innerHTML = '';
    S.images.forEach((img) => {
        const el = h('div', { class: 'img-item', draggable: 'true', title: img.label, style: `background-image:url("${img.url}")` }, h('span', {}, img.label));
        el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/x-spike-image', JSON.stringify(img)); e.dataTransfer.effectAllowed = 'copy'; });
        el.addEventListener('dblclick', () => addItem({ type: 'image', ...(img.key ? { key: img.key } : { src: img.src }), name: img.label }));
        box.append(el);
    });
}

function renderAll() {
    renderTabs();
    renderItemList();
    renderTimeline();
    renderItemPanel();
    renderEffectsPanel();
    renderScreenPanel();
    renderJson();
    refreshFrame();
    const n = $('#topScreenName'); if (n && S.def) n.value = S.def.name || S.id;
    const c = $('#curName'); if (c && S.def) c.textContent = `${S.def.name || S.id} · ${S.def.width || 800}×${S.def.height || 600}`;
    const st = $('#statusMode'); if (st) st.textContent = S.id ? `Schermata: ${S.id}` : '';
}

// ------------------------------------------------------------------ load / save
async function loadScreen(id) {
    if (S.dirty && S.def && !window.confirm('Ci sono modifiche non salvate. Cambiare schermata?')) return;
    try {
        const res = await api(`api/screens/?id=${encodeURIComponent(id)}`);
        S.id = id;
        S.def = res.data;
        S.sel = null; S.selFx = null; S.t = 0;
        S.history = []; S.future = [];
        markDirty(false);
        store.set('se-screen', id);
        rebuild();
        renderAll();
        setStatus(`Aperta: data/screens/${id}.json`);
    } catch (e) {
        setStatus(`Impossibile aprire ${id}: ${e.message}`, true);
    }
}
async function saveScreen() {
    if (!S.def || !S.id) return;
    try {
        await api(`api/screens/?id=${encodeURIComponent(S.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: S.def }) });
        // the exits of the screen are also the flow of the game
        if (S.manifest) {
            const evs = Object.fromEntries(Object.entries(S.def.events || {}).filter(([, v]) => v));
            const prev = JSON.stringify(S.manifest.flow?.[S.id] || {});
            if (Object.keys(evs).length && prev !== JSON.stringify(evs)) {
                S.manifest.flow = S.manifest.flow || {};
                S.manifest.flow[S.id] = evs;
                S.manifestDirty = true;
            }
            if (S.manifestDirty) {
                await api('api/manifest/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: S.manifest }) });
                S.manifestDirty = false;
            }
        }
        markDirty(false);
        setStatus(`Salvata: data/screens/${S.id}.json`);
        toast('Schermata salvata');
        return true;
    } catch (e) {
        setStatus(`Errore di salvataggio: ${e.message}`, true);
        return false;
    }
}
async function newScreen() {
    const raw = window.prompt('Nome del file della nuova schermata (lettere, numeri, trattini):', 'nuova-schermata');
    if (!raw) return;
    const id = raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    if (S.screens.includes(id)) { toast('Esiste già una schermata con questo nome'); return; }
    S.id = id;
    S.def = {
        id, name: raw.trim(), width: 800, height: 600, duration: 8000, loop: false,
        background: { color: '#000000', image: 'bg', fit: 'cover', overlay: 0.4 },
        events: {},
        items: [{ id: 'title', name: 'Titolo', type: 'text', text: raw.trim().toUpperCase(), x: 400, y: 120, fontSize: 34, color: '#ffd84a', strokeThickness: 6, in: 0, effects: [{ name: 'dropBounce', at: 0, duration: 700 }] }]
    };
    S.sel = null; S.history = []; S.future = []; S.t = 0;
    S.screens.push(id);
    await saveScreen();
    rebuild();
    renderAll();
}
function downloadJson() {
    if (!S.def) return;
    const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(S.def, null, 2)], { type: 'application/json' })), download: `${S.id}.json` });
    document.body.append(a); a.click(); a.remove();
}
function importJson(file) {
    const r = new FileReader();
    r.onload = () => {
        try {
            const d = JSON.parse(r.result);
            if (!d || !Array.isArray(d.items)) throw new Error('manca "items"');
            pushHistory();
            S.def = d; S.sel = null;
            rebuild(); renderAll();
            setStatus(`Importato ${file.name}: premi Salva per scriverlo in data/screens/${S.id}.json`);
        } catch (e) { setStatus(`JSON non valido: ${e.message}`, true); }
    };
    r.readAsText(file);
}
async function playInGame() {
    const key = Object.entries(S.manifest?.screens || {}).find(([, v]) => v.id === S.id)?.[0];
    if (!key) { toast('Collega prima la schermata a una scena del gioco (scheda Schermata → Nel gioco)'); showPanelTab('screen'); return; }
    if (S.dirty && !(await saveScreen())) return;
    window.open(`index.html?scene=${encodeURIComponent(key)}`, 'spikeScreenTest');
}

// ------------------------------------------------------------------ shell (same layout as the other Spike apps)
const ICON = (d, extra = '') => `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${extra}<path d="${d}"/></svg>`;
const ICONS = {
    menu: `<svg viewBox="0 0 22 22" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 6h14M4 11h14M4 16h14"/></svg>`,
    text: ICON('M5 5h12 M11 5v13 M8 18h6'),
    rect: ICON('M4 6h14v10H4z'),
    widget: ICON('M4 4h6v6H4z M12 4h6v6h-6z M4 12h6v6H4z M15 12v6 M12 15h6'),
    play: ICON('M6 4l12 7-12 7z'),
    save: ICON('M4 3h11l3 3v13H4z M7 3v5h7V3 M7 19v-6h8v6'),
    level: ICON('M3 3h16v16H3z M3 8.3h16 M3 13.7h16 M8.3 3v16 M13.7 3v16'),
    undo: ICON('M8 7L4 11l4 4 M4 11h10a4 4 0 0 1 0 8h-3'),
    pkg: ICON('M11 2l8 4.5v9L11 20l-8-4.5v-9z M3 6.5l8 4.5 8-4.5 M11 11v9')
};
const WIDGET_ICONS = { coins: '¢', arcadeControls: '⌨', language: '⚑', topTen: '★', menu: '☰', textCycle: '↻' };

function buildShell() {
    const left = $('#topbarLeft');
    const grp = (cls, ...els) => h('div', { class: `grp ${cls || ''}` }, ...els);
    const btn = (id, html, title, onClick, cls = 'iconbtn') => { const b = h('button', { type: 'button', id, class: cls, title }); b.innerHTML = html; b.addEventListener('click', onClick); return b; };
    left.append(
        grp('sidebar-grp', btn('btnSidebar', ICONS.menu, 'Comprimi o espandi la barra degli strumenti', () => toggleRail())),
        h('div', { class: 'grp brand', html: '' }),
        grp('', (() => { const i = h('input', { type: 'text', id: 'topScreenName', title: 'Nome della schermata', spellcheck: 'false' }); i.addEventListener('change', () => setDef('name', i.value, false)); return i; })()),
        grp('', btn('btnReady', '✓ Salvato', 'Stato · clic per salvare (Ctrl+S)', saveScreen)),
        h('div', { class: 'spacer' }),
        grp('', btn('btnPlayTest', '▶ Prova nel gioco', 'Salva e apri il gioco direttamente su questa schermata', playInGame),
            btn('btnHelpTop', '?', 'Guida e scorciatoie (F1)', showHelp)));
    left.querySelector('.brand').innerHTML = '<span class="brand-mark">▦</span><span class="brand-name">Spike<b>Code</b> <span class="brand-sub">Schermate</span></span>';

    const menus = [
        { label: 'File ▾', items: [
            ['＋', 'Nuova schermata…', '', newScreen],
            ['💾', 'Salva', 'Ctrl+S', saveScreen],
            ['⬇', 'Scarica JSON', '', downloadJson],
            ['⇪', 'Importa JSON…', '', () => $('#importFile').click()],
            null,
            ['▶', 'Prova nel gioco', '', playInGame],
            ['📦', 'Crea pacchetto per… (web, Windows, Linux, Android)', '', () => window.SpikePackager?.open()],
            ['▦', 'Editor dei livelli', '', () => { window.location.href = 'level_editor.html'; }]
        ] },
        { label: 'Inserisci ▾', items: [
            ['T', 'Testo', 'T', addText],
            ['▭', 'Rettangolo', 'R', addRect],
            null,
            ...listWidgets().map((w) => [WIDGET_ICONS[w.id] || '⚙', w.label, '', () => addWidget(w.id)])
        ] },
        { label: 'Modifica ▾', items: [
            ['↶', 'Annulla', 'Ctrl+Z', undo],
            ['↷', 'Ripeti', 'Ctrl+Y', redo],
            null,
            ['⧉', 'Duplica elemento', 'Ctrl+D', duplicateSelected],
            ['▲', 'Porta davanti', '', () => moveSelected(1)],
            ['▼', 'Porta dietro', '', () => moveSelected(-1)],
            ['✕', 'Elimina elemento', 'Canc', deleteSelected]
        ] },
        { label: '⋯', more: true, items: [
            ['▦', 'Editor dei livelli', '', () => { window.location.href = 'level_editor.html'; }],
            ['🎮', 'Apri il gioco', '', () => window.open('index.html', '_blank', 'noopener')],
            null,
            ['📖', 'Guida e scorciatoie', 'F1', showHelp],
            ['ℹ️', 'Informazioni', '', showAbout]
        ] }
    ];
    const bar = $('#menu');
    menus.forEach((m) => {
        const item = h('div', { class: `menu-item grp${m.more ? ' more' : ' pill'}` });
        const label = h('button', { type: 'button', class: `menu-label ${m.more ? 'iconbtn' : 'btn primary'}` }, m.label);
        const dd = h('div', { class: 'menu-dropdown', role: 'menu' });
        m.items.forEach((e) => {
            if (!e) { dd.append(h('div', { class: 'menu-dropdown-separator' })); return; }
            const [icon, text, sc, fn] = e;
            const row = h('button', { type: 'button', class: 'menu-dropdown-item' }, h('span', { class: 'mi-icon' }, icon), h('span', { class: 'mi-label' }, text), sc ? h('span', { class: 'shortcut' }, sc) : null);
            row.addEventListener('click', (ev) => { ev.stopPropagation(); closeMenus(); fn(); });
            dd.append(row);
        });
        label.addEventListener('click', (ev) => { ev.stopPropagation(); const was = item.classList.contains('active'); closeMenus(); if (!was) item.classList.add('active'); });
        item.append(label, dd);
        bar.append(item);
    });
    document.addEventListener('click', closeMenus);

    // rail
    const rail = $('#rail');
    const tool = (id, icon, label, title, fn, key = '') => {
        const b = h('button', { type: 'button', class: 'tool', id, title: title + (key ? ` (${key})` : '') });
        b.innerHTML = `${icon}<span class="tlabel">${label}</span>${key ? `<span class="kbd${key.length > 1 ? ' kbd-long' : ''}">${key}</span>` : ''}`;
        b.addEventListener('click', fn);
        rail.append(b);
    };
    const section = (t) => rail.append(h('div', { class: 'rail-title' }, t), h('div', { class: 'rail-sep' }));
    section('Inserisci');
    tool('railText', ICONS.text, 'Testo', 'Aggiungi un testo', addText, 'T');
    tool('railRect', ICONS.rect, 'Rettangolo', 'Aggiungi un rettangolo (pannello)', addRect, 'R');
    listWidgets().forEach((w) => tool(`railW_${w.id}`, `<span style="width:18px;text-align:center;font-size:15px">${WIDGET_ICONS[w.id] || '⚙'}</span>`, w.label.split(' (')[0], `Aggiungi: ${w.label}`, () => addWidget(w.id)));
    section('Schermata');
    tool('railPlay', ICONS.play, 'Riproduci', 'Riproduci la timeline', togglePlay, 'Spazio');
    tool('railSave', ICONS.save, 'Salva', 'Salva la schermata', saveScreen, 'Ctrl+S');
    tool('railUndo', ICONS.undo, 'Annulla', 'Annulla l\'ultima modifica', undo, 'Ctrl+Z');
    tool('railPackage', ICONS.pkg, 'Crea pacchetto', 'Crea il gioco per web, Windows, Linux, Android', () => window.SpikePackager?.open());
    tool('railLevels', ICONS.level, 'Editor livelli', 'Passa all\'editor dei livelli', () => { window.location.href = 'level_editor.html'; });
    const exp = store.get('se-rail-expanded');
    setRail(exp === null ? true : exp === '1');

    // right panel tabs
    const tabs = $('#panelTabs');
    document.querySelectorAll('#rightSidebar > .tabpage').forEach((p) => {
        const b = h('button', { type: 'button' }, p.dataset.label);
        b.dataset.tab = p.dataset.tab;
        b.addEventListener('click', () => showPanelTab(p.dataset.tab));
        tabs.append(b);
    });
    showPanelTab(store.get('se-tab') || 'item');

    // status bar
    $('#status').innerHTML = `
      <span id="statusMode"></span><span id="statusSel">Nessuna selezione</span>
      <span class="status" id="statusText"></span><span class="spacer"></span>
      <span class="toggle active" id="stRail" title="Mostra/nascondi gli strumenti ([)">◧ Strumenti</span>
      <span class="toggle active" id="stPanel" title="Mostra/nascondi il pannello (])">◨ Pannello</span>
      <span class="status-sign"><span class="sign-by">SpikeCode Schermate by <a href="https://www.filippomorano.com" target="_blank" rel="noopener">SpikeCode AI</a> · </span>${APP_RELEASE} · Ver: ${APP_VERSION}</span>`;
    $('#stRail').addEventListener('click', () => toggleSide('left'));
    $('#stPanel').addEventListener('click', () => toggleSide('right'));
    $('#railResizer').addEventListener('dblclick', () => toggleSide('left'));
    $('#panelResizer').addEventListener('dblclick', () => toggleSide('right'));

    // JSON tab
    $('#jsonApply').addEventListener('click', () => {
        try {
            const d = JSON.parse($('#jsonArea').value);
            pushHistory(); S.def = d; S.sel = null; rebuild(); renderAll(); setStatus('JSON applicato');
        } catch (e) { setStatus(`JSON non valido: ${e.message}`, true); }
    });
    $('#jsonRefresh').addEventListener('click', () => { $('#jsonArea').value = JSON.stringify(S.def, null, 2); });
    $('#importFile').addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; });
    $('#previewLang').addEventListener('change', (e) => {
        GAME_STATE.language = e.target.value;
        services.loadTranslations(GAME_STATE.language, () => { rebuild(); renderItemPanel(); });
    });
}
function closeMenus() { document.querySelectorAll('.menu-item.active').forEach((m) => m.classList.remove('active')); }
function setRail(expanded) {
    $('#rail').classList.toggle('expanded', expanded);
    $('#sidebar').classList.toggle('rail-compact', !expanded);
    $('#sidebar').style.width = expanded ? '230px' : '52px';
    $('#btnSidebar')?.classList.toggle('on', expanded);
    store.set('se-rail-expanded', expanded ? '1' : '0');
}
function toggleRail() { setRail(!$('#rail').classList.contains('expanded')); }
function toggleSide(pos) {
    const el = pos === 'left' ? $('#sidebar') : $('#rightSidebar');
    el.classList.toggle('hidden');
    const vis = !el.classList.contains('hidden');
    (pos === 'left' ? $('#railResizer') : $('#panelResizer')).style.display = vis ? '' : 'none';
    $(pos === 'left' ? '#stRail' : '#stPanel')?.classList.toggle('active', vis);
    setTimeout(() => { game.scale.refresh(); renderPlayhead(); }, 50);
}
function showPanelTab(id) {
    document.querySelectorAll('#rightSidebar > .tabpage').forEach((p) => p.classList.toggle('active', p.dataset.tab === id));
    document.querySelectorAll('#panelTabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    store.set('se-tab', id);
}
function renderTabs() {
    const box = $('#screenTabs');
    box.innerHTML = '';
    S.screens.forEach((id) => {
        const label = id === S.id && S.def?.name ? S.def.name : id;
        const b = h('button', { type: 'button', class: `tab${id === S.id ? ' active' : ''}`, title: `data/screens/${id}.json` }, `🎬 ${label}`);
        b.addEventListener('click', () => { if (id !== S.id) loadScreen(id); });
        box.append(b);
    });
    box.append(h('button', { type: 'button', class: 'tab', title: 'Nuova schermata', onclick: newScreen }, '＋ Nuova'));
}

function modal(title, html) {
    let ov = $('.modal-overlay');
    if (!ov) {
        ov = h('div', { class: 'modal-overlay' });
        ov.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true"><div class="modal-head"><h3></h3><button type="button" class="iconbtn" aria-label="Chiudi">✕</button></div><div class="modal-body"></div></div>';
        ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('open'); });
        ov.querySelector('.modal-head button').addEventListener('click', () => ov.classList.remove('open'));
        document.body.append(ov);
    }
    ov.querySelector('h3').textContent = title;
    ov.querySelector('.modal-body').innerHTML = html;
    ov.classList.add('open');
}
function showHelp() {
    const keys = [['Clic', 'Seleziona un elemento'], ['Trascina', 'Sposta (Shift: griglia di 10 px)'], ['Maniglie', 'Angoli = scala · tonda = ruota (Shift: 15°)'],
        ['Frecce', 'Sposta di 1 px (Shift: 10 px)'], ['Spazio', 'Riproduci / pausa'], ['Home', 'Torna all\'inizio'], ['T · R', 'Aggiungi testo · rettangolo'],
        ['Ctrl+D', 'Duplica'], ['Canc', 'Elimina'], ['Ctrl+Z / Ctrl+Y', 'Annulla / ripeti'], ['Ctrl+S', 'Salva'], ['[  ]', 'Strumenti / pannello'], ['F1', 'Questa guida']];
    modal('Guida e scorciatoie', `
      <p>Ogni schermata (attract, istruzioni, top ten, selezione livello…) è un file <code>data/screens/&lt;nome&gt;.json</code>
      che il gioco riproduce con lo stesso motore dell'anteprima. Aggiungi testi, immagini (trascinale dalla lista a sinistra),
      rettangoli e widget; nella <b>timeline</b> decidi quando ogni elemento compare e sparisce e dove partono i suoi effetti.</p>
      <p>Nella scheda <b>Schermata</b> scegli sfondo, musica, durata e le <b>uscite</b>: a quale scena porta ogni evento
      (es. <code>start</code> → LevelSelectScene). <b>▶ Prova nel gioco</b> salva e apre il gioco su questa schermata.</p>
      <table class="keys">${keys.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</table>`);
}
function showAbout() {
    modal('Informazioni', `<p><b>SpikeCode Schermate ${APP_VERSION}</b> · ${APP_RELEASE}</p>
      <p>Editor visuale delle schermate per i giochi SpikeCode: effetti in <code>kit/effects/</code>, widget in <code>kit/widgets/</code>, motore in <code>kit/blocks/screen/</code>.</p>
      <p class="hint">by <a href="https://www.filippomorano.com" target="_blank" rel="noopener">SpikeCode AI</a>. Interfaccia nello stile di SpikeCut.</p>`);
}

function bindKeys() {
    document.addEventListener('keydown', (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (e.key === 'Escape') { closeMenus(); $('.modal-overlay')?.classList.remove('open'); }
        if (e.key === 'F1') { e.preventDefault(); showHelp(); return; }
        if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveScreen(); return; }
        const typing = e.target.matches?.('input, textarea, select') || e.target.isContentEditable;
        if (typing) return;
        if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
        if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
        if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); return; }
        if (mod) return;
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
        if (e.key === ' ') { e.preventDefault(); togglePlay(); return; }
        if (e.key === 'Home') { S.t = 0; refreshFrame(); return; }
        if (e.key === '[') { toggleSide('left'); return; }
        if (e.key === ']') { toggleSide('right'); return; }
        if (e.key.toLowerCase() === 't') { addText(); return; }
        if (e.key.toLowerCase() === 'r') { addRect(); return; }
        if (S.sel && e.key.startsWith('Arrow')) {
            e.preventDefault();
            const d = e.shiftKey ? 10 : 1;
            pushHistory();
            if (e.key === 'ArrowLeft') S.sel.x -= d;
            if (e.key === 'ArrowRight') S.sel.x += d;
            if (e.key === 'ArrowUp') S.sel.y -= d;
            if (e.key === 'ArrowDown') S.sel.y += d;
            refreshFrame(); renderItemPanel(true);
        }
    });
    window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
}

// ------------------------------------------------------------------ boot
let bootDone = false;
async function bootReady() {
    if (bootDone) return;
    bootDone = true;
    try {
        const cfg = await fetch('data/config.json', { cache: 'no-store' }).then((r) => r.json());
        Object.assign(CONFIG, cfg);
    } catch (e) { }
    try {
        const scores = await fetch('data/topScores.json', { cache: 'no-store' }).then((r) => r.json());
        if (Array.isArray(scores)) GAME_STATE.topScores = scores.slice(0, 10);
    } catch (e) { }
    try { S.manifest = (await api('api/manifest/')).data; configureKit(S.manifest); } catch (e) { setStatus('Manifest del gioco non leggibile: le uscite non verranno salvate nel flusso', true); }
    await new Promise((res) => services.loadTranslations(GAME_STATE.language, res));
    // image palette: game textures + background/foreground files
    S.images = Object.entries(TEXTURES).map(([key, url]) => ({ key, label: key, url }));
    for (const kind of ['background', 'foreground']) {
        try {
            const list = await fetch(`api/images/${kind}/`, { cache: 'no-store' }).then((r) => r.json());
            (Array.isArray(list) ? list : []).forEach((src) => S.images.push({ src, label: src.split('/').pop().replace(/\.[a-z0-9]+$/i, ''), url: src }));
        } catch (e) { }
    }
    renderImagePalette();
    try { S.screens = (await api('api/screens/')).items || []; } catch (e) { S.screens = []; setStatus('Impossibile leggere l\'elenco delle schermate (api/screens)', true); }
    const first = new URLSearchParams(location.search).get('screen') || store.get('se-screen');
    const target = S.screens.includes(first) ? first : S.screens[0];
    if (target) await loadScreen(target);
    else { $('#editorLoading')?.classList.add('hidden'); renderTabs(); }
}

buildShell();
bindTimeline();
bindStageDrop();
bindKeys();
window.ScreenEditor = { S, select, addItem, addWidget, saveScreen, loadScreen, undo, redo, togglePlay, refreshFrame, game };
