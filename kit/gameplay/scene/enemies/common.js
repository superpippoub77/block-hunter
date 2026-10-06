// Nemici: funzioni comuni.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createEnemiesCommonMixin(deps) {
const {
    Phaser,
    CONFIG,
    GAME_STATE,
    GAME_FONT,
    HUD_DEPTH,
    TRANSLATIONS,
    LOGGER,
    OBJECT_FRAMES,
    TILE_FRAMES,
    WALL_TILE_COLS,
    applyMappingFrameOverrides,
    isFreeplayEnabled,
    hasStartAccessForPlayers,
    consumeCreditsForPlayers,
    TILE_NATIVE_WIDTH,
    TILE_NATIVE_HEIGHT,
    OBJECT_NATIVE_SIZE,
    defaultFrame,
    PRELOAD_ASSET_MANIFEST_KEY,
    PRELOAD_ASSET_MANIFEST_PATH,
    PRELOAD_SPRITESHEET_CONFIGS,
    LOG_LEVELS,
    LOG_LEVEL_NAMES,
    normalizeLogLevel,
    readInitialLogLevel,
    inferPurposeFromName,
    getFunctionParamNames,
    inferOutputFromName,
    toDocEntry,
    buildTopLevelFunctionDocs,
    buildSceneMethodsDocs,
    chooseTraceLevel,
    instrumentSceneMethods,
    queueLegacyPreloadAssets,
    queueAssetsFromManifest,
    mergeLocalConfig,
    loadTranslations,
    clearRuntimeMatchStorage,
    resetGameStateForNewRun,
    drawTextPanel,
    getTextureMaxNumericFrame,
    playLoopAudioSafely,
    resolveContactSpec,
    LEVEL_CONFIG,
    getLevelFileName,
    getLevelMasterNumber,
    parseExitTargetLevel,
    addSpikeCredit,
    createCreditsManager,
    createLanguageCarousel,
    kitFlow
} = deps;

return class EnemiesCommonMixin {

    applyEnemyDirectionalFacing(enemy) {
        if (!enemy || !enemy.active) return;
        const vx = enemy.body?.velocity?.x || 0;
        const vy = enemy.body?.velocity?.y || 0;
        const deadzone = 1.5;
        if (Math.abs(vx) <= deadzone && Math.abs(vy) <= deadzone) return;

        // Prevent jitter on diagonal movement: switch to vertical only when it clearly dominates.
        const verticalDominance = 1.22;
        const absVx = Math.abs(vx);
        const absVy = Math.abs(vy);
        const currentFacing = enemy.getData('facingDir') || 'right';
        const lastHorizontalFacing = enemy.getData('lastHorizontalFacing') || (currentFacing === 'left' ? 'left' : 'right');

        if (absVy >= absVx * verticalDominance) {
            const nextFacing = vy < 0 ? 'up' : 'down';
            enemy.setData('facingDir', nextFacing);
            enemy.setFlipX(lastHorizontalFacing === 'left');
            enemy.setAngle(0);
            return;
        }

        if (absVx >= absVy * verticalDominance) {
            const nextFacing = vx < 0 ? 'left' : 'right';
            enemy.setData('facingDir', nextFacing);
            enemy.setData('lastHorizontalFacing', nextFacing);
            enemy.setAngle(0);
            enemy.setFlipX(nextFacing === 'left');
            return;
        }

        // Ambiguous diagonal band: keep previous facing for visual stability.
        if (currentFacing === 'up') {
            enemy.setFlipX(lastHorizontalFacing === 'left');
            enemy.setAngle(0);
        } else if (currentFacing === 'down') {
            enemy.setFlipX(lastHorizontalFacing === 'left');
            enemy.setAngle(0);
        } else {
            enemy.setAngle(0);
            enemy.setFlipX(currentFacing === 'left');
        }
        return;
    }
};
}
