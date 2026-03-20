export function isFreeplayEnabled(config) {
    return Boolean(config && config.freeplay === true);
}

export function hasStartAccessForPlayers(config, gameState, players) {
    if (isFreeplayEnabled(config)) return true;
    return (Number(gameState.credits) || 0) >= players;
}

export function consumeCreditsForPlayers(config, gameState, players) {
    if (isFreeplayEnabled(config)) return;
    gameState.credits = Math.max(0, (Number(gameState.credits) || 0) - players);
}

export function clearRuntimeMatchStorage(logger) {
    logger.trace('clearRuntimeMatchStorage', 'Pulizia storage runtime/sessione');
    try {
        if (window && window.localStorage) {
            // Runtime-only persistence for the current run
            localStorage.removeItem('blockHunterPlacedPlanks');
        }
    } catch (e) { }

    try {
        if (window && window.sessionStorage) {
            // Session data should never leak across fresh runs
            sessionStorage.clear();
        }
    } catch (e) { }
}

export function resetGameStateForNewRun(gameState, clearRuntimeStorage, logger, players = 1) {
    logger.info('resetGameStateForNewRun', 'Reset stato partita', `players=${players}`);
    const p = Number(players) === 2 ? 2 : 1;

    gameState.players = p;
    gameState.currentLevel = 0;
    gameState.score = 0;
    gameState.isGameOver = false;

    gameState.lives = 5;
    gameState.dynamiteCount = 20;
    gameState.keysCount = 0;
    gameState.woodenCount = 0;

    gameState.keysP1 = 0;
    gameState.keysP2 = 0;
    gameState.woodenP1 = 0;
    gameState.woodenP2 = 0;

    if (p === 2) {
        gameState.livesP1 = 5;
        gameState.livesP2 = 5;
    } else {
        delete gameState.livesP1;
        delete gameState.livesP2;
    }

    gameState.placedPlanks = [];
    clearRuntimeStorage();
}
