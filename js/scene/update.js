export function update(scene) {
    // Accept explicit `scene` param or use `this` (Phaser binds scene as `this` when calling)
    scene = scene || this;
    try {
        if (!window.gameStarted) return;

        // Player 1 movement
        if (window.player) {
            try {
                if (window.cursors.left.isDown) {
                    window.player.x -= 5;
                } else if (window.cursors.right.isDown) {
                    window.player.x += 5;
                }

                if (window.cursors.up.isDown) {
                    window.player.y -= 5;
                } else if (window.cursors.down.isDown) {
                    window.player.y += 5;
                }

                window.player.x = Phaser.Math.Clamp(window.player.x, 10, 790);
                window.player.y = Phaser.Math.Clamp(window.player.y, 10, 590);

                if (Phaser.Input.Keyboard.JustDown(window.spaceKey)) {
                    try { window.shoot && window.shoot(scene, window.player); } catch (e) { }
                }
            } catch (e) { /* ignore */ }
        }

        // Player 1 animation
        try {
            if (window.player && window.player.anims) {
                const dx = (window.cursors.right.isDown ? 1 : 0) - (window.cursors.left.isDown ? 1 : 0);
                const dy = (window.cursors.down.isDown ? 1 : 0) - (window.cursors.up && window.cursors.up.isDown ? 1 : 0);
                const moving = Math.abs(dx) + Math.abs(dy) > 0;
                let dir = (window.player._lastDir || 'down');
                if (moving) {
                    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
                    else if (Math.abs(dy) > 0) dir = dy > 0 ? 'down' : 'up';
                    window.player._lastDir = dir;
                    const key = 'p_run_' + (dir === 'left' ? 'left' : (dir === 'right' ? 'right' : (dir === 'up' ? 'up' : 'down')));
                    if (!window.player.anims.isPlaying || window.player.anims.currentAnim.key !== key) {
                        window.player.anims.play(key, true);
                    }
                    try { window.player.setFlipX(dir === 'left'); } catch (e) { }
                } else {
                    const key = 'p_idle_' + (dir === 'left' ? 'left' : (dir === 'right' ? 'right' : (dir === 'up' ? 'up' : 'down')));
                    if (!window.player.anims.isPlaying || window.player.anims.currentAnim.key !== key) {
                        window.player.anims.play(key, true);
                    }
                    try { window.player.setFlipX(dir === 'left'); } catch (e) { }
                }
            }
        } catch (e) { /* non-critical */ }

        // Player 2 movement & animation
        if (window.player2 && window.wasdKeys) {
            try {
                if (window.wasdKeys.left && window.wasdKeys.left.isDown) window.player2.x -= 5;
                else if (window.wasdKeys.right && window.wasdKeys.right.isDown) window.player2.x += 5;

                if (window.wasdKeys.up && window.wasdKeys.up.isDown) window.player2.y -= 5;
                else if (window.wasdKeys.down && window.wasdKeys.down.isDown) window.player2.y += 5;

                window.player2.x = Phaser.Math.Clamp(window.player2.x, 10, 790);
                window.player2.y = Phaser.Math.Clamp(window.player2.y, 10, 590);

                const p2ShootKey = window.wasdKeys.shoot || window.wasdKeys.F || window.wasdKeys.f;
                if (p2ShootKey && Phaser.Input.Keyboard.JustDown(p2ShootKey)) {
                    try { window.shoot && window.shoot(scene, window.player2); } catch (e) { }
                }
            } catch (e) { }

            try {
                if (window.player2 && window.player2.anims && window.wasdKeys) {
                    const dx2 = (window.wasdKeys.right && window.wasdKeys.right.isDown ? 1 : 0) - (window.wasdKeys.left && window.wasdKeys.left.isDown ? 1 : 0);
                    const dy2 = (window.wasdKeys.down && window.wasdKeys.down.isDown ? 1 : 0) - (window.wasdKeys.up && window.wasdKeys.up.isDown ? 1 : 0);
                    const moving2 = Math.abs(dx2) + Math.abs(dy2) > 0;
                    let dir2 = (window.player2._lastDir || 'down');
                    if (moving2) {
                        if (Math.abs(dx2) > Math.abs(dy2)) dir2 = dx2 > 0 ? 'right' : 'left';
                        else if (Math.abs(dy2) > 0) dir2 = dy2 > 0 ? 'down' : 'up';
                        window.player2._lastDir = dir2;
                        const key2 = 'p_run_' + (dir2 === 'left' ? 'left' : (dir2 === 'right' ? 'right' : (dir2 === 'up' ? 'up' : 'down')));
                        if (!window.player2.anims.isPlaying || window.player2.anims.currentAnim.key !== key2) {
                            window.player2.anims.play(key2, true);
                        }
                        try { window.player2.setFlipX(dir2 === 'left'); } catch (e) { }
                    } else {
                        const key2 = 'p_idle_' + (dir2 === 'left' ? 'left' : (dir2 === 'right' ? 'right' : (dir2 === 'up' ? 'up' : 'down')));
                        if (!window.player2.anims.isPlaying || window.player2.anims.currentAnim.key !== key2) {
                            window.player2.anims.play(key2, true);
                        }
                        try { window.player2.setFlipX(dir2 === 'left'); } catch (e) { }
                    }
                }
            } catch (e) { /* ignore */ }
        }

        // Target lifetime
        window.targetLifetime = (window.targetLifetime || 0) + 1;
        if (window.targetLifetime > 180) { try { window.spawnTarget && window.spawnTarget(scene); } catch (e) { } }

        // Spawn blocks
        const spawnRate = Math.max(30 - (window.level || 1) * 2, 10);
        window.blockSpawnTimer = (window.blockSpawnTimer || 0) + 1;
        if (window.blockSpawnTimer >= spawnRate) {
            try { window.spawnBlock && window.spawnBlock(scene); } catch (e) { }
            window.blockSpawnTimer = 0;
        }

        // Update blocks
        try {
            (window.blocks && window.blocks.children && window.blocks.children.entries || []).forEach((block, index) => {
                if (block.getData && block.getData('landed')) return;
                (window.blocks && window.blocks.children && window.blocks.children.entries || []).forEach((otherBlock, otherIndex) => {
                    if (index === otherIndex || !(otherBlock.getData && otherBlock.getData('landed'))) return;
                    const bounds1 = block.getBounds();
                    const bounds2 = otherBlock.getBounds();
                    const nextBounds = new Phaser.Geom.Rectangle(bounds1.x + (block.body ? block.body.velocity.x / 60 : 0), bounds1.y + (block.body ? block.body.velocity.y / 60 : 0), bounds1.width, bounds1.height);
                    if (Phaser.Geom.Intersects.RectangleToRectangle(nextBounds, bounds2)) {
                        try { block.setData('landed', true); block.body.setVelocity(0, 0); } catch (e) { }
                        try {
                            if (block.body && block.body.velocity.y > 0) { block.y = otherBlock.y - 20; }
                            else if (block.body && block.body.velocity.y < 0) { block.y = otherBlock.y + 20; }
                            else if (block.body && block.body.velocity.x > 0) { block.x = otherBlock.x - 20; }
                            else if (block.body && block.body.velocity.x < 0) { block.x = otherBlock.x + 20; }
                        } catch (e) { }
                    }
                });
                if (block.y >= 590 || block.y <= 10 || block.x <= 10 || block.x >= 790) {
                    try { block.setData('landed', true); block.body.setVelocity(0, 0); block.y = Phaser.Math.Clamp(block.y, 10, 590); block.x = Phaser.Math.Clamp(block.x, 10, 790); } catch (e) { }
                }
            });
        } catch (e) { }

        // Cleanup bullets and blocks out of bounds
        try { (window.bullets && window.bullets.children && window.bullets.children.entries || []).forEach(bullet => { if (bullet.y < -20) bullet.destroy(); }); } catch (e) { }
        try { (window.blocks && window.blocks.children && window.blocks.children.entries || []).forEach(block => { if (block.x < -100 || block.x > 900 || block.y < -100 || block.y > 700) { if (!block.getData || !block.getData('landed')) { try { block.destroy(); } catch (e) { } } } }); } catch (e) { }
    } catch (e) { console.warn('[scene.update] error', e); }
}
