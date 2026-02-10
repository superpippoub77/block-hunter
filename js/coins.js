// Coin / Credits manager (class-based)
// Backwards-compatible API: exports named functions and exposes `window.Coins` for legacy callers.

export const KEY = 'bh_credits';

class CoinsManager {
    constructor() {
        this.credits = 0;
        this.listeners = new Set();
        this._load();
    }

    _load() {
        try {
            const raw = localStorage.getItem(KEY);
            this.credits = Math.max(0, parseInt(raw, 10) || 0);
        } catch (e) {
            this.credits = 0;
        }
    }

    _save() {
        try { localStorage.setItem(KEY, String(this.credits)); } catch (e) { /* ignore */ }
    }

    _emit() {
        for (const cb of Array.from(this.listeners)) {
            try { cb(this.credits); } catch (e) { /* ignore listener errors */ }
        }
    }

    getCredits() { return this.credits; }

    setCredits(n) {
        this.credits = Math.max(0, Math.floor(Number(n) || 0));
        this._save();
        this._emit();
        return this.credits;
    }

    addCredits(n = 1) {
        const add = Math.max(0, Math.floor(Number(n) || 0));
        return this.setCredits(this.credits + add);
    }

    consumeCredits(n = 1) {
        const use = Math.max(0, Math.floor(Number(n) || 0));
        if (this.credits < use) return false;
        this.credits -= use;
        this._save();
        this._emit();
        return true;
    }

    getCreditsPerPlayer() {
        try { return (window.CREDITS_PER_PLAYER && Number(window.CREDITS_PER_PLAYER)) ? Number(window.CREDITS_PER_PLAYER) : 1; } catch (e) { return 1; }
    }

    getAvailablePlayers() {
        const per = Math.max(1, Math.floor(this.getCreditsPerPlayer() || 1));
        return Math.floor(this.credits / per);
    }

    usePlayers(n = 1) {
        const players = Math.max(0, Math.floor(Number(n) || 0));
        const required = players * this.getCreditsPerPlayer();
        if (this.credits < required) return false;
        return this.consumeCredits(required);
    }

    onChange(cb) {
        if (typeof cb === 'function') {
            this.listeners.add(cb);
            return () => this.listeners.delete(cb);
        }
        return () => {};
    }
}

// singleton
const _coins = new CoinsManager();

// expose legacy global
try {
    window.Coins = window.Coins || {
        getCredits: _coins.getCredits.bind(_coins),
        setCredits: _coins.setCredits.bind(_coins),
        addCredits: _coins.addCredits.bind(_coins),
        consumeCredits: _coins.consumeCredits.bind(_coins),
        getAvailablePlayers: _coins.getAvailablePlayers.bind(_coins),
        usePlayers: _coins.usePlayers.bind(_coins),
        onChange: _coins.onChange.bind(_coins),
        KEY
    };
} catch (e) { /* ignore in non-browser contexts */ }

// Named exports (bound to the singleton)
export const getCredits = _coins.getCredits.bind(_coins);
export const setCredits = _coins.setCredits.bind(_coins);
export const addCredits = _coins.addCredits.bind(_coins);
export const consumeCredits = _coins.consumeCredits.bind(_coins);
export const getAvailablePlayers = _coins.getAvailablePlayers.bind(_coins);
export const usePlayers = _coins.usePlayers.bind(_coins);
export const onChange = _coins.onChange.bind(_coins);

// Also export the class for advanced usage/tests
export { CoinsManager };
