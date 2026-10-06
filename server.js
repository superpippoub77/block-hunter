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

// Screens designed in the screen editor: data/screens/<id>.json (backup in bck/ on save)
function handleScreensApi(req, res, urlObj) {
  const dir = path.join(ROOT_DIR, "data", "screens");
  const id = String(urlObj.searchParams.get("id") || "").trim();
  if (id && !/^[a-z0-9_-]+$/i.test(id)) {
    sendJson(res, 400, { ok: false, error: "invalid screen id" });
    return;
  }
  if (req.method === "GET") {
    if (!id) {
      fs.readdir(dir, (err, files) => {
        const items = (files || []).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
        sendJson(res, 200, { ok: true, items });
      });
      return;
    }
    fs.readFile(path.join(dir, `${id}.json`), "utf8", (err, content) => {
      if (err) { sendJson(res, 404, { ok: false, error: "screen not found" }); return; }
      try { sendJson(res, 200, { ok: true, id, data: JSON.parse(content) }); }
      catch (_e) { sendJson(res, 500, { ok: false, error: "invalid screen json" }); }
    });
    return;
  }
  if (req.method === "POST") {
    if (!id) { sendJson(res, 400, { ok: false, error: "missing id" }); return; }
    parseJsonBody(req, (err, body) => {
      const data = body && body.data;
      if (err || !data || typeof data !== "object" || Array.isArray(data)) {
        sendJson(res, 400, { ok: false, error: "screen data must be an object" });
        return;
      }
      try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
      const file = path.join(dir, `${id}.json`);
      const backup = createBackupPath(`screen-${id}`);
      fs.readFile(file, "utf8", (_e, current) => {
        const write = () => fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8", (wErr) => {
          if (wErr) { sendJson(res, 500, { ok: false, error: wErr.message }); return; }
          sendJson(res, 200, { ok: true, file: `data/screens/${id}.json` });
        });
        if (current == null) { write(); return; }
        fs.writeFile(backup.backupFilePath, current, "utf8", () => write());
      });
    });
    return;
  }
  sendJson(res, 405, { ok: false, error: "method not allowed" });
}

