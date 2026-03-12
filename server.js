const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PORT = process.env.PORT || 8080;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function listImagesInDir(dirPath, publicPrefix, callback) {
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      callback([]);
      return;
    }
    const imgExt = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
    const list = (files || [])
      .filter((f) => imgExt.has(path.extname(f).toLowerCase()))
      .map((f) => path.posix.join(publicPrefix, f));
    callback(list);
  });
}

function safeResolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const requestedPath = decoded === "/" ? "/index.html" : decoded;
  const safePath = path.normalize(requestedPath).replace(/^([/\\])+/, "");
  return path.join(ROOT_DIR, safePath);
}

const server = http.createServer((req, res) => {
  // API: get/save config.json with automatic backup in /bck
  if (req.url && req.url.startsWith('/api/config')) {
    const configFile = path.join(ROOT_DIR, 'data', 'config.json');
    const backupDir = path.join(ROOT_DIR, 'bck');

    if (req.method === 'GET') {
      fs.readFile(configFile, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
          return;
        }
        try {
          const parsed = JSON.parse(data || '{}');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(parsed));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'invalid config json' }));
        }
      });
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'payload must be an object' }));
            return;
          }

          try { fs.mkdirSync(path.dirname(configFile), { recursive: true }); } catch (_) {}
          try { fs.mkdirSync(backupDir, { recursive: true }); } catch (_) {}

          const now = new Date();
          const pad = (n) => String(n).padStart(2, '0');
          const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
          const backupFileName = `config-${stamp}.json`;
          const backupFilePath = path.join(backupDir, backupFileName);

          fs.readFile(configFile, 'utf8', (_readErr, currentData) => {
            const currentText = currentData || '{}';
            fs.writeFile(backupFilePath, currentText, 'utf8', (backupErr) => {
              if (backupErr) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: false, error: backupErr.message }));
                return;
              }

              fs.writeFile(configFile, JSON.stringify(payload, null, 2), 'utf8', (writeErr) => {
                if (writeErr) {
                  res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                  res.end(JSON.stringify({ ok: false, error: writeErr.message }));
                  return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, backupFile: path.posix.join('bck', backupFileName) }));
              });
            });
          });
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
        }
      });
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
    return;
  }

  // Simple API for top scores: GET /api/top-scores, POST /api/top-scores
  if (req.url && req.url.startsWith('/api/top-scores')) {
    const scoresFile = path.join(ROOT_DIR, 'data', 'topScores.json');
    if (req.method === 'GET') {
      fs.readFile(scoresFile, 'utf8', (err, data) => {
        if (err) {
          // fallback: try to read topScores from data/config.json
          fs.readFile(path.join(ROOT_DIR, 'data', 'config.json'), 'utf8', (cfgErr, cfgData) => {
            if (cfgErr) {
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify([]));
              return;
            }
            try {
              const cfg = JSON.parse(cfgData);
              const tops = Array.isArray(cfg.topScores) ? cfg.topScores : [];
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify(tops));
            } catch (e) {
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify([]));
            }
          });
          return;
        }
        try {
          const parsed = JSON.parse(data || '[]');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(parsed));
        } catch (e) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify([]));
        }
      });
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '[]');
          // Ensure directory exists
          try { fs.mkdirSync(path.join(ROOT_DIR, 'data'), { recursive: true }); } catch (_) {}
          fs.writeFile(scoresFile, JSON.stringify(payload, null, 2), 'utf8', (writeErr) => {
            if (writeErr) {
              res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: writeErr.message }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true }));
          });
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
        }
      });
      return;
    }

    // Method not allowed
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
    return;
  }

  // API: list music files in /music folder
  if (req.url && req.url.startsWith('/api/music')) {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
      return;
    }
    const musicDir = path.join(ROOT_DIR, 'music');
    fs.readdir(musicDir, (err, files) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify([]));
        return;
      }
      const audioExt = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac']);
      const list = (files || []).filter(f => audioExt.has(path.extname(f).toLowerCase())).map(f => path.posix.join('music', f));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(list));
    });
    return;
  }

  // API: list level JSON files in /data/level folder
  if (req.url && req.url.startsWith('/api/levels')) {
    const levelDir = path.join(ROOT_DIR, 'data', 'level');

    if (req.method === 'GET') {
      fs.readdir(levelDir, (err, files) => {
        if (err) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify([]));
          return;
        }
        const list = (files || [])
          .filter((f) => path.extname(f).toLowerCase() === '.json')
          .map((f) => path.posix.join('data', 'level', f))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(list));
      });
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const fileName = String(payload?.fileName || '').trim();
          const level = payload?.level;

          if (!fileName || !/^[a-z0-9._-]+\.json$/i.test(fileName) || fileName.includes('..')) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'invalid fileName' }));
            return;
          }
          if (!level || typeof level !== 'object' || Array.isArray(level)) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'level must be an object' }));
            return;
          }

          try { fs.mkdirSync(levelDir, { recursive: true }); } catch (_) { }
          const targetFile = path.join(levelDir, fileName);
          fs.writeFile(targetFile, `${JSON.stringify(level, null, 2)}\n`, 'utf8', (writeErr) => {
            if (writeErr) {
              res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ ok: false, error: writeErr.message }));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, file: path.posix.join('data', 'level', fileName) }));
          });
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
        }
      });
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
    return;
  }

  // API: list image files in /assets/images/background folder
  if (req.url && req.url.startsWith('/api/images/background')) {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
      return;
    }
    const bgDir = path.join(ROOT_DIR, 'assets', 'images', 'background');
    listImagesInDir(bgDir, 'assets/images/background', (list) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(list));
    });
    return;
  }

  // API: list image files in /assets/images/foreground folder
  if (req.url && req.url.startsWith('/api/images/foreground')) {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
      return;
    }
    const fgDir = path.join(ROOT_DIR, 'assets', 'images', 'foreground');
    listImagesInDir(fgDir, 'assets/images/foreground', (list) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(list));
    });
    return;
  }

  // API: list image files in /images folder (legacy)
  if (req.url && req.url.startsWith('/api/images')) {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'method not allowed' }));
      return;
    }
    const imagesDir = path.join(ROOT_DIR, 'images');
    listImagesInDir(imagesDir, 'images', (list) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(list));
    });
    return;
  }

  const filePath = safeResolvePath(req.url || "/");

  fs.stat(filePath, (statErr, stats) => {
    if (statErr) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }

    const finalPath = stats.isDirectory()
      ? path.join(filePath, "index.html")
      : filePath;

    fs.readFile(finalPath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
        return;
      }

      const ext = path.extname(finalPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    });
  });
});

function openFirefox(url) {
  if (process.env.OPEN_BROWSER !== "firefox") {
    return;
  }

  const candidates = [
    process.env.FIREFOX_PATH,
    "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
    "C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe",
  ].filter(Boolean);

  const firefoxPath = candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  });

  if (!firefoxPath) {
    return;
  }

  const child = spawn(firefoxPath, [url], {
    detached: true,
    stdio: "ignore",
  });

  child.unref();
}

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/index.html`;
  console.log(`Server running at http://localhost:${PORT}/`);
  openFirefox(url);
});
