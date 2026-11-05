import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WindowManager {
  constructor(port, userDataPath) {
    this.port = port;
    this.userDataPath = userDataPath;
    this.stateFilePath = path.join(userDataPath, 'window-state.json');
    this.gameWindow = null;
    this.dashboardWindow = null;
    this.isQuitting = false;
  }

  loadWindowState() {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        return JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8'));
      }
    } catch (_) {}
    return null;
  }

  saveWindowState() {
    if (!this.gameWindow || this.gameWindow.isDestroyed()) return;
    try {
      const bounds = this.gameWindow.getBounds();
      const isFullScreen = this.gameWindow.isFullScreen();
      const data = { ...bounds, isFullScreen };
      fs.writeFileSync(this.stateFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (_) {}
  }

  createGameWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
    const savedState = this.loadWindowState();

    // Smart initial sizing (D-02): 1080p if screen height > 1080, else 720p
    let initialWidth = screenH > 1080 ? 1920 : 1280;
    let initialHeight = screenH > 1080 ? 1080 : 720;

    if (savedState && savedState.width && savedState.height) {
      initialWidth = savedState.width;
      initialHeight = savedState.height;
    }

    const preloadPath = path.join(__dirname, 'preload.cjs');

    this.gameWindow = new BrowserWindow({
      width: initialWidth,
      height: initialHeight,
      useContentSize: true,
      backgroundColor: '#050508',
      title: 'Dead Again - Revamped (Twitch Edition)',
      icon: path.join(__dirname, 'assets', 'icon.png'),
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false // OBS unthrottled 60 FPS (D-06, Pitfall 3)
      }
    });

    // Locked 16:9 Aspect Ratio (D-01)
    this.gameWindow.setAspectRatio(16 / 9);

    // Suppress web browser reload and zoom quirks (D-07, Pitfall 4)
    this.gameWindow.webContents.on('before-input-event', (event, input) => {
      // Block F5, Ctrl+R, Cmd+R
      if ((input.key === 'F5') || ((input.control || input.meta) && input.key.toLowerCase() === 'r')) {
        event.preventDefault();
      }
      // Block Ctrl/Cmd +/-/0 zoom
      if ((input.control || input.meta) && ['=', '+', '-', '0'].includes(input.key)) {
        event.preventDefault();
      }
    });

    this.gameWindow.webContents.on('will-navigate', (event) => event.preventDefault());
    this.gameWindow.webContents.on('context-menu', (event) => event.preventDefault());

    this.gameWindow.loadURL(`http://127.0.0.1:${this.port}/`);

    this.gameWindow.on('close', () => {
      this.saveWindowState();
    });

    this.gameWindow.on('closed', () => {
      this.gameWindow = null;
      if (this.dashboardWindow && !this.dashboardWindow.isDestroyed()) {
        this.dashboardWindow.destroy();
      }
      app.quit();
    });

    return this.gameWindow;
  }

  createDashboardWindow() {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const preloadPath = path.join(__dirname, 'preload.cjs');

    // Multi-Monitor Auto-Placement (D-08): if 2+ displays, place on Monitor 2
    let x, y, autoShow = false;
    if (displays.length >= 2) {
      const secondary = displays.find((d) => d.id !== primaryDisplay.id) || displays[1];
      x = Math.round(secondary.bounds.x + (secondary.bounds.width - 1024) / 2);
      y = Math.round(secondary.bounds.y + (secondary.bounds.height - 768) / 2);
      autoShow = true;
    }

    this.dashboardWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      minWidth: 800,
      minHeight: 600,
      x,
      y,
      show: false,
      backgroundColor: '#0d1117',
      title: '[STREAMER ONLY] Dead Again - Revamped Dashboard', // D-11: OBS exclusion title
      icon: path.join(__dirname, 'assets', 'dashboard-icon.png'),
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    this.dashboardWindow.loadURL(`http://127.0.0.1:${this.port}/dashboard`);

    // Hide-on-close pattern (D-10): preserves WebSockets, swarms, and logs
    this.dashboardWindow.on('close', (event) => {
      if (!this.isQuitting && this.gameWindow && !this.gameWindow.isDestroyed()) {
        event.preventDefault();
        this.dashboardWindow.hide();
      }
    });

    if (autoShow) {
      this.dashboardWindow.once('ready-to-show', () => {
        this.dashboardWindow.show();
      });
    }

    return this.dashboardWindow;
  }

  toggleDashboard() {
    if (!this.dashboardWindow || this.dashboardWindow.isDestroyed()) return;
    if (this.dashboardWindow.isVisible()) {
      this.dashboardWindow.hide();
    } else {
      this.dashboardWindow.show();
      this.dashboardWindow.focus();
    }
  }

  openDashboard() {
    if (!this.dashboardWindow || this.dashboardWindow.isDestroyed()) return;
    if (this.dashboardWindow.isMinimized()) this.dashboardWindow.restore();
    this.dashboardWindow.show();
    this.dashboardWindow.focus();
  }

  toggleFullscreen() {
    if (!this.gameWindow || this.gameWindow.isDestroyed()) return;
    this.gameWindow.setFullScreen(!this.gameWindow.isFullScreen());
  }

  setResolution(width, height) {
    if (!this.gameWindow || this.gameWindow.isDestroyed()) return;
    if (this.gameWindow.isFullScreen()) {
      this.gameWindow.setFullScreen(false);
    }
    this.gameWindow.setContentSize(width, height);
    this.gameWindow.setAspectRatio(16 / 9);
    this.gameWindow.center();
  }

  focusGameWindow() {
    if (this.gameWindow && !this.gameWindow.isDestroyed()) {
      if (this.gameWindow.isMinimized()) this.gameWindow.restore();
      this.gameWindow.focus();
    }
  }
}
