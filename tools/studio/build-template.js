#!/usr/bin/env node
// Builds the game template used by SpikeEngine Studio (kit/template in the spikeengine repo)
// from this game: editors, PHP APIs, data and a light selection of graphics and sounds.
//
//   node tools/studio/build-template.js            → writes kit/template/
//
// Every game created by the studio is a copy of the template plus the engine (kit/) with its
// own name, type and generated levels. Run this again after improving the editors here.

'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..');
const OUT = path.join(SRC, 'kit', 'template');

const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const mkdir = (p) => fs.mkdirSync(p, { recursive: true });
const SKIP = (name) => /_old\d*$|\.(pdn|psd|xcf|kra)$|^\.DS_Store$|^Thumbs\.db$| copy\.png$/i.test(name);
let files = 0, bytes = 0;
function copy(rel, to = rel) {
    const from = path.join(SRC, rel);
    if (!fs.existsSync(from)) { console.warn('  manca', rel); return; }
    const dest = path.join(OUT, to);
    if (fs.statSync(from).isDirectory()) {
        mkdir(dest);
        fs.readdirSync(from).forEach((e) => { if (!SKIP(e)) copy(path.join(rel, e), path.join(to, e)); });
        return;
    }
    mkdir(path.dirname(dest));
    fs.copyFileSync(from, dest);
    files++; bytes += fs.statSync(from).size;
}
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(SRC, rel), 'utf8'));
const writeJson = (rel, data) => { const p = path.join(OUT, rel); mkdir(path.dirname(p)); fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`); };
const write = (rel, text) => { const p = path.join(OUT, rel); mkdir(path.dirname(p)); fs.writeFileSync(p, text); };
const existsOut = (rel) => fs.existsSync(path.join(OUT, rel));

rm(OUT);
mkdir(OUT);

// ---------------------------------------------------------------- pages, editors, runtime
['index.html', 'sw.js', 'manifest.json', 'build.config.json', 'level_editor.html', 'screen_editor.html'].forEach((f) => copy(f));
['js', 'css', 'vendor', 'api', 'game'].forEach((d) => copy(d));
// the editors carry the engine's name, not Block Hunter's
const rebrand = (rel, pairs) => { const p = path.join(OUT, rel); let t = fs.readFileSync(p, 'utf8'); pairs.forEach(([a, b]) => { t = t.split(a).join(b); }); fs.writeFileSync(p, t); };
rebrand('js/editor-layout.js', [['Block Hunter Editor', 'SpikeEngine Editor'], ['Block Hunter · Level Editor', 'SpikeEngine · Level Editor'],
    ['Editor dei livelli di Block Hunter', 'Editor dei livelli del gioco']]);
rebrand('level_editor.html', [['Block Hunter · Level Editor', 'SpikeEngine · Level Editor'], ['Editor dei livelli di Block Hunter', 'Editor dei livelli del gioco']]);

// ---------------------------------------------------------------- graphics and sounds
// Nothing of Block Hunter's world (mine walls, objects, carts, stones, sounds, story) goes into a new
// game: the studio draws and synthesizes them from the user's story (studio/js/art.js, sheets.js,
// sfx.js, texts.js). The template only ships neutral placeholders in the same formats.
['flags.png', 'logo_spikecode.png'].forEach((f) => copy(`assets/images/common/${f}`));
const zlib = require('zlib');
function png(w, h, pixel) {
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const [r, g, b, a] = pixel(x, y); const o = y * (w * 4 + 1) + 1 + x * 4; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a; } }
    const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (buf) => { let c = 0xffffffff; for (const v of buf) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const writePng = (rel, w, h, pixel) => { const p = path.join(OUT, rel); mkdir(path.dirname(p)); fs.writeFileSync(p, png(w, h, pixel)); files++; };
// framed boxes, one per frame: clearly placeholders, in the sizes the engine reads
const boxes = (fw, fh, fill) => (x, y) => { const i = x % fw, j = y % fh; const edge = i < 4 || j < 4 || i >= fw - 4 || j >= fh - 4; return edge ? [70, 76, 96, 255] : fill(x, y); };
const transparent = () => [0, 0, 0, 0];
writePng('assets/images/common/tiles.png', 384, 64, boxes(64, 64, () => [44, 48, 62, 255]));
writePng('assets/images/common/wall_completed.png', 384, 256, boxes(64, 64, () => [96, 104, 130, 255]));
writePng('assets/images/common/obj_game.png', 256, 256, (x, y) => { const i = x % 64 - 32, j = y % 64 - 32; return i * i + j * j < 300 ? [200, 200, 220, 255] : [0, 0, 0, 0]; });
writePng('assets/images/common/player_front_10.png', 640, 192, (x, y) => { const i = x % 64 - 32, j = y % 64 - 36; return Math.abs(i) < 12 && Math.abs(j) < 22 ? [230, 200, 80, 255] : [0, 0, 0, 0]; });
['ghost', 'bat', 'spider', 'snake'].forEach((k) => writePng(`assets/images/common/${k}.png`, 640, 64, (x, y) => { const i = x % 64 - 32, j = y - 34; return i * i + j * j < 280 ? [190, 90, 200, 255] : [0, 0, 0, 0]; }));
writePng('assets/images/common/batpng.png', 384, 64, (x, y) => { const i = x % 64 - 32, j = y - 34; return i * i + j * j < 280 ? [190, 90, 200, 255] : [0, 0, 0, 0]; });
['level1.png', 'level2.png', 'level3.png', 'attract_bg.png'].forEach((f, k) => writePng(`assets/images/common/${f}`, 1536, 1024, (x, y) => [18 + k * 4, 20 + k * 3, 34 + k * 6, 255]));
writePng('assets/images/common/explorer.png', 1536, 1024, transparent);
mkdir(path.join(OUT, 'assets/images/foreground'));
mkdir(path.join(OUT, 'assets/images/background'));
write('assets/images/background/LEGGIMI.txt', 'Metti qui gli sfondi dei livelli (PNG/JPG). Li trovi poi nella palette Background del level editor.\n');
copy('assets/fonts');
copy('assets/icons');
// sounds synthesized by the studio's own synthesizer (neutral "arcade" world): studio/js/sfx.js
mkdir(path.join(OUT, 'assets/music'));
const { execFileSync } = require('child_process');
const SOUND_KEYS = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
import { generateSounds, SOUND_KEYS } from ${JSON.stringify('file://' + path.join(SRC, 'kit/studio/js/sfx.js'))};
import fs from 'fs';
const s = generateSounds({ id: 'arcade' }, 1);
for (const [k, v] of Object.entries(s)) fs.writeFileSync(${JSON.stringify(path.join(OUT, 'assets/music'))} + '/' + k, v);
console.log(JSON.stringify(SOUND_KEYS));`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
files += Object.keys(SOUND_KEYS).length;

// ---------------------------------------------------------------- data
['data/game-effects-mapping.json', 'data/game-tiles-mapping.json'].forEach((f) => copy(f));
// game settings without Block Hunter's debug switches
const config = readJson('data/config.json');
Object.keys(config).filter((k) => /^debug/i.test(k)).forEach((k) => { config[k] = false; });
writeJson('data/config.json', config);
copy('data/dic');
// texts of a neutral game in every language (studio/js/texts.js); the studio writes the real ones from the story
const TEXTS = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
import { gameTexts } from ${JSON.stringify('file://' + path.join(SRC, 'kit/studio/js/texts.js'))};
console.log(JSON.stringify(gameTexts({ hero: 'Hero', theme: 'arcade', collect: 'stelle', enemies: ['ghost', 'bat'] })));`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
fs.readdirSync(path.join(OUT, 'data/dic')).filter((f) => f.endsWith('.json')).forEach((f) => {
    const p = path.join(OUT, 'data/dic', f), d = JSON.parse(fs.readFileSync(p, 'utf8'));
    Object.keys(d).filter((k) => /^obj_/.test(k)).forEach((k) => delete d[k]);
    Object.assign(d, TEXTS[f.replace('.json', '')] || TEXTS.en, { title: '{{GAME_TITLE}}' });
    delete d.story_intro;
    fs.writeFileSync(p, `${JSON.stringify(d, null, 2)}\n`);
});
copy('data/screens');
writeJson('data/topScores.json', []);
writeJson('data/rules.json', { rules: [] });   // "when … then …" rules (studio → Regole, kit/genres/lib/rules.js)
mkdir(path.join(OUT, 'data/level'));
write('data/level/LEGGIMI.txt', 'I livelli del gioco (level10.json, level11.json…) vengono creati da SpikeEngine Studio e si modificano con level_editor.html.\n');

// enemies: Block Hunter's plus the platform starter ones
const entities = readJson('data/game-entities-mapping.json');
const starterEntities = readJson('kit/platform/starter/entities.json');
entities.entities = { ...(entities.entities || {}), ...starterEntities };
entities.meta = { ...(entities.meta || {}), name: 'SpikeEngine entities' };
writeJson('data/game-entities-mapping.json', entities);

// asset manifest: only what the template ships; game music → ambient loop when the big track is missing
const manifest = readJson('data/data.json');
const keep = (it) => it && it.path && existsOut(it.path);
manifest.music = (manifest.music || []).filter((it) => it && SOUND_KEYS[it.key]).map((it) => ({ ...it, path: `assets/music/${SOUND_KEYS[it.key]}` }));
['objects', 'backgrounds', 'foregrounds'].forEach((k) => {
    manifest[k] = (manifest[k] || []).filter((it) => keep(it) && !/^(title|title_explosion|subtitle)$/.test(it.key));
});
manifest.generatedAt = new Date().toISOString().slice(0, 10);
manifest.source = 'SpikeEngine template';
writeJson('data/data.json', manifest);
const listDir = (dir) => (fs.existsSync(path.join(OUT, dir)) ? fs.readdirSync(path.join(OUT, dir)).filter((f) => /\.(png|jpe?g|webp|gif|mp3|ogg|wav)$/i.test(f)).sort().map((f) => `${dir}/${f}`) : []);
writeJson('data/background-images.json', listDir('assets/images/background'));
writeJson('data/foreground-images.json', listDir('assets/images/foreground'));
writeJson('data/music-files.json', listDir('assets/music'));

// attract: the Block Hunter logo becomes the game's title as text
const attract = readJson('data/screens/attract.json');
let titleDone = false;
attract.items = (attract.items || []).flatMap((it) => {
    if (it.type === 'image' && /^title/.test(String(it.key || ''))) {
        if (titleDone) return [];
        titleDone = true;
        return [{
            id: 'title', name: 'Titolo', type: 'text', text: '{{GAME_TITLE}}', x: it.x ?? 400, y: it.y ?? 150,
            fontSize: 44, color: '#ffd34d', stroke: '#000000', strokeThickness: 8, align: 'center',
            in: it.in ?? 0, out: it.out, effects: (it.effects || []).filter((fx) => fx && fx.name)
        }];
    }
    return [it];
});
writeJson('data/screens/attract.json', attract);

// ---------------------------------------------------------------- game identity placeholders
const gameJs = fs.readFileSync(path.join(SRC, 'game.js'), 'utf8')
    .replace(/^import \{ createBonusScene \}.*\n/m, '')
    .replace(/\n\s*\/\/ scenes of this game only[^\n]*\n\s*scenes: \[[^\]]*\]/, '\n    // scenes of this game only (none yet)\n    scenes: []')
    .replace(/^\/\/ BLOCK HUNTER - .*$/m, '// {{GAME_TITLE}} - made with SpikeEngine Studio, built on the SpikeCode engine (kit/)')
    .replace(/what belongs to Block Hunter/g, 'what belongs to this game')
    .replace(/identity:\s*\{[^}]*\}/, "identity: { id: '{{GAME_ID}}', title: '{{GAME_TITLE_JS}}', storagePrefix: '{{GAME_PREFIX}}' }")
    .replace(/newRun: \{[^}]*\},?/, "newRun: { lives: {{LIVES}}, dynamiteCount: {{DYNAMITE}} },\n\n    // 'topdown' (seen from above) or 'platform'\n    gameplay: '{{GAMEPLAY}}',")
    .replace(/\n\/\/ legacy console helpers[\s\S]*$/, '\n');
write('game.js.tpl', gameJs);
// neutral rules of the levels (obstacles yes, no rolling boulders): the game's own, not Block Hunter's
rm(path.join(OUT, 'game/scenes'));
write('game/levels.js', `// Rules of each level: obstacles and speed. Passed to the SpikeCode engine as \`levels\` in game.js.
export const LEVEL_CONFIG = {
    globalRules: { staticRocks: { sizes: ['small', 'medium', 'large'], randomSpawn: true, generateShards: false }, dynamicBoulders: { sizes: { small: { shards: [0, 1] }, medium: { shards: [2, 3] }, large: { shards: [4, 6] } } } },
    levels: ${JSON.stringify(Array.from({ length: 25 }, (_, i) => ({ id: `${Math.floor(i / 5) + 1}.${i % 5}`, staticRocks: true, dynamicBoulders: false, speed: 1 + (i % 5), escapeRoute: false })))}
};
`);
const gm = readJson('game.manifest.json');
gm.game = { id: '{{GAME_ID}}', title: '{{GAME_TITLE}}', storagePrefix: '{{GAME_PREFIX}}' };
writeJson('game.manifest.json.tpl', gm);

// ---------------------------------------------------------------- APIs: only the author may save
write('api/_auth.php', `<?php
// Who may change this game. A game created by SpikeEngine Studio has .spike/owner.json: only its
// author, logged in to the studio (PHP session SPIKESTUDIO), may save levels, screens, data and
// assets. A game without that file (a game developed locally) stays open as before.
function spike_require_owner() {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET' || $method === 'HEAD' || $method === 'OPTIONS') return;
    $ownerFile = realpath(__DIR__ . '/..') . '/.spike/owner.json';
    if (!is_file($ownerFile)) return;
    $owner = json_decode((string)@file_get_contents($ownerFile), true);
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name('SPIKESTUDIO');
        @session_start(['read_and_close' => true]);
    }
    $author = $_SESSION['spike_author'] ?? '';
    if ($author === '' || !is_array($owner) || !hash_equals((string)($owner['author'] ?? ''), (string)$author)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'Per salvare accedi a SpikeEngine Studio come autore di questo gioco.']);
        exit;
    }
}
spike_require_owner();
`);
let protectedApis = 0;
(function walk(dir) {
    fs.readdirSync(dir).forEach((e) => {
        const p = path.join(dir, e);
        if (fs.statSync(p).isDirectory()) return walk(p);
        if (e !== 'index.php') return;
        let t = fs.readFileSync(p, 'utf8');
        const rel = path.relative(path.join(OUT, 'api'), path.dirname(p)).split(path.sep).filter(Boolean);
        const back = rel.map(() => '..').join('/');
        t = t.replace(/^<\?php\s*\n/, `<?php\nrequire_once __DIR__ . '/${back}/_auth.php';\n`);
        fs.writeFileSync(p, t);
        protectedApis++;
    });
})(path.join(OUT, 'api'));
write('.spike/.htaccess', '<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n');

console.log(`template: ${files} file copiati (${(bytes / 1e6).toFixed(1)} MB), ${protectedApis} API protette → ${path.relative(SRC, OUT)}`);
