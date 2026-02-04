// Global game configuration. Edit this file to tweak gameplay parameters.
// Exposed as window.GAME_CONFIG so it can be read/modified at runtime.
window.GAME_CONFIG = {
    // Rendering / scale
    SIZE_SCALE: 1.5,

    // Timing
    CONTINUE_FRAMES: 600, // 10s at ~60fps
    TRANSITION_FRAMES: 150, // ~2.5s at 60fps

    // Level / scoring
    GEMS_PER_STAGE: 20,

    // Player
    PLAYER_INITIAL_SPEED: 5,
    PLAYER_MIN_SPEED: 1,

    // Playfield
    OUTER_BAND: 80,

    // Explosions / effects
    STRONG_EXPLOSION_THRESHOLD: 4,

    // Powerups / durations
    DOUBLOON_DURATION_FRAMES: 5 * 60, // ~5 seconds

    // Inventory limits
    DYNAMITE_MAX: 50,

    // Block sizing config
    BLOCK_SIZE_CONFIG: {
        distribution: { small: 0.35, medium: 0.5, large: 0.15 },
        multipliers: { small: 0.7, medium: 1.0, large: 1.5 }
    }
    ,
    // How many credits are required per player (set to 1 by default). The second
    // player requires exactly double this amount.
    CREDITS_PER_PLAYER: 1,
    PULSE: { title: false, coin: false }
};

// Make a convenience alias for console tweaking
window.BLOCK_SIZE_CONFIG = window.GAME_CONFIG.BLOCK_SIZE_CONFIG;
