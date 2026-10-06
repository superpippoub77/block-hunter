// SpikeCode widgets: interactive pieces a screen can contain. The widgets live in kit/widgets/
// (one file each, custom.js as template); this file exposes the registry to the game and editor.
//
// A widget is { label, size: { width, height }, props: [...], create(scene, item, ctx) }.
// create() returns { obj, update(t), refresh(), destroy() } — see kit/widgets/README.md.
import { WIDGETS } from '../widgets/index.js';

export { WIDGETS };

export function listWidgets() {
    return Object.entries(WIDGETS).map(([id, w]) => ({ id, label: w.label, size: w.size, props: w.props }));
}

export function widgetProps(item) {
    const def = WIDGETS[item.widget];
    const out = {};
    (def?.props || []).forEach((p) => { out[p.key] = p.default; });
    return Object.assign(out, item.props || {});
}
