export function queueLegacyPreloadAssets(scene, logger, preloadSpritesheetConfigs) {
    logger.debug('queueLegacyPreloadAssets', 'Caricamento preload legacy');
    scene.load
        .image('title', 'assets/images/common/title.png')
        .image('explorer', 'assets/images/common/explorer.png')
        .image('title_explosion', 'assets/images/common/title_explosion.png')
        .image('bg', 'assets/images/common/attract_bg.png')
        .image('game_bg', 'assets/images/common/level1.png')
        .spritesheet('flags', 'assets/images/common/flags.png', preloadSpritesheetConfigs.flags)
        .spritesheet('tiles', 'assets/images/common/tiles.png', preloadSpritesheetConfigs.tiles)
        .spritesheet('wall_tiles', 'assets/images/common/wall_completed.png', preloadSpritesheetConfigs.wall_tiles)
        .spritesheet('objects', 'assets/images/common/obj_game.png', preloadSpritesheetConfigs.objects)
        .spritesheet('bat', 'assets/images/common/bat.png', preloadSpritesheetConfigs.bat)
        .spritesheet('ghost', 'assets/images/common/ghost.png', preloadSpritesheetConfigs.ghost)
        .spritesheet('spider', 'assets/images/common/spider.png', preloadSpritesheetConfigs.spider)
        .spritesheet('snake', 'assets/images/common/snake.png', preloadSpritesheetConfigs.snake)
        .spritesheet('player_front', 'assets/images/common/player_front_10.png', preloadSpritesheetConfigs.player_front)
        .spritesheet('player_back', 'assets/images/common/player_front_10.png', preloadSpritesheetConfigs.player_back)
        .spritesheet('player_right', 'assets/images/common/player_front_10.png', preloadSpritesheetConfigs.player_right)
        .spritesheet('player_back_right', 'assets/images/common/player_front_10.png', preloadSpritesheetConfigs.player_back_right)
        .audio('intro_bgm', 'assets/music/intro.mp3')
        .audio('game_bgm', 'assets/music/game.mp3')
        .audio('step_sfx', 'assets/music/step.mp3')
        .audio('stone_sfx', 'assets/music/stone.mp3')
        .audio('explosion_sfx', 'assets/music/explosion.mp3')
        .audio('gem_sfx', 'assets/music/gem.mp3')
        .audio('rolling_sfx', 'assets/music/rolling_stones.mp3')
        .audio('gameover_sfx', 'assets/music/gameover.mp3')
        .audio('level_completed_sfx', 'assets/music/level_completed.mp3')
        .audio('coin_sfx', 'assets/music/coin.mp3')
        .audio('select_sfx', 'assets/music/select.mp3')
        .audio('ghost_sfx', 'assets/music/ghost.mp3')
        .audio('bat_sfx', 'assets/music/bat.mp3')
        .audio('rain_sfx', 'assets/music/rain.mp3')
        .image('game_bg_1', 'assets/images/common/level1.png')
        .image('game_bg_2', 'assets/images/common/level2.png')
        .image('game_bg_3', 'assets/images/common/level3.png')
        .image('game_bg_4', 'assets/images/common/level4.png')
        .image('game_bg_5', 'assets/images/common/level5.png')
        .image('game_fg', 'assets/images/common/foreground.png');
}

export function queueAssetsFromManifest(scene, manifest, logger, preloadSpritesheetConfigs) {
    logger.debug('queueAssetsFromManifest', 'Inizio enqueue da manifest');
    if (!manifest || typeof manifest !== 'object') return 0;

    let queued = 0;
    const buckets = ['music', 'objects', 'backgrounds', 'foregrounds'];

    buckets.forEach((bucket) => {
        const entries = manifest[bucket];
        if (!Array.isArray(entries)) return;

        entries.forEach((entry) => {
            if (!entry || entry.inPreload !== true || entry.exists === false || !entry.key || !entry.path) {
                return;
            }

            const spriteConfig = preloadSpritesheetConfigs[entry.key];
            if (bucket === 'music') {
                scene.load.audio(entry.key, entry.path);
            } else if (spriteConfig) {
                scene.load.spritesheet(entry.key, entry.path, spriteConfig);
            } else {
                scene.load.image(entry.key, entry.path);
            }

            queued += 1;
        });
    });

    logger.info('queueAssetsFromManifest', 'Enqueue completato', `queued=${queued}`);
    return queued;
}
