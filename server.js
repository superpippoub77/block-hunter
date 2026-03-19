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

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req, callback) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      callback(null, parsed);
    } catch (e) {
      callback(e);
    }
  });
}

function sanitizeFileName(fileName) {
  const raw = String(fileName || "").trim();
  if (!raw) return "";
  const base = path.basename(raw);
  if (base !== raw) return "";
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) return "";
  return base;
}

function getAssetConfigForType(type) {
  const key = String(type || "").trim().toLowerCase();
  if (key === "background") {
    return {
      dir: path.join(ROOT_DIR, "assets", "images", "background"),
      prefix: "assets/images/background",
      allowedExt: new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"])
    };
  }
  if (key === "foreground") {
    return {
      dir: path.join(ROOT_DIR, "assets", "images", "foreground"),
      prefix: "assets/images/foreground",
      allowedExt: new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"])
    };
  }
  if (key === "music") {
    return {
      dir: path.join(ROOT_DIR, "music"),
      prefix: "music",
      allowedExt: new Set([".mp3", ".ogg", ".wav", ".m4a", ".aac"])
    };
  }
  return null;
}

function collectUsedAssets() {
  const used = {
    background: new Set(),
    foreground: new Set(),
    music: new Set()
  };

  const levelDir = path.join(ROOT_DIR, "data", "level");
  let files = [];
  try {
    files = fs.readdirSync(levelDir);
  } catch (_e) {
    files = [];
  }

  const pushNormalized = (set, raw, mode) => {
    const val = String(raw || "").trim();
    if (!val) return;
    const base = path.basename(val);
    if (!base) return;
    set.add(base);
    if (mode === "music") return;
    if (mode === "background") {
      if (val.startsWith("assets/images/background/")) set.add(base);
    }
    if (mode === "foreground") {
      if (val.startsWith("assets/images/foreground/")) set.add(base);
    }
  };

  const walkLayer = (value, mode) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((v) => walkLayer(v, mode));
      return;
    }
    if (typeof value === "string" || typeof value === "number") {
      pushNormalized(used[mode], value, mode);
      return;
    }
    if (typeof value === "object") {
      if (value.src) pushNormalized(used[mode], value.src, mode);
    }
  };

  files
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .forEach((name) => {
      try {
        const full = path.join(levelDir, name);
        const parsed = JSON.parse(fs.readFileSync(full, "utf8"));
        walkLayer(parsed.background, "background");
        walkLayer(parsed.foreground, "foreground");
        if (parsed.music) pushNormalized(used.music, parsed.music, "music");
      } catch (_e) {
        // Ignore malformed level files.
      }
    });

  return used;
}

function listAssetItems(type) {
  const cfg = getAssetConfigForType(type);
  if (!cfg) return { ok: false, error: "invalid type" };

  let files = [];
  try {
    files = fs.readdirSync(cfg.dir);
  } catch (_e) {
    files = [];
  }

  const used = collectUsedAssets();
  const usedSet = used[type] || new Set();
  const assets = files
    .filter((name) => cfg.allowedExt.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      path: path.posix.join(cfg.prefix, name),
      used: usedSet.has(name)
    }));

  return { ok: true, assets };
}

