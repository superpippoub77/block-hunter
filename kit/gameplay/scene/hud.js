// Interfaccia: HUD, punteggio, indicatore obiettivo.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createHudMixin(deps) {
const {
    Phaser,
    CONFIG,
    GAME_STATE,
    GAME_FONT,
    HUD_DEPTH,
    TRANSLATIONS,
    LOGGER,
    OBJECT_FRAMES,
    TILE_FRAMES,
    WALL_TILE_COLS,
    applyMappingFrameOverrides,
    isFreeplayEnabled,
    hasStartAccessForPlayers,
    consumeCreditsForPlayers,
    TILE_NATIVE_WIDTH,
    TILE_NATIVE_HEIGHT,
    OBJECT_NATIVE_SIZE,
    defaultFrame,
    PRELOAD_ASSET_MANIFEST_KEY,
    PRELOAD_ASSET_MANIFEST_PATH,
    PRELOAD_SPRITESHEET_CONFIGS,
    LOG_LEVELS,
    LOG_LEVEL_NAMES,
    normalizeLogLevel,
    readInitialLogLevel,
    inferPurposeFromName,
    getFunctionParamNames,
    inferOutputFromName,
    toDocEntry,
    buildTopLevelFunctionDocs,
    buildSceneMethodsDocs,
    chooseTraceLevel,
    instrumentSceneMethods,
    queueLegacyPreloadAssets,
    queueAssetsFromManifest,
    mergeLocalConfig,
    loadTranslations,
    clearRuntimeMatchStorage,
    resetGameStateForNewRun,
    drawTextPanel,
    getTextureMaxNumericFrame,
    playLoopAudioSafely,
    resolveContactSpec,
    LEVEL_CONFIG,
    getLevelFileName,
    getLevelMasterNumber,
    parseExitTargetLevel,
    addSpikeCredit,
    createCreditsManager,
    createLanguageCarousel,
    kitFlow
} = deps;

