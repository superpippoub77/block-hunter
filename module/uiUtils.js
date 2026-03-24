export function addSpikeCredit(scene, config, gameFont, logger, opts = {}) {
    logger.trace('addSpikeCredit', 'Aggiunta credit overlay');
    try {
        if (!scene || !scene.add) return null;
        const w = Number(config.width) || 800;
        const h = Number(config.height) || 600;
        const style = Object.assign({
            fontSize: '12px',
            fill: '#cfdff8',
            fontFamily: gameFont,
            stroke: '#000000',
            strokeThickness: 3
        }, opts.style || {});

        const credit = scene.add.text(w - 8, h - 6, 'by SpikeCode', style).setOrigin(1, 1);
        try { credit.setDepth(9999); } catch (e) { }
        try { credit.setScrollFactor(0); } catch (e) { }
        try { credit.setInteractive && credit.disableInteractive && credit.disableInteractive(); } catch (e) { }
        return credit;
    } catch (e) { return null; }
}
