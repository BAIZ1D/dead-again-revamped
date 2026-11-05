import fs from 'fs';
import path from 'path';

let electronApp = null;
let electronBrowserWindow = null;

if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
  try {
    const electron = await import('electron');
    electronApp = electron.app || electron.default?.app;
    electronBrowserWindow = electron.BrowserWindow || electron.default?.BrowserWindow;
  } catch (_) {}
}

/**
 * Resolve local application version string.
 */
function getLocalVersion() {
  if (electronApp && typeof electronApp.getVersion === 'function') {
    return electronApp.getVersion();
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    return pkg.version || '1.0.0';
  } catch (_) {
    return '1.0.0';
  }
}

/**
 * Compare two semver strings (vRemote, vLocal).
 * Returns:
 *   1 if vRemote > vLocal
 *  -1 if vRemote < vLocal
 *   0 if vRemote === vLocal
 */
export function compareSemver(vRemote, vLocal) {
  if (typeof vRemote !== 'string' || typeof vLocal !== 'string') return 0;

  const parse = (v) => {
    const clean = v.trim().replace(/^v/i, '');
    const [core, prerelease] = clean.split('-');
    const parts = (core || '').split('.').map((p) => parseInt(p, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return { parts: parts.slice(0, 3), prerelease };
  };

  const r = parse(vRemote);
  const l = parse(vLocal);

  for (let i = 0; i < 3; i++) {
    if (r.parts[i] > l.parts[i]) return 1;
    if (r.parts[i] < l.parts[i]) return -1;
  }

  // If major.minor.patch parts are identical:
  if (!r.prerelease && l.prerelease) return 1;
  if (r.prerelease && !l.prerelease) return -1;
  if (r.prerelease && l.prerelease && r.prerelease !== l.prerelease) {
    return r.prerelease.localeCompare(l.prerelease) > 0 ? 1 : -1;
  }

  return 0;
}

/**
 * Check latest release from GitHub Releases API with strict 3s timeout and silent error handling.
 */
export async function checkLatestRelease(repoOwnerRepo = 'BAIZ1D/dead-again-revamped', currentVersion = '1.0.0') {
  const curVer = currentVersion || getLocalVersion();
  try {
    const url = (typeof repoOwnerRepo === 'string' && (repoOwnerRepo.startsWith('http://') || repoOwnerRepo.startsWith('https://')))
      ? repoOwnerRepo
      : `https://api.github.com/repos/${repoOwnerRepo}/releases/latest`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': `DeadAgain-DesktopLauncher/${curVer}`
      },
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      console.debug(`[Updater] HTTP ${response.status} from ${url}`);
      return {
        updateAvailable: false,
        error: `HTTP ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    const latestVersion = (data.tag_name || '').replace(/^v/i, '');
    const updateAvailable = compareSemver(latestVersion, curVer) === 1;

    return {
      updateAvailable,
      currentVersion: curVer,
      latestVersion,
      releaseName: data.name || data.tag_name || latestVersion,
      releaseNotes: data.body || '',
      htmlUrl: data.html_url || (repoOwnerRepo.startsWith('http') ? repoOwnerRepo : `https://github.com/${repoOwnerRepo}/releases`),
      publishedAt: data.published_at || new Date().toISOString()
    };
  } catch (err) {
    console.debug('[Updater] Check latest release failed silently:', err.message);
    return {
      updateAvailable: false,
      error: err.message
    };
  }
}

/**
 * Broadcast update notification to electron windows.
 */
function broadcastUpdate(target, data) {
  if (!data || !data.updateAvailable) return;

  if (target && typeof target === 'object') {
    if (target.gameWindow && !target.gameWindow.isDestroyed()) {
      target.gameWindow.webContents.send('desktop:update-available', data);
    }
    if (target.dashboardWindow && !target.dashboardWindow.isDestroyed()) {
      target.dashboardWindow.webContents.send('desktop:update-available', data);
    }
    if (target.webContents && !target.isDestroyed()) {
      target.webContents.send('desktop:update-available', data);
    }
  }

  if (electronBrowserWindow && typeof electronBrowserWindow.getAllWindows === 'function') {
    const wins = electronBrowserWindow.getAllWindows();
    for (const win of wins) {
      if (!win.isDestroyed() && win.webContents) {
        win.webContents.send('desktop:update-available', data);
      }
    }
  }
}

let updateTimer = null;

/**
 * Initialize automatic background update checker with 2s startup delay.
 */
export function initUpdateChecker(windowManager) {
  const currentVersion = getLocalVersion();
  const repo = 'BAIZ1D/dead-again-revamped';

  updateTimer = setTimeout(async () => {
    try {
      const result = await checkLatestRelease(repo, currentVersion);
      if (result && result.updateAvailable) {
        broadcastUpdate(windowManager, result);
      }
    } catch (err) {
      console.debug('[Updater] Startup check failed silently:', err.message);
    }
  }, 2000);
}

/**
 * Trigger manual update check from menu or dashboard.
 */
export async function checkUpdatesManual(parentOrWindowManager) {
  const currentVersion = getLocalVersion();
  const repo = 'BAIZ1D/dead-again-revamped';

  const result = await checkLatestRelease(repo, currentVersion);
  if (result && result.updateAvailable) {
    broadcastUpdate(parentOrWindowManager, result);
  }
  return result;
}