return class HudMixin {

    getHudResponsiveMetrics() {
        const cam = this.cameras?.main;
        const camW = (cam && cam.width) ? cam.width : (this.scale.width || CONFIG.width || 800);
        const camH = (cam && cam.height) ? cam.height : (this.scale.height || CONFIG.height || 600);
        const baseW = Number(CONFIG.width) || 800;
        const baseH = Number(CONFIG.height) || 600;
        const viewportScale = Phaser.Math.Clamp(Math.min(camW / baseW, camH / baseH), 0.62, 1.25);

        return {
            camW,
            camH,
            scoreX: Math.max(8, Math.round(10 * viewportScale)),
            topBarHeight: Math.max(28, Math.round(36 * viewportScale)),
            topHudY: Math.max(12, Math.round(18 * viewportScale)),
            bottomBarHeight: Math.max(30, Math.round(40 * viewportScale)),
            timerY: camH - Math.max(12, Math.round(16 * viewportScale)),
            labelFont: Math.max(11, Math.round(16 * viewportScale)),
            statFont: Math.max(10, Math.round(14 * viewportScale)),
            timerLabelFont: Math.max(11, Math.round(16 * viewportScale)),
            actionHintFont: Math.max(11, Math.round(14 * viewportScale)),
            actionHintY: camH - Math.max(30, Math.round(48 * viewportScale)),
            iconSize: Math.max(14, Math.round(24 * viewportScale)),
            iconGap: Math.max(2, Math.round(3 * viewportScale)),
            sectionGap: Math.max(8, Math.round(14 * viewportScale)),
            pepitaSize: Math.max(8, Math.round(12 * viewportScale)),
            pepitaGap: Math.max(1, Math.round(1.5 * viewportScale))
        };
    }

    updateDomHudVisibility() {
        try {
            const domHudRoot = document.getElementById('dom-hud');
            if (!domHudRoot) return;

            const hasTouch = (('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
            const vw = Math.max(0, window.innerWidth || 0);
            const vh = Math.max(0, window.innerHeight || 0);
            // Keep HUD readable also on small desktop windows.
            const isSmallViewport = (vw > 0 && vw <= 980) || (vh > 0 && vh <= 700);
            const shouldShowDomHud = !!hasTouch || isSmallViewport;

            if (shouldShowDomHud) {
                domHudRoot.style.display = 'flex';
                domHudRoot.removeAttribute('aria-hidden');
            } else {
                domHudRoot.style.display = 'none';
                domHudRoot.setAttribute('aria-hidden', 'true');
            }
        } catch (e) { }
    }

    createUI() {
        console.log('Creating UI with language:', GAME_STATE.language);
        const t = TRANSLATIONS[GAME_STATE.language];

        if (this.hudContainer && this.hudContainer.destroy && this.hudContainer.active) {
            this.hudContainer.destroy(true);
        }
        this.hudContainer = null;

        if (!this.hudContainer || !this.hudContainer.active) {
            this.hudContainer = this.add.container(0, 0);
        }
        this.hudContainer.setScrollFactor(0);

        const metrics = this.getHudResponsiveMetrics();
        const camW = metrics.camW;
        const camH = metrics.camH;

        // Top HUD background overlay (semi-transparent) to improve readability
        try {
            this.hudTopBg = this.add.rectangle(camW / 2, metrics.topHudY, camW, metrics.topBarHeight, 0x000000, 0.45).setOrigin(0.5, 0.5);
            this.hudContainer.add(this.hudTopBg);
        } catch (e) { this.hudTopBg = null; }

        this.scoreText = this.add.text(metrics.scoreX, 10, `${t.score_label}: ${GAME_STATE.score}`, {
            fontSize: `${metrics.labelFont}px`,
            fill: '#ffffff',
            fontFamily: GAME_FONT
        });
        this.hudContainer.add(this.scoreText);
        this.levelText = this.add.text(camW - metrics.scoreX, 10, `${t.level_label}: ${GAME_STATE.currentLevel + 1}`, {
            fontSize: `${metrics.labelFont}px`,
            fill: '#00ff00',
            fontFamily: GAME_FONT
        }).setOrigin(1, 0);
        this.hudContainer.add(this.levelText);

        // Timer pepitas: create background (full-color) icons and a disabled overlay
        // that will progressively gray out elapsed slots.
        this.timerPepitas = []; // background (full-color)
        this.timerPepitasDisabled = []; // overlay (grayed) shown for elapsed slots
        this.timerPepitasCount = 20;
        const pepitaSize = metrics.pepitaSize;
        const pepitaGap = metrics.pepitaGap;
        const pepitaY = metrics.timerY;
        const timerLabelText = t.time_label || t.time || 'TIME';
        this.timerLabel = this.add.text(metrics.scoreX, pepitaY, timerLabelText, {
            fontSize: `${metrics.timerLabelFont}px`,
            fill: '#ffffff',
            fontFamily: GAME_FONT
        }).setOrigin(0, 0.5);
        // Bottom HUD background overlay (semi-transparent) behind timer/pepitas
        try {
            this.hudBottomBg = this.add.rectangle(camW / 2, pepitaY, camW, metrics.bottomBarHeight, 0x000000, 0.45).setOrigin(0.5, 0.5);
            this.hudContainer.add(this.hudBottomBg);
        } catch (e) { this.hudBottomBg = null; }
        this.hudContainer.add(this.timerLabel);
        const timerLabelWidth = Number(this.timerLabel?.width) || 52;
        const pepitaStartX = metrics.scoreX + timerLabelWidth + 8;
        for (let i = 0; i < this.timerPepitasCount; i++) {
            // background full-color pepita
            const pepita = this.add.sprite(
                pepitaStartX + i * (pepitaSize + pepitaGap),
                pepitaY,
                'objects',
                OBJECT_FRAMES.pepita
            );
            // scale timer icons according to objectSize (pixels)
            // Note: keep existing relative sizing behaviour but applied to both layers
            const pepitaScaleFactor = (CONFIG.objectSize / OBJECT_NATIVE_SIZE) * (pepitaSize / OBJECT_NATIVE_SIZE);
            pepita.setScale(pepitaScaleFactor);
            pepita.setScrollFactor(0);
            pepita.setDepth(HUD_DEPTH - 1);
            pepita.setVisible(false);
            this.hudContainer.add(pepita);
            this.timerPepitas.push(pepita);

            // disabled overlay (tinted gray) placed above the background
            const disabled = this.add.sprite(
                pepita.x,
                pepita.y,
                'objects',
                OBJECT_FRAMES.pepita
            );
            disabled.setScale(pepitaScaleFactor);
            disabled.setScrollFactor(0);
            // tint to gray to give a "disabled" appearance and slightly lower alpha
            disabled.setTint(0x888888);
            disabled.setAlpha(0.95);
            disabled.setDepth(HUD_DEPTH);
            disabled.setVisible(false);
            this.hudContainer.add(disabled);
            this.timerPepitasDisabled.push(disabled);
        }

        this.hudContainer.setDepth(HUD_DEPTH);
        // Hide timer label initially
        this.timerLabel.setVisible(false);
        // Hide both layers initially
        this.timerPepitas.forEach((p) => p.setVisible(false));
        if (this.timerPepitasDisabled) this.timerPepitasDisabled.forEach((d) => d.setVisible(false));

        this.topStatsObjects = [];
        this.refreshHudIcons();
        // Action hint text shown when player is near a locked door and has a key
        try {
            if (!this.actionHint || !this.actionHint.destroy) {
                this.actionHint = this.add.text(camW / 2, metrics.actionHintY, '', {
                    fontSize: `${metrics.actionHintFont}px`,
                    fill: '#ffff00',
                    fontFamily: GAME_FONT,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    padding: { x: 8, y: 6 }
                }).setOrigin(0.5);
                this.actionHint.setScrollFactor(0);
                this.actionHint.setDepth(HUD_DEPTH + 1);
                this.actionHint.setVisible(false);
                this.hudContainer.add(this.actionHint);
            }
        } catch (e) { }
        this.createObjectivePointerUI();
        // Ensure HUD elements are laid out according to current camera size
        if (this.updateHudLayout) this.updateHudLayout();

        // --- DOM HUD: create or update overlay elements for responsive UI ---
        try {
            const scoreElId = 'scoreDisplay';
            const levelElId = 'levelDisplay';
            let scoreEl = document.getElementById(scoreElId);
            let levelEl = document.getElementById(levelElId);
            if (!scoreEl) {
                // fallback: create minimal DOM HUD if index.html not updated
                const domHud = document.getElementById('dom-hud') || document.createElement('div');
                domHud.id = 'dom-hud';
                document.body.appendChild(domHud);
                scoreEl = document.createElement('div');
                scoreEl.id = scoreElId;
                scoreEl.className = 'dom-hud-item';
                domHud.appendChild(scoreEl);
            }
            if (!levelEl) {
                const domHud = document.getElementById('dom-hud') || document.createElement('div');
                domHud.id = 'dom-hud';
                document.body.appendChild(domHud);
                levelEl = document.createElement('div');
                levelEl.id = levelElId;
                levelEl.className = 'dom-hud-item';
                domHud.appendChild(levelEl);
            }
            scoreEl.textContent = `${t.score_label}: ${GAME_STATE.score}`;
            levelEl.textContent = `${t.level_label}: ${GAME_STATE.currentLevel + 1}`;
            // Ensure DOM HUD is visible now that the in-game HUD has been created
            try {
                const domHudRoot = document.getElementById('dom-hud');
                if (domHudRoot) {
                    this.updateDomHudVisibility();
                }
            } catch (e) { /* noop */ }
            // Remove legacy global Phaser text objects to avoid duplicate HUD elements
            try {
                if (window.scoreText1 && typeof window.scoreText1.destroy === 'function') { window.scoreText1.destroy(); window.scoreText1 = null; }
                if (window.scoreText2 && typeof window.scoreText2.destroy === 'function') { window.scoreText2.destroy(); window.scoreText2 = null; }
                if (window.levelText && typeof window.levelText.destroy === 'function') { window.levelText.destroy(); window.levelText = null; }
                if (window.livesText1 && typeof window.livesText1.destroy === 'function') { window.livesText1.destroy(); window.livesText1 = null; }
                if (window.livesText2 && typeof window.livesText2.destroy === 'function') { window.livesText2.destroy(); window.livesText2 = null; }
            } catch (e) { /* noop */ }
        } catch (e) {
            // noop
        }
    }

    updateHudLayout() {
        const metrics = this.getHudResponsiveMetrics();
        const camW = metrics.camW;
        const camH = metrics.camH;

        if (this.scoreText) {
            this.scoreText.setPosition(metrics.scoreX, 10);
            this.scoreText.setFontSize(`${metrics.labelFont}px`);
        }
        if (this.levelText) {
            this.levelText.setX(camW - metrics.scoreX);
            this.levelText.setFontSize(`${metrics.labelFont}px`);
        }
        // reposition top HUD background
        try {
            if (this.hudTopBg) {
                this.hudTopBg.setPosition(camW / 2, metrics.topHudY);
                this.hudTopBg.setDisplaySize(camW, metrics.topBarHeight);
            }
        } catch (e) { }
        if (this.timerLabel) {
            this.timerLabel.setPosition(metrics.scoreX, metrics.timerY);
            this.timerLabel.setFontSize(`${metrics.timerLabelFont}px`);
        }
        // reposition bottom HUD background
        try {
            const pepitaY = metrics.timerY;
            if (this.hudBottomBg) {
                this.hudBottomBg.setPosition(camW / 2, pepitaY);
                this.hudBottomBg.setDisplaySize(camW, metrics.bottomBarHeight);
            }
        } catch (e) { }
        // reposition pepitas and disabled overlays
        if (this.timerPepitas && this.timerPepitas.length > 0) {
            const timerLabelWidth = Number(this.timerLabel?.width) || 52;
            const pepitaStartX = metrics.scoreX + timerLabelWidth + 8;
            const pepitaSize = metrics.pepitaSize;
            const pepitaGap = metrics.pepitaGap;
            const pepitaScaleFactor = (CONFIG.objectSize / OBJECT_NATIVE_SIZE) * (pepitaSize / OBJECT_NATIVE_SIZE);
            for (let i = 0; i < this.timerPepitas.length; i++) {
                const px = pepitaStartX + i * (pepitaSize + pepitaGap);
                const py = metrics.timerY;
                const p = this.timerPepitas[i];
                const d = this.timerPepitasDisabled[i];
                if (p) {
                    p.setPosition(px, py);
                    p.setScale(pepitaScaleFactor);
                }
                if (d) {
                    d.setPosition(px, py);
                    d.setScale(pepitaScaleFactor);
                }
            }
        }

        try {
            if (this.actionHint) {
                this.actionHint.setPosition(camW / 2, metrics.actionHintY);
                this.actionHint.setFontSize(`${metrics.actionHintFont}px`);
            }
        } catch (e) { }

        this.refreshHudIcons();
        this.updateDomHudVisibility();
    }

    createObjectivePointerUI() {
        const camera = this.cameras?.main;
        if (!camera) return;

        const centerX = camera.width - 72;
        const arrowY = camera.height - 54;

        const previousTargets = [
            this.objectivePointerArrow,
            this.objectivePointerArrowShadow,
            this.objectivePointerHalo,
            this.objectivePointerLabel
        ].filter(Boolean);

        if (this.objectivePointerPulse) {
            try {
                if (this.objectivePointerPulse.stop) {
                    this.objectivePointerPulse.stop();
                }
            } catch (e) {
                // ignore stale tween state
            }
            this.objectivePointerPulse = null;
        }

        if (previousTargets.length > 0 && this.tweens && this.tweens.killTweensOf) {
            try {
                this.tweens.killTweensOf(previousTargets);
            } catch (e) {
                // ignore if tween manager already disposed target internals
            }
        }

        if (this.objectivePointerArrow && this.objectivePointerArrow.destroy) {
            this.objectivePointerArrow.destroy();
        }
        if (this.objectivePointerArrowShadow && this.objectivePointerArrowShadow.destroy) {
            this.objectivePointerArrowShadow.destroy();
        }
        if (this.objectivePointerHalo && this.objectivePointerHalo.destroy) {
            this.objectivePointerHalo.destroy();
        }
        if (this.objectivePointerLabel && this.objectivePointerLabel.destroy) {
            this.objectivePointerLabel.destroy();
        }

        this.objectivePointerHalo = this.add.circle(centerX, arrowY, 42, 0x000000, 0.18)
            .setDepth(4998)
            .setScrollFactor(0);

        this.objectivePointerArrowShadow = this.add.triangle(
            centerX + 2,
            arrowY + 2,
            0, 0,
            54, 22,
            0, 44,
            0x000000,
            0.38
        ).setOrigin(0.5).setDepth(4999).setScrollFactor(0);

        this.objectivePointerArrow = this.add.triangle(
            centerX,
            arrowY,
            0, 0,
            50, 20,
            0, 40,
            0xffe36b,
            0.48
        ).setOrigin(0.5).setDepth(5000).setScrollFactor(0);

        this.objectivePointerLabel = this.add.text(centerX, arrowY - 24, 'GEM', {
            fontSize: '13px',
            fill: '#fff2b3',
            fontFamily: GAME_FONT,
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(5000).setScrollFactor(0).setAlpha(0.55);

        this.objectivePointerPulse = this.tweens.add({
            targets: [this.objectivePointerArrow, this.objectivePointerArrowShadow, this.objectivePointerHalo, this.objectivePointerLabel],
            scaleX: { from: 0.98, to: 1.04 },
            scaleY: { from: 0.98, to: 1.04 },
            duration: 560,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                if (this.objectivePointerHalo && this.objectivePointerHalo.active && this.objectivePointerArrow && this.objectivePointerArrow.active) {
                    const alphaPulse = 0.12 + ((this.objectivePointerArrow.scaleX - 0.98) / 0.06) * 0.1;
                    this.objectivePointerHalo.setAlpha(Phaser.Math.Clamp(alphaPulse, 0.1, 0.22));
                }
            }
        });
    }

    getNearestPoint(originX, originY, points) {
        if (!Array.isArray(points) || points.length === 0) return null;
        let nearest = null;
        let nearestDistSq = Number.POSITIVE_INFINITY;

        for (const point of points) {
            if (!point) continue;
            const px = Number(point.x);
            const py = Number(point.y);
            if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
            const dx = px - originX;
            const dy = py - originY;
            const distSq = (dx * dx) + (dy * dy);
            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearest = { x: px, y: py };
            }
        }

        return nearest;
    }

    getObjectivePointerTarget() {
        const originX = Number(this.player?.x) || 0;
        const originY = Number(this.player?.y) || 0;

        if ((Number(this.gemsRemaining) || 0) > 0) {
            const activeGems = (this.gems?.children?.entries || []).filter((gem) => gem && gem.active);
            const gemTarget = this.getNearestPoint(originX, originY, activeGems);
            if (gemTarget) {
                return { type: 'gem', x: gemTarget.x, y: gemTarget.y };
            }

            if (Array.isArray(this.mapGemPositions) && this.mapGemPositions.length > 0) {
                const index = Phaser.Math.Clamp(Number(this.mapGemIndex) || 0, 0, this.mapGemPositions.length - 1);
                const nextGem = this.mapGemPositions[index];
                if (nextGem && Number.isFinite(Number(nextGem.x)) && Number.isFinite(Number(nextGem.y))) {
                    return { type: 'gem', x: Number(nextGem.x), y: Number(nextGem.y) };
                }
            }
        }

        if (this.hole2ExitsActive) {
            const activeExits = (this.hole2Exits?.children?.entries || []).filter((exitObj) => exitObj && exitObj.active);
            const exitTarget = this.getNearestPoint(originX, originY, activeExits);
            if (exitTarget) {
                return { type: 'exit', x: exitTarget.x, y: exitTarget.y };
            }

            const fallbackExit = this.getNearestPoint(originX, originY, this.hole2ExitPositions);
            if (fallbackExit) {
                return { type: 'exit', x: fallbackExit.x, y: fallbackExit.y };
            }
        }

        return null;
    }

    updateObjectivePointerUI() {
        if (!this.objectivePointerArrow || !this.objectivePointerArrow.active) return;
        if (!this.objectivePointerLabel || !this.objectivePointerLabel.active) return;
        if (!this.player || !this.player.active) return;

        const target = this.getObjectivePointerTarget();
        if (!target) {
            this.objectivePointerArrow.setVisible(false);
            if (this.objectivePointerArrowShadow) this.objectivePointerArrowShadow.setVisible(false);
            if (this.objectivePointerHalo) this.objectivePointerHalo.setVisible(false);
            this.objectivePointerLabel.setVisible(false);
            return;
        }

        this.objectivePointerArrow.setVisible(true);
        if (this.objectivePointerArrowShadow) this.objectivePointerArrowShadow.setVisible(true);
        if (this.objectivePointerHalo) this.objectivePointerHalo.setVisible(true);
        this.objectivePointerLabel.setVisible(true);
        const targetLabel = target.type === 'gem' ? 'GEM' : 'EXIT';
        if (this.objectivePointerLabel.text !== targetLabel) {
            this.objectivePointerLabel.setText(targetLabel);
        }

        const dx = target.x - this.player.x;
        const dy = target.y - this.player.y;
        const angle = Math.atan2(dy, dx);
        this.objectivePointerArrow.setRotation(angle);
        if (this.objectivePointerArrowShadow) {
            this.objectivePointerArrowShadow.setRotation(angle);
        }
    }

    showLevelObjective() {
        const objectiveLabel = this.levelData?.objectiveLabel;
        if (!objectiveLabel || typeof objectiveLabel !== 'string') return;

        const t = TRANSLATIONS[GAME_STATE.language] || {};
        const objectiveText = t[objectiveLabel] || objectiveLabel;
        if (!objectiveText || typeof objectiveText !== 'string') return;

        const x = this.cameras.main.width / 2;
        const y = 64;
        const textObj = this.add.text(x, y, objectiveText, {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: GAME_FONT,
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3,
            wordWrap: { width: Math.max(320, this.cameras.main.width - 80), useAdvancedWrap: true }
        }).setOrigin(0.5).setDepth(2100).setScrollFactor(0);

        const panel = this.add.graphics();
        drawTextPanel(panel, textObj, { paddingX: 14, paddingY: 10, radius: 8 });
        panel.setDepth(2099);
        panel.setScrollFactor(0);

        this.tweens.add({
            targets: [textObj, panel],
            alpha: 0,
            duration: 900,
            delay: 2800,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                if (textObj && textObj.destroy) textObj.destroy();
                if (panel && panel.destroy) panel.destroy();
            }
        });
    }

    addScore(amount, x, y, skipUnderflowLifeLoss = false) {
        const numericAmount = Number(amount) || 0;
        if (numericAmount > 0 && this.levelStats) {
            this.levelStats.pointsEarned = (Number(this.levelStats.pointsEarned) || 0) + numericAmount;
        }

        const nextScore = (Number(GAME_STATE.score) || 0) + (Number(amount) || 0);

        if (nextScore < 0) {
            GAME_STATE.score = 0;
            this.showScorePopup(amount, x, y);
            if (!skipUnderflowLifeLoss) {
                this.loseLife({
                    skipScorePenalty: true,
                    reason: 'score_underflow',
                    popupX: x,
                    popupY: y
                });
            }
            return;
        }

        GAME_STATE.score = nextScore;
        this.showScorePopup(amount, x, y);
    }

    showScorePopup(amount, x, y) {
        const posX = typeof x === 'number' ? x : (this.player?.x || 0);
        const posY = typeof y === 'number' ? y : (this.player?.y || 0);
        const color = amount >= 0 ? '#00ff66' : '#ff4444';
        const text = amount > 0 ? `+${amount}` : `${amount}`;

        const popup = this.add.text(posX, posY - 10, text, {
            fontSize: '16px',
            fill: color,
            fontFamily: GAME_FONT,
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        popup.setDepth(1000);
        popup.setScrollFactor(1);

        this.tweens.add({
            targets: popup,
            y: posY - 40,
            alpha: 0,
            duration: 700,
            ease: 'Cubic.easeOut',
            onComplete: () => popup.destroy()
        });
    }

    showLifeLossPopup(x, y) {
        const posX = typeof x === 'number' ? x : (this.player?.x || 0);
        const posY = typeof y === 'number' ? y : (this.player?.y || 0);

        const popup = this.add.text(posX, posY - 28, 'LIFE -1', {
            fontSize: '16px',
            fill: '#ff3355',
            fontFamily: GAME_FONT,
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        popup.setDepth(1001);
        popup.setScrollFactor(1);

        this.tweens.add({
            targets: popup,
            y: posY - 60,
            alpha: 0,
            duration: 800,
            ease: 'Cubic.easeOut',
            onComplete: () => popup.destroy()
        });
    }

    updateUITexts() {
        const t = TRANSLATIONS[GAME_STATE.language];
        // Use the same keys as createUI and the JSON translations (suffix _label)
        this.scoreText.setText(`${t.score_label}: ${GAME_STATE.score}`);
        this.levelText.setText(`${t.level_label}: ${GAME_STATE.currentLevel + 1}`);

        // Update DOM HUD if present (keeps mobile HUD crisp and readable)
        try {
            const scoreEl = document.getElementById('scoreDisplay');
            const levelEl = document.getElementById('levelDisplay');
            if (scoreEl) scoreEl.textContent = `${t.score_label}: ${GAME_STATE.score}`;
            if (levelEl) levelEl.textContent = `${t.level_label}: ${GAME_STATE.currentLevel + 1}`;
        } catch (e) { }

        this.refreshHudIcons();

        // Update action hint: show when player1 or player2 is near a locked door and has a key
        try {
            let hintShown = false;
            const doors = this.doors?.children?.entries || [];
            for (const door of doors) {
                if (!door || !door.active) continue;
                if (!door.getData || !door.getData('locked')) continue;
                if (door.getData('opening')) continue;
                // Prefer player1 hint if both nearby
                if (door.getData('playerNearbyP1')) {
                    // show P1 action label
                    const actionNames = (CONFIG.controlPanel?.player1?.action) || ['Z'];
                    const label = Array.isArray(actionNames) ? String(actionNames[0]) : String(actionNames);
                    if (this.actionHint && this.actionHint.setText) {
                        this.actionHint.setText(`Premi [${label}] per aprire`);
                        this.actionHint.setVisible(true);
                    }
                    hintShown = true;
                    break;
                } else if (door.getData('playerNearbyP2')) {
                    const actionNames2 = (CONFIG.controlPanel?.player2?.action) || ['M'];
                    const label2 = Array.isArray(actionNames2) ? String(actionNames2[0]) : String(actionNames2);
                    if (this.actionHint && this.actionHint.setText) {
                        this.actionHint.setText(`Premi [${label2}] per aprire`);
                        this.actionHint.setVisible(true);
                    }
                    hintShown = true;
                    break;
                }
            }

            // If no door hint shown, check for nearby holes where player can place a plank
            if (!hintShown) {
                try {
                    if (this.holeNearbyP1) {
                        const actionNames = (CONFIG.controlPanel?.player1?.action) || ['Z'];
                        const label = Array.isArray(actionNames) ? String(actionNames[0]) : String(actionNames);
                        if (this.actionHint && this.actionHint.setText) {
                            this.actionHint.setText(`Premi [${label}] per coprire la buca`);
                            this.actionHint.setVisible(true);
                        }
                        hintShown = true;
                    } else if (this.holeNearbyP2) {
                        const actionNames2 = (CONFIG.controlPanel?.player2?.action) || ['M'];
                        const label2 = Array.isArray(actionNames2) ? String(actionNames2[0]) : String(actionNames2);
                        if (this.actionHint && this.actionHint.setText) {
                            this.actionHint.setText(`Premi [${label2}] per coprire la buca`);
                            this.actionHint.setVisible(true);
                        }
                        hintShown = true;
                    }
                } catch (e) { }
            }

            if (!hintShown && this.actionHint) this.actionHint.setVisible(false);
        } catch (e) { }
    }

    refreshHudIcons() {
        if (!this.scoreText || !this.scoreText.active) return;
        if (!this.levelText || !this.levelText.active) return;
        if (!this.hudContainer || !this.hudContainer.active) return;

        if (!this.topStatsObjects) {
            this.topStatsObjects = [];
        }
        this.topStatsObjects.forEach((obj) => {
            if (obj && obj.destroy) obj.destroy();
        });
        this.topStatsObjects.length = 0;

        const metrics = this.getHudResponsiveMetrics();
        const topY = metrics.topHudY;

        let scoreBounds;
        let levelBounds;
        try {
            scoreBounds = this.scoreText.getBounds();
            levelBounds = this.levelText.getBounds();
        } catch (e) {
            return;
        }
        const laneStart = scoreBounds.right + Math.max(8, Math.round(metrics.sectionGap * 0.7));
        const laneEnd = levelBounds.x - Math.max(8, Math.round(metrics.sectionGap * 0.7));
        const availableWidth = Math.max(120, laneEnd - laneStart);
        const density = Phaser.Math.Clamp(availableWidth / 430, 0.58, 1);
        const iconSize = Math.max(12, Math.round(metrics.iconSize * density));
        const iconGap = Math.max(2, Math.round(metrics.iconGap * density));
        const sectionGap = Math.max(6, Math.round(metrics.sectionGap * density));
        const countFontSize = Math.max(10, Math.round(metrics.statFont * density));
        let x = laneStart;

        const addIcon = (frame) => {
            const icon = this.add.sprite(x, topY, 'objects', frame).setDisplaySize(iconSize, iconSize);
            icon.setDepth(HUD_DEPTH);
            icon.setScrollFactor(0);
            this.hudContainer.add(icon);
            this.topStatsObjects.push(icon);
            x += iconSize + iconGap;
            return icon;
        };

        const addCountText = (value, color = '#ffffff') => {
            const txt = this.add.text(x, topY, String(value), {
                fontSize: `${countFontSize}px`,
                fill: color,
                fontFamily: GAME_FONT
            }).setOrigin(0, 0.5);
            txt.setDepth(HUD_DEPTH);
            txt.setScrollFactor(0);
            this.hudContainer.add(txt);
            this.topStatsObjects.push(txt);
            x += txt.width + sectionGap;
            return txt;
        };

        // Cuori: show single heart icon + numeric count (per-player in 2P)
        if (Number(GAME_STATE.players) === 2) {
            const p1Lives = Number(GAME_STATE.livesP1) || 0;
            addIcon(OBJECT_FRAMES.heart);
            addCountText(p1Lives, '#ff8888');
            x += sectionGap;
            const p2Lives = Number(GAME_STATE.livesP2) || 0;
            addIcon(OBJECT_FRAMES.heart);
            addCountText(p2Lives, '#ff8888');
        } else {
            const lives = Number(GAME_STATE.lives) || 0;
            addIcon(OBJECT_FRAMES.heart);
            addCountText(lives, '#ff8888');
        }
        x += sectionGap;

        // Keys and wooden planks: show icon + numeric count (per-player in 2P)
        if (Number(GAME_STATE.players) === 2) {
            const p1Keys = Number(GAME_STATE.keysP1) || 0;
            addIcon(OBJECT_FRAMES.key);
            addCountText(p1Keys, '#ffffff');
            const p1Wood = Number(GAME_STATE.woodenP1) || 0;
            addIcon(OBJECT_FRAMES.wooden);
            addCountText(p1Wood, '#ffffff');
            x += sectionGap;
            const p2Keys = Number(GAME_STATE.keysP2) || 0;
            addIcon(OBJECT_FRAMES.key);
            addCountText(p2Keys, '#ffffff');
            const p2Wood = Number(GAME_STATE.woodenP2) || 0;
            addIcon(OBJECT_FRAMES.wooden);
            addCountText(p2Wood, '#ffffff');
            x += sectionGap;
        } else {
            const keys = Number(GAME_STATE.keysCount) || 0;
            addIcon(OBJECT_FRAMES.key);
            addCountText(keys, '#ffffff');
            const wood = Number(GAME_STATE.woodenCount) || 0;
            addIcon(OBJECT_FRAMES.wooden);
            addCountText(wood, '#ffffff');
            x += sectionGap;
        }

        // Dinamite: una sola icona + numero rimanente
        addIcon(OBJECT_FRAMES.dynamite_projectile);
        addCountText(GAME_STATE.dynamiteCount, '#ffaa00');

        // Gemme: una sola icona + numero rimanente
        addIcon(OBJECT_FRAMES.gem);
        // Mostra il numero di gemme rimanenti insieme al minimo richiesto per sbloccare l'uscita
        addCountText(String(this.gemsRemaining) + '/' + String(this.requiredGems), '#00ffff');

        // Centra l'intero blocco tra punteggio e livello
        const usedWidth = x - laneStart;
        const offset = Math.max(0, (availableWidth - usedWidth) / 2);
        this.topStatsObjects.forEach((obj) => {
            if (obj && typeof obj.x === 'number') {
                obj.x += offset;
            }
        });
    }
};
}
