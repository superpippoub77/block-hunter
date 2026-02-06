// Modular carousel factory for Phaser scenes
// Exports createFlagCarousel(scene, container, centerX, y, initialIndex, opts)
// opts can include:
//  - items: array of items (if using spritesheet, length is number of frames)
//  - frameWidth/frameHeight: desired display sizes for center/side
//  - centerSize: {w,h} default 96x48
//  - sideSize: {w,h} default 64x32
//  - sideAlpha: default 0.45
//  - interactive: whether to setInteractive (default true)
// Returns { left, center, right, setIndex, destroy }

export function createFlagCarousel(scene, container, centerX, y, initialIndex = 0, opts = {}) {
    if (!scene || !container) return null;
    opts = Object.assign({ items: (window && window.LANGS) ? window.LANGS.slice() : null, centerSize: { w: 96, h: 48 }, sideSize: { w: 64, h: 32 }, sideAlpha: 0.45, interactive: true }, opts || {});
    const items = Array.isArray(opts.items) ? opts.items : (window && window.LANGS ? window.LANGS : []);
    if (!items || !items.length) return null;
    initialIndex = ((initialIndex || 0) % items.length + items.length) % items.length;

    const leftX = centerX - 96;
    const centerXpos = centerX;
    const rightX = centerX + 96;
    let left = null, center = null, right = null;

    try {
        const tex = scene.textures.get('flags');
        const isSheet = !!(tex && tex.frameTotal && tex.frameTotal > 1);

        if (isSheet) {
            left = scene.add.sprite(leftX, y, 'flags', (initialIndex - 1 + items.length) % items.length).setOrigin(0.5, 0.5);
            center = scene.add.sprite(centerXpos, y, 'flags', initialIndex).setOrigin(0.5, 0.5);
            right = scene.add.sprite(rightX, y, 'flags', (initialIndex + 1) % items.length).setOrigin(0.5, 0.5);

            try { center.setDisplaySize(opts.centerSize.w, opts.centerSize.h); } catch (e) { }
            try { left.setDisplaySize(opts.sideSize.w, opts.sideSize.h); right.setDisplaySize(opts.sideSize.w, opts.sideSize.h); } catch (e) { }
            try { left.setAlpha(opts.sideAlpha); right.setAlpha(opts.sideAlpha); } catch (e) { }
        } else {
            left = scene.add.image(leftX, y, 'flags').setOrigin(0.5, 0.5);
            center = scene.add.image(centerXpos, y, 'flags').setOrigin(0.5, 0.5);
            right = scene.add.image(rightX, y, 'flags').setOrigin(0.5, 0.5);

            try { center.setDisplaySize(opts.centerSize.w, opts.centerSize.h); } catch (e) { }
            try { left.setDisplaySize(opts.sideSize.w, opts.sideSize.h); right.setDisplaySize(opts.sideSize.w, opts.sideSize.h); } catch (e) { }
            try { left.setAlpha(opts.sideAlpha); right.setAlpha(opts.sideAlpha); } catch (e) { }
        }

        if (opts.interactive) {
            try { if (left && left.setInteractive) left.setInteractive({ useHandCursor: true }); } catch (e) { }
            try { if (center && center.setInteractive) center.setInteractive({ useHandCursor: true }); } catch (e) { }
            try { if (right && right.setInteractive) right.setInteractive({ useHandCursor: true }); } catch (e) { }
        }

        container.add([left, center, right]);

        const api = {
            left,
            center,
            right,
            setIndex: (idx) => {
                try {
                    const newIdx = ((idx || 0) % items.length + items.length) % items.length;
                    // update frames if spritesheet
                    if (isSheet) {
                        try { center.setFrame(newIdx); } catch (e) { }
                        try { left.setFrame((newIdx - 1 + items.length) % items.length); } catch (e) { }
                        try { right.setFrame((newIdx + 1) % items.length); } catch (e) { }
                    } else {
                        // for image-based flags we can't setFrame; assume texture contains whole strip
                        // and caller will handle cropping externally via updateFlagCrop
                    }
                } catch (e) { /* ignore */ }
            },
            destroy: () => {
                try { if (left && left.destroy) left.destroy(); } catch (e) { }
                try { if (center && center.destroy) center.destroy(); } catch (e) { }
                try { if (right && right.destroy) right.destroy(); } catch (e) { }
            }
        };

        return api;
    } catch (e) {
        console.warn('[CAROUSEL] failed to create carousel', e);
        try { if (left && left.destroy) left.destroy(); } catch (ee) { }
        try { if (center && center.destroy) center.destroy(); } catch (ee) { }
        try { if (right && right.destroy) right.destroy(); } catch (ee) { }
        return null;
    }
}
