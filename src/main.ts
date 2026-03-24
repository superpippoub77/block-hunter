import '../game.js';
import '../js/touch-controls.js';

declare global {
    interface Window {
        inizialization?: () => Promise<boolean>;
    }
}

async function loadGameFont(): Promise<void> {
    try {
        if (window.FontFace) {
            const font = new FontFace(
                'Press Start 2P',
                "url('assets/fonts/PressStart2P-Regular.woff2'), url('assets/fonts/PressStart2P-Regular.woff'), url('assets/fonts/PressStart2P-Regular.ttf')"
            );
            await font.load();
            document.fonts.add(font);
            await document.fonts.ready;
            return;
        }

        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
    } catch (error) {
        console.warn('Impossibile caricare il font personalizzato, si usera il fallback.', error);
    }
}

async function bootstrapGame(): Promise<void> {
    await loadGameFont();

    if (typeof window.inizialization !== 'function') {
        console.error('Bootstrap non disponibile: window.inizialization non e definita.');
        return;
    }

    if (await window.inizialization()) {
        console.log('Gioco inizializzato con successo.');
    } else {
        console.error("Errore durante l'inizializzazione del gioco.");
    }
}

window.addEventListener('load', () => {
    void bootstrapGame();
});
