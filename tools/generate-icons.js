// Simple icon generator: converts SVG icons to PNG using sharp (requires sharp installed)
const fs = require('fs');
const path = require('path');
(async function () {
    try {
        const sharp = require('sharp');
        const svg192 = path.join(__dirname, '..', 'assets', 'icons', 'icon-192.svg');
        const svg512 = path.join(__dirname, '..', 'assets', 'icons', 'icon-512.svg');
        const out192 = path.join(__dirname, '..', 'assets', 'icons', 'icon-192.png');
        const out512 = path.join(__dirname, '..', 'assets', 'icons', 'icon-512.png');

        if (fs.existsSync(svg192)) {
            await sharp(svg192).png().resize(192, 192).toFile(out192);
            console.log('Wrote', out192);
        } else console.warn('Missing', svg192);

        if (fs.existsSync(svg512)) {
            await sharp(svg512).png().resize(512, 512).toFile(out512);
            console.log('Wrote', out512);
        } else console.warn('Missing', svg512);

        console.log('Icon generation complete.');
    } catch (e) {
        console.error('Error: ensure `sharp` is installed (npm install --save-dev sharp)');
        console.error(e && e.message ? e.message : e);
        process.exitCode = 1;
    }
})();
