/**
 * Crea la classe scena Bonus con logica minigioco dedicata.
 * @param {Record<string, any>} deps Dipendenze runtime condivise.
 * @returns {typeof Phaser.Scene} Classe scena Bonus.
 */
export function createBonusSceneClass(deps) {
    const {
        CONFIG,
        GAME_FONT,
        GAME_STATE,
        getLevelMasterNumber,
        getTextureMaxNumericFrame,
        isFinite,
        Math,
        Number,
        OBJECT_NATIVE_SIZE,
        OBJECT_FRAMES,
        Phaser,
        String,
        TRANSLATIONS,
        WALL_TILE_COLS,
    } = deps;

    class BonusScene extends Phaser.Scene {
        /**
         * Inizializza la scena bonus.
         */
        constructor() {
            super('BonusScene');
        }
    
        /**
         * Riceve i dati di ingresso scena bonus.
         * @param {object} [data={}] Payload transizione scena.
         * @returns {void}
         */
        init(data = {}) {
            this.bonusConfig = data.bonusConfig || {};
            this.bonusLevelName = data.bonusLevelName || this.bonusConfig.name || this.bonusConfig.level || this.bonusConfig.file || this.bonusConfig.nome;
            this.returnLevel = Number.isFinite(Number(data.returnLevel)) ? Number(data.returnLevel) : GAME_STATE.currentLevel;
            this.bonusCacheKey = this.bonusLevelName ? `bonus_level_${this.bonusLevelName}` : null;
            this.isBonusTransitioning = false;
            this.bonusPepitasCollected = 0;
            this.bonusStartScore = Number(GAME_STATE.score) || 0;
        }
    
        /**
         * Precarica eventuali asset specifici della scena bonus.
         * @returns {void}
         */
        preload() {
            if (this.bonusCacheKey && this.bonusLevelName) {
                this.load.json(this.bonusCacheKey, `data/level/${this.bonusLevelName}.json`);
            }
        }
    
        /**
         * Crea mondo, UI e regole del minigioco bonus.
         * @returns {void}
         */
        create() {
            const t = TRANSLATIONS[GAME_STATE.language] || {};
            const bonusData = this.bonusCacheKey ? this.cache.json.get(this.bonusCacheKey) : null;
    
            if (!bonusData || !bonusData.map) {
                this.showBonusMessageAndReturn(t.bonus_missing || 'BONUS DATA MISSING');
                return;
            }
    
            const mapData = Array.isArray(bonusData.map?.tiles)
                ? bonusData.map.tiles
                : (Array.isArray(bonusData.map) ? bonusData.map : []);
            if (!mapData.length) {
                this.showBonusMessageAndReturn(t.bonus_missing || 'BONUS DATA MISSING');
                return;
            }
    
            this.mapRows = Number(bonusData.map?.rows) || mapData.length;
            this.mapCols = Number(bonusData.map?.cols) || (mapData[0]?.length || 40);
            this.mapOffsetX = 0;
            this.mapOffsetY = 0;
    
            const tileSize = CONFIG.tileSize;
            const worldWidth = this.mapCols * tileSize;
            const worldHeight = Math.max(CONFIG.height, this.mapRows * tileSize);
    
            const masterLevel = getLevelMasterNumber(this.returnLevel);
            const masterLevelBgKey = `game_bg_${masterLevel}`;
            const selectedBgKey = this.textures.exists(masterLevelBgKey) ? masterLevelBgKey : 'game_bg';
            this.add.image(worldWidth / 2, worldHeight / 2, selectedBgKey)
                .setDisplaySize(worldWidth, worldHeight)
                .setDepth(-1000);
    
            // Bonus foreground removed: no bonus scene FG created.
    
            this.bonusRails = this.physics.add.staticGroup();
            this.bonusHazards = this.physics.add.group({ allowGravity: false, immovable: true });
            this.bonusPepitas = this.physics.add.group({ allowGravity: false, immovable: true });
            this.bonusGems = this.physics.add.group({ allowGravity: false, immovable: true });
            this.bonusProjectiles = this.physics.add.group({ allowGravity: false, immovable: false });
            this.bonusFallingRocks = this.physics.add.group();
            this.bonusRailVisuals = [];
    
            this.finishX = worldWidth - tileSize * 2;
            let startX = tileSize * 2;
            let startY = worldHeight - tileSize * 2;
            let startRailTopY = null;
            let firstRailX = null;
            let firstRailTopY = null;
            let lastRailX = null;
    
        const wallMaxFrame = getTextureMaxNumericFrame(this, 'wall_tiles', WALL_TILE_COLS);
    
            const parseWallToken = (token) => {
                const tokenStr = String(token || '').trim().toLowerCase();
                // Accept new wRCRF (row,col,rot,flip) or legacy forms
                const wallMatch4 = tokenStr.match(/^w(\d)(\d)(\d)([hv0])$/i);
                if (wallMatch4) {
                    const row = Number(wallMatch4[1]);
                    const col = Number(wallMatch4[2]);
                    const rot = Number(wallMatch4[3]);
                    const flip = String(wallMatch4[4]).toLowerCase();
                    if (row >= 0 && row <= 3 && col >= 0 && col <= 5 && rot >= 0 && rot <= 3) {
                        const frame = Phaser.Math.Clamp(row * 6 + col, 0, wallMaxFrame);
                        return { isWall: true, frame, rotation: rot, flip };
                    }
                }
                const wallMatch3 = tokenStr.match(/^w(\d)(\d)(\d)$/i);
                if (wallMatch3) {
                    const row = Number(wallMatch3[1]);
                    const col = Number(wallMatch3[2]);
                    const rot = Number(wallMatch3[3]);
                    if (row >= 0 && row <= 3 && col >= 0 && col <= 5 && rot >= 0 && rot <= 3) {
                        const frame = Phaser.Math.Clamp(row * 6 + col, 0, wallMaxFrame);
                        return { isWall: true, frame, rotation: rot, flip: '0' };
                    }
                }
                const wallMatch2 = tokenStr.match(/^w(\d)(\d)$/i);
                if (wallMatch2) {
                    const legacyFrame = Number(wallMatch2[1]) || 0;
                    const rot = ((Number(wallMatch2[2]) || 0) % 4 + 4) % 4;
                    const frame = Phaser.Math.Clamp(legacyFrame, 0, wallMaxFrame);
                    return { isWall: true, frame, rotation: rot, flip: '0' };
                }
                return { isWall: false, frame: 0, rotation: 0, flip: '0' };
            };
    
            const isSolidRailToken = (token) => {
                const tokenStr = String(token || '').trim().toLowerCase();
                if (!tokenStr || tokenStr === '-') return false;
                if (tokenStr === 'h' || tokenStr === 'hole' || tokenStr === 'hole1' || tokenStr === 'hole2') return false;
                if (tokenStr === '=' || tokenStr === 't' || tokenStr === 's' || tokenStr === 'e' || tokenStr === 'rail' || tokenStr === 'floor' || tokenStr === 'f') return true;
                // accept legacy wXX and new wRCRF (optionally ending with h/v/0)
                if (/^w\d{2,3}[hv0]?$/i.test(tokenStr)) return true;
                return false;
            };
    
            const createRailAt = (wx, wy, token) => {
                const wallInfo = parseWallToken(token);
                const visual = wallInfo.isWall
                    ? this.add.sprite(wx, wy, 'wall_tiles', wallInfo.frame)
                    : this.add.sprite(wx, wy, 'tiles', 3);
                visual.setDisplaySize(tileSize, tileSize);
                if (wallInfo.isWall) {
                    const rr = Number(wallInfo.rotation) || 0;
                    const flip = String(wallInfo.flip ?? '0').toLowerCase();
                    if (flip === 'h') visual.setFlipX(true);
                    else if (flip === 'v') visual.setFlipY(true);
                    else visual.setAngle(rr * 90);
                }
                visual.setDepth(500);
                this.bonusRailVisuals.push(visual);
    
                const rail = this.bonusRails.create(wx, wy, 'tiles', 3);
                rail.setDisplaySize(tileSize, tileSize);
                rail.setVisible(false);
                if (rail.refreshBody) rail.refreshBody();
    
                if (firstRailX === null) {
                    firstRailX = wx;
                    firstRailTopY = wy - tileSize / 2;
                }
                lastRailX = wx;
            };
    
            for (let y = 0; y < this.mapRows; y++) {
                for (let x = 0; x < this.mapCols; x++) {
                    const tokenRaw = mapData[y]?.[x];
                    const token = String(tokenRaw ?? '-').trim().toLowerCase();
                    const wx = this.mapOffsetX + x * tileSize + tileSize / 2;
                    const wy = this.mapOffsetY + y * tileSize + tileSize / 2;
    
                    if (isSolidRailToken(token)) {
                        createRailAt(wx, wy, token);
                    }
    
                    if (token === 's') {
                        startX = wx;
                        startRailTopY = wy - tileSize / 2;
                    }
                    if (token === 'e') {
                        this.finishX = wx;
                    }
    
                    if (token === 'r') {
                        const rock = this.bonusHazards.create(wx, wy - tileSize * 0.35, 'objects', OBJECT_FRAMES.stone);
                        rock.setScale((CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.9);
                        rock.setData('hazardType', 'rock');
                        rock.setData('destructible', true);
                    } else if (token === 'g') {
                        const ghost = this.bonusHazards.create(wx, wy - tileSize * 0.55, 'objects', OBJECT_FRAMES.ghost);
                        ghost.setScale((CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.85);
                        ghost.setData('hazardType', 'ghost');
                        ghost.setData('destructible', false);
                        this.tweens.add({
                            targets: ghost,
                            y: ghost.y - 12,
                            duration: 420,
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                    } else if (token === 'b') {
                        const bat = this.bonusHazards.create(wx, wy - tileSize * 0.65, 'bat', 0);
                        bat.setScale((CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.7);
                        bat.setData('hazardType', 'bat');
                        bat.setData('destructible', false);
                        if (this.anims.exists('bat_fly')) {
                            bat.play('bat_fly', true);
                        }
                        this.tweens.add({
                            targets: bat,
                            y: bat.y + 10,
                            duration: 280,
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                    } else if (token === 'p') {
                        const pepita = this.bonusPepitas.create(wx, wy - tileSize * 0.6, 'objects', OBJECT_FRAMES.pepita);
                        pepita.setScale((CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.75);
                        this.tweens.add({
                            targets: pepita,
                            y: pepita.y - 8,
                            duration: 360,
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                    } else if (token === 'm' || token === 'gem') {
                        const gem = this.bonusGems.create(wx, wy - tileSize * 0.62, 'objects', OBJECT_FRAMES.gem);
                        gem.setScale((CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.76);
                        this.tweens.add({
                            targets: gem,
                            y: gem.y - 10,
                            duration: 360,
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                    }
                }
            }
    
            if (startRailTopY === null && firstRailX !== null) {
                startX = firstRailX;
                startRailTopY = firstRailTopY;
            }
    
            if (firstRailX === null || startRailTopY === null) {
                this.showBonusMessageAndReturn(t.bonus_missing || 'BONUS TRACK MISSING');
                return;
            }
    
            if (!(Number.isFinite(Number(this.finishX))) && lastRailX !== null) {
                this.finishX = lastRailX;
            }
            if (lastRailX !== null) {
                this.finishX = Math.max(Number(this.finishX) || lastRailX, lastRailX);
            }
    
            // Hidden safety rails at spawn to avoid instant fall from tiny gaps/config mistakes
            for (let i = 0; i < 5; i++) {
                const safeX = startX + i * tileSize;
                const safeY = startRailTopY + tileSize / 2;
                const safeRail = this.bonusRails.create(safeX, safeY, 'tiles', 3);
                safeRail.setDisplaySize(tileSize, tileSize);
                safeRail.setVisible(false);
                if (safeRail.refreshBody) safeRail.refreshBody();
            }
    
            this.cart = this.physics.add.sprite(startX, startY, 'objects', OBJECT_FRAMES.cart);
            this.cart.setScale(CONFIG.objectSize / OBJECT_NATIVE_SIZE);
            this.cart.setDepth(1200);
            this.cart.body.setGravityY(1100);
            this.cart.body.setCollideWorldBounds(false);
            this.cart.body.setSize(Math.floor(this.cart.displayWidth * 0.8), Math.floor(this.cart.displayHeight * 0.82));
            if (startRailTopY !== null) {
                startY = startRailTopY - (this.cart.displayHeight * 0.48);
                this.cart.setPosition(startX, startY);
            }
            this.bonusSpawnY = startY;
    
            // Rider (miner) visible on top of the cart
            this.cartRider = this.add.sprite(this.cart.x, this.cart.y - this.cart.displayHeight * 0.55, 'objects', OBJECT_FRAMES.wall);
            const riderScale = Math.max(0.34, (Number(CONFIG.playerSize) || Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE) / 220);
            this.riderBaseScale = riderScale;
            this.cartRider.setScale(riderScale);
            this.cartRider.setDepth(1202);
    
            this.physics.add.collider(this.cart, this.bonusRails, () => {
                this.bonusHadRailContact = true;
            }, null, this);
            this.bonusHadRailContact = false;
            this.bonusGraceDurationMs = Number(this.bonusConfig.graceMs ?? bonusData.graceMs ?? 1600) || 1600;
            this.bonusGraceUntil = (this.time?.now || 0) + Math.max(0, this.bonusGraceDurationMs);
            this.bonusStartX = startX;
            this.bonusHazardActivationX = startX + tileSize * 5;
    
            this.physics.add.overlap(this.cart, this.bonusHazards, () => {
                const now = this.time?.now || 0;
                if (now < this.bonusGraceUntil) return;
                if ((Number(this.cart?.x) || 0) < this.bonusHazardActivationX) return;
                this.failBonus();
            }, null, this);
            this.physics.add.overlap(this.cart, this.bonusPepitas, (_, pepita) => {
                if (!pepita || !pepita.active) return;
                pepita.destroy();
                this.bonusPepitasCollected++;
                const pepitaScore = Number(this.bonusConfig.pepitaScore ?? 10) || 10;
                GAME_STATE.score = (Number(GAME_STATE.score) || 0) + pepitaScore;
                this.updateBonusHud();
            }, null, this);
    
            this.physics.add.overlap(this.cart, this.bonusGems, (_, gem) => {
                if (!gem || !gem.active) return;
                gem.destroy();
                GAME_STATE.score = (Number(GAME_STATE.score) || 0) + 50;
                this.updateBonusHud();
            }, null, this);
    
            this.physics.add.overlap(this.cart, this.bonusFallingRocks, () => {
                const now = this.time?.now || 0;
                if (now < this.bonusGraceUntil) return;
                this.failBonus();
            }, null, this);
    
            this.physics.add.overlap(this.bonusProjectiles, this.bonusHazards, (projectile, hazard) => {
                if (!projectile || !projectile.active || !hazard || !hazard.active) return;
                const hazardType = hazard.getData('hazardType');
                if (hazardType === 'rock' || hazard.getData('destructible')) {
                    this.destroyBonusRock(hazard);
                    projectile.destroy();
                    return;
                }
                projectile.destroy();
            }, null, this);
    
            this.physics.add.overlap(this.bonusProjectiles, this.bonusFallingRocks, (projectile, rock) => {
                if (!projectile || !projectile.active || !rock || !rock.active) return;
                this.destroyBonusRock(rock);
                projectile.destroy();
            }, null, this);
    
            this.physics.add.collider(this.bonusFallingRocks, this.bonusRails, this.onBonusRockLanded, null, this);
    
            this.fallingRockTimer = this.time.addEvent({
                delay: Number(this.bonusConfig.fallingRockInterval ?? bonusData.fallingRockInterval ?? 1300) || 1300,
                loop: true,
                callback: () => {
                    if (this.isBonusTransitioning) return;
                    this.spawnBonusFallingRock();
                }
            });
    
            this.physics.world.setBounds(0, 0, worldWidth, worldHeight + tileSize * 2);
            this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
            this.cameras.main.startFollow(this.cart, true, 0.15, 0.1);
            this.cameras.main.setDeadzone(CONFIG.width * 0.35, CONFIG.height * 0.5);
    
            this.baseSpeed = Number(this.bonusConfig.baseSpeed ?? bonusData.baseSpeed ?? 220) || 220;
            this.minSpeed = Number(this.bonusConfig.minSpeed ?? bonusData.minSpeed ?? 90) || 90;
            this.maxSpeed = Number(this.bonusConfig.maxSpeed ?? bonusData.maxSpeed ?? 520) || 520;
            this.speedStep = Number(this.bonusConfig.speedStep ?? bonusData.speedStep ?? 320) || 320;
            this.brakeStep = Number(this.bonusConfig.brakeStep ?? bonusData.brakeStep ?? (this.speedStep * 1.35)) || (this.speedStep * 1.35);
            this.coastDecel = Number(this.bonusConfig.coastDecel ?? bonusData.coastDecel ?? (this.speedStep * 0.45)) || (this.speedStep * 0.45);
            this.jumpVelocity = Number(this.bonusConfig.jumpVelocity ?? bonusData.jumpVelocity ?? 560) || 560;
            this.cartSpeed = 0;
    
            this.cursors = this.input.keyboard.createCursorKeys();
            this.upKey = this.cursors.up;
            this.downKey = this.cursors.down;
            this.spaceShootKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            try {
                this.spaceShootKeyX = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
            } catch (e) { this.spaceShootKeyX = null; }
    
            this.bonusHud = this.add.text(12, 10, '', {
                fontSize: '14px',
                fill: '#ffffff',
                fontFamily: GAME_FONT,
                stroke: '#000000',
                strokeThickness: 3
            }).setScrollFactor(0).setDepth(3000);
            this.bonusLabel = this.add.text(CONFIG.width / 2, 12, this.bonusConfig.label || t.bonus_level || 'BONUS', {
                fontSize: '14px',
                fill: '#ffe36b',
                fontFamily: GAME_FONT,
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(3000);
            this.updateBonusHud();
        }
    
        /**
         * Spawna un masso in caduta nel livello bonus.
         * @returns {void}
         */
        spawnBonusFallingRock() {
            if (!this.bonusFallingRocks || !this.cart) return;
    
            const cam = this.cameras?.main;
            const centerX = Number(this.cart.x) || (cam?.midPoint?.x || CONFIG.width / 2);
            const spawnX = Phaser.Math.Clamp(
                Phaser.Math.Between(centerX + CONFIG.width * 0.2, centerX + CONFIG.width * 0.95),
                CONFIG.tileSize,
                this.physics.world.bounds.width - CONFIG.tileSize
            );
            const spawnY = (cam?.scrollY || 0) - CONFIG.tileSize;
    
            const rock = this.bonusFallingRocks.create(spawnX, spawnY, 'objects', OBJECT_FRAMES.stone);
            rock.setScale((CONFIG.objectSize / OBJECT_NATIVE_SIZE) * Phaser.Math.FloatBetween(0.82, 1.05));
            rock.setDepth(1100);
            rock.setData('hazardType', 'rock');
            rock.setData('destructible', true);
            rock.setData('landed', false);
            rock.setVelocity(Phaser.Math.Between(-20, 20), Phaser.Math.Between(10, 40));
            rock.setAngularVelocity(Phaser.Math.Between(-380, 380));
            if (rock.body) {
                rock.body.setGravityY(Phaser.Math.Between(980, 1280));
                rock.body.setBounce(0.06, 0.06);
                rock.body.setSize(Math.floor((rock.displayWidth || rock.width) * 0.88), Math.floor((rock.displayHeight || rock.height) * 0.88));
            }
    
            this.spawnBonusRockTrail(rock);
        }
    
        /**
         * Genera scia/particelle del masso bonus in movimento.
         * @param {any} rock Entita masso.
         * @returns {void}
         */
        spawnBonusRockTrail(rock) {
            if (!rock || !rock.active) return;
            const trailEvent = this.time.addEvent({
                delay: 70,
                loop: true,
                callback: () => {
                    if (!rock || !rock.active) {
                        if (trailEvent && trailEvent.remove) trailEvent.remove(false);
                        return;
                    }
                    const smoke = this.add.circle(
                        rock.x + Phaser.Math.Between(-3, 3),
                        rock.y + Phaser.Math.Between(-3, 3),
                        Phaser.Math.Between(3, 6),
                        Phaser.Utils.Array.GetRandom([0x8f8f8f, 0x7a7a7a, 0x666666]),
                        Phaser.Math.FloatBetween(0.35, 0.55)
                    ).setDepth(900);
    
                    this.tweens.add({
                        targets: smoke,
                        y: smoke.y - Phaser.Math.Between(4, 8),
                        alpha: 0,
                        scale: Phaser.Math.FloatBetween(1.5, 2.3),
                        duration: Phaser.Math.Between(240, 420),
                        ease: 'Sine.easeOut',
                        onComplete: () => smoke.destroy()
                    });
                }
            });
            rock.setData('trailEvent', trailEvent);
            if (rock.once) {
                rock.once('destroy', () => {
                    const eventRef = rock.getData('trailEvent');
                    if (eventRef && eventRef.remove) eventRef.remove(false);
                });
            }
        }
    
        /**
         * Crea un puff visivo in posizione specifica.
         * @param {number} x Coordinata X.
         * @param {number} y Coordinata Y.
         * @param {number} [scale=1] Scala effetto.
         * @returns {void}
         */
        createBonusPuff(x, y, scale = 1) {
            for (let i = 0; i < 10; i++) {
                const puff = this.add.circle(
                    x + Phaser.Math.Between(-8, 8),
                    y + Phaser.Math.Between(-6, 6),
                    Phaser.Math.Between(3, 7) * scale,
                    Phaser.Utils.Array.GetRandom([0xd2d2d2, 0xb3b3b3, 0x8f8f8f]),
                    Phaser.Math.FloatBetween(0.45, 0.8)
                ).setDepth(950);
    
                this.tweens.add({
                    targets: puff,
                    x: puff.x + Phaser.Math.Between(-26, 26),
                    y: puff.y + Phaser.Math.Between(-16, 10),
                    alpha: 0,
                    scale: Phaser.Math.FloatBetween(1.2, 2.2),
                    duration: Phaser.Math.Between(260, 520),
                    ease: 'Sine.easeOut',
                    onComplete: () => puff.destroy()
                });
            }
        }
    
        /**
         * Applica un effetto wobble alla traccia bonus vicino a una posizione.
         * @param {number} x Coordinata X centro effetto.
         * @param {number} y Coordinata Y centro effetto.
         * @returns {void}
         */
        wobbleBonusTrackAt(x, y) {
            const nearbyRails = (this.bonusRailVisuals || []).filter((rail) => {
                if (!rail || !rail.active) return false;
                return Math.abs(rail.x - x) <= CONFIG.tileSize * 1.2 && Math.abs(rail.y - y) <= CONFIG.tileSize * 0.8;
            });
    
            nearbyRails.forEach((rail) => {
                this.tweens.add({
                    targets: rail,
                    y: rail.y + 4,
                    duration: 70,
                    yoyo: true,
                    ease: 'Sine.easeInOut'
                });
            });
    
            if (CONFIG.enableImpactShake !== false && this.cameras && this.cameras.main) {
                this.cameras.main.shake(90, 0.0035);
            }
        }
    
        /**
         * Gestisce l'atterraggio di un masso bonus.
         * @param {any} rock Entita masso.
         * @returns {void}
         */
        onBonusRockLanded(rock) {
            if (!rock || !rock.active) return;
            if (rock.getData('landed')) return;
    
            rock.setData('landed', true);
            this.createBonusPuff(rock.x, rock.y + (rock.displayHeight || 24) * 0.28, 0.9);
            this.wobbleBonusTrackAt(rock.x, rock.y);
    
            if (rock.body) {
                rock.body.setGravityY(0);
                rock.body.setVelocityX(Math.max(20, (Number(this.cartSpeed) || 0) * 0.12));
                rock.body.setVelocityY(0);
            }
    
            this.time.delayedCall(3200, () => {
                if (rock && rock.active) rock.destroy();
            });
        }
    
        /**
         * Distrugge in sicurezza un masso bonus.
         * @param {any} rock Entita da distruggere.
         * @returns {void}
         */
        destroyBonusRock(rock) {
            if (!rock || !rock.active) return;
            this.createBonusPuff(rock.x, rock.y, 1);
            this.wobbleBonusTrackAt(rock.x, rock.y);
            rock.destroy();
        }
    
        /**
         * Spara dinamite nel minigioco bonus.
         * @returns {void}
         */
        shootBonusDynamite() {
            if (!this.cart || !this.cart.active || this.isBonusTransitioning) return;
            const now = this.time?.now || 0;
            if (now < (this.nextBonusShotAt || 0)) return;
            this.nextBonusShotAt = now + 320;
    
            const dynamite = this.bonusProjectiles.create(
                this.cart.x + Math.max(10, (this.cart.displayWidth || 24) * 0.35),
                this.cart.y - Math.max(4, (this.cart.displayHeight || 24) * 0.15),
                'objects',
                OBJECT_FRAMES.dynamite_projectile
            );
            dynamite.setScale(Math.max(0.22, (CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.35));
            dynamite.setDepth(1300);
            dynamite.setVelocity(Math.max(280, (Number(this.cartSpeed) || 0) + 260), 0);
            dynamite.setAngularVelocity(Phaser.Math.Between(-620, 620));
    
            this.time.delayedCall(2000, () => {
                if (dynamite && dynamite.active) {
                    this.createBonusPuff(dynamite.x, dynamite.y, 0.45);
                    dynamite.destroy();
                }
            });
        }
    
        /**
         * Aggiorna HUD della scena bonus.
         * @returns {void}
         */
        updateBonusHud() {
            if (!this.bonusHud || !this.bonusHud.active) return;
            const scoreDelta = (Number(GAME_STATE.score) || 0) - (Number(this.bonusStartScore) || 0);
            const speedNow = Math.max(0, Math.round(Number(this.cartSpeed) || 0));
            this.bonusHud.setText(`BONUS +${scoreDelta}  PEPITE:${this.bonusPepitasCollected}  SPEED:${speedNow}`);
        }
    
        /**
         * Mostra messaggio finale bonus e rientra alla scena principale.
         * @param {string} message Messaggio da mostrare.
         * @returns {void}
         */
        showBonusMessageAndReturn(message) {
            this.add.text(CONFIG.width / 2, CONFIG.height / 2, message, {
                fontSize: '18px',
                fill: '#ffffff',
                fontFamily: GAME_FONT,
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(3200);
    
            this.time.delayedCall(1200, () => {
                GAME_STATE.currentLevel = this.returnLevel;
                this.scene.start('GameScene');
            });
        }
    
        /**
         * Conclude il bonus con esito positivo.
         * @returns {void}
         */
        completeBonus() {
            if (this.isBonusTransitioning) return;
            this.isBonusTransitioning = true;
    
            const bonusReward = Number(this.bonusConfig.rewardScore ?? 80) || 80;
            GAME_STATE.score = (Number(GAME_STATE.score) || 0) + bonusReward;
    
            this.add.text(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y, 'BONUS COMPLETATO!', {
                fontSize: '24px',
                fill: '#00ff88',
                fontFamily: GAME_FONT,
                stroke: '#000000',
                strokeThickness: 5
            }).setOrigin(0.5).setScrollFactor(0).setDepth(3300);
    
            this.time.delayedCall(900, () => {
                GAME_STATE.currentLevel = this.returnLevel;
                this.scene.start('GameScene');
            });
        }
    
        /**
         * Conclude il bonus con fallimento.
         * @returns {void}
         */
        failBonus() {
            if (this.isBonusTransitioning) return;
            this.isBonusTransitioning = true;
    
            GAME_STATE.lives = Math.max(0, (Number(GAME_STATE.lives) || 0) - 1);
            if ((Number(GAME_STATE.lives) || 0) <= 0) {
                this.scene.launch('GameOverScene');
                return;
            }
    
            this.add.text(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y, 'BONUS FALLITO', {
                fontSize: '24px',
                fill: '#ff6666',
                fontFamily: GAME_FONT,
                stroke: '#000000',
                strokeThickness: 5
            }).setOrigin(0.5).setScrollFactor(0).setDepth(3300);
    
            this.time.delayedCall(900, () => {
                GAME_STATE.currentLevel = this.returnLevel;
                this.scene.start('GameScene');
            });
        }
    
        /**
         * Loop update della scena bonus.
         * @param {number} time Timestamp corrente.
         * @param {number} delta Delta ms frame.
         * @returns {void}
         */
        update(time, delta) {
            if (!this.cart || !this.cart.active || this.isBonusTransitioning) return;
    
            const dt = Math.max(0.001, (Number(delta) || 16) / 1000);
            if (this.cursors.right.isDown) {
                this.cartSpeed += this.speedStep * dt;
            }
            if (this.cursors.left.isDown) {
                this.cartSpeed -= this.brakeStep * dt;
            } else if (!this.cursors.right.isDown) {
                this.cartSpeed -= this.coastDecel * dt;
            }
            this.cartSpeed = Phaser.Math.Clamp(this.cartSpeed, 0, this.maxSpeed);
    
            this.cart.setVelocityX(this.cartSpeed);
    
            // Keep the cart from going backward out of the safe start zone
            if ((Number(this.cart.x) || 0) < (Number(this.bonusStartX) || 0)) {
                this.cart.x = this.bonusStartX;
                if (this.cart.body) {
                    this.cart.body.velocity.x = Math.max(0, Number(this.cart.body.velocity.x) || 0);
                }
                this.cartSpeed = Math.max(this.cartSpeed, 0);
            }
    
            if (this.cartRider && this.cartRider.active) {
                const isCrouching = !!this.downKey?.isDown;
                const riderOffsetY = isCrouching ? this.cart.displayHeight * 0.36 : this.cart.displayHeight * 0.55;
                this.cartRider.setPosition(this.cart.x, this.cart.y - riderOffsetY);
                const crouchScaleY = isCrouching ? this.riderBaseScale * 0.72 : this.riderBaseScale;
                this.cartRider.setScale(this.riderBaseScale, crouchScaleY);
                // We use reversed animation for left-facing movement, so avoid horizontal flip here
                this.cartRider.setFlipX(false);
    
                // No miner animations: keep the cart rider as the static `objects` sprite
                try {
                    if (this.cartRider.anims && this.cartRider.anims.isPlaying) this.cartRider.anims.stop();
                    this.cartRider.setFrame(OBJECT_FRAMES.wall);
                } catch (e) { }
            }
    
            const canJump = this.cart.body?.blocked?.down || this.cart.body?.touching?.down;
            if (canJump && this.upKey && Phaser.Input.Keyboard.JustDown(this.upKey)) {
                this.cart.setVelocityY(-this.jumpVelocity);
            }
    
            if ((this.spaceShootKey && Phaser.Input.Keyboard.JustDown(this.spaceShootKey)) || (this.spaceShootKeyX && Phaser.Input.Keyboard.JustDown(this.spaceShootKeyX))) {
                this.shootBonusDynamite();
            }
    
            const now = this.time?.now || 0;
            if (now < this.bonusGraceUntil && this.cart.y > (Number(this.bonusSpawnY) || 0) + CONFIG.tileSize * 1.1) {
                this.cart.setPosition(this.bonusStartX, this.bonusSpawnY);
                if (this.cart.body) {
                    this.cart.body.setVelocity(0, 0);
                }
            }
    
            if (now >= this.bonusGraceUntil
                && (Number(this.cart.x) || 0) >= this.bonusHazardActivationX
                && this.bonusHadRailContact
                && this.cart.y > this.physics.world.bounds.height + CONFIG.tileSize) {
                this.failBonus();
                return;
            }
    
            if (this.cart.x >= this.finishX) {
                this.completeBonus();
            }
    
            this.updateBonusHud();
        }
    }

    return BonusScene;
}
