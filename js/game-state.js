// Runtime game state variables. These are the mutable game values tracked during play.
// This file is included before the main inline script so the variables are available globally.

// Game state
let gameState = 'attract'; // attract, playing, gameOver
let score = 0;
// level kept for compatibility (combined stage = (gameLevel-1)*5 + subLevel)
let level = 1;
// New structured levels: gameLevel (1..5) and subLevel (1..5)
let gameLevel = 1;
let subLevel = 1;
let stageConfig = {};
// Credits and players
let credits = 0;
let numPlayers = 1;
let continueDiv = null;
let continueTimer = 0;
let continueEligibleTopTen = false;
let storedFinalScore = 0;
// Gems and transitions
let gemsCollected = 0;
let inTransition = false;
let transitionTimer = 0;
let transitionText = '';

// Floating texts (score, key, door messages)
let floatingTexts = [];

let lives = 3;
let frameCount = 0;
