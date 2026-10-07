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
const COMMON = ['tiles.png', 'wall_completed.png', 'obj_game.png', 'bat.png', 'batpng.png', 'ghost.png', 'spider.png',
    'snake.png', 'player_front_10.png', 'flags.png', 'explorer.png', 'attract_bg.png', 'level1.png', 'level2.png',
    'level3.png', 'foreground.png', 'foreground1.png', 'foreground2.png', 'logo_spikecode.png'];
COMMON.forEach((f) => copy(`assets/images/common/${f}`));
copy('assets/images/foreground');
mkdir(path.join(OUT, 'assets/images/background'));
write('assets/images/background/LEGGIMI.txt', 'Metti qui gli sfondi dei livelli (PNG/JPG). Li trovi poi nella palette Background del level editor.\n');
copy('assets/fonts');
copy('assets/icons');
const MUSIC = ['intro.mp3', 'wood_ambient.mp3', 'coin.mp3', 'step.mp3', 'select.mp3', 'bat.mp3', 'ghost.mp3', 'stone.mp3',
    'explosion.mp3', 'gem.mp3', 'gameover.mp3', 'level_completed.mp3', 'rolling_stones.mp3'];
MUSIC.forEach((f) => copy(`assets/music/${f}`));

// ---------------------------------------------------------------- data
['data/game-effects-mapping.json', 'data/game-tiles-mapping.json'].forEach((f) => copy(f));
// game settings without Block Hunter's debug switches
const config = readJson('data/config.json');
Object.keys(config).filter((k) => /^debug/i.test(k)).forEach((k) => { config[k] = false; });
writeJson('data/config.json', config);
copy('data/dic');
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
['objects', 'backgrounds', 'foregrounds', 'music'].forEach((k) => {
    manifest[k] = (manifest[k] || []).map((it) => {
        if (it && it.key === 'game_bgm' && !keep(it)) return { ...it, path: 'assets/music/wood_ambient.mp3' };
        return it;
    }).filter((it) => keep(it) && !/^(title|title_explosion|subtitle)$/.test(it.key));
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
    .replace(/^\/\/ BLOCK HUNTER - .*$/m, '// {{GAME_TITLE}} - made with SpikeEngine Studio, built on the SpikeCode engine (kit/)')
    .replace(/what belongs to Block Hunter/g, 'what belongs to this game')
    .replace(/identity:\s*\{[^}]*\}/, "identity: { id: '{{GAME_ID}}', title: '{{GAME_TITLE_JS}}', storagePrefix: '{{GAME_PREFIX}}' }")
    .replace(/newRun: \{[^}]*\},?/, "newRun: { lives: {{LIVES}}, dynamiteCount: {{DYNAMITE}} },\n\n    // 'topdown' (seen from above) or 'platform'\n    gameplay: '{{GAMEPLAY}}',")
    .replace(/\n\/\/ legacy console helpers[\s\S]*$/, '\n');
write('game.js.tpl', gameJs);
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
