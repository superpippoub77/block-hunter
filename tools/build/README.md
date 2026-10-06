# Pacchetti del gioco (SpikeCode packager)

Crea le versioni scaricabili del gioco a partire dai file elencati in `build.config.json`
(nella cartella principale del progetto).

| Comando | Risultato in `dist/` |
|---|---|
| `npm run package:web` | `<Nome>-web-<versione>.zip`: per un sito web o itch.io; dai telefoni si installa come app (PWA) |
| `npm run package:windows` | `<Nome>-windows-x64-<versione>.zip` con `<Nome>.exe` (Electron) |
| `npm run package:linux` | `<Nome>-linux-x64-<versione>.tar.gz` (Electron) |
| `npm run package:android` | `<Nome>-android-<versione>.apk` se c'è l'Android SDK (`ANDROID_HOME`), altrimenti `<Nome>-android-project-<versione>.zip` da aprire con Android Studio |
| `npm run package:all` | tutti |

La prima volta: `npm run package:install` (installa gli strumenti in `tools/build/node_modules`).
Gli editor (`level_editor.html`, `screen_editor.html`) hanno il pulsante **📦 Crea pacchetto**, che fa
tutto da solo quando il gioco è avviato con `npm run start:api`. Sul sito PHP si può creare solo il
pacchetto web.

## build.config.json

- `appId`, `name`, `productName`, `version`, `description`, `author`: identità dell'app;
- `icon` (PNG 512) e `iconIco` (Windows);
- `window`: dimensioni della finestra desktop;
- `releaseConfig`: valori di `data/config.json` sovrascritti **solo nei pacchetti**
  (es. `"debugTileGrid": false`);
- `include` / `exclude`: file e cartelle del gioco, file da escludere (sorgenti `.pdn`, copie `_old`…).

## Come funziona

- **Desktop**: `templates/electron-main.js` apre il gioco in una finestra Electron servendolo dal
  protocollo `app://`, così moduli JavaScript e `fetch()` dei dati funzionano come su un server web.
  F11 = schermo intero.
- **Android**: progetto Capacitor (`capacitor.config.json` + `www/`).
- **iPhone/iPad**: la versione web installata da Safari (Condividi → Aggiungi alla schermata Home);
  per un'app vera `npx cap add ios` nel progetto Android/Capacitor, su un Mac con Xcode.
