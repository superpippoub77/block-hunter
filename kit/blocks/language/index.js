// Small reusable language carousel UI for scenes
export function createLanguageCarousel(scene, opts = {}) {
    const languages = opts.languages || ['it', 'fr', 'de', 'en', 'us', 'ja', 'es', 'zh'];
    let index = (typeof opts.index === 'number') ? opts.index : 0;
    const x = (typeof opts.x === 'number') ? opts.x : 400;
    const y = (typeof opts.y === 'number') ? opts.y : 560;
    const hudDepth = (typeof opts.hudDepth === 'number') ? opts.hudDepth : 10000;
    const font = opts.font || '"Press Start 2P"';

    const flagSprite = scene.add.sprite(x, y, 'flags', index).setOrigin(0.5).setDepth(hudDepth).setScrollFactor(0);
    // store the base X so external animations can reliably reset position
    flagSprite.baseX = x;
    try {
        scene.tweens.add({
            targets: flagSprite,
            scaleX: 1.05,
            scaleY: 0.98,
            angle: -2,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        scene.tweens.add({
            targets: flagSprite,
            y: y - 2,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 200
        });
    } catch (e) { }

    const leftArrow = scene.add.text(x - 80, y, '◄', {
        fontSize: '24px',
        fill: '#ffffff',
        fontFamily: font
    }).setOrigin(0.5).setInteractive().setDepth(hudDepth).setScrollFactor(0);

    const rightArrow = scene.add.text(x + 80, y, '►', {
        fontSize: '24px',
        fill: '#ffffff',
        fontFamily: font
    }).setOrigin(0.5).setInteractive().setDepth(hudDepth).setScrollFactor(0);

    const pulseArrow = (arrow) => {
        if (!arrow) return;
        try {
            const original = (arrow.style && arrow.style.fill) || '#ffffff';
            arrow.setStyle && arrow.setStyle({ fill: '#ffff00' });
            scene.tweens.add({ targets: arrow, scaleX: 1.6, scaleY: 1.6, duration: 120, yoyo: true, ease: 'Sine.easeOut', onComplete: () => {
                try { arrow.setStyle && arrow.setStyle({ fill: original }); } catch (e) { }
            }});
        } catch (e) { }
    };

    const setIndex = (newIndex, dir) => {
        index = ((newIndex % languages.length) + languages.length) % languages.length;
        try { flagSprite.setFrame(index); } catch (e) { }
        if (typeof opts.onIndexChange === 'function') {
            try { opts.onIndexChange(index, languages[index], dir); } catch (e) { }
        }
    };

    // attach pointer handlers that call scene.changeLanguage (if available) or fall back to setIndex
    try {
        leftArrow.on && leftArrow.on('pointerdown', () => {
            try { pulseArrow(leftArrow); } catch (e) {}
            if (typeof opts.onRequestChange === 'function') {
                try { opts.onRequestChange(-1); } catch (e) {}
            } else if (scene && typeof scene.changeLanguage === 'function') {
                try { scene.changeLanguage(-1); } catch (e) {}
            } else {
                setIndex(index - 1, -1);
            }
        });
    } catch (e) { }
    try {
        rightArrow.on && rightArrow.on('pointerdown', () => {
            try { pulseArrow(rightArrow); } catch (e) {}
            if (typeof opts.onRequestChange === 'function') {
                try { opts.onRequestChange(1); } catch (e) {}
            } else if (scene && typeof scene.changeLanguage === 'function') {
                try { scene.changeLanguage(1); } catch (e) {}
            } else {
                setIndex(index + 1, 1);
            }
        });
    } catch (e) { }

    // expose on the scene for backward compatibility so game.js doesn't need extra assignments
    try {
        if (scene) {
            scene.flagSprite = flagSprite;
            scene.leftArrow = leftArrow;
            scene.rightArrow = rightArrow;
            scene.pulseArrow = pulseArrow;
        }
    } catch (e) { }

    return {
        languages,
        get index() { return index; },
        flagSprite,
        leftArrow,
        rightArrow,
        pulseArrow,
        setIndex
    };
}
