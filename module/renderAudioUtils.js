export function drawTextPanel(graphics, textObj, opts = {}, logger) {
    logger.trace('drawTextPanel', 'Disegno pannello testo');
    const paddingX = opts.paddingX || 12;
    const paddingY = opts.paddingY || 6;
    const radius = opts.radius || 6;

    graphics.clear();
    if (!textObj || !textObj.text) return;

    const width = (textObj.width || 0) + paddingX * 2;
    const height = (textObj.height || 0) + paddingY * 2;
    const x = textObj.x - width * (textObj.originX || 0.5);
    const y = textObj.y - height * (textObj.originY || 0.5);

    graphics.fillStyle(0x000000, 0.35);
    if (graphics.fillRoundedRect) {
        graphics.fillRoundedRect(x, y, width, height, radius);
    } else {
        graphics.fillRect(x, y, width, height);
    }

    graphics.lineStyle(2, 0x000000, 1);
    if (graphics.strokeRoundedRect) {
        graphics.strokeRoundedRect(x, y, width, height, radius);
    } else {
        graphics.strokeRect(x, y, width, height);
    }

    try {
        graphics.setDepth((textObj.depth || 0) - 1);
    } catch (e) {
        // ignore if depth cannot be set
    }
}

export function getTextureMaxNumericFrame(scene, textureKey, fallback = 0, logger) {
    logger.trace('getTextureMaxNumericFrame', 'Risoluzione frame massimo', `textureKey=${textureKey}`);
    try {
        const texture = scene?.textures?.get(textureKey);
        if (!texture) return fallback;

        const names = texture.getFrameNames ? texture.getFrameNames() : [];
        const numericFrames = names
            .map((name) => Number(name))
            .filter((value) => Number.isFinite(value));

        if (numericFrames.length > 0) {
            return Math.max(...numericFrames);
        }

        const frameTotal = Number(texture.frameTotal);
        if (Number.isFinite(frameTotal) && frameTotal > 1) {
            return Math.max(0, frameTotal - 1);
        }
    } catch (e) {
        // ignore and use fallback
    }

    return fallback;
}

export function playLoopAudioSafely(scene, key, volume = 0.3, logger) {
    logger.debug('playLoopAudioSafely', 'Avvio audio loop', `key=${key}`);
    const sound = scene?.sound;
    if (!sound) return;

    const playNow = () => {
        const existing = sound.get(key);
        if (existing) {
            if (!existing.isPlaying) {
                existing.play({ loop: true, volume });
            }
            return;
        }
        sound.play(key, { loop: true, volume });
    };

    if (sound.locked) {
        sound.once('unlocked', () => {
            try {
                playNow();
            } catch (e) {
                // ignore autoplay race errors
            }
        });
        return;
    }

    try {
        const ctx = sound.context;
        if (ctx && ctx.state === 'suspended' && ctx.resume) {
            ctx.resume().catch(() => { });
        }
    } catch (e) {
        // ignore
    }

    playNow();
}
