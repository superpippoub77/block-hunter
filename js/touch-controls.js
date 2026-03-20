// Touch controls module: exposes window.TOUCH_INPUT and wires joystick + action button UI
(function () {
    if (window.__touchControlsLoaded) return;
    window.__touchControlsLoaded = true;

    window.TOUCH_INPUT = {
        x: 0, // -1..1
        y: 0, // -1..1
        action: false,
        jump: false
    };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    function initJoystick() {
        const base = document.getElementById('joystick-base');
        const thumb = document.getElementById('joystick-thumb');
        const container = document.getElementById('joystick');
        if (!container || !base || !thumb) return;

        let active = false;
        let rect = null;
        let centerX = 0;
        let centerY = 0;
        let maxRadius = 40; // movement radius for thumb

        const updateRect = () => {
            rect = container.getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;
            maxRadius = Math.min(rect.width, rect.height) * 0.32;
        };

        const setThumbPos = (dx, dy) => {
            thumb.style.transform = `translate(${dx}px, ${dy}px)`;
        };

        const handlePointer = (clientX, clientY) => {
            const dx = clientX - centerX;
            const dy = clientY - centerY;
            const dist = Math.hypot(dx, dy);
            const nx = dx / Math.max(dist, 1);
            const ny = dy / Math.max(dist, 1);
            const limited = Math.min(dist, maxRadius);
            const thumbX = nx * limited;
            const thumbY = ny * limited;
            setThumbPos(thumbX, thumbY);
            // normalize to -1..1 based on maxRadius
            window.TOUCH_INPUT.x = clamp((thumbX / maxRadius), -1, 1);
            window.TOUCH_INPUT.y = clamp((thumbY / maxRadius), -1, 1);
        };

        container.addEventListener('pointerdown', (ev) => {
            ev.preventDefault();
            active = true;
            updateRect();
            container.setPointerCapture(ev.pointerId);
            handlePointer(ev.clientX, ev.clientY);
        });

        container.addEventListener('pointermove', (ev) => {
            if (!active) return;
            ev.preventDefault();
            handlePointer(ev.clientX, ev.clientY);
        });

        const endPointer = (ev) => {
            if (!active) return;
            active = false;
            try { container.releasePointerCapture(ev.pointerId); } catch (e) {}
            // animate thumb back to center
            setThumbPos(0, 0);
            window.TOUCH_INPUT.x = 0;
            window.TOUCH_INPUT.y = 0;
        };

        container.addEventListener('pointerup', endPointer);
        container.addEventListener('pointercancel', endPointer);
        window.addEventListener('resize', updateRect);
        // initialize rect
        setTimeout(updateRect, 50);
    }

    function initPressButton(buttonId, fieldName) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        btn.addEventListener('pointerdown', (ev) => {
            ev.preventDefault();
            window.TOUCH_INPUT[fieldName] = true;
            btn.classList.add('pressed');
            try { btn.setPointerCapture(ev.pointerId); } catch (e) {}
        });
        const end = (ev) => {
            ev && ev.preventDefault && ev.preventDefault();
            window.TOUCH_INPUT[fieldName] = false;
            btn.classList.remove('pressed');
            try {
                if (ev && typeof ev.pointerId !== 'undefined') btn.releasePointerCapture(ev.pointerId);
            } catch (e) {}
        };
        btn.addEventListener('pointerup', end);
        btn.addEventListener('pointercancel', end);
        btn.addEventListener('pointerleave', end);
        btn.addEventListener('lostpointercapture', end);
    }

    // Allow keyboard fallback: map arrow keys/WASD to TOUCH_INPUT axes when on touch devices
    function initKeyboardFallback() {
        window.addEventListener('keydown', (e) => {
            if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return;
            if (e.key === 'ArrowLeft' || e.key === 'a') window.TOUCH_INPUT.x = -1;
            if (e.key === 'ArrowRight' || e.key === 'd') window.TOUCH_INPUT.x = 1;
            if (e.key === 'ArrowUp' || e.key === 'w') window.TOUCH_INPUT.y = -1;
            if (e.key === 'ArrowDown' || e.key === 's') window.TOUCH_INPUT.y = 1;
            // Map configured player1 action/shoot keys to the action button for touch/keyboard fallback
            const panel = (window.CONFIG && window.CONFIG.controlPanel) ? window.CONFIG.controlPanel : (window.CONTROL_PANEL || {});
            const p1cfg = panel.player1 || {};
            const actionKeys = Array.isArray(p1cfg.shoot) ? p1cfg.shoot : (p1cfg.shoot ? [p1cfg.shoot] : ['X','SPACE']);
            const actionAlt = Array.isArray(p1cfg.action) ? p1cfg.action : (p1cfg.action ? [p1cfg.action] : ['Z']);
            const jumpKeys = Array.isArray(p1cfg.jump) ? p1cfg.jump : (p1cfg.jump ? [p1cfg.jump] : ['C']);
            const keysToCheck = [].concat(actionKeys || [], actionAlt || []);
            const isMatch = (configuredKey) => {
                if (!configuredKey || !e.key) return false;
                const ck = String(configuredKey).toUpperCase();
                // space
                if (ck === 'SPACE') return (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar');
                // arrows
                if (ck === 'LEFT') return e.key === 'ArrowLeft';
                if (ck === 'RIGHT') return e.key === 'ArrowRight';
                if (ck === 'UP') return e.key === 'ArrowUp';
                if (ck === 'DOWN') return e.key === 'ArrowDown';
                // single character compare
                return e.key.toLowerCase() === ck.toLowerCase();
            };
            if (keysToCheck.some(isMatch)) window.TOUCH_INPUT.action = true;
            if ((jumpKeys || []).some(isMatch)) window.TOUCH_INPUT.jump = true;
        });
        window.addEventListener('keyup', (e) => {
            if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return;
            if (['ArrowLeft','a','ArrowRight','d'].includes(e.key)) window.TOUCH_INPUT.x = 0;
            if (['ArrowUp','w','ArrowDown','s'].includes(e.key)) window.TOUCH_INPUT.y = 0;
            const panel = (window.CONFIG && window.CONFIG.controlPanel) ? window.CONFIG.controlPanel : (window.CONTROL_PANEL || {});
            const p1cfg = panel.player1 || {};
            const actionKeys = Array.isArray(p1cfg.shoot) ? p1cfg.shoot : (p1cfg.shoot ? [p1cfg.shoot] : ['X','SPACE']);
            const actionAlt = Array.isArray(p1cfg.action) ? p1cfg.action : (p1cfg.action ? [p1cfg.action] : ['Z']);
            const jumpKeys = Array.isArray(p1cfg.jump) ? p1cfg.jump : (p1cfg.jump ? [p1cfg.jump] : ['C']);
            const keysToCheck = [].concat(actionKeys || [], actionAlt || []);
            const isMatch = (configuredKey) => {
                if (!configuredKey || !e.key) return false;
                const ck = String(configuredKey).toUpperCase();
                if (ck === 'SPACE') return (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar');
                if (ck === 'LEFT') return e.key === 'ArrowLeft';
                if (ck === 'RIGHT') return e.key === 'ArrowRight';
                if (ck === 'UP') return e.key === 'ArrowUp';
                if (ck === 'DOWN') return e.key === 'ArrowDown';
                return e.key.toLowerCase() === ck.toLowerCase();
            };
            if (keysToCheck.some(isMatch)) window.TOUCH_INPUT.action = false;
            if ((jumpKeys || []).some(isMatch)) window.TOUCH_INPUT.jump = false;
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const isTouchDevice = () => {
            try {
                return ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || /Mobi|Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent);
            } catch (e) { return false; }
        };

        const touchDevice = isTouchDevice();
        try {
            if (document.body) {
                document.body.classList.toggle('touch-device', !!touchDevice);
            }
        } catch (e) { }

        if (!touchDevice) {
            // Do not initialize touch UI on non-touch/desktop devices
            return;
        }

        try {
            const controls = document.getElementById('touch-controls');
            if (controls) {
                controls.style.display = 'block';
                controls.removeAttribute('aria-hidden');
            }
        } catch (e) { }

        initJoystick();
        initPressButton('actionBtn', 'action');
        initPressButton('jumpBtn', 'jump');
        initKeyboardFallback();
    });
})();
