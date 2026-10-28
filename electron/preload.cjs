const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  setIslandBounds: (bounds) => ipcRenderer.send('set-island-bounds', bounds),
  focusWindow: () => ipcRenderer.send('focus-window'),
  setDraggingOut: (flag) => ipcRenderer.send('set-dragging-out', flag),
  startNativeFileDrag: (payload) => ipcRenderer.send('start-native-file-drag', payload),
  getPathForFile: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file) || '';
      }
      return file?.path || '';
    } catch (_e) {
      return file?.path || '';
    }
  },
  mediaControl: (action, value) => ipcRenderer.send('media-control', { action, value }),
  setVolume: (val) => ipcRenderer.send('set-volume', val),
  setMute: (mute) => ipcRenderer.send('set-mute', mute),
  setBrightness: (val) => ipcRenderer.send('set-brightness', val),
  fetchTrackExtras: (title, artist) => ipcRenderer.invoke('fetch-track-extras', { title, artist }),
  writeClipboard: (text) => ipcRenderer.invoke('write-clipboard', text),
  pasteToActiveWindow: (payload) => ipcRenderer.invoke('paste-to-active-window', payload),
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  launchAppOrUrl: (target) => ipcRenderer.invoke('launch-app-or-url', target),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  showInFolder: (targetPath) => ipcRenderer.invoke('show-in-folder', targetPath),
  refreshDownloads: () => ipcRenderer.invoke('refresh-downloads'),
  getNotifications: () => ipcRenderer.invoke('get-notifications'),
  clearNotifications: () => ipcRenderer.invoke('clear-notifications'),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', enabled),
  quitApp: () => ipcRenderer.send('quit-app'),

  onSystemTelemetry: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('system-telemetry', listener);
    return () => ipcRenderer.removeListener('system-telemetry', listener);
  },
  onOutsideClick: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('outside-click', listener);
    return () => ipcRenderer.removeListener('outside-click', listener);
  },
  onNotificationsUpdate: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('notifications-update', listener);
    return () => ipcRenderer.removeListener('notifications-update', listener);
  },
  onNewNotification: (callback) => {
    const listener = (_event, item) => callback(item);
    ipcRenderer.on('new-notification', listener);
    return () => ipcRenderer.removeListener('new-notification', listener);
  },
  onDownloadsUpdate: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('downloads-update', listener);
    return () => ipcRenderer.removeListener('downloads-update', listener);
  },
  onClipboardUpdate: (callback) => {
    const listener = (_event, item) => callback(item);
    ipcRenderer.on('clipboard-updated', listener);
    return () => ipcRenderer.removeListener('clipboard-updated', listener);
  },
  onPowerStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('power-status', listener);
    return () => ipcRenderer.removeListener('power-status', listener);
  },
  onGlobalShortcut: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('global-shortcut', listener);
    return () => ipcRenderer.removeListener('global-shortcut', listener);
  }
});
