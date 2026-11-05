import { Menu, shell, app, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { checkUpdatesManual } from './updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupMenu(windowManager) {
  const isMac = process.platform === 'darwin';

  if (isMac && app.setAboutPanelOptions) {
    app.setAboutPanelOptions({
      applicationName: 'Dead Again - Revamped (Twitch Edition)',
      applicationVersion: app.getVersion ? app.getVersion() : '1.0.0',
      copyright: 'Dead Again - Revamped © 2026 Baizid Al Hamid',
      credits: 'Developed by Baizid Al Hamid'
    });
  }

  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }]
      : []),
    {
      label: 'Streamer',
      submenu: [
        {
          label: 'Open APG Dashboard',
          accelerator: 'CmdOrCtrl+D',
          click: () => windowManager.openDashboard()
        },
        {
          label: 'Toggle APG Dashboard',
          accelerator: 'F1',
          click: () => windowManager.toggleDashboard()
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: async () => {
            const res = await checkUpdatesManual(windowManager ? windowManager.gameWindow : null);
            if (res && !res.updateAvailable && !res.error) {
              dialog.showMessageBox({
                title: 'Dead Again - Revamped',
                message: 'You are running the latest version (' + (app.getVersion ? app.getVersion() : '1.0.0') + ').',
                buttons: ['OK']
              });
            }
          }
        },
        {
          label: 'Open User Data Folder',
          click: () => shell.openPath(windowManager.userDataPath)
        },
        {
          label: 'Reset Window Position',
          click: () => windowManager.setResolution(1280, 720)
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => windowManager.toggleFullscreen()
        },
        { type: 'separator' },
        {
          label: 'Resolution: 1080p (1920x1080)',
          click: () => windowManager.setResolution(1920, 1080)
        },
        {
          label: 'Resolution: 720p (1280x720)',
          click: () => windowManager.setResolution(1280, 720)
        },
        ...(!app.isPackaged
          ? [
              { type: 'separator' },
              { role: 'toggleDevTools' }
            ]
          : [])
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }]
          : [{ role: 'close' }])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Streamer Quick-Start Guide',
          click: () => {
            const guidePath = path.join(app.getAppPath ? app.getAppPath() : path.join(__dirname, '..'), 'STREAMER_GUIDE.md');
            if (fs.existsSync(guidePath)) {
              shell.openPath(guidePath);
            }
          }
        },
        { type: 'separator' },
        {
          label: '☕ Support on Ko-fi...',
          click: () => shell.openExternal('https://ko-fi.com/baiz1d')
        },
        {
          label: '★ Itch.io Game Page...',
          click: () => shell.openExternal('https://baiz1d.itch.io/dead-again-revamped')
        },
        {
          label: 'GitHub Releases Hub...',
          click: () => shell.openExternal('https://github.com/BAIZ1D/dead-again-revamped/releases')
        },
        { type: 'separator' },
        {
          label: 'About Dead Again - Revamped',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'Dead Again - Revamped (Twitch Edition)',
              message: 'Dead Again - Revamped (Twitch Edition) v' + (app.getVersion ? app.getVersion() : '1.0.0') + '\n\nDeveloped by Baizid Al Hamid\n\n100% Free & Open Source.',
              buttons: ['OK']
            });
          }
        },
        {
          label: 'Third-Party Licenses',
          click: () => {
            const licensePath = path.join(__dirname, '..', 'LICENSE-THIRD-PARTY.txt');
            if (fs.existsSync(licensePath)) {
              shell.openPath(licensePath);
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

