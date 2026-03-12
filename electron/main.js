const path = require('path');
const net = require('net');
const { fork } = require('child_process');
const { app, BrowserWindow } = require('electron');

let serverProcess = null;
let serverPort = null;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();

    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = address && typeof address === 'object' ? address.port : null;
      probe.close((closeErr) => {
        if (closeErr) {
          reject(closeErr);
          return;
        }
        if (!port) {
          reject(new Error('No free port found'));
          return;
        }
        resolve(port);
      });
    });
  });
}

function waitForServerReady(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port: serverPort }, () => {
        socket.end();
        resolve(url);
      });

      socket.on('error', () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error('Local server start timeout'));
          return;
        }
        setTimeout(tryConnect, 200);
      });
    };

    tryConnect();
  });
}

async function startLocalServer(dataRootDir) {
  serverPort = await getFreePort();
  const serverEntry = path.join(__dirname, '..', 'server.js');

  serverProcess = fork(serverEntry, {
    env: {
      ...process.env,
      PORT: String(serverPort),
      OPEN_BROWSER: 'none',
      BLOCK_HUNTER_DATA_DIR: dataRootDir
    },
    stdio: 'ignore'
  });

  const baseUrl = `http://127.0.0.1:${serverPort}`;
  return waitForServerReady(`${baseUrl}/index.html`);
}

function stopLocalServer() {
  if (!serverProcess || serverProcess.killed) return;
  try {
    serverProcess.kill();
  } catch (_err) {
    // Ignore shutdown errors.
  }
}

async function createMainWindow() {
  const dataRootDir = path.join(app.getPath('userData'), 'runtime-data');
  const gameUrl = await startLocalServer(dataRootDir);

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  await mainWindow.loadURL(gameUrl);
}

app.whenReady().then(async () => {
  try {
    await createMainWindow();
  } catch (err) {
    console.error('Unable to start desktop app:', err);
    app.quit();
    return;
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  stopLocalServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
