#!/usr/bin/env node
// SpikeCode packager: builds the downloadable packages of the game.
//
//   node tools/build/build.js web       → dist/<Name>-web-<ver>.zip      (any web server, itch.io; PWA)
//   node tools/build/build.js windows   → dist/<Name>-windows-x64-<ver>.zip (BlockHunter.exe inside)
//   node tools/build/build.js linux     → dist/<Name>-linux-x64-<ver>.tar.gz
//   node tools/build/build.js android   → dist/<Name>-android-<ver>.apk if the Android SDK is installed,
//                                         otherwise dist/<Name>-android-project-<ver>.zip for Android Studio
//   node tools/build/build.js all
//
// The files of the game come from build.config.json ("include" / "exclude") at the project root.
// First run: cd tools/build && npm install (the editors' "Crea pacchetto" button does it for you).
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const STAGE = path.join(DIST, '.stage');
const ELECTRON_VERSION = '32.3.3';
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'build.config.json'), 'utf8'));
const NAME = cfg.productName || 'Game';
const VER = cfg.version || '1.0.0';

const log = (...a) => console.log('[build]', ...a);
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const mkdir = (p) => fs.mkdirSync(p, { recursive: true });

function globToRegex(g) {
    return new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, 'i');
}
const EXCLUDE = (cfg.exclude || []).map(globToRegex);
const excluded = (name) => EXCLUDE.some((r) => r.test(name));

function copyTree(src, dst, stats) {
    const st = fs.statSync(src);
    if (st.isDirectory()) {
        mkdir(dst);
        for (const e of fs.readdirSync(src)) {
            if (e.startsWith('.') || excluded(e)) continue;
            copyTree(path.join(src, e), path.join(dst, e), stats);
        }
    } else {
        mkdir(path.dirname(dst));
        fs.copyFileSync(src, dst);
        stats.files++; stats.bytes += st.size;
    }
}

/** Copies the game files listed in build.config.json into <dir> */
function stageWeb(dir) {
    rm(dir); mkdir(dir);
    const stats = { files: 0, bytes: 0 };
    for (const entry of cfg.include || []) {
        const src = path.join(ROOT, entry);
        if (!fs.existsSync(src)) { log(`attenzione: ${entry} non esiste, salto`); continue; }
        copyTree(src, path.join(dir, entry), stats);
    }
    // release settings (build.config.json "releaseConfig"), e.g. no debug grid in the packages
    const cfgFile = path.join(dir, 'data', 'config.json');
    if (cfg.releaseConfig && fs.existsSync(cfgFile)) {
        const game = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
        Object.assign(game, cfg.releaseConfig);
        fs.writeFileSync(cfgFile, `${JSON.stringify(game, null, 2)}\n`);
        log(`impostazioni di rilascio: ${Object.keys(cfg.releaseConfig).join(', ')}`);
    }
    log(`file del gioco: ${stats.files} (${(stats.bytes / 1048576).toFixed(1)} MB)`);
    return stats;
}

function zipDir(dir, outFile, rootName) {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addLocalFolder(dir, rootName || '');
    zip.writeZip(outFile);
    log(`creato ${path.relative(ROOT, outFile)} (${(fs.statSync(outFile).size / 1048576).toFixed(1)} MB)`);
    return outFile;
}

async function buildWeb() {
    const www = path.join(STAGE, 'web', NAME);
    stageWeb(www);
    fs.writeFileSync(path.join(www, 'LEGGIMI.txt'), [
        `${cfg.name} ${VER} — versione web`,
        '',
        'Carica il contenuto di questa cartella su un qualsiasi server web (o su itch.io come gioco HTML)',
        'e apri index.html. Il gioco usa moduli JavaScript: aprendo index.html direttamente dal disco',
        '(file://) il browser lo blocca, serve un server web.',
        '',
        'Sui telefoni (Android e iPhone) dal sito si installa come app: menu del browser →',
        '"Aggiungi a schermata Home". Dopo la prima apertura funziona anche offline.',
        ''
    ].join('\n'));
    mkdir(DIST);
    return zipDir(path.join(STAGE, 'web'), path.join(DIST, `${NAME}-web-${VER}.zip`));
}

function stageElectron() {
    const app = path.join(STAGE, 'electron-app');
    stageWeb(path.join(app, 'www'));
    fs.copyFileSync(path.join(__dirname, 'templates', 'electron-main.js'), path.join(app, 'main.js'));
    fs.copyFileSync(path.join(ROOT, cfg.icon), path.join(app, 'icon.png'));
    fs.writeFileSync(path.join(app, 'app-settings.json'), JSON.stringify({ title: cfg.name, ...(cfg.window || {}) }, null, 2));
    fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({
        name: (cfg.appId || NAME).toLowerCase().replace(/[^a-z0-9.-]/g, '-'),
        productName: NAME, version: VER, description: cfg.description || '', author: cfg.author || '', main: 'main.js'
    }, null, 2));
    return app;
}

