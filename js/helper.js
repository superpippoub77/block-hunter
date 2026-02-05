/* Helper functions moved out of block-hunter-phaser.html
   Exposes global functions:
     - typeWriter(scene, textObj, fullText, charDelay, pauseAfter, loop)
     - fallLetters(scene, textObj, fullText, opts)
*/

// Typewriter effect helper for Phaser Text objects.
// - scene: current Phaser Scene
// - textObj: Phaser Text object
// - fullText: string to type (may contain newlines)
// - charDelay: ms per character
// - pauseAfter: ms to wait after full text before clearing and restarting (if loop)
// - loop: boolean, whether to repeat typing
export function typeWriter(scene, textObj, fullText, charDelay = 40, pauseAfter = 1200, loop = true) {
    try {
        if (!scene || !textObj || typeof fullText !== 'string') return;
        // cancel any previous typing event attached to this object
        try { if (textObj._typeEvent) { textObj._typeEvent.remove(false); textObj._typeEvent = null; } } catch (e) { }
        try { textObj.setText(''); } catch (e) { }
        let idx = 0;
        const total = fullText.length;
        textObj._typeEvent = scene.time.addEvent({
            delay: charDelay,
            loop: true,
            callback: () => {
                try {
                    idx = Math.min(total, idx + 1);
                    textObj.setText(fullText.slice(0, idx));
                    if (idx >= total) {
                        // finished typing
                        try { if (textObj._typeEvent) { textObj._typeEvent.remove(false); textObj._typeEvent = null; } } catch (e) { }
                        if (loop) {
                            try {
                                scene.time.delayedCall(pauseAfter, () => {
                                    try {
                                        // restart typing
                                        typeWriter(scene, textObj, fullText, charDelay, pauseAfter, loop);
                                    } catch (e) { /* ignore */ }
                                });
                            } catch (e) { /* ignore scheduling errors */ }
                        }
                    }
                } catch (e) { /* ignore per-tick errors */ }
            }
        });
    } catch (e) { /* ignore */ }
}
// also expose on window for backward compatibility
try { window.typeWriter = typeWriter; } catch (e) { /* ignore */ }

// Falling-letters effect: letters drop from above and create a puff on landing.
// - scene: Phaser Scene
// - textObj: original Phaser Text object (will be hidden)
// - fullText: string with possible newlines
// - opts: { gravityDropMin, gravityDropMax, durationMin, durationMax, puffColor, lineSpacing }
export function fallLetters(scene, textObj, fullText, opts = {}) {
    try {
        if (!scene || !textObj || typeof fullText !== 'string') return;
        opts = Object.assign({ gravityDropMin: 180, gravityDropMax: 420, durationMin: 600, durationMax: 1100, puffColor: 0xffffff, lineSpacing: 10 }, opts || {});

        // remember the full text and options so the effect can be recreated later
        try { textObj._fallFullText = fullText; textObj._fallOpts = Object.assign({}, opts); } catch (e) { }

        // clean previous letters if any
        try {
            if (textObj._letters && Array.isArray(textObj._letters)) {
                textObj._letters.forEach(o => { try { o.destroy && o.destroy(); } catch (e) { } });
                textObj._letters = null;
            }
        } catch (e) { }

        // hide the original textObj (we'll render per-char)
        try { textObj.setText(''); textObj.setVisible(false); } catch (e) { }

        const lines = fullText.split('\n');
        const style = { fontSize: (window.GAME_CONFIG && window.GAME_CONFIG.FONTBASE) || '14px', fontFamily: (window.GAME_FONT || '"Press Start 2P"'), color: '#00ffff', stroke: '#000000', strokeThickness: 4 };
        const created = [];

        const centerX = textObj.x || (scene.scale.width / 2);
        const baseY = textObj.y || 280;

        // For each line compute widths by creating char objects first (offscreen), then position and animate
        for (let li = 0; li < lines.length; li++) {
            const line = lines[li] || '';
            // compute character widths and total
            const charWidths = [];
            let totalW = 0;
            for (let ci = 0; ci < line.length; ci++) {
                const ch = line[ci] || ' ';
                const m = scene.add.text(-9999, -9999, ch, style).setOrigin(0, 0.5);
                const w = m.width || ((parseInt(style.fontSize, 10) || 14) * 0.6);
                charWidths.push(w);
                totalW += w;
                m.destroy();
            }

            let startX = Math.round(centerX - totalW / 2);
            let accum = 0;
            const lineHeight = (parseInt(style.fontSize, 10) || 14) + (opts.lineSpacing || 10);

            for (let ci = 0; ci < line.length; ci++) {
                const ch = line[ci] || ' ';
                const w = charWidths[ci] || ((parseInt(style.fontSize, 10) || 14) * 0.6);
                const targetX = Math.round(startX + accum);
                const targetY = Math.round(baseY + li * lineHeight);
                accum += w;

                const dropStartY = targetY - (opts.gravityDropMin + Math.random() * (opts.gravityDropMax - opts.gravityDropMin));
                const dur = Math.round(opts.durationMin + Math.random() * (opts.durationMax - opts.durationMin));

                const chObj = scene.add.text(targetX, dropStartY, ch, Object.assign({}, style)).setOrigin(0, 0.5);
                try { chObj.setDepth(750); } catch (e) { }
                chObj.setAlpha(0.0);

                // tiny delay per char for nicer staggering
                const delay = Math.round(ci * 18 + li * 80 + Math.random() * 120);

                scene.time.delayedCall(delay, () => {
                    try {
                        scene.tweens.add({
                            targets: chObj,
                            y: targetY,
                            alpha: 1,
                            ease: 'Cubic.easeIn',
                            duration: dur,
                            onComplete: () => {
                                try {
                                    // puff effect
                                    const puff = scene.add.circle(targetX + (w / 2), targetY + 2, 2, opts.puffColor).setOrigin(0.5);
                                    try { puff.setDepth(760); } catch (e) { }
                                    scene.tweens.add({ targets: puff, scale: 6, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => { try { puff.destroy(); } catch (e) { } } });
                                    // small bounce on character
                                    scene.tweens.add({ targets: chObj, y: targetY - 6, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
                                } catch (e) { /* ignore */ }
                            }
                        });
                    } catch (e) { /* ignore */ }
                });

                created.push(chObj);
            }
        }

        // store for cleanup
        textObj._letters = created;
        // mark destroyed flag as false
        try { textObj._lettersDestroyed = false; } catch (e) { }
    } catch (e) { console.warn('fallLetters error', e); }
}
// also expose on window for backward compatibility
try { window.fallLetters = fallLetters; } catch (e) { /* ignore */ }
