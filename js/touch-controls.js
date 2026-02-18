// Touch controls module: exposes window.TOUCH_INPUT and wires joystick + action button UI
(function () {
    if (window.__touchControlsLoaded) return;
    window.__touchControlsLoaded = true;

    window.TOUCH_INPUT = {
        x: 0, // -1..1
        y: 0, // -1..1
        action: false
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

    function initActionButton() {
        const btn = document.getElementById('actionBtn');
        if (!btn) return;
        btn.addEventListener('pointerdown', (ev) => {
            ev.preventDefault();
            window.TOUCH_INPUT.action = true;
            btn.classList.add('pressed');
        });
        const end = (ev) => {
            ev && ev.preventDefault && ev.preventDefault();
            window.TOUCH_INPUT.action = false;
            btn.classList.remove('pressed');
        };
        btn.addEventListener('pointerup', end);
        btn.addEventListener('pointercancel', end);
        btn.addEventListener('pointerleave', end);
    }

    // Allow keyboard fallback: map arrow keys/WASD to TOUCH_INPUT axes when on touch devices
    function initKeyboardFallback() {
        window.addEventListener('keydown', (e) => {
            if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return;
            if (e.key === 'ArrowLeft' || e.key === 'a') window.TOUCH_INPUT.x = -1;
            if (e.key === 'ArrowRight' || e.key === 'd') window.TOUCH_INPUT.x = 1;
            if (e.key === 'ArrowUp' || e.key === 'w') window.TOUCH_INPUT.y = -1;
            if (e.key === 'ArrowDown' || e.key === 's') window.TOUCH_INPUT.y = 1;
            if (e.key === ' ' || e.key.toLowerCase() === 'x') window.TOUCH_INPUT.action = true;
        });
        window.addEventListener('keyup', (e) => {
            if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return;
            if (['ArrowLeft','a','ArrowRight','d'].includes(e.key)) window.TOUCH_INPUT.x = 0;
            if (['ArrowUp','w','ArrowDown','s'].includes(e.key)) window.TOUCH_INPUT.y = 0;
            if (e.key === ' ' || e.key.toLowerCase() === 'x') window.TOUCH_INPUT.action = false;
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initJoystick();
        initActionButton();
        initKeyboardFallback();
    });
})();
