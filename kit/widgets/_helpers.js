// Helpers shared by the widget files.
export const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
export const color = (v, d = '#ffffff') => (typeof v === 'string' && v ? v : d);
export const textStyle = (item, ctx, size, fill) => ({
    fontFamily: item.props?.font || ctx.font,
    fontSize: `${num(item.props?.fontSize, size)}px`,
    color: color(item.props?.color, fill),
    stroke: color(item.props?.stroke, '#000000'),
    strokeThickness: num(item.props?.strokeThickness, 4),
    align: 'center'
});
export const keyList = (v) => String(v || '').split(/[\s,]+/).map((k) => k.trim().toUpperCase()).filter(Boolean);

export function editorBox(scene, w, h, label) {
    const g = scene.add.rectangle(0, 0, w, h, 0xc9973f, 0.08).setStrokeStyle(1, 0xc9973f, 0.8);
    const t = scene.add.text(0, 0, label, { fontFamily: 'monospace', fontSize: '12px', color: '#c9973f' }).setOrigin(0.5);
    return [g, t];
}