function handleAssetsApi(req, res, urlObj) {
  if (req.method === "GET") {
    const type = String(urlObj.searchParams.get("type") || "").trim().toLowerCase();
    const out = listAssetItems(type);
    if (!out.ok) {
      sendJson(res, 400, out);
      return;
    }
    sendJson(res, 200, out);
    return;
  }

  if (req.method === "DELETE") {
    parseJsonBody(req, (err, body) => {
      if (err) {
        sendJson(res, 400, { ok: false, error: "invalid json" });
        return;
      }
      const type = String(body.type || "").trim().toLowerCase();
      const fileName = sanitizeFileName(body.fileName);
      const cfg = getAssetConfigForType(type);
      if (!cfg || !fileName) {
        sendJson(res, 400, { ok: false, error: "invalid type or fileName" });
        return;
      }

      const used = collectUsedAssets();
      const usedSet = used[type] || new Set();
      if (usedSet.has(fileName)) {
        sendJson(res, 409, { ok: false, error: "asset is used by one or more levels" });
        return;
      }

      const target = path.join(cfg.dir, fileName);
      if (!target.startsWith(cfg.dir)) {
        sendJson(res, 400, { ok: false, error: "invalid path" });
        return;
      }

      fs.unlink(target, (unlinkErr) => {
        if (unlinkErr) {
          sendJson(res, 500, { ok: false, error: unlinkErr.message });
          return;
        }
        sendJson(res, 200, { ok: true });
      });
    });
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
}

function handleAssetsUploadApi(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  parseJsonBody(req, (err, body) => {
    if (err) {
      sendJson(res, 400, { ok: false, error: "invalid json" });
      return;
    }

    const type = String(body.type || "").trim().toLowerCase();
    const fileName = sanitizeFileName(body.fileName);
    const contentBase64 = String(body.contentBase64 || "").trim();
    const cfg = getAssetConfigForType(type);
    if (!cfg || !fileName || !contentBase64) {
      sendJson(res, 400, { ok: false, error: "missing required fields" });
      return;
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!cfg.allowedExt.has(ext)) {
      sendJson(res, 400, { ok: false, error: "file extension not allowed" });
      return;
    }

    const target = path.join(cfg.dir, fileName);
    if (!target.startsWith(cfg.dir)) {
      sendJson(res, 400, { ok: false, error: "invalid path" });
      return;
    }

    let buffer;
    try {
      buffer = Buffer.from(contentBase64, "base64");
    } catch (_e) {
      sendJson(res, 400, { ok: false, error: "invalid base64 content" });
      return;
    }

    fs.mkdir(cfg.dir, { recursive: true }, (mkErr) => {
      if (mkErr) {
        sendJson(res, 500, { ok: false, error: mkErr.message });
        return;
      }
      fs.writeFile(target, buffer, (writeErr) => {
        if (writeErr) {
          sendJson(res, 500, { ok: false, error: writeErr.message });
          return;
        }
        sendJson(res, 200, {
          ok: true,
          path: path.posix.join(cfg.prefix, fileName)
        });
      });
    });
  });
}

function handleDictionariesApi(req, res, urlObj) {
  const dicDir = path.join(ROOT_DIR, "data", "dic");

  if (req.method === "GET") {
    const name = String(urlObj.searchParams.get("name") || "").trim();
    if (!name) {
      fs.readdir(dicDir, (err, files) => {
        if (err) {
          sendJson(res, 500, { ok: false, error: err.message });
          return;
        }
        const items = (files || [])
          .filter((f) => f.toLowerCase().endsWith(".json"))
          .sort((a, b) => a.localeCompare(b));
        sendJson(res, 200, { ok: true, items });
      });
      return;
    }

    const safeName = sanitizeFileName(name);
    if (!safeName || !safeName.toLowerCase().endsWith(".json")) {
      sendJson(res, 400, { ok: false, error: "invalid dictionary name" });
      return;
    }
    const target = path.join(dicDir, safeName);
    if (!target.startsWith(dicDir)) {
      sendJson(res, 400, { ok: false, error: "invalid path" });
      return;
    }

    fs.readFile(target, "utf8", (readErr, content) => {
      if (readErr) {
        sendJson(res, 404, { ok: false, error: "dictionary not found" });
        return;
      }
      try {
        const parsed = JSON.parse(content || "{}");
        sendJson(res, 200, { ok: true, data: parsed });
      } catch (_e) {
        sendJson(res, 500, { ok: false, error: "invalid dictionary json" });
      }
    });
    return;
  }

  if (req.method === "POST") {
    parseJsonBody(req, (err, body) => {
      if (err) {
        sendJson(res, 400, { ok: false, error: "invalid json" });
        return;
      }

      const name = sanitizeFileName(body.name);
      const data = body.data;
      if (!name || !name.toLowerCase().endsWith(".json")) {
        sendJson(res, 400, { ok: false, error: "invalid dictionary name" });
        return;
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        sendJson(res, 400, { ok: false, error: "dictionary data must be an object" });
        return;
      }

      const target = path.join(dicDir, name);
      if (!target.startsWith(dicDir)) {
        sendJson(res, 400, { ok: false, error: "invalid path" });
        return;
      }

      fs.mkdir(dicDir, { recursive: true }, (mkErr) => {
        if (mkErr) {
          sendJson(res, 500, { ok: false, error: mkErr.message });
          return;
        }
        fs.writeFile(target, `${JSON.stringify(data, null, 2)}\n`, "utf8", (writeErr) => {
          if (writeErr) {
            sendJson(res, 500, { ok: false, error: writeErr.message });
            return;
          }
          sendJson(res, 200, { ok: true });
        });
      });
    });
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
}

function getMappingConfigForType(type) {
  const key = String(type || "").trim().toLowerCase();
  if (key === "entities") {
    return {
      file: path.join(ROOT_DIR, "data", "game-entities-mapping.json"),
      itemRootKey: "entities"
    };
  }
  if (key === "effects") {
    return {
      file: path.join(ROOT_DIR, "data", "game-effects-mapping.json"),
      itemRootKey: "effectProfiles"
    };
  }
  if (key === "tiles") {
    return {
      file: path.join(ROOT_DIR, "data", "game-tiles-mapping.json"),
      itemRootKey: "tiles"
    };
  }
  return null;
}

function createBackupPath(prefix) {
  const backupDir = path.join(ROOT_DIR, "bck");
  try { fs.mkdirSync(backupDir, { recursive: true }); } catch (_) {}
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const backupFileName = `${prefix}-${stamp}.json`;
  return {
    backupDir,
    backupFileName,
    backupFilePath: path.join(backupDir, backupFileName)
  };
}

function handleMappingsApi(req, res, urlObj) {
  const type = String(urlObj.searchParams.get("type") || "").trim().toLowerCase();
  const cfg = getMappingConfigForType(type);
  if (!cfg) {
    sendJson(res, 400, { ok: false, error: "invalid mapping type" });
    return;
  }

  if (req.method === "GET") {
    fs.readFile(cfg.file, "utf8", (err, content) => {
      if (err) {
        sendJson(res, 500, { ok: false, error: err.message });
        return;
      }
      try {
        const parsed = JSON.parse(content || "{}");
        sendJson(res, 200, {
          ok: true,
          type,
          file: path.relative(ROOT_DIR, cfg.file).replace(/\\/g, "/"),
          itemRootKey: cfg.itemRootKey,
          data: parsed
        });
      } catch (_e) {
        sendJson(res, 500, { ok: false, error: "invalid mapping json" });
      }
    });
    return;
  }

  if (req.method === "POST") {
    parseJsonBody(req, (err, body) => {
      if (err) {
        sendJson(res, 400, { ok: false, error: "invalid json" });
        return;
      }

      const data = body.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        sendJson(res, 400, { ok: false, error: "mapping data must be an object" });
        return;
      }

      const backup = createBackupPath(`mapping-${type}`);
      fs.readFile(cfg.file, "utf8", (_readErr, currentData) => {
        const currentText = currentData || "{}";
        fs.writeFile(backup.backupFilePath, currentText, "utf8", (backupErr) => {
          if (backupErr) {
            sendJson(res, 500, { ok: false, error: backupErr.message });
            return;
          }

          fs.writeFile(cfg.file, `${JSON.stringify(data, null, 2)}\n`, "utf8", (writeErr) => {
            if (writeErr) {
              sendJson(res, 500, { ok: false, error: writeErr.message });
              return;
            }
            sendJson(res, 200, {
              ok: true,
              backupFile: path.posix.join("bck", backup.backupFileName)
            });
          });
        });
      });
    });
    return;
  }

  sendJson(res, 405, { ok: false, error: "method not allowed" });
}

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (urlObj.pathname === "/api/assets") {
    handleAssetsApi(req, res, urlObj);
    return;
  }

  if (urlObj.pathname === "/api/assets/upload") {
    handleAssetsUploadApi(req, res);
    return;
  }

  if (urlObj.pathname === "/api/dictionaries") {
    handleDictionariesApi(req, res, urlObj);
    return;
  }

  if (urlObj.pathname === "/api/mappings") {
    handleMappingsApi(req, res, urlObj);
    return;
  }

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
