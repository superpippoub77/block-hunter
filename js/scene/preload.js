// Scene preload implementation (cleaned up).
// Exports a single function `preload(scene)` used by the Phaser config.

export function preload(scene) {
    // Accept either an explicit `scene` parameter or use `this` when Phaser calls
    // the function with the scene as `this` (common when functions are passed
    // directly to the Phaser scene config). This keeps both calling styles working.
    scene = scene || this;
    if (!scene || !scene.load) {
        console.warn('[scene.preload] no scene/load available, skipping preload');
        return;
    }

    try {
        console.log('Preloading assets...');

        // EVENTS
        scene.load.on('complete', () => {
            console.log(' Tutti gli asset caricati correttamente');
        });

        scene.load.on('loaderror', (file) => {
            console.error(' Errore nel caricamento:', file && file.key, file && file.src);
            // throw to surface critical preload errors during development
            throw new Error('Errore nel preload, esecuzione interrotta');
        });

        scene.load.on('filecomplete', (key, type, data) => {
            console.log(` Caricato: ${key} (${type})`);
        });

        // BACKGROUND / TITLE / FLAGS
        scene.load.image('attractBg', 'images/bg.png');
        scene.load.image('title', 'images/title.png');
        try {
            scene.load.spritesheet('flags', 'images/flags.png', { frameWidth: 64, frameHeight: 32 });
        } catch (e) {
            // fallback to plain image if spritesheet load isn't supported in the environment
            scene.load.image('flags', 'images/flags.svg');
        }

        // TILES & OBJECTS
        scene.load.image('tileSheet', 'images/tile.png');
        scene.load.image('spriteSheet', 'images/objects.png');

        // PLAYER SPRITESHEET
        scene.load.spritesheet('player', 'images/player.png', {
            frameWidth: 64,
            frameHeight: 64
        });
    } catch (e) {
        // Log but don't crash the module loader; caller can decide how to handle.
        console.error('[scene.preload] error', e);
    }
}
