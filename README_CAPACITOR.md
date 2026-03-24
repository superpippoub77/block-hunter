# Packaging Block Hunter with Capacitor

This guide shows the minimal steps to package the web game into native Android/iOS apps using Capacitor. It assumes you have Node.js and npm installed.

1) Install Capacitor CLI and Core (in your project root):

```bash
npm install --save-dev @capacitor/cli @capacitor/core
```

2) Initialize npm (if you don't have a package.json yet):

```bash
npm init -y
```

3) Build your web app with Vite and prepare `www/` for Capacitor:

```bash
npm install
npm run prepare:www
```

Questo comando esegue la build Vite (`dist/`) e copia il contenuto ottimizzato in `www/`.

4) Initialize Capacitor (replace appId and appName):

```bash
npx cap init block-hunter com.example.blockhunter
```

When prompted, set the webDir to `www` (or the folder where your built web files are).

5) Add platforms:

```bash
npx cap add android
# optionally for iOS (macOS required)
# npx cap add ios
```

6) Copy web assets into native projects and open the native IDE:

```bash
npx cap copy
npx cap open android
# npx cap open ios
```

7) Build and run from Android Studio / Xcode. You may need to set the minimum SDK and signing keys.

Notes & tips
- Prefer to produce a proper `www` build (minified JS/CSS) for better performance.
- Add the icons in `manifest.json` and make sure `assets/icons` contains the referenced images.
- Consider Service Worker / offline caching if you want PWA-like behavior.

If you want, I can add a `package.json` with helper scripts (`cap:init`, `cap:copy`, `cap:open:android`) and a minimal `www` build task to make these steps reproducible.

Icon generation
----------------
You can generate PNG icons from the SVG placeholders with the included node script. Install dev deps and run:

```bash
npm install
npm run generate:icons
```

This will create `assets/icons/icon-192.png` and `assets/icons/icon-512.png` used by the manifest.
