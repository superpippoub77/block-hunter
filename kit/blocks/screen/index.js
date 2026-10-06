// SpikeCode screen runtime: one generic Phaser scene that plays a screen designed in the
// screen editor (data/screens/<id>.json): background, images, texts, shapes, widgets, with a
// timeline (when each item appears / disappears) and effects from kit/core/effects.js.
//
//   const AttractScene = createScreenScene(services, { key: 'AttractScene', id: 'attract',
//                                                      src: 'data/screens/attract.json' });
//
// Screen JSON (see kit/README.md for the full format):
//   { id, width, height, duration, loop, timeout: { after, event },
//     background: { color, image, src, fit, overlay }, music: { key, volume },
//     items: [ { id, name, type: 'image'|'text'|'rect'|'widget', x, y, width, height, scale,
//                rotation, alpha, flipX, flipY, depth, in, out, effects: [...],
//                key|src (image) · text, textKey, font, fontSize, color, stroke... (text)
//                fill, fillAlpha, radius (rect) · widget, props (widget) } ] }
//
// Leaving the screen: widgets and the timeout emit events ("start", "idle", ...) and the game
// manifest maps them to scenes (kitFlow.next(screenId, event, default)).
//
// Editor mode: scene.start(key, { def, editor: true }) shows the screen without input or
// timeouts; the editor moves the time with scene.seek(t) and reads scene.itemObjects.

import { itemStateAt, ACTIONS, effectParams } from '../../core/effects.js';
import { WIDGETS, widgetProps } from '../../core/widgets.js';