async function buildDesktop(platform) {
    const { packager } = require('@electron/packager');
    const app = stageElectron();
    const out = path.join(STAGE, `electron-${platform}`);
    rm(out);
    log(`impacchetto per ${platform} con Electron ${ELECTRON_VERSION} (la prima volta scarica Electron, ~100 MB)…`);
    const [appDir] = await packager({
        dir: app, out, platform, arch: 'x64', electronVersion: ELECTRON_VERSION,
        name: NAME, executableName: NAME, appVersion: VER, overwrite: true, asar: true, prune: false,
        icon: platform === 'win32' ? path.join(ROOT, cfg.iconIco || cfg.icon) : path.join(ROOT, cfg.icon),
        // without wine the Windows .exe keeps the default Electron icon/metadata
        win32metadata: { CompanyName: cfg.author || '', ProductName: cfg.name || NAME, FileDescription: cfg.description || '' }
    }).catch(async (e) => {
        if (platform === 'win32' && /wine/i.test(String(e && e.message))) {
            log('wine non disponibile: creo l\'eseguibile Windows senza icona personalizzata');
            return packager({ dir: app, out, platform, arch: 'x64', electronVersion: ELECTRON_VERSION, name: NAME, executableName: NAME, appVersion: VER, overwrite: true, asar: true, prune: false });
        }
        throw e;
    });
    mkdir(DIST);
    if (platform === 'win32') return zipDir(appDir, path.join(DIST, `${NAME}-windows-x64-${VER}.zip`), path.basename(appDir));
    const tar = require('tar');
    const file = path.join(DIST, `${NAME}-linux-x64-${VER}.tar.gz`);
    await tar.c({ gzip: true, file, cwd: path.dirname(appDir), portable: true }, [path.basename(appDir)]);
    log(`creato ${path.relative(ROOT, file)} (${(fs.statSync(file).size / 1048576).toFixed(1)} MB)`);
    return file;
}

function hasAndroidSdk() {
    const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    return !!(sdk && fs.existsSync(sdk));
}

async function buildAndroid() {
    const proj = path.join(STAGE, 'android-project', NAME);
    rm(path.dirname(proj));
    stageWeb(path.join(proj, 'www'));
    fs.writeFileSync(path.join(proj, 'package.json'), JSON.stringify({
        name: NAME.toLowerCase(), version: VER, private: true,
        scripts: { 'add-android': 'cap add android', sync: 'cap sync android', open: 'cap open android' },
        dependencies: { '@capacitor/android': '^6.1.2', '@capacitor/core': '^6.1.2' },
        devDependencies: { '@capacitor/cli': '^6.1.2' }
    }, null, 2));
    fs.writeFileSync(path.join(proj, 'capacitor.config.json'), JSON.stringify({
        appId: cfg.appId, appName: cfg.name, webDir: 'www',
        android: { backgroundColor: '#000000' }, server: { androidScheme: 'https' }
    }, null, 2));
    fs.writeFileSync(path.join(proj, 'LEGGIMI.txt'), [
        `${cfg.name} ${VER} — progetto Android (Capacitor)`,
        '',
        'Serve Android Studio (con l\'SDK) e Node.js. In questa cartella:',
        '  npm install',
        '  npx cap add android',
        '  npx cap open android      → in Android Studio: Build > Build App Bundle(s) / APK(s)',
        '',
        'Per l\'iPhone: npx cap add ios (serve un Mac con Xcode), oppure installa la versione web',
        'dal sito con Safari → Condividi → "Aggiungi alla schermata Home".',
        ''
    ].join('\n'));
    mkdir(DIST);
    if (!hasAndroidSdk()) {
        log('Android SDK non trovato (ANDROID_HOME): creo il progetto da aprire con Android Studio');
        return zipDir(path.dirname(proj), path.join(DIST, `${NAME}-android-project-${VER}.zip`));
    }
    log('Android SDK trovato: compilo l\'APK (debug)…');
    const run = (cmd) => { log(`$ ${cmd}`); execSync(cmd, { cwd: proj, stdio: 'inherit' }); };
    run('npm install --no-audit --no-fund');
    run('npx cap add android');
    run('npx cap sync android');
    const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    execSync(`${gradlew} assembleDebug`, { cwd: path.join(proj, 'android'), stdio: 'inherit' });
    const apk = path.join(proj, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    const out = path.join(DIST, `${NAME}-android-${VER}.apk`);
    fs.copyFileSync(apk, out);
    log(`creato ${path.relative(ROOT, out)}`);
    return out;
}

async function main() {
    const target = (process.argv[2] || 'web').toLowerCase();
    const jobs = {
        web: buildWeb,
        windows: () => buildDesktop('win32'),
        linux: () => buildDesktop('linux'),
        android: buildAndroid
    };
    const list = target === 'all' ? Object.keys(jobs) : [target];
    const results = [];
    for (const t of list) {
        if (!jobs[t]) throw new Error(`destinazione sconosciuta: ${t} (web, windows, linux, android, all)`);
        log(`=== ${t} ===`);
        results.push(await jobs[t]());
    }
    rm(STAGE);
    // the editors read this line to offer the download
    console.log(`BUILD_RESULT ${JSON.stringify(results.map((f) => path.relative(ROOT, f).split(path.sep).join('/')))}`);
}

main().catch((e) => { console.error('[build] ERRORE:', e && e.stack || e); process.exit(1); });
