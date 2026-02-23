// Global game configuration. Edit this file to tweak gameplay parameters.
// Exposed as window.GAME_CONFIG so it can be read/modified at runtime.
window.GAME_CONFIG = {
    // Rendering / scale
    SIZE_SCALE: 1.5,

    // Timing
    CONTINUE_FRAMES: 600, // 10s at ~60fps
    TRANSITION_FRAMES: 150, // ~2.5s at 60fps

    DIMENSIONS: { width: 800, height: 600 },
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

    //FONTBASE
    FONTBASE: '18px',

    // Block sizing config
    BLOCK_SIZE_CONFIG: {
        distribution: { small: 0.35, medium: 0.5, large: 0.15 },
        multipliers: { small: 0.7, medium: 1.0, large: 1.5 }
    }
    ,
    // Control mapping: define keys used by player 1 and player 2.
    // Each entry uses key names that match Phaser's Keyboard.KeyCodes (e.g. 'LEFT','A','Z','SPACE').
    // Values may be strings (single key) or arrays (primary + alternates).
    controlPanel: {
        player1: {
            // movement: arrow keys as default for player1
            move: { left: 'LEFT', right: 'RIGHT', up: 'UP', down: 'DOWN' },
            // shooting / dynamite: prefer 'X', keep 'SPACE' as legacy fallback
            shoot: ['X', 'SPACE'],
            // action/confirm (place/open): primary 'Z'
            action: ['Z']
        },
        player2: {
            // movement: WASD for player2
            move: { left: 'A', right: 'D', up: 'W', down: 'S' },
            // shooting: prefer 'M' with 'N' as alternate; keep 'F' as legacy fallback
            shoot: ['M', 'N', 'F'],
            // action/confirm: use 'M' and 'N' for player2 actions
            action: ['M', 'N']
        }
    }
    ,
    // How many credits are required per player (set to 1 by default). The second
    // player requires exactly double this amount.
    CREDITS_PER_PLAYER: 1,
    PULSE: { title: false, coin: false }
};

// Make a convenience alias for console tweaking
window.BLOCK_SIZE_CONFIG = window.GAME_CONFIG.BLOCK_SIZE_CONFIG;
// Expose control panel mapping for easy access at runtime (console/tests)
window.CONTROL_PANEL = window.GAME_CONFIG.controlPanel;