// Game levels (data/level/<id>.json) with versions for the level editor:
//   GET  /api/levels                         -> list of levels
//   GET  /api/levels?id=level10              -> level json
//   GET  /api/levels?id=level10&versions=1   -> versions (newest first)
//   GET  /api/levels?id=level10&version=V    -> one version
//   POST /api/levels?id=level10 {data, note} -> saves the level; every save is kept as a version
//        in data/level-versions/<id>/ (the first save also keeps the original file)
const LEVEL_ID_RE = /^[a-z0-9_-]+$/i;
const LEVEL_VERSION_RE = /^\d{8}-\d{6}-\d{3}$/;
function levelVersionStamp(date = new Date()) {
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}-${p(date.getMilliseconds(), 3)}`;
}
function levelSummary(data) {
  const tiles = data && data.map && Array.isArray(data.map.tiles) ? data.map.tiles : [];
  return {
    levelId: data && data.id != null ? String(data.id) : "",
    cols: Number(data && data.map && data.map.cols) || (tiles[0] ? tiles[0].length : 0),
    rows: Number(data && data.map && data.map.rows) || tiles.length
  };
}
function writeLevelVersion(id, data, note, cb) {
  const dir = path.join(ROOT_DIR, "data", "level-versions", id);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  let stamp = levelVersionStamp();
  while (fs.existsSync(path.join(dir, `${stamp}.json`))) stamp = levelVersionStamp(new Date(Date.now() + 1));
  const payload = { version: stamp, savedAt: new Date().toISOString(), note: String(note || "").slice(0, 200), data };
  fs.writeFile(path.join(dir, `${stamp}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8", (err) => cb(err, stamp));
}
function handleLevelsApi(req, res, urlObj) {
  const levelDir = path.join(ROOT_DIR, "data", "level");
  const id = String(urlObj.searchParams.get("id") || "").trim();
  if (id && !LEVEL_ID_RE.test(id)) { sendJson(res, 400, { ok: false, error: "invalid level id" }); return; }
  const versionsDir = id ? path.join(ROOT_DIR, "data", "level-versions", id) : null;
  if (req.method === "GET") {
    if (!id) {
      fs.readdir(levelDir, (err, files) => {
        const items = (files || []).filter((f) => f.endsWith(".json")).sort().map((f) => {
          const levelIdName = f.replace(/\.json$/, "");
          let summary = {};
          let modified = null;
          try {
            const full = path.join(levelDir, f);
            modified = fs.statSync(full).mtime.toISOString();
            summary = levelSummary(JSON.parse(fs.readFileSync(full, "utf8")));
          } catch (_) { summary = { invalid: true }; }
          let versions = 0;
          try { versions = fs.readdirSync(path.join(ROOT_DIR, "data", "level-versions", levelIdName)).filter((v) => v.endsWith(".json")).length; } catch (_) {}
          return { id: levelIdName, file: `data/level/${f}`, modified, versions, ...summary };
        });
        sendJson(res, 200, { ok: true, items });
      });
      return;
    }
    if (urlObj.searchParams.get("versions")) {
      fs.readdir(versionsDir, (err, files) => {
        const items = (files || []).filter((f) => LEVEL_VERSION_RE.test(f.replace(/\.json$/, ""))).sort().reverse().map((f) => {
          try {
            const v = JSON.parse(fs.readFileSync(path.join(versionsDir, f), "utf8"));
            return { version: v.version, savedAt: v.savedAt, note: v.note || "", ...levelSummary(v.data) };
          } catch (_) { return { version: f.replace(/\.json$/, ""), invalid: true }; }
        });
        sendJson(res, 200, { ok: true, id, items });
      });
      return;
    }
    const version = String(urlObj.searchParams.get("version") || "").trim();
    if (version) {
      if (!LEVEL_VERSION_RE.test(version)) { sendJson(res, 400, { ok: false, error: "invalid version" }); return; }
      fs.readFile(path.join(versionsDir, `${version}.json`), "utf8", (err, content) => {
        if (err) { sendJson(res, 404, { ok: false, error: "version not found" }); return; }
        try { const v = JSON.parse(content); sendJson(res, 200, { ok: true, id, version, note: v.note || "", savedAt: v.savedAt, data: v.data }); }
        catch (_e) { sendJson(res, 500, { ok: false, error: "invalid version json" }); }
      });
      return;
    }
    fs.readFile(path.join(levelDir, `${id}.json`), "utf8", (err, content) => {
      if (err) { sendJson(res, 404, { ok: false, error: "level not found" }); return; }
      try { sendJson(res, 200, { ok: true, id, data: JSON.parse(content) }); }
      catch (_e) { sendJson(res, 500, { ok: false, error: "invalid level json" }); }
    });
    return;
  }
  if (req.method === "POST") {
    if (!id) { sendJson(res, 400, { ok: false, error: "missing id" }); return; }
    parseJsonBody(req, (err, body) => {
      const data = body && body.data;
      if (err || !data || typeof data !== "object" || Array.isArray(data) || !data.map) {
        sendJson(res, 400, { ok: false, error: "level data must be an object with a map" });
        return;
      }
      const file = path.join(levelDir, `${id}.json`);
      const hasVersions = (() => { try { return fs.readdirSync(versionsDir).some((f) => f.endsWith(".json")); } catch (_) { return false; } })();
      const saveNew = () => {
        fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8", (wErr) => {
          if (wErr) { sendJson(res, 500, { ok: false, error: wErr.message }); return; }
          writeLevelVersion(id, data, body.note || "Salvataggio", (vErr, version) => {
            if (vErr) { sendJson(res, 500, { ok: false, error: vErr.message }); return; }
            sendJson(res, 200, { ok: true, id, file: `data/level/${id}.json`, version });
          });
        });
      };
      fs.readFile(file, "utf8", (_e, current) => {
        // first save of an existing level: keep the original as a version, so it can always come back
        if (current != null && !hasVersions) {
          let original = null;
          try { original = JSON.parse(current); } catch (_) { original = null; }
          if (original) { writeLevelVersion(id, original, "Originale (prima del primo salvataggio dall'editor)", () => saveNew()); return; }
        }
        saveNew();
      });
    });
    return;
  }
  sendJson(res, 405, { ok: false, error: "method not allowed" });
}

// Game manifest (game.manifest.json): blocks, screens and scene flow
function handleManifestApi(req, res) {
  const file = path.join(ROOT_DIR, "game.manifest.json");
  if (req.method === "GET") {
    fs.readFile(file, "utf8", (err, content) => {
      if (err) { sendJson(res, 404, { ok: false, error: "manifest not found" }); return; }
      try { sendJson(res, 200, { ok: true, data: JSON.parse(content) }); }
      catch (_e) { sendJson(res, 500, { ok: false, error: "invalid manifest json" }); }
    });
    return;
  }
  if (req.method === "POST") {
    parseJsonBody(req, (err, body) => {
      const data = body && body.data;
      if (err || !data || typeof data !== "object" || Array.isArray(data)) {
        sendJson(res, 400, { ok: false, error: "manifest must be an object" });
        return;
      }
      const backup = createBackupPath("manifest");
      fs.readFile(file, "utf8", (_e, current) => {
        fs.writeFile(backup.backupFilePath, current || "{}", "utf8", () => {
          fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8", (wErr) => {
            if (wErr) { sendJson(res, 500, { ok: false, error: wErr.message }); return; }
            sendJson(res, 200, { ok: true });
          });
        });
      });
    });
    return;
  }
  sendJson(res, 405, { ok: false, error: "method not allowed" });
}

