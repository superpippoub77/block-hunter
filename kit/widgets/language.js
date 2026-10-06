// Widget "language" — see kit/widgets/README.md
export default {
    label: 'Selettore lingua (bandiere)',
    size: { width: 200, height: 70 },
    props: [
        { key: 'languages', label: 'Lingue', type: 'text', default: 'it,fr,de,en,us,ja,es,zh' },
        { key: 'keys', label: 'Frecce ← → cambiano lingua', type: 'checkbox', default: true }
    ],
    create(scene, item, ctx) {
        const { GAME_STATE, createLanguageCarousel, loadTranslations } = ctx.services;
        const languages = String(item.props?.languages || 'it,fr,de,en,us,ja,es,zh').split(',').map((s) => s.trim()).filter(Boolean);
        const c = scene.add.container(0, 0);
        const idx0 = Math.max(0, languages.indexOf(GAME_STATE.language));
        const car = createLanguageCarousel(scene, { languages, index: idx0, x: 0, y: 0, hudDepth: 0, font: ctx.font });
        [car.flagSprite, car.leftArrow, car.rightArrow].filter(Boolean).forEach((o) => c.add(o));
        if (ctx.editor) return { obj: c };
        const change = (dir) => {
            const i = (languages.indexOf(GAME_STATE.language) + dir + languages.length) % languages.length;
            GAME_STATE.language = languages[i < 0 ? 0 : i];
            try { car.setIndex(languages.indexOf(GAME_STATE.language)); } catch (e) { }
            try { car.pulseArrow && car.pulseArrow(dir > 0 ? car.rightArrow : car.leftArrow); } catch (e) { }
            try { scene.sound.play('select_sfx', { volume: 0.4 }); } catch (e) { }
            loadTranslations(GAME_STATE.language, () => { if (scene.sys?.isActive()) ctx.refreshTexts(); });
            ctx.resetTimeout();
        };
        if (item.props?.keys !== false) {
            scene.input.keyboard.on('keydown-LEFT', () => change(-1));
            scene.input.keyboard.on('keydown-RIGHT', () => change(1));
        }
        try { car.leftArrow?.setInteractive({ useHandCursor: true }).on('pointerdown', () => change(-1)); } catch (e) { }
        try { car.rightArrow?.setInteractive({ useHandCursor: true }).on('pointerdown', () => change(1)); } catch (e) { }
        return { obj: c };
    }
};
