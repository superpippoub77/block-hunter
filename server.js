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

function safeResolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const requestedPath = decoded === "/" ? "/index.html" : decoded;
  const safePath = path.normalize(requestedPath).replace(/^([/\\])+/, "");
  return path.join(ROOT_DIR, safePath);
}

const server = http.createServer((req, res) => {
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
