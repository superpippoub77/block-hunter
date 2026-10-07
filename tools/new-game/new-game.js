#!/usr/bin/env node
// Crea un nuovo gioco fatto con il motore SpikeCode.
//
//   node tools/new-game/new-game.js ../mio-gioco --title "Mio Gioco"
//        [--id mio-gioco] [--prefix mioGioco] [--app-id com.spikecode.miogioco] [--force]
//
// Copia il motore (kit/, editor, server, API, strumenti per i pacchetti) e, come punto di
// partenza, i contenuti di questo gioco (game/, data/, assets/) con la nuova identità: nome,
// prefisso delle chiavi nel browser, id dell'app. Poi si cambiano grafiche, livelli e dati.
// Il gioco di partenza non viene toccato.

'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------- argomenti
const args = process.argv.slice(2);
const opt = (name, def = null) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--force'].includes(args[i - 1])));
if (!target || flag('help')) {
    console.log('Uso: node tools/new-game/new-game.js <cartella> --title "Nome del gioco" [--type topdown|platform] [--id id] [--prefix prefisso] [--app-id com.x.y] [--force]');
    process.exit(target ? 0 : 1);
}
const DEST = path.resolve(process.cwd(), target);
const title = opt('title', path.basename(DEST));
const slug = (opt('id') || title).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'spike-game';
const camel = slug.replace(/-([a-z0-9])/g, (m, c) => c.toUpperCase());
const prefix = opt('prefix', camel);
const compact = title.replace(/[^A-Za-z0-9]/g, '') || 'SpikeGame';
const appId = opt('app-id', `com.spikecode.${slug.replace(/-/g, '')}`);
const type = String(opt('type', 'topdown')).toLowerCase() === 'platform' ? 'platform' : 'topdown';

if (DEST === SRC || DEST.startsWith(SRC + path.sep)) {
    console.error('La cartella del nuovo gioco deve stare fuori da questo progetto.');
    process.exit(1);
}
if (fs.existsSync(DEST) && fs.readdirSync(DEST).length && !flag('force')) {
    console.error(`${DEST} esiste e non è vuota (usa --force per scriverci comunque).`);
    process.exit(1);
}

// ---------------------------------------------------------------- copia
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'bck', 'level-versions', 'www', '.vscode', '.vs']);
const SKIP_FILE = (name) => /_old\d*$|\.(pdn|psd|xcf|kra)$/i.test(name) || name === '.DS_Store' || name === 'Thumbs.db';

let files = 0;
function copy(rel) {
    const from = path.join(SRC, rel);
    if (!fs.existsSync(from)) return;
    const to = path.join(DEST, rel);
    const st = fs.statSync(from);
    if (st.isDirectory()) {
        if (SKIP_DIRS.has(path.basename(from))) return;
        fs.mkdirSync(to, { recursive: true });
        fs.readdirSync(from).forEach((e) => copy(path.join(rel, e)));
        return;
    }
    if (SKIP_FILE(path.basename(from)) || path.basename(from) === '.git') return; // .git file of a submodule
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    files++;
}

const ENGINE = [
    'kit', 'vendor', 'level_editor.html', 'screen_editor.html', 'js', 'css', 'server.js', 'api', 'sw.js',
    'tools/build/build.js', 'tools/build/package.json', 'tools/build/package-lock.json', 'tools/build/README.md',
    'tools/build/templates', 'tools/new-game', 'tools/generate-icons.js', '.gitignore'
];
const STARTER = ['game', 'game.js', 'game.manifest.json', 'index.html', 'manifest.json', 'build.config.json', 'package.json', 'data', 'assets'];
ENGINE.forEach(copy);
STARTER.forEach(copy);

// ---------------------------------------------------------------- nuova identità
const edit = (rel, fn) => {
    const p = path.join(DEST, rel);
    if (!fs.existsSync(p)) return;
    fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8')));
};
const editJson = (rel, fn) => edit(rel, (t) => `${JSON.stringify(fn(JSON.parse(t)), null, 2)}\n`);

