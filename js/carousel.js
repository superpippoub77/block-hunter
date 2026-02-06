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
    // opts:
    //  - items: array of language ids (defaults to window.LANGS)
    //  - onLeft / onRight: callbacks invoked when left/right are activated
    //  - centerSize / sideSize / sideAlpha / interactive as before
    opts = Object.assign({ items: (window && window.LANGS) ? window.LANGS.slice() : null, centerSize: { w: 96, h: 48 }, sideSize: { w: 64, h: 32 }, sideAlpha: 0.45, interactive: true, onLeft: null, onRight: null }, opts || {});
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

        // Create optional arrow text buttons internally (unless caller manages them)
        // opts.createArrows === false disables internal creation
        let leftArrow = null, rightArrow = null;
        if (opts.createArrows !== false) {
            try {
                const arrowStyle = Object.assign({ fontSize: '24px', fontFamily: (window && window.GAME_FONT) ? window.GAME_FONT : 'Press Start 2P', fill: '#00ffff' }, opts.arrowStyle || {});
                leftArrow = scene.add.text(centerX - 80, y, '<', arrowStyle).setOrigin(0.5);
                rightArrow = scene.add.text(centerX + 80, y, '>', arrowStyle).setOrigin(0.5);
                try { if (opts.interactive && leftArrow.setInteractive) leftArrow.setInteractive({ useHandCursor: true }); } catch (e) { }
                try { if (opts.interactive && rightArrow.setInteractive) rightArrow.setInteractive({ useHandCursor: true }); } catch (e) { }
                // wire to the same handlers used by flags
                try { if (leftArrow && leftArrow.on && _onLeftCb) leftArrow.on('pointerdown', _leftHandler); } catch (e) { }
                try { if (rightArrow && rightArrow.on && _onRightCb) rightArrow.on('pointerdown', _rightHandler); } catch (e) { }
                // add arrows to the provided container so they render alongside flags
                try { container.add([leftArrow, rightArrow]); } catch (e) { }
            } catch (e) { /* ignore arrow creation errors */ }
        }

        // attach built-in pointer handlers that call provided callbacks (if any)
        const _onLeftCb = typeof opts.onLeft === 'function' ? opts.onLeft : null;
        const _onRightCb = typeof opts.onRight === 'function' ? opts.onRight : null;
        const _leftHandler = () => { try { if (_onLeftCb) _onLeftCb(); } catch (e) { /* ignore */ } };
        const _rightHandler = () => { try { if (_onRightCb) _onRightCb(); } catch (e) { /* ignore */ } };
        try { if (left && left.on && _onLeftCb) left.on('pointerdown', _leftHandler); } catch (e) { }
        try { if (right && right.on && _onRightCb) right.on('pointerdown', _rightHandler); } catch (e) { }

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
            // allow attaching external arrow GameObjects (text buttons) to reuse the same handlers
            attachArrows: (leftArrowObj, rightArrowObj) => {
                try {
                    if (leftArrowObj && leftArrowObj.on && _onLeftCb) {
                        leftArrowObj.off && leftArrowObj.off('pointerdown', _leftHandler);
                        leftArrowObj.on('pointerdown', _leftHandler);
                    }
                } catch (e) { }
                try {
                    if (rightArrowObj && rightArrowObj.on && _onRightCb) {
                        rightArrowObj.off && rightArrowObj.off('pointerdown', _rightHandler);
                        rightArrowObj.on('pointerdown', _rightHandler);
                    }
                } catch (e) { }
            },
            // expose internally created arrows (may be null if creation disabled)
            leftArrow,
            rightArrow,
            destroy: () => {
                try { if (left && left.destroy) left.destroy(); } catch (e) { }
                try { if (center && center.destroy) center.destroy(); } catch (e) { }
                try { if (right && right.destroy) right.destroy(); } catch (e) { }
                try { if (leftArrow && leftArrow.destroy) leftArrow.destroy(); } catch (e) { }
                try { if (rightArrow && rightArrow.destroy) rightArrow.destroy(); } catch (e) { }
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