export function createScreenScene(services, opts) {
    const { Phaser, CONFIG, GAME_STATE, TRANSLATIONS, GAME_FONT, kitFlow, playLoopAudioSafely, loadTranslations } = services;
    const sceneKey = opts.key;
    const screenId = opts.id;
    const jsonKey = `screen_${screenId}`;

    return class ScreenScene extends Phaser.Scene {
        constructor() {
            super(sceneKey);
        }

        init(data) {
            this.editorMode = !!data?.editor;
            this.injectedDef = data?.def || null;
            this.onReady = data?.onReady || null;
        }

        preload() {
            if (!this.injectedDef && opts.src && !this.cache.json.exists(jsonKey)) {
                this.load.json(jsonKey, opts.src);
            }
        }

        create() {
            this.def = this.injectedDef || this.cache.json.get(jsonKey) || { items: [] };
            // images referenced by path: load what is missing, then build
            const missing = [];
            const want = (key, src) => { if (src && !this.textures.exists(key)) missing.push([key, src]); };
            if (this.def.background?.src) want(this.bgKey(this.def.background.src), this.def.background.src);
            (this.def.items || []).forEach((it) => { if (it.type === 'image' && it.src && !it.key) want(this.imgKey(it.src), it.src); });
            if (missing.length) {
                missing.forEach(([k, s]) => this.load.image(k, s));
                this.load.once('complete', () => this.build());
                this.load.start();
            } else {
                this.build();
            }
        }

        bgKey(src) { return `screenimg_${src}`; }
        imgKey(src) { return `screenimg_${src}`; }

        tr(key, fallback) {
            const t = TRANSLATIONS?.[GAME_STATE.language] || {};
            const v = t[key];
            if (Array.isArray(v)) return v.join('\n');
            return (typeof v === 'string' && v) ? v : fallback;
        }

        design() {
            return { width: Number(this.def.width) || Number(CONFIG.width) || 800, height: Number(this.def.height) || Number(CONFIG.height) || 600 };
        }

        build() {
            const d = this.design();
            this.children.removeAll(true);
            this.itemObjects = new Map();
            this.widgets = new Map();
            this.elapsed = 0;
            this._lastT = -1;
            this._left = false;

            // the screen is designed at width x height: fit it into the game view
            const cam = this.cameras.main;
            const fit = () => {
                const w = this.scale.width, h = this.scale.height;
                cam.setZoom(Math.min(w / d.width, h / d.height));
                cam.centerOn(d.width / 2, d.height / 2);
            };
            fit();
            this.scale.on('resize', fit);
            this.events.once('shutdown', () => this.scale.off('resize', fit));

            // background
            const bg = this.def.background || {};
            this.add.rectangle(d.width / 2, d.height / 2, d.width, d.height, Phaser.Display.Color.HexStringToColor(bg.color || '#000000').color, 1).setDepth(-1000);
            const bgTex = bg.image || (bg.src ? this.bgKey(bg.src) : null);
            if (bgTex && this.textures.exists(bgTex)) {
                const img = this.add.image(d.width / 2, d.height / 2, bgTex).setDepth(-999);
                const fw = img.width || 1, fh = img.height || 1;
                const mode = bg.fit || 'cover';
                const k = mode === 'contain' ? Math.min(d.width / fw, d.height / fh) : Math.max(d.width / fw, d.height / fh);
                if (mode === 'stretch') img.setDisplaySize(d.width, d.height); else img.setScale(k);
            }
            if (Number(bg.overlay) > 0) this.add.rectangle(d.width / 2, d.height / 2, d.width, d.height, 0x000000, Number(bg.overlay)).setDepth(-998);

            // optional language reset when the screen starts (the attract mode returns to its default language)
            if (!this.editorMode && this.def.language) GAME_STATE.language = this.def.language;

            // music (stops the gameplay music like the old scenes did)
            if (!this.editorMode) {
                try { const gm = this.sound.get('game_bgm'); if (gm && gm.isPlaying) gm.stop(); } catch (e) { }
                if (this.def.music?.key) {
                    try { playLoopAudioSafely(this, this.def.music.key, Number(this.def.music.volume) || 0.35); } catch (e) { }
                }
            }

            const ctx = {
                services,
                font: GAME_FONT,
                editor: this.editorMode,
                tr: (k, f) => this.tr(k, f),
                emit: (event) => this.leave(event),
                resetTimeout: () => { this._timeoutStart = this.elapsed; },
                refreshTexts: () => this.refreshTexts()
            };
            this.widgetCtx = ctx;
            (this.def.items || []).forEach((item, i) => this.createItem(item, i, ctx));

            this._timeoutStart = 0;
            if (!this.editorMode && this.def.loadDictionary !== false) {
                try { loadTranslations(GAME_STATE.language, () => { if (this.sys.isActive()) this.refreshTexts(); }); } catch (e) { }
            }
            this.applyTime(0, true);
            if (typeof this.onReady === 'function') this.onReady(this);
        }

        createItem(item, index, ctx) {
            let obj = null;
            if (item.type === 'image') {
                const key = item.key || (item.src ? this.imgKey(item.src) : null);
                if (!key || !this.textures.exists(key)) return;
                obj = this.add.image(0, 0, key, item.frame ?? undefined);
                if (Number(item.width) > 0 && Number(item.height) > 0) obj.setDisplaySize(Number(item.width), Number(item.height));
                obj.setFlip(!!item.flipX, !!item.flipY);
            } else if (item.type === 'text') {
                obj = this.add.text(0, 0, this.itemText(item), {
                    fontFamily: item.font || GAME_FONT,
                    fontSize: `${Number(item.fontSize) || 24}px`,
                    color: item.color || '#ffffff',
                    stroke: item.stroke || '#000000',
                    strokeThickness: Number(item.strokeThickness ?? 4),
                    align: item.align || 'center',
                    wordWrap: Number(item.wrap) > 0 ? { width: Number(item.wrap) } : undefined
                });
                obj.__fullText = obj.text;
            } else if (item.type === 'rect') {
                const fill = Phaser.Display.Color.HexStringToColor(item.fill || '#000000').color;
                obj = this.add.rectangle(0, 0, Number(item.width) || 100, Number(item.height) || 60, fill, item.fillAlpha == null ? 0.6 : Number(item.fillAlpha));
                if (item.strokeColor) obj.setStrokeStyle(Number(item.strokeWidth) || 2, Phaser.Display.Color.HexStringToColor(item.strokeColor).color, 1);
            } else if (item.type === 'widget') {
                const def = WIDGETS[item.widget];
                if (!def) return;
                const w = def.create(this, { ...item, props: widgetProps(item) }, ctx);
                obj = w.obj;
                this.widgets.set(item, w);
            }
            if (!obj) return;
            if (obj.setOrigin) obj.setOrigin(0.5);
            obj.setDepth(Number(item.depth) || index);
            obj.__baseScaleX = obj.scaleX;
            obj.__baseScaleY = obj.scaleY;
            obj.__item = item;
            this.itemObjects.set(item, obj);
        }

        itemText(item) {
            const raw = item.textKey ? this.tr(item.textKey, item.text || item.textKey) : (item.text || '');
            // placeholders: {score} {credits} {lives} {level} {hiscore}
            return String(raw).replace(/\{(\w+)\}/g, (m, k) => {
                if (k === 'hiscore') return String(GAME_STATE.topScores?.[0]?.score ?? 0);
                if (k === 'level') return String((Number(GAME_STATE.currentLevel) || 0) + 1);
                const v = GAME_STATE[k];
                return v == null ? m : String(v);
            });
        }

        refreshTexts() {
            this.itemObjects?.forEach((obj, item) => {
                if (item.type === 'text') { obj.__fullText = this.itemText(item); obj.setText(obj.__fullText); }
            });
            this.widgets?.forEach((w) => { try { w.refresh && w.refresh(); } catch (e) { } });
        }

        /** Shows the screen at time t (used by the editor timeline) */
        seek(t) {
            this.elapsed = Math.max(0, Number(t) || 0);
            this.applyTime(this.elapsed, true);
        }

        screenTime(elapsed) {
            const dur = Number(this.def.duration) || 0;
            return (this.def.loop && dur > 0) ? elapsed % dur : elapsed;
        }

        applyTime(elapsed, silent = false) {
            const t = this.screenTime(elapsed);
            const d = this.design();
            this.itemObjects?.forEach((obj, item) => {
                const s = itemStateAt(item, t, d);
                if (!s) { obj.setVisible(false); return; }
                obj.setVisible(true);
                obj.setPosition(s.x, s.y);
                obj.setScale(obj.__baseScaleX * s.scaleX, obj.__baseScaleY * s.scaleY);
                obj.setAngle(s.angle);
                obj.setAlpha(Math.max(0, Math.min(1, s.alpha)));
                if (obj.setTint) { if (s.tint != null) obj.setTint(s.tint); else obj.clearTint(); }
                if (item.type === 'text' && obj.__fullText != null) {
                    const n = Math.ceil(obj.__fullText.length * Math.max(0, Math.min(1, s.visibleChars)));
                    const shown = obj.__fullText.slice(0, n);
                    if (obj.text !== shown) obj.setText(shown);
                }
                if (item.type === 'text' && /\{\w+\}/.test(item.text || '') && !silent) {
                    const full = this.itemText(item);
                    if (full !== obj.__fullText) { obj.__fullText = full; }
                }
                const w = this.widgets.get(item);
                if (w && w.update) { try { w.update(t); } catch (e) { } }
            });
            // one-shot actions crossed since the previous frame (never while scrubbing in the editor)
            if (!silent && !this.editorMode) {
                const prev = this._lastT;
                (this.def.items || []).forEach((item) => (item.effects || []).forEach((fx) => {
                    const act = ACTIONS[fx.name];
                    if (!act) return;
                    const at = (Number(item.in) || 0) + (Number(fx.at) || 0);
                    const crossed = prev < 0 ? t >= at && at === 0 : (prev <= t ? (at > prev && at <= t) : (at > prev || at <= t));
                    if (crossed) act.run(this, { params: effectParams(fx) });
                }));
            }
            this._lastT = t;
        }

        update(time, delta) {
            if (!this.itemObjects || this.editorMode || this._left) return;
            this.elapsed += delta;
            this.applyTime(this.elapsed);
            const to = this.def.timeout;
            if (to && Number(to.after) > 0 && this.elapsed - this._timeoutStart >= Number(to.after)) {
                this.leave(to.event || 'timeout');
            }
        }

        leave(event) {
            if (this.editorMode || this._left) return;
            const target = kitFlow.next(screenId, event, this.def.events?.[event]);
            if (!target) return;
            this._left = true;
            try { if (this.def.music?.key && this.def.music.stopOnLeave !== false) this.sound.get(this.def.music.key)?.stop(); } catch (e) { }
            this.scene.start(target);
        }
    };
}
