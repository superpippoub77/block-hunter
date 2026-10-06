// Top-ten entry: arcade initials picker + high-score helpers, usable from any scene
// (Block Hunter uses it in the game over).
//
//   const entry = createNameEntry(scene, {
//       font, x, titleY, nameY, countdownY, titleFont, nameFont, countdownFont,
//       labels: { title: 'ENTER YOUR NAME', time: 'TIME' },
//       length: 3, timeoutMs: 10000,
//       onConfirm: (name) => { ... },          // all letters confirmed (X on the last one, or Enter)
//       onTimeout: (defaultName) => { ... }     // time is up
//   });
//   entry.layout({ x, titleY, nameY, countdownY, titleFont, nameFont, countdownFont });
//   entry.stop();                               // removes keys/timers and the countdown
//
// Keys: ↑/↓ change letter · X confirm letter · Backspace previous letter · Enter save

const A = 65;

/** True when `score` enters a list of `size` best scores */
export function isHighScore(topScores, score, size = 10) {
    const list = Array.isArray(topScores) ? topScores : [];
    const s = Number(score) || 0;
    if (list.length < size) return s > 0;
    return s > (Number(list[list.length - 1]?.score) || 0);
}

/** New list with `entry` inserted, sorted by score and cut to `size` */
export function insertTopScore(topScores, entry, size = 10) {
    const list = (Array.isArray(topScores) ? topScores.slice() : []).concat([entry]);
    list.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    return list.slice(0, size);
}

/** Saves the list on the server (POST endpoint); falls back to localStorage[storageKey] */
export async function saveTopScores(list, { endpoint = '/api/top-scores', storageKey = 'topScores' } = {}) {
    const local = () => { try { localStorage.setItem(storageKey, JSON.stringify(list)); } catch (e) { } };
    try {
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(list)
        });
        if (!resp || !resp.ok) { local(); return 'local'; }
        return 'server';
    } catch (e) {
        local();
        return 'local';
    }
}

export function createNameEntry(scene, opts = {}) {
    const length = Math.max(1, Number(opts.length) || 3);
    const labels = Object.assign({ title: 'ENTER YOUR NAME', time: 'TIME' }, opts.labels || {});
    const font = opts.font || '"Press Start 2P"';
    const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 10000;
    const depth = Number.isFinite(opts.depth) ? opts.depth : 1;
    const pos = Object.assign({ x: 400, titleY: 340, nameY: 390, countdownY: 430, titleFont: 24, nameFont: 32, countdownFont: 18 }, opts);

    const chars = Array.from({ length }, () => 'A');
    const confirmed = Array.from({ length }, () => false);
    let current = 0;
    let finished = false;

    const format = () => chars.map((ch, i) => {
        if (confirmed[i]) return ch;
        if (current === i) return `[${ch}]`;
        return ch;
    }).join(' ');

    const titleText = scene.add.text(pos.x, pos.titleY, labels.title, {
        fontSize: `${pos.titleFont}px`, fill: '#00ff00', fontFamily: font
    }).setOrigin(0.5).setDepth(depth);
    const nameText = scene.add.text(pos.x, pos.nameY, format(), {
        fontSize: `${pos.nameFont}px`, fill: '#ffff00', fontFamily: font
    }).setOrigin(0.5).setDepth(depth);
    let countdownText = scene.add.text(pos.x, pos.countdownY, `${labels.time}: ${Math.ceil(timeoutMs / 1000)}`, {
        fontSize: `${pos.countdownFont}px`, fill: '#ffffff', fontFamily: font, stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(depth);

    const refresh = () => { try { nameText.setText(format()); } catch (e) { } };
    const name = () => chars.join('').toUpperCase();

    const finish = (fn, ...args) => {
        if (finished) return;
        finished = true;
        api.stop();
        if (typeof fn === 'function') fn(...args);
    };

    const cycle = (delta) => {
        const code = chars[current].charCodeAt(0);
        let p = (code >= A && code < A + 26) ? code - A : 0;
        p = ((p + delta) % 26 + 26) % 26;
        chars[current] = String.fromCharCode(A + p);
        refresh();
    };
    const confirm = () => {
        confirmed[current] = true;
        for (let i = current + 1; i < length; i++) {
            if (!confirmed[i]) { current = i; refresh(); return; }
        }
        if (confirmed.every(Boolean)) finish(opts.onConfirm, name());
        else { current = Math.min(length - 1, current + 1); refresh(); }
    };
    const back = () => {
        if (current > 0) current--;
        confirmed[current] = false;
        refresh();
    };

    const onKey = (event) => {
        const key = event.key;
        if (key === 'ArrowUp') cycle(1);
        else if (key === 'ArrowDown') cycle(-1);
        else if (key && key.toLowerCase() === 'x') confirm();
        else if (key === 'Backspace') back();
        else if (key === 'Enter' && confirmed.every(Boolean)) finish(opts.onConfirm, name());
    };
    scene.input.keyboard.on('keydown', onKey);

    const timeout = scene.time.delayedCall(timeoutMs, () => finish(opts.onTimeout, 'A'.repeat(length)));
    // remaining time comes from the timer itself (the scene clock is still 0 while the scene is created)
    const ticker = scene.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
            const remain = Math.max(0, timeout.getRemaining());
            try { if (countdownText) countdownText.setText(`${labels.time}: ${Math.ceil(remain / 1000)}`); } catch (e) { }
        }
    });

    const api = {
        get name() { return name(); },
        get finished() { return finished; },
        titleText,
        nameText,
        get countdownText() { return countdownText; },
        layout(m = {}) {
            const x = Number.isFinite(m.x) ? m.x : pos.x;
            try { titleText.setPosition(x, m.titleY ?? titleText.y).setFontSize(`${m.titleFont ?? pos.titleFont}px`); } catch (e) { }
            try { nameText.setPosition(x, m.nameY ?? nameText.y).setFontSize(`${m.nameFont ?? pos.nameFont}px`); } catch (e) { }
            try { if (countdownText) countdownText.setPosition(x, m.countdownY ?? countdownText.y).setFontSize(`${m.countdownFont ?? pos.countdownFont}px`); } catch (e) { }
        },
        /** Removes keys, timers and the countdown; title and name stay on screen */
        stop() {
            try { scene.input.keyboard.off('keydown', onKey); } catch (e) { }
            try { timeout.remove(false); } catch (e) { }
            try { ticker.remove(false); } catch (e) { }
            try { if (countdownText) { countdownText.destroy(); countdownText = null; } } catch (e) { }
        }
    };
    return api;
}
