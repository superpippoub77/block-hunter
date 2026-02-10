// Level 1 - sublevel 0 (1.0)
// 12 cols x 8 rows

window.LEVELS = window.LEVELS || {};

window.LEVELS["1.0"] = {
  id: "1.0",

  map: {
    cols: 12,
    rows: 8,
    tiles: [
      ['floor','floor','floor','floor','floor','floor','floor','floor','floor','floor','floor','gem'],
      ['floor','gem','floor','floor','floor','floor','gem','floor','floor','floor','floor','floor'],
      ['floor','floor','floor','floor','hole','floor','floor','hole','floor','floor','floor','floor'],
      ['floor','floor','floor','floor','floor','floor','gem','floor','gem','floor','gem','floor'],
      ['floor','floor','floor','floor','floor','floor','floor','floor','floor','floor','floor','floor'],
      ['floor','floor','gem','floor','floor','hole','floor','floor','floor','floor','floor','floor'],
      ['floor','floor','floor','floor','gem','floor','floor','floor','floor','floor','floor','floor'],
      ['gem','hole','floor','floor','floor','floor','floor','hole','floor','floor','gem','floor']
    ]
  },

  // --- ENVIRONMENT ---
  staticRocks: {
    enabled: true,
    dynamicSize: null,
    rotation: null,
    chaotic: null
  },

  dynamicBoulders: {
    enabled: false,
    directions: null,
    sizes: null
  },

  // --- GAMEPLAY ---
  speed: 1,
  escapeRoute: false,

  // --- EXTENSIBILITY (future-proof) ---
  enemies: null,
  collectibles: null,
  traps: null,
  spawnPoints: null,
  timeLimit: null,
  scoreRules: null
};