editJson('game.manifest.json', (m) => ({ ...m, game: { ...(m.game || {}), id: slug, title, storagePrefix: prefix } }));
edit('game.js', (t) => t
    .replace(/identity:\s*\{[^}]*\}/, `identity: { id: '${slug}', title: '${title.replace(/'/g, "\\'")}', storagePrefix: '${prefix}' }`)
    .replace(/^\/\/ BLOCK HUNTER - .*$/m, `// ${title.toUpperCase()} - built on the SpikeCode engine (kit/)`)
    .replace(/what belongs to Block Hunter/g, `what belongs to ${title}`)
    .replace(/\n\/\/ legacy console helpers[\s\S]*$/, '\n'));
edit('index.html', (t) => t.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`));
editJson('manifest.json', (m) => ({ ...m, name: title, short_name: compact }));
editJson('build.config.json', (c) => ({ ...c, appId, name: title, productName: compact, version: '0.1.0', description: `${title} - SpikeCode` }));
editJson('package.json', (p) => {
    const out = { ...p, name: slug, version: '0.1.0', description: `${title} - SpikeCode game` };
    if (out.scripts && out.scripts['cap:init']) out.scripts['cap:init'] = `npx cap init ${slug} ${appId} --web-dir=www`;
    return out;
});
edit('level_editor.html', (t) => t.replace(/<title>[^<]*<\/title>/, `<title>${title} · Level Editor</title>`));
fs.writeFileSync(path.join(DEST, 'README.md'), `# ${title}

Gioco fatto con il motore **SpikeCode** (cartella \`kit/\`).

- \`node server.js\` → http://localhost:8080/index.html (gioco), \`level_editor.html\` (livelli),
  \`screen_editor.html\` (attract, top ten, istruzioni, selezione livello)
- \`game.js\`: identità del gioco, sprite, regole dei livelli, scene proprie
- \`game.manifest.json\`: blocchi usati, schermate e flusso tra le scene
- \`game/\`: codice proprio del gioco · \`data/\`, \`assets/\`: contenuti
- \`npm run package:install\` poi \`npm run package:web|windows|linux|android\`: pacchetti

Il punto di partenza sono i contenuti di Block Hunter: sostituisci immagini (\`assets/\`), livelli
(\`data/level/\`), nemici e oggetti (\`data/game-entities-mapping.json\`), testi (\`data/dic/\`).
Guida del motore: \`kit/ENGINE.md\`.
`);

// ---------------------------------------------------------------- platform starter
if (type === 'platform') {
    const starter = path.join(SRC, 'kit', 'platform', 'starter');
    const levelDir = path.join(DEST, 'data', 'level');
    fs.readdirSync(levelDir).filter((f) => /^level\d+\.json$|^bonus\d*\.json$/.test(f)).forEach((f) => fs.unlinkSync(path.join(levelDir, f)));
    const levels = fs.readdirSync(path.join(starter, 'level')).filter((f) => f.endsWith('.json')).sort();
    levels.forEach((f) => fs.copyFileSync(path.join(starter, 'level', f), path.join(levelDir, f)));
    editJson('game.manifest.json', (m) => ({ ...m, gameplay: 'platform', levels: levels.map((f) => f.replace(/\.json$/, '')) }));
    const extra = JSON.parse(fs.readFileSync(path.join(starter, 'entities.json'), 'utf8'));
    editJson('data/game-entities-mapping.json', (m) => ({ ...m, entities: { ...(m.entities || {}), ...extra } }));
    edit('game.js', (t) => t
        .replace(/\n\s*\/\/ scenes of this game only[^\n]*\n\s*scenes: \[[^\n]*\]\n/, '\n')
        .replace(/newRun: \{[^}]*\},?/, "newRun: { lives: 5, dynamiteCount: 0 },\n\n    // platform gameplay: gravity, jumps, platforms, ladders, scrolling (kit/platform)\n    gameplay: 'platform'"));
}

console.log(`Creato "${title}" in ${DEST}`);
console.log(`  tipo di gioco: ${type === 'platform' ? 'platform (kit/platform)' : 'visto dall\'alto (kit/gameplay)'}`);
console.log(`  id ${slug} · chiavi browser ${prefix}… · app ${appId} · ${files} file copiati`);
console.log(`  cd ${path.relative(process.cwd(), DEST) || '.'} && node server.js`);
