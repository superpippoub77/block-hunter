// Language management module for Block Hunter
// Exposes LANGS, current index, persistence to localStorage (bh_lang), changeLang, setLang and keyboard helpers.
export const LANGS = ['it', 'fr', 'de', 'en', 'us', 'ja', 'es', 'zh'];

const STORAGE_KEY = 'bh_lang';
let _listeners = [];

// Initialize current index from localStorage when possible
let _currentIndex = 0;
try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        const idx = LANGS.indexOf(saved);
        if (idx >= 0) _currentIndex = idx;
    }
} catch (e) { /* ignore storage errors */ }

function _notify() {
    try {
        const code = LANGS[_currentIndex];
        for (const fn of _listeners.slice()) {
            try { fn(code, _currentIndex); } catch (e) { /* ignore listener errors */ }
        }
    } catch (e) { /* ignore */ }
}

export function getIndex() { return _currentIndex; }
export function getCurrent() { return LANGS[_currentIndex]; }

export function setLang(codeOrIndex, opts = {}) {
    try {
        let idx = typeof codeOrIndex === 'number' ? codeOrIndex : LANGS.indexOf(String(codeOrIndex));
        if (idx < 0) idx = 0;
        idx = Math.max(0, Math.min(idx, LANGS.length - 1));
        if (idx === _currentIndex) return { code: LANGS[_currentIndex], index: _currentIndex };
        _currentIndex = idx;
        if (opts.persist !== false) {
            try { localStorage.setItem(STORAGE_KEY, LANGS[_currentIndex]); } catch (e) { /* ignore */ }
        }
        _notify();
        return { code: LANGS[_currentIndex], index: _currentIndex };
    } catch (e) {
        return { code: LANGS[_currentIndex], index: _currentIndex };
    }
}

export function changeLang(delta = 1, opts = {}) {
    try {
        const next = (_currentIndex + (delta || 0) + LANGS.length) % LANGS.length;
        return setLang(next, opts);
    } catch (e) { return { code: LANGS[_currentIndex], index: _currentIndex }; }
}

export function onChange(fn) {
    if (typeof fn !== 'function') return () => {};
    _listeners.push(fn);
    // call immediately with current state so listeners can initialize
    try { fn(LANGS[_currentIndex], _currentIndex); } catch (e) { /* ignore */ }
    return () => offChange(fn);
}

export function offChange(fn) {
    const i = _listeners.indexOf(fn);
    if (i >= 0) _listeners.splice(i, 1);
}

// Attach keyboard arrows to change language when `allowWhen()` returns true.
// Returns a function to remove the listener.
export function initKeyboard(allowWhen) {
    const handler = (ev) => {
        try {
            if (allowWhen && typeof allowWhen === 'function') {
                if (!allowWhen()) return;
            }
            if (ev.code === 'ArrowLeft' || ev.key === 'Left') {
                changeLang(-1);
                ev.preventDefault && ev.preventDefault();
            } else if (ev.code === 'ArrowRight' || ev.key === 'Right') {
                changeLang(1);
                ev.preventDefault && ev.preventDefault();
            }
        } catch (e) { /* ignore */ }
    };
    window.addEventListener('keydown', handler);
    return () => { try { window.removeEventListener('keydown', handler); } catch (e) { } };
}

// no global fallbacks exported here — consumers should import this module
