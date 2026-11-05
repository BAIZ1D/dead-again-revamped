const { contextBridge, ipcRenderer } = require('electron');

// Expose desktop environment flag
contextBridge.exposeInMainWorld('isDesktop', true);

// Expose secure desktop API bridge
contextBridge.exposeInMainWorld('electronAPI', {
  openDashboard: () => {
    ipcRenderer.send('desktop:open-dashboard');
  },
  toggleDashboard: () => {
    ipcRenderer.send('desktop:toggle-dashboard');
  },
  toggleFullscreen: () => {
    ipcRenderer.send('desktop:toggle-fullscreen');
  },
  getAppVersion: () => {
    return ipcRenderer.invoke('desktop:get-version');
  },
  checkForUpdates: () => {
    return ipcRenderer.invoke('desktop:check-updates');
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('desktop:update-available', (event, data) => callback(data));
  },
  openExternalUrl: (url) => {
    ipcRenderer.send('desktop:open-external', url);
  }
});
