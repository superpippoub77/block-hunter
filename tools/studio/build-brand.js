// SpikeEngine brand: renders the SVG / HTML sources of kit/studio/brand into the PNG and ICO files
// every page and every game uses (favicons, app icons, transparent logos, social image).
//   node tools/studio/build-brand.js          (needs Playwright + Chromium, and python3 + Pillow for the .ico)
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const DIR = path.join(__dirname, '../../kit/studio/brand');
const url = (f) => 'file://' + path.join(DIR, f);
const ICON_BG = 'radial-gradient(circle at 50% 38%, #26304a 0%, #141a28 55%, #0b0e16 100%)';

(async () => {
    const b = await chromium.launch();
    const shot = async (out, w, h, html, transparent = true) => {
        const p = await b.newPage({ viewport: { width: w, height: h } });
        await p.setContent(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;${transparent ? 'background:transparent' : ''}">${html}</body></html>`);
        await p.waitForTimeout(250);
        await p.screenshot({ path: path.join(DIR, out), omitBackground: transparent });
        await p.close();
        console.log('  ' + out);
    };
    // the SVG inline as a data URL (a blank page may not load file:// images)
    const data = (f) => 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(DIR, f)).toString('base64');
    const img = (f, w, h, style = '') => `<img src="${data(f)}" style="display:block;width:${w}px;height:${h}px;${style}">`;
    const tile = (size, scale, radius) => `<div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${ICON_BG};display:flex;align-items:center;justify-content:center;box-sizing:border-box;${radius ? 'border:' + Math.max(2, size / 128) + 'px solid rgba(45,140,255,.45)' : ''}">${img('mark.svg', size * scale, size * scale)}</div>`;
    for (const s of [16, 32, 48]) await shot(`favicon-${s}.png`, s, s, img(s === 16 ? 'favicon-16.svg' : 'favicon.svg', s, s));     // at 16 px: the cube and the lightning only
    await shot('apple-touch-icon.png', 180, 180, tile(180, 0.86, 0), false);
    await shot('icon-192.png', 192, 192, tile(192, 0.86, 40));
    await shot('icon-512.png', 512, 512, tile(512, 0.86, 104));
    await shot('icon-maskable-512.png', 512, 512, tile(512, 0.64, 0), false);       // the safe zone of Android masks
    await shot('logo.png', 1024, 1024, img('mark.svg', 1024, 1024));
    await shot('logo-horizontal.png', 1080, 320, img('logo-horizontal.svg', 1080, 320));
    await shot('logo-vertical.png', 640, 740, img('logo-vertical.svg', 640, 740));
    const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
    await p.goto(url('og-image.html')); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(DIR, 'og-image.png') }); await p.close();
    console.log('  og-image.png');
    await b.close();
    // favicon.ico with 16, 32 and 48 px inside
    execFileSync('python3', ['-c', `from PIL import Image
im = Image.open('${path.join(DIR, 'favicon-48.png')}').convert('RGBA')
im.save('${path.join(DIR, 'favicon.ico')}', sizes=[(16, 16), (32, 32), (48, 48)])`]);
    console.log('  favicon.ico');
})().catch((e) => { console.error(e); process.exit(1); });