// Packages for web / Windows / Linux / Android (tools/build/build.js), run as background jobs
const buildJobs = new Map();
function handleBuildApi(req, res, urlObj) {
  const buildDir = path.join(ROOT_DIR, "tools", "build");
  const hasSdk = !!((process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT) && fs.existsSync(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT));
  if (req.method === "GET") {
    const id = urlObj.searchParams.get("job");
    if (id) {
      const job = buildJobs.get(id);
      if (!job) { sendJson(res, 404, { ok: false, error: "job not found" }); return; }
      sendJson(res, 200, { ok: true, job: { id, target: job.target, status: job.status, files: job.files, log: job.log.slice(-40) } });
      return;
    }
    let files = [];
    try { files = fs.readdirSync(path.join(ROOT_DIR, "dist")).filter((f) => !f.startsWith(".")).map((f) => `dist/${f}`); } catch (_) {}
    sendJson(res, 200, {
      ok: true, server: "node",
      targets: { web: true, windows: true, linux: true, android: true },
      androidSdk: hasSdk,
      files
    });
    return;
  }
  if (req.method === "POST") {
    const target = String(urlObj.searchParams.get("target") || "").toLowerCase();
    if (!["web", "windows", "linux", "android", "all"].includes(target)) { sendJson(res, 400, { ok: false, error: "invalid target" }); return; }
    const running = [...buildJobs.values()].find((j) => j.status === "running");
    if (running) { sendJson(res, 409, { ok: false, error: `è già in corso un pacchetto (${running.target})` }); return; }
    const id = `${Date.now().toString(36)}-${target}`;
    const job = { target, status: "running", log: [], files: [] };
    buildJobs.set(id, job);
    const push = (chunk) => String(chunk).split(/\r?\n/).filter(Boolean).forEach((line) => {
      const m = line.match(/^BUILD_RESULT (.*)$/);
      if (m) { try { job.files = JSON.parse(m[1]); } catch (_) {} return; }
      job.log.push(line);
      if (job.log.length > 400) job.log.shift();
    });
    const run = () => {
      const child = spawn(process.execPath, [path.join(buildDir, "build.js"), target], { cwd: ROOT_DIR });
      child.stdout.on("data", push);
      child.stderr.on("data", push);
      child.on("close", (code) => { job.status = code === 0 ? "done" : "error"; });
    };
    if (!fs.existsSync(path.join(buildDir, "node_modules"))) {
      push("Prima volta: installo gli strumenti di impacchettamento (npm install)…");
      const npm = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--no-audit", "--no-fund"], { cwd: buildDir, shell: process.platform === "win32" });
      npm.stdout.on("data", push);
      npm.stderr.on("data", push);
      npm.on("close", (code) => { if (code === 0) run(); else { push("npm install non riuscito"); job.status = "error"; } });
    } else {
      run();
    }
    sendJson(res, 200, { ok: true, job: id });
    return;
  }
  sendJson(res, 405, { ok: false, error: "method not allowed" });
}

// Downloads of the packages in dist/ (streamed: they are large)
function handleDistDownload(req, res, urlObj) {
  const name = path.basename(decodeURIComponent(urlObj.pathname));
  const file = path.join(ROOT_DIR, "dist", name);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("404 Not Found"); return; }
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Length": st.size,
      "Content-Disposition": `attachment; filename="${name}"`
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  // The editor calls API endpoints with a trailing slash (api/assets/), like the PHP backend
  if (urlObj.pathname.startsWith("/api/") && urlObj.pathname.length > 5 && urlObj.pathname.endsWith("/")) {
    urlObj.pathname = urlObj.pathname.replace(/\/+$/, "");
  }

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

  if (urlObj.pathname === "/api/build") {
    handleBuildApi(req, res, urlObj);
    return;
  }

  if (urlObj.pathname.startsWith("/dist/")) {
    handleDistDownload(req, res, urlObj);
    return;
  }

  if (urlObj.pathname === "/api/levels") {
    handleLevelsApi(req, res, urlObj);
    return;
  }

  if (urlObj.pathname === "/api/screens") {
    handleScreensApi(req, res, urlObj);
    return;
  }

  if (urlObj.pathname === "/api/manifest") {
    handleManifestApi(req, res);
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
