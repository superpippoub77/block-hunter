// Coin / Credits manager
// Simple module to manage insert-coin credits and compute available players
// Exports: getCredits, setCredits, addCredits, consumeCredits, getAvailablePlayers, usePlayers, onChange, KEY
// Also exposes `window.Coins` for legacy callers.

const KEY = 'bh_credits';
let credits = 0;
const listeners = new Set();

function _load() {
    try {
        const raw = localStorage.getItem(KEY);
        credits = Math.max(0, parseInt(raw, 10) || 0);
    } catch (e) {
        credits = 0;
    }
}

function _save() {
    try { localStorage.setItem(KEY, String(credits)); } catch (e) { /* ignore */ }
}

function _emit() {
    for (const cb of Array.from(listeners)) {
        try { cb(credits); } catch (e) { /* ignore listener errors */ }
    }
}

function getCredits() { return credits; }

function setCredits(n) {
    credits = Math.max(0, Math.floor(Number(n) || 0));
    _save();
    _emit();
    return credits;
}

function addCredits(n = 1) {
    const add = Math.max(0, Math.floor(Number(n) || 0));
    return setCredits(credits + add);
}

function consumeCredits(n = 1) {
    const use = Math.max(0, Math.floor(Number(n) || 0));
    if (credits < use) return false;
    credits -= use;
    _save();
    _emit();
    return true;
}

function getCreditsPerPlayer() {
    try { return (window.CREDITS_PER_PLAYER && Number(window.CREDITS_PER_PLAYER)) ? Number(window.CREDITS_PER_PLAYER) : 1; } catch (e) { return 1; }
}

function getAvailablePlayers() {
    const per = Math.max(1, Math.floor(getCreditsPerPlayer() || 1));
    return Math.floor(credits / per);
}

function usePlayers(n = 1) {
    const players = Math.max(0, Math.floor(Number(n) || 0));
    const required = players * getCreditsPerPlayer();
    if (credits < required) return false;
    return consumeCredits(required);
}

function onChange(cb) {
    if (typeof cb === 'function') {
        listeners.add(cb);
        // return an unsubscribe function
        return () => listeners.delete(cb);
    }
    return () => {};
}

// initialize from storage
_load();

// legacy fallback
try { window.Coins = window.Coins || { getCredits, setCredits, addCredits, consumeCredits, getAvailablePlayers, usePlayers, onChange, KEY }; } catch (e) { /* ignore */ }

export { KEY, getCredits, setCredits, addCredits, consumeCredits, getAvailablePlayers, usePlayers, onChange };
