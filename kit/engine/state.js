import { kitGame } from '../core/flow.js';

export function clearRuntimeMatchStorage(logger) {
    logger.trace('clearRuntimeMatchStorage', 'Pulizia storage runtime/sessione');
    try {
        if (window && window.localStorage) {
            // Runtime-only persistence for the current run
            localStorage.removeItem(kitGame.storageKey('PlacedPlanks'));
        }
    } catch (e) { }

    try {
        if (window && window.sessionStorage) {
            // Session data should never leak across fresh runs
            sessionStorage.clear();
        }
    } catch (e) { }
}

/** `start`: the game's values for a new run (game.js → newRun), e.g. { lives: 5, dynamiteCount: 20 } */
export function resetGameStateForNewRun(gameState, clearRuntimeStorage, logger, players = 1, start = {}) {
    logger.info('resetGameStateForNewRun', 'Reset stato partita', `players=${players}`);
    const p = Number(players) === 2 ? 2 : 1;

    gameState.players = p;
    gameState.currentLevel = 0;
    gameState.score = 0;
    gameState.isGameOver = false;

    const lives = Number(start.lives) > 0 ? Number(start.lives) : 5;
    gameState.lives = lives;
    gameState.dynamiteCount = Number.isFinite(Number(start.dynamiteCount)) ? Number(start.dynamiteCount) : 20;
    gameState.keysCount = 0;
    gameState.woodenCount = 0;

    gameState.keysP1 = 0;
    gameState.keysP2 = 0;
    gameState.woodenP1 = 0;
    gameState.woodenP2 = 0;

    if (p === 2) {
        gameState.livesP1 = lives;
        gameState.livesP2 = lives;
    } else {
        delete gameState.livesP1;
        delete gameState.livesP2;
    }

    gameState.placedPlanks = [];
    clearRuntimeStorage();
}
