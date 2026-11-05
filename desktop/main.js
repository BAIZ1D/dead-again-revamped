import { app, ipcMain, shell } from 'electron';
import path from 'path';
import { findAvailablePort } from './portFinder.js';
import { RelayManager } from './relayManager.js';
import { WindowManager } from './windowManager.js';
import { setupMenu } from './menu.js';
import { initUpdateChecker, checkUpdatesManual } from './updater.js';

// Chromium switches for unthrottled OBS 60 FPS, Web Audio autoplay, and GPU capture (D-06, Pitfalls 3, 8, 9)
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Single-Instance Lock (DESK-01, D-15)
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.warn('[Desktop] Another instance is already running; quitting duplicate instance.');
  app.quit();
  process.exit(0);
}

let relayManager = null;
let windowManager = null;
let isShuttingDown = false;

app.on('second-instance', () => {
  if (windowManager) {
    windowManager.focusGameWindow();
  }
});

async function initApp() {
  const userDataPath = app.getPath('userData');
  const configPath = path.join(userDataPath, 'config.json');

  // 1. Find vacant port (8085 default, fallback 8086–8105)
  const port = await findAvailablePort(8085, 20);

  // 2. Start supervised background relay process
  relayManager = new RelayManager(port, configPath);
  await relayManager.start();

  // 3. Initialize dual-window manager and native menu
  windowManager = new WindowManager(port, userDataPath);
  setupMenu(windowManager);

  windowManager.createGameWindow();
  windowManager.createDashboardWindow();

  // 4. Register IPC handlers for preload bridge
  ipcMain.on('desktop:open-dashboard', () => {
    if (windowManager) windowManager.openDashboard();
  });

  ipcMain.on('desktop:toggle-dashboard', () => {
    if (windowManager) windowManager.toggleDashboard();
  });

  ipcMain.on('desktop:toggle-fullscreen', () => {
    if (windowManager) windowManager.toggleFullscreen();
  });

  ipcMain.handle('desktop:get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('desktop:check-updates', async () => {
    return checkUpdatesManual(windowManager ? windowManager.gameWindow : null);
  });

  ipcMain.on('desktop:open-external', (event, url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });

  // 5. Initialize background update checker
  initUpdateChecker(windowManager);
}

app.whenReady().then(initApp).catch((err) => {
  console.error('[Desktop] Fatal error during startup:', err);
  app.quit();
});

async function cleanTeardown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  if (windowManager) {
    windowManager.isQuitting = true;
  }
  if (relayManager) {
    await relayManager.stop();
  }
}

app.on('before-quit', async (event) => {
  if (!isShuttingDown) {
    event.preventDefault();
    await cleanTeardown();
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
