const {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  clipboard,
  powerMonitor,
  globalShortcut,
  shell,
  desktopCapturer,
  Tray,
  Menu,
  nativeImage
} = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');
const { spawn, execFileSync } = require('child_process');

app.setName('ORBIT');
if (process.platform === 'win32') app.setAppUserModelId('com.sh3hann.orbit');

// Low RAM & Low CPU Chromium Engine Flags
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=64 --optimize-for-size');
app.commandLine.appendSwitch('renderer-process-limit', '1');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('no-pings');
app.commandLine.appendSwitch(
  'disable-features',
  'MediaRouter,OptimizationHints,Translate,AutofillServerCommunication,CalculateNativeWinOcclusion,HardwareMediaKeyHandling,SpareRendererForSitePerProcess'
);

// Ensure single instance only
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

let mainWindow = null;
let tray = null;
let bridgeProc = null;
let notifWorkerProc = null;
let isCurrentlyIgnoring = true;

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ELECTRON_EXE = process.execPath;
const DATA_DIR = app.getPath('userData');
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (_e) {}
const AUTO_START_CONFIG_FILE = path.join(DATA_DIR, 'autostart-config.json');
const NOTIF_CACHE_FILE = path.join(DATA_DIR, 'notif-history-cache.json');

// Scripts spawned as external processes cannot be read from inside app.asar
function unpackedPath(p) {
  return p.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
}

const WIN_WIDTH = 450;
const WIN_HEIGHT = 330;
let windowBounds = { x: 0, y: 0, width: WIN_WIDTH, height: WIN_HEIGHT };

// Event-driven active island box relative to the 450x330 window
let islandBox = { x: 85, y: 0, width: 280, height: 42 };

// ============================================================================
// FAST SILENT WINDOWS STARTUP REGISTRATION (No CMD Window, <1s Boot Launch)
// ============================================================================
const REG_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const REG_VALUE_NAME = 'ORBIT';
const LEGACY_REG_VALUE_NAMES = ['iOS27DynamicIsland'];

function isAutoStartEnabled() {
  try {
    if (fs.existsSync(AUTO_START_CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(AUTO_START_CONFIG_FILE, 'utf8'));
      if (typeof cfg.enabled === 'boolean') return cfg.enabled;
    }
  } catch (_e) {}
  return true; // On by default; can be switched off in Settings or the tray menu
}

function regDelete(name) {
  if (process.platform !== 'win32') return;
  try {
    execFileSync('reg.exe', ['delete', REG_RUN_KEY, '/v', name, '/f'], {
      windowsHide: true,
      stdio: 'ignore'
    });
  } catch (_e) {}
}

function applyWindowsStartupRegistration(enable) {
  try {
    fs.writeFileSync(AUTO_START_CONFIG_FILE, JSON.stringify({ enabled: Boolean(enable) }), 'utf8');
  } catch (_e) {}

  if (process.platform === 'win32') {
    LEGACY_REG_VALUE_NAMES.forEach(regDelete);
    try {
      if (app.isPackaged) {
        // Installed build: launch the ORBIT executable directly (no console window, no scripts)
        app.setLoginItemSettings({
          openAtLogin: Boolean(enable),
          path: process.execPath,
          name: REG_VALUE_NAME
        });
      } else if (enable) {
        const vbsPath = path.join(PROJECT_ROOT, 'scripts', 'Start-ORBIT.vbs');
        execFileSync(
          'reg.exe',
          ['add', REG_RUN_KEY, '/v', REG_VALUE_NAME, '/t', 'REG_SZ', '/d', `wscript.exe "${vbsPath}"`, '/f'],
          { windowsHide: true, stdio: 'ignore' }
        );
      } else {
        regDelete(REG_VALUE_NAME);
      }
    } catch (_e) {}
  } else if (process.platform === 'darwin') {
    try {
      app.setLoginItemSettings({
        openAtLogin: Boolean(enable),
        openAsHidden: true
      });
    } catch (_e) {}
  }

  updateTrayMenu();
  return Boolean(enable);
}

// ============================================================================
// CPU & DISK TELEMETRY
// ============================================================================
let prevCpuTimes = getCpuTimes();

function getCpuTimes() {
  const cpus = os.cpus();
  return cpus.map((cpu) => {
    const total = Object.values(cpu.times).reduce((acc, tv) => acc + tv, 0);
    return { idle: cpu.times.idle, total, model: cpu.model };
  });
}

function calculateCpuUsage() {
  const current = getCpuTimes();
  let totalIdle = 0;
  let totalTick = 0;
  const coreLoads = [];

  for (let i = 0; i < current.length; i++) {
    const idleDiff = current[i].idle - (prevCpuTimes[i]?.idle || 0);
    const totalDiff = current[i].total - (prevCpuTimes[i]?.total || 1);
    totalIdle += idleDiff;
    totalTick += totalDiff;
    const pct = totalDiff > 0 ? Math.max(0, Math.min(100, Math.round(100 - (100 * idleDiff) / totalDiff))) : 0;
    coreLoads.push(pct);
  }

  prevCpuTimes = current;
  const avgCpu = totalTick > 0 ? Math.max(1, Math.min(100, Math.round(100 - (100 * totalIdle) / totalTick))) : 2;
  return {
    avgCpu,
    coreLoads: coreLoads.slice(0, 8),
    cpuModel: (current[0]?.model || (process.platform === 'darwin' ? 'Apple Silicon' : 'Processor')).trim(),
    coresCount: current.length
  };
}

function getDiskUsageC() {
  try {
    const rootPath = process.platform === 'win32' ? 'C:\\' : '/';
    const stats = fs.statfsSync(rootPath);
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bfree * stats.bsize;
    const usedBytes = totalBytes - freeBytes;
    return {
      diskPct: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0,
      usedDiskGB: (usedBytes / (1024 ** 3)).toFixed(0),
      totalDiskGB: (totalBytes / (1024 ** 3)).toFixed(0),
      freeDiskGB: (freeBytes / (1024 ** 3)).toFixed(0)
    };
  } catch (_e) {
    return { diskPct: 0, usedDiskGB: '0', totalDiskGB: '0', freeDiskGB: '0' };
  }
}

let latestBridgeState = {
  media: {
    hasMedia: false,
    playing: false,
    title: '',
    artist: '',
    album: '',
    sourceApp: '',
    positionSec: 0,
    durationSec: 0,
    thumbnail: ''
  },
  whatsappCall: null,
  volume: 50,
  muted: false,
  brightness: 80,
  net: { rxBytesPerSec: 0, txBytesPerSec: 0 },
  isFullscreen: false,
  bluetooth: null
};

function startNativeWindowsBridge() {
  if (process.platform !== 'win32') return;
  const scriptPath = unpackedPath(path.join(__dirname, 'win-bridge.ps1'));
  if (!fs.existsSync(scriptPath)) return;

  bridgeProc = spawn(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore']
    }
  );

  let stdoutBuf = '';
  bridgeProc.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString('utf8');
    let nlIdx;
    while ((nlIdx = stdoutBuf.indexOf('\n')) !== -1) {
      const line = stdoutBuf.slice(0, nlIdx).trim();
      stdoutBuf = stdoutBuf.slice(nlIdx + 1);
      if (line.startsWith('STATE:')) {
        try {
          const parsed = JSON.parse(line.slice(6));
          latestBridgeState = parsed;
          emitCombinedTelemetry();
        } catch (_e) {}
      } else if (line.startsWith('FULLSCREEN:')) {
        const flag = line.slice(11).trim() === '1';
        if (latestBridgeState.isFullscreen !== flag) {
          latestBridgeState.isFullscreen = flag;
          emitCombinedTelemetry();
        }
      } else if (line.startsWith('MOUSEDOWN:1')) {
        isGlobalMouseDown = true;
        if (mainWindow && !mainWindow.isDestroyed() && isCurrentlyIgnoring && islandBox.height > 55) {
          mainWindow.webContents.send('outside-click');
        }
      } else if (line.startsWith('MOUSEDOWN:0')) {
        isGlobalMouseDown = false;
      }
    }
  });

  bridgeProc.on('exit', () => {
    bridgeProc = null;
  });
}

function sendBridgeCommand(cmd) {
  if (bridgeProc && bridgeProc.stdin && !bridgeProc.stdin.destroyed) {
    try {
      bridgeProc.stdin.write(cmd + '\n');
    } catch (_e) {}
  }
}

function emitCombinedTelemetry() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { avgCpu, coreLoads, cpuModel, coresCount } = calculateCpuUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPct = Math.round((usedMem / totalMem) * 100);
  const disk = getDiskUsageC();

  mainWindow.webContents.send('system-telemetry', {
    cpuPct: avgCpu,
    coreLoads,
    cpuModel,
    coresCount,
    memPct,
    usedMemGB: (usedMem / (1024 ** 3)).toFixed(1),
    totalMemGB: (totalMem / (1024 ** 3)).toFixed(1),
    ...disk,
    uptimeHours: (os.uptime() / 3600).toFixed(1),
    hostname: os.hostname(),
    media: latestBridgeState.media,
    whatsappCall: latestBridgeState.whatsappCall || null,
    volume: latestBridgeState.volume >= 0 ? latestBridgeState.volume : 50,
    muted: Boolean(latestBridgeState.muted),
    brightness: latestBridgeState.brightness >= 0 ? latestBridgeState.brightness : 80,
    net: latestBridgeState.net || { rxBytesPerSec: 0, txBytesPerSec: 0 },
    isFullscreen: Boolean(latestBridgeState.isFullscreen),
    bluetooth: latestBridgeState.bluetooth || null
  });
}

// ============================================================================
// REAL WINDOWS & WHATSAPP NOTIFICATION WORKER BRIDGE (Node 25 node:sqlite)
// ============================================================================
let latestNotifState = {
  whatsappUnread: 0,
  notifications: []
};

// Preload cached history immediately so UI has notifications at t=0ms
try {
  if (fs.existsSync(NOTIF_CACHE_FILE)) {
    const cached = JSON.parse(fs.readFileSync(NOTIF_CACHE_FILE, 'utf8'));
    if (Array.isArray(cached.history)) {
      latestNotifState.notifications = cached.history;
    }
  }
} catch (_e) {}

function startNotificationsWorker() {
  if (process.platform !== 'win32') return;
  const workerScript = unpackedPath(path.join(__dirname, 'notif-worker.cjs'));
  if (!fs.existsSync(workerScript)) return;

  notifWorkerProc = spawn(process.execPath, ['--max-old-space-size=24', workerScript], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'ignore'],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ORBIT_DATA_DIR: DATA_DIR }
  });

  let buf = '';
  notifWorkerProc.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.startsWith('NOTIF_UPDATE:')) {
        try {
          const parsed = JSON.parse(line.slice(13));
          latestNotifState = parsed;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('notifications-update', latestNotifState);
          }
        } catch (_e) {}
      } else if (line.startsWith('NEW_NOTIF:')) {
        try {
          const item = JSON.parse(line.slice(10));
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('new-notification', item);
          }
        } catch (_e) {}
      }
    }
  });

  notifWorkerProc.on('exit', () => {
    notifWorkerProc = null;
    // Auto-restart worker if it ever exits while app is running
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        startNotificationsWorker();
      }
    }, 2500);
  });
}

function sendNotifWorkerCommand(cmd) {
  if (notifWorkerProc && notifWorkerProc.stdin && !notifWorkerProc.stdin.destroyed) {
    try {
      notifWorkerProc.stdin.write(cmd + '\n');
    } catch (_e) {}
  }
}

// ============================================================================
// REAL WINDOWS DOWNLOADS FOLDER WATCHER (C:\Users\ASUS\Downloads)
// ============================================================================
const downloadsDir = path.join(os.homedir(), 'Downloads');
let prevDownloadSizes = new Map();

function scanDownloadsFolder() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  try {
    if (!fs.existsSync(downloadsDir)) return null;
    const entries = fs.readdirSync(downloadsDir, { withFileTypes: true });
    const files = [];
    const now = Date.now();

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name.startsWith('desktop.ini')) continue;
      const fullPath = path.join(downloadsDir, entry.name);
      try {
        const st = fs.statSync(fullPath);
        const ext = path.extname(entry.name).toLowerCase();
        const isTempDownload = ['.crdownload', '.part', '.opdownload', '.tmp', '.download'].includes(ext);
        const prev = prevDownloadSizes.get(fullPath);
        let speedBps = 0;
        if (prev && st.size > prev.size && now > prev.time) {
          speedBps = Math.round(((st.size - prev.size) * 1000) / (now - prev.time));
        }
        prevDownloadSizes.set(fullPath, { size: st.size, time: now });

        const isRecentlyGrowing = speedBps > 0 || (isTempDownload && now - st.mtimeMs < 60000);

        files.push({
          name: entry.name,
          fullPath,
          sizeBytes: st.size,
          mtimeMs: st.mtimeMs,
          isActiveDownload: isTempDownload || isRecentlyGrowing,
          speedBps
        });
      } catch (_e) {}
    }

    files.sort((a, b) => {
      if (a.isActiveDownload !== b.isActiveDownload) return a.isActiveDownload ? -1 : 1;
      return b.mtimeMs - a.mtimeMs;
    });

    const payload = {
      downloadsPath: downloadsDir,
      activeDownload: files.find((f) => f.isActiveDownload) || null,
      recentFiles: files.slice(0, 8)
    };
    mainWindow.webContents.send('downloads-update', payload);
    return payload;
  } catch (_e) {
    return null;
  }
}

function startDownloadsWatcher() {
  scanDownloadsFolder();
  try {
    if (fs.existsSync(downloadsDir)) {
      let debounceTimer = null;
      fs.watch(downloadsDir, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          scanDownloadsFolder();
        }, 400);
      });
    }
  } catch (_e) {}
}

// ============================================================================
// REAL SPOTIFY / YOUTUBE / YOUTUBE MUSIC METADATA, BASE64 COVER & LYRICS
// ============================================================================
const trackExtrasCache = new Map();

function httpsGetJson(url) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'ORBIT/1.0 (+https://github.com/Sh3hann/dynamic-Island)' }, timeout: 5000 },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (_e) {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function httpsGetImageBase64(url) {
  if (!url) return Promise.resolve('');
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 4500 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpsGetImageBase64(res.headers.location));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const buf = Buffer.concat(chunks);
          if (buf.length > 100) {
            resolve('data:image/jpeg;base64,' + buf.toString('base64'));
          } else {
            resolve(url);
          }
        } catch (_e) {
          resolve(url);
        }
      });
    });
    req.on('error', () => resolve(url));
    req.on('timeout', () => {
      req.destroy();
      resolve(url);
    });
  });
}

function cleanSongMetadata(rawTitle, rawArtist) {
  let title = (rawTitle || '').trim();
  let artist = (rawArtist || '').trim();

  title = title
    .replace(/\s*[-|]\s*(YouTube\s*Music|YouTube|Spotify).*$/i, '')
    .replace(/^\(\d+\)\s*/, '')
    .replace(
      /(\(|\[)(Official\s*(Music\s*)?(Video|Audio|Lyric\s*Video|Visualizer)|Lyric\s*Video|Lyrics|Audio|HD|4K|HQ|MV|M\/V|Explicit|Clean|Visualizer|Full\s*Song|Full\s*Video)(\)|\])/gi,
      ''
    )
    .replace(/\s*\((feat\.?|ft\.?|with)\s+[^)]+\)/gi, '')
    .replace(/\s*\[(feat\.?|ft\.?|with)\s+[^\]]+\]/gi, '')
    .replace(/\s+(feat\.?|ft\.?)\s+.*$/i, '')
    .trim();

  artist = artist
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/Official$/i, '')
    .trim();

  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    const left = parts[0].trim();
    const right = parts.slice(1).join(' - ').trim();
    if (
      !artist ||
      artist.toLowerCase() === 'youtube' ||
      artist.toLowerCase() === 'youtube music' ||
      artist.toLowerCase().includes(left.toLowerCase().replace(/\s+/g, ''))
    ) {
      artist = left;
      title = right;
    } else if (left.toLowerCase() === artist.toLowerCase()) {
      title = right;
    }
  }

  return { cleanTitle: title.trim() || rawTitle || '', cleanArtist: artist.trim() };
}

function parseLrcText(lrc) {
  if (!lrc || typeof lrc !== 'string') return [];
  const lines = lrc.split('\n');
  const parsed = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/;
  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const fracRaw = match[3] || '0';
      const fracDiv = fracRaw.length === 3 ? 1000 : fracRaw.length === 2 ? 100 : 10;
      const fracSec = parseInt(fracRaw, 10) / fracDiv;
      const exactTime = Number((mins * 60 + secs + fracSec).toFixed(2));
      const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim();
      if (text) {
        parsed.push({ time: exactTime, text });
      }
    }
  }
  return parsed;
}

async function fetchTrackExtras(rawTitle, rawArtist) {
  const { cleanTitle, cleanArtist } = cleanSongMetadata(rawTitle, rawArtist);
  if (!cleanTitle) {
    return { cleanTitle: '', cleanArtist: '', coverUrl: '', durationSec: 0, lyrics: [] };
  }

  const cacheKey = `${cleanTitle.toLowerCase()}|${cleanArtist.toLowerCase()}`;
  if (trackExtrasCache.has(cacheKey)) {
    return trackExtrasCache.get(cacheKey);
  }

  const fullQuery = encodeURIComponent(`${cleanTitle} ${cleanArtist}`.trim());
  const titleOnlyQuery = encodeURIComponent(cleanTitle);

  const [lrcExact, itunesRes] = await Promise.all([
    httpsGetJson(`https://lrclib.net/api/search?q=${fullQuery}`),
    httpsGetJson(`https://itunes.apple.com/search?term=${fullQuery}&entity=song&limit=1`)
  ]);

  let lrcList = Array.isArray(lrcExact) && lrcExact.length > 0 ? lrcExact : null;
  if (!lrcList && cleanArtist) {
    const fallbackLrc = await httpsGetJson(`https://lrclib.net/api/search?q=${titleOnlyQuery}`);
    if (Array.isArray(fallbackLrc) && fallbackLrc.length > 0) {
      lrcList = fallbackLrc;
    }
  }

  let remoteCoverUrl = '';
  let durationSec = 0;

  if (itunesRes?.results?.[0]) {
    const item = itunesRes.results[0];
    if (item.artworkUrl100) {
      remoteCoverUrl = item.artworkUrl100.replace('100x100bb', '300x300bb');
    }
    if (item.trackTimeMillis) {
      durationSec = Math.round(item.trackTimeMillis / 1000);
    }
  }

  if (!remoteCoverUrl) {
    const deezerRes = await httpsGetJson(`https://api.deezer.com/search?q=${fullQuery}&limit=1`);
    if (deezerRes?.data?.[0]?.album?.cover_medium) {
      remoteCoverUrl = deezerRes.data[0].album.cover_medium;
    }
    if (!durationSec && deezerRes?.data?.[0]?.duration) {
      durationSec = Number(deezerRes.data[0].duration) || 0;
    }
  }

  const coverUrl = remoteCoverUrl ? await httpsGetImageBase64(remoteCoverUrl) : '';

  let lyrics = [];
  if (lrcList && lrcList.length > 0) {
    const withSynced = lrcList.find((item) => item.syncedLyrics) || lrcList[0];
    if (!durationSec && withSynced?.duration) {
      durationSec = Math.round(Number(withSynced.duration));
    }
    if (withSynced?.syncedLyrics) {
      lyrics = parseLrcText(withSynced.syncedLyrics);
    } else if (withSynced?.plainLyrics) {
      const lines = withSynced.plainLyrics
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);
      const step = durationSec > 0 && lines.length > 0 ? Math.max(2.5, durationSec / lines.length) : 3.5;
      lyrics = lines.map((text, idx) => ({ time: Math.round(idx * step), text }));
    }
  }

  const result = {
    cleanTitle,
    cleanArtist,
    coverUrl,
    durationSec,
    lyrics
  };

  trackExtrasCache.set(cacheKey, result);
  return result;
}

// ============================================================================
// SYSTEM TRAY ICON (Hidden from Taskbar, Lives in Windows Icon Tray)
// ============================================================================
function loadTrayIconImage() {
  const icoPath = path.join(__dirname, 'tray-icon.ico');
  if (fs.existsSync(icoPath)) {
    const img = nativeImage.createFromPath(icoPath);
    if (!img.isEmpty()) return img;
  }
  const iconPath = path.join(__dirname, 'tray-icon.png');
  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) return img;
  }
  return nativeImage.createEmpty();
}

function updateTrayMenu() {
  if (!tray) return;
  const autoStartOn = isAutoStartEnabled();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Expand / Collapse Island (Alt+Space)',
      click: () => mainWindow?.webContents.send('global-shortcut', 'toggle-expand')
    },
    {
      label: 'WhatsApp & Laptop Notifications',
      click: () => mainWindow?.webContents.send('global-shortcut', 'open-notifications')
    },
    {
      label: 'Clipboard Shelf (Ctrl+Shift+V)',
      click: () => mainWindow?.webContents.send('global-shortcut', 'open-shelf')
    },
    {
      label: 'Open Island Settings',
      click: () => mainWindow?.webContents.send('global-shortcut', 'open-settings')
    },
    { type: 'separator' },
    {
      label: 'Start Automatically on Windows Login',
      type: 'checkbox',
      checked: autoStartOn,
      click: (menuItem) => {
        applyWindowsStartupRegistration(menuItem.checked);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit ORBIT',
      click: () => app.quit()
    }
  ]);
  tray.setContextMenu(contextMenu);
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;

  const winX = Math.round((screenWidth - WIN_WIDTH) / 2);
  const winY = 0;

  windowBounds = { x: winX, y: winY, width: WIN_WIDTH, height: WIN_HEIGHT };

  mainWindow = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    x: winX,
    y: winY,
    transparent: true,
    frame: false,
    thickFrame: false,
    roundedCorners: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true, // Hidden from Taskbar! Lives in System Tray only
    backgroundColor: '#00000000',
    icon: loadTrayIconImage(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  // Strictly enforce hiding from Windows Taskbar on all window state events
  mainWindow.setSkipTaskbar(true);
  // Exclude Dynamic Island from all screenshots & screen recordings (captures behind the island!)
  mainWindow.setContentProtection(true);
  mainWindow.on('show', () => mainWindow?.setSkipTaskbar(true));
  mainWindow.on('focus', () => mainWindow?.setSkipTaskbar(true));
  mainWindow.on('restore', () => mainWindow?.setSkipTaskbar(true));

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  isCurrentlyIgnoring = true;

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('outside-click');
    }
  });

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
  const useDevServer = process.env.VITE_DEV_SERVER === 'true' || !fs.existsSync(distIndex);

  if (useDevServer) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(distIndex);
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setSkipTaskbar(true);
    emitCombinedTelemetry();
    scanDownloadsFolder();
    mainWindow.webContents.send('notifications-update', latestNotifState);
    sendNotifWorkerCommand('refresh');
  });

  screen.on('display-metrics-changed', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const disp = screen.getPrimaryDisplay();
    const nx = Math.round((disp.bounds.width - WIN_WIDTH) / 2);
    windowBounds.x = nx;
    mainWindow.setPosition(nx, 0);
  });
}

let isGlobalMouseDown = false;
let isDraggingOut = false;
let draggingOutTimer = null;

function startLowCpuHitTestLoop() {
  const checkCursor = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    // While dragging an item out of the island, preserve mouse capture for Windows OLE DoDragDrop
    if (isDraggingOut) {
      setTimeout(checkCursor, 120);
      return;
    }

    const cursor = screen.getCursorScreenPoint();
    const relX = cursor.x - windowBounds.x;
    const relY = cursor.y - windowBounds.y;

    // Expand hit zone generously when user is holding mouse button near top of screen (dragging files/text into island)
    const padX = isGlobalMouseDown ? 48 : 14;
    const padY = isGlobalMouseDown ? 42 : 12;

    const insideIsland =
      relX >= islandBox.x - padX &&
      relX <= islandBox.x + islandBox.width + padX &&
      relY >= -5 &&
      relY <= islandBox.y + islandBox.height + padY;

    const shouldIgnore = !insideIsland;
    if (shouldIgnore !== isCurrentlyIgnoring) {
      isCurrentlyIgnoring = shouldIgnore;
      if (shouldIgnore) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
      } else {
        mainWindow.setIgnoreMouseEvents(false);
      }
    }

    // Check mouse button state when island is expanded OR when cursor is near top of screen for drag-and-drop
    if ((shouldIgnore && islandBox.height > 55) || (relY >= 0 && relY <= 140)) {
      sendBridgeCommand('checkmouse');
    }

    setTimeout(checkCursor, cursor.y > WIN_HEIGHT && islandBox.height <= 55 ? 160 : 65);
  };

  setTimeout(checkCursor, 100);
}

let lastClipboardText = '';
let lastClipboardFile = '';
let lastClipboardImgSig = '';
let imagePollTick = 0;

function readWindowsClipboardFile() {
  try {
    const buf = clipboard.readBuffer('FileNameW');
    if (buf && buf.length > 4) {
      const filePath = buf.toString('utf16le').split('\0')[0].trim();
      if (filePath && fs.existsSync(filePath)) {
        return filePath;
      }
    }
  } catch (_e) {}
  return '';
}

function startBackgroundMonitors() {
  try {
    lastClipboardText = clipboard.readText() || '';
    lastClipboardFile = readWindowsClipboardFile();
  } catch (_e) {
    lastClipboardText = '';
  }

  setInterval(() => {
    if (process.platform === 'win32') {
      sendBridgeCommand('poll');
    } else {
      emitCombinedTelemetry();
    }
  }, 1800);

  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    sendBridgeCommand('checkfullscreen');
    try {
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // 1. Check if a File was copied in Windows Explorer (CF_HDROP / FileNameW)
      const copiedFile = readWindowsClipboardFile();
      if (copiedFile && copiedFile !== lastClipboardFile) {
        lastClipboardFile = copiedFile;
        const baseName = path.basename(copiedFile);
        mainWindow.webContents.send('clipboard-updated', {
          id: 'file-' + Date.now(),
          type: 'file',
          title: `File: ${baseName}`,
          preview: copiedFile,
          content: copiedFile,
          filePath: copiedFile,
          timestamp: nowStr
        });
        return;
      }

      // 2. Check if Text was copied
      const text = clipboard.readText();
      if (text && text.trim().length > 0 && text !== lastClipboardText) {
        lastClipboardText = text;
        mainWindow.webContents.send('clipboard-updated', {
          id: 'clip-' + Date.now(),
          type: 'text',
          title: 'Copied Text',
          preview: text.trim().replace(/\s+/g, ' ').slice(0, 140),
          content: text.slice(0, 8000),
          timestamp: nowStr
        });
        return;
      }

      // 3. Check if an Image / Screenshot was copied (only decode when the clipboard really holds an image)
      const hasImageFormat = clipboard.availableFormats().some((f) => f.startsWith('image/'));
      imagePollTick = hasImageFormat ? imagePollTick + 1 : 0;
      if (hasImageFormat && (imagePollTick === 1 || imagePollTick % 3 === 0) && (!text || text.trim().length === 0)) {
        const img = clipboard.readImage();
        if (img && !img.isEmpty()) {
          const sz = img.getSize();
          const dataUrl = img.resize({ width: Math.min(360, sz.width) }).toDataURL();
          const sig = `${sz.width}x${sz.height}:${dataUrl.length}:${dataUrl.slice(-32)}`;
          if (sig !== lastClipboardImgSig) {
            lastClipboardImgSig = sig;
            mainWindow.webContents.send('clipboard-updated', {
              id: 'img-' + Date.now(),
              type: 'image',
              title: `Copied Image (${sz.width}×${sz.height})`,
              preview: `Screenshot / Image (${sz.width}×${sz.height})`,
              content: dataUrl,
              timestamp: nowStr
            });
          }
        }
      }
    } catch (_e) {}
  }, 800);

  powerMonitor.on('on-ac', () => {
    mainWindow?.webContents.send('power-status', { charging: true });
  });
  powerMonitor.on('on-battery', () => {
    mainWindow?.webContents.send('power-status', { charging: false });
  });
}

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSkipTaskbar(true);
    mainWindow.webContents.send('global-shortcut', 'toggle-expand');
  }
});

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    try { app.dock.hide(); } catch (_e) {}
  }
  createWindow();
  if (process.platform === 'win32') {
    startNativeWindowsBridge();
    startNotificationsWorker();
  } else {
    emitCombinedTelemetry();
  }
  startLowCpuHitTestLoop();
  startDownloadsWatcher();
  startBackgroundMonitors();

  // Create Windows System Tray Icon
  try {
    tray = new Tray(loadTrayIconImage());
    tray.setToolTip('ORBIT');
    updateTrayMenu();
    tray.on('click', () => {
      mainWindow?.webContents.send('global-shortcut', 'toggle-expand');
    });
  } catch (_e) {}

  // Ensure Fast Windows Startup Registration
  applyWindowsStartupRegistration(isAutoStartEnabled());

  globalShortcut.register('Alt+Space', () => {
    mainWindow?.webContents.send('global-shortcut', 'toggle-expand');
  });
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    mainWindow?.webContents.send('global-shortcut', 'toggle-expand');
  });
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    mainWindow?.webContents.send('global-shortcut', 'open-shelf');
  });
});

ipcMain.on('set-island-bounds', (_event, bounds) => {
  if (bounds && typeof bounds.width === 'number' && typeof bounds.height === 'number') {
    const bx = Math.round((WIN_WIDTH - bounds.width) / 2);
    islandBox = {
      x: bx,
      y: 6,
      width: Math.round(bounds.width),
      height: Math.round(bounds.height)
    };
  }
});

ipcMain.on('media-control', (_event, { action, value }) => {
  if (action === 'seek') {
    sendBridgeCommand(`media:seek:${value}`);
  } else {
    sendBridgeCommand(`media:${action}`);
  }
});

ipcMain.on('set-volume', (_event, val) => {
  latestBridgeState.volume = Number(val);
  sendBridgeCommand(`volume:${Math.round(Number(val))}`);
});

ipcMain.on('set-mute', (_event, mute) => {
  latestBridgeState.muted = Boolean(mute);
  sendBridgeCommand(`mute:${mute ? '1' : '0'}`);
});

ipcMain.on('set-brightness', (_event, val) => {
  latestBridgeState.brightness = Number(val);
  sendBridgeCommand(`brightness:${Math.round(Number(val))}`);
});

ipcMain.handle('fetch-track-extras', async (_event, { title, artist }) => {
  return await fetchTrackExtras(title, artist);
});

ipcMain.handle('get-notifications', () => {
  sendNotifWorkerCommand('refresh');
  return latestNotifState;
});

ipcMain.handle('clear-notifications', () => {
  latestNotifState = {
    whatsappUnread: latestNotifState.whatsappUnread,
    notifications: []
  };
  sendNotifWorkerCommand('clear');
  return latestNotifState;
});

ipcMain.handle('get-auto-start', () => {
  return isAutoStartEnabled();
});

ipcMain.handle('set-auto-start', (_event, enabled) => {
  return applyWindowsStartupRegistration(Boolean(enabled));
});

ipcMain.on('focus-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setIgnoreMouseEvents(false);
    isCurrentlyIgnoring = false;
    mainWindow.focus();
    mainWindow.setSkipTaskbar(true);
  }
});

const DROP_CACHE_DIR = path.join(os.tmpdir(), 'DynamicIsland_Drop');
try {
  if (!fs.existsSync(DROP_CACHE_DIR)) {
    fs.mkdirSync(DROP_CACHE_DIR, { recursive: true });
  }
} catch (_e) {}

ipcMain.on('set-dragging-out', (_event, flag) => {
  isDraggingOut = Boolean(flag);
  if (draggingOutTimer) {
    clearTimeout(draggingOutTimer);
    draggingOutTimer = null;
  }
  if (isDraggingOut) {
    draggingOutTimer = setTimeout(() => {
      isDraggingOut = false;
    }, 7000);
  }
});

ipcMain.on('start-native-file-drag', (event, payload) => {
  try {
    isDraggingOut = true;
    if (draggingOutTimer) clearTimeout(draggingOutTimer);
    draggingOutTimer = setTimeout(() => {
      isDraggingOut = false;
    }, 7000);

    let targetFile = null;

    if (typeof payload === 'string') {
      if (fs.existsSync(payload)) {
        targetFile = payload;
      }
    } else if (payload && typeof payload === 'object') {
      const { type, content, filePath, title } = payload;
      if (filePath && fs.existsSync(filePath)) {
        targetFile = filePath;
      } else if (type === 'file' && content && fs.existsSync(content)) {
        targetFile = content;
      } else if (type === 'image' && typeof content === 'string' && content.startsWith('data:image/')) {
        const isPng = content.includes('image/png');
        const ext = isPng ? 'png' : 'jpg';
        const safeName = `Image_${Date.now()}.${ext}`;
        const tempPath = path.join(DROP_CACHE_DIR, safeName);
        const b64 = content.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(tempPath, Buffer.from(b64, 'base64'));
        targetFile = tempPath;
      } else if (content && typeof content === 'string') {
        const safeTitle = (title || 'Snippet').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 24);
        const tempPath = path.join(DROP_CACHE_DIR, `${safeTitle}_${Date.now()}.txt`);
        fs.writeFileSync(tempPath, content, 'utf8');
        targetFile = tempPath;
      }
    }

    if (targetFile && fs.existsSync(targetFile)) {
      event.sender.startDrag({
        file: targetFile,
        icon: loadTrayIconImage()
      });
    }
  } catch (_e) {}
});

function writeItemToSystemClipboard(payload) {
  if (!payload) return false;
  const isObj = typeof payload === 'object';
  const type = isObj ? payload.type : 'text';
  const content = isObj ? payload.content : String(payload);
  const filePath = isObj ? (payload.filePath || (type === 'file' ? payload.content : null)) : (typeof payload === 'string' && fs.existsSync(payload) ? payload : null);

  if (filePath && fs.existsSync(filePath)) {
    sendBridgeCommand(`copyfile:${filePath}`);
    lastClipboardFile = filePath;
    lastClipboardText = filePath;
    clipboard.writeText(filePath);
    return true;
  }

  if (type === 'image' && typeof content === 'string' && content.startsWith('data:image/')) {
    const img = nativeImage.createFromDataURL(content);
    if (!img.isEmpty()) {
      clipboard.writeImage(img);
      try {
        const imgFile = path.join(DROP_CACHE_DIR, `Image_${Date.now()}.png`);
        fs.writeFileSync(imgFile, img.toPNG());
        sendBridgeCommand(`copyfile:${imgFile}`);
      } catch (_e) {}
      return true;
    }
  }

  if (content) {
    lastClipboardText = String(content);
    clipboard.writeText(String(content));
    return true;
  }
  return false;
}

ipcMain.handle('write-clipboard', (_event, payload) => {
  return writeItemToSystemClipboard(payload);
});

ipcMain.handle('paste-to-active-window', (_event, payload) => {
  if (writeItemToSystemClipboard(payload)) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      isCurrentlyIgnoring = true;
    }
    sendBridgeCommand('paste');
    return true;
  }
  return false;
});

ipcMain.handle('read-clipboard', () => {
  try {
    const file = readWindowsClipboardFile();
    if (file) {
      return {
        type: 'file',
        title: `File: ${path.basename(file)}`,
        preview: file,
        content: file,
        filePath: file
      };
    }
    const txt = clipboard.readText();
    if (txt && txt.trim()) {
      return {
        type: 'text',
        title: 'From Windows Clipboard',
        preview: txt.trim().replace(/\s+/g, ' ').slice(0, 140),
        content: txt.trim()
      };
    }
    const img = clipboard.readImage();
    if (img && !img.isEmpty()) {
      const sz = img.getSize();
      const dataUrl = img.resize({ width: Math.min(360, sz.width) }).toDataURL();
      return {
        type: 'image',
        title: `Copied Image (${sz.width}×${sz.height})`,
        preview: `Image (${sz.width}×${sz.height})`,
        content: dataUrl
      };
    }
  } catch (_e) {}
  return null;
});

ipcMain.handle('capture-screenshot', async () => {
  try {
    // Ensure Dynamic Island is 100% invisible so only what is behind it is captured
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setContentProtection(true);
      mainWindow.setOpacity(0);
    }
    await new Promise((resolve) => setTimeout(resolve, 85));

    const disp = screen.getPrimaryDisplay();
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: disp.bounds.width, height: disp.bounds.height }
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(1);
      mainWindow.setSkipTaskbar(true);
    }

    if (sources && sources.length > 0) {
      const img = sources[0].thumbnail;
      clipboard.writeImage(img);
      const screenshotsDir = path.join(os.homedir(), 'Pictures', 'Screenshots');
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }
      const filePath = path.join(screenshotsDir, `DynamicIsland_Capture_${Date.now()}.png`);
      fs.writeFileSync(filePath, img.toPNG());
      return { ok: true, filePath };
    }
  } catch (_e) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(1);
      mainWindow.setSkipTaskbar(true);
    }
  }
  return { ok: false };
});

ipcMain.handle('launch-app-or-url', async (_event, target) => {
  if (!target) return false;
  try {
    if (target === 'taskmgr') {
      if (process.platform === 'darwin') {
        spawn('open', ['-a', 'Activity Monitor'], { detached: true, stdio: 'ignore' }).unref();
      } else {
        spawn('taskmgr.exe', [], { detached: true, windowsHide: false, stdio: 'ignore' }).unref();
      }
      return true;
    }
    if (target === 'explorer') {
      if (process.platform === 'darwin') {
        spawn('open', ['-a', 'Finder'], { detached: true, stdio: 'ignore' }).unref();
      } else {
        spawn('explorer.exe', [], { detached: true, windowsHide: false, stdio: 'ignore' }).unref();
      }
      return true;
    }
    if (target === 'calc') {
      if (process.platform === 'darwin') {
        spawn('open', ['-a', 'Calculator'], { detached: true, stdio: 'ignore' }).unref();
      } else {
        spawn('calc.exe', [], { detached: true, windowsHide: false, stdio: 'ignore' }).unref();
      }
      return true;
    }
    await shell.openExternal(target);
    return true;
  } catch (_e) {
    return false;
  }
});

ipcMain.handle('open-path', async (_event, targetPath) => {
  if (!targetPath) return false;
  try {
    await shell.openPath(targetPath);
    return true;
  } catch (_e) {
    return false;
  }
});

ipcMain.handle('open-external-url', async (_event, url) => {
  if (!url) return false;
  try {
    await shell.openExternal(url);
    return true;
  } catch (_e) {
    return false;
  }
});

ipcMain.handle('show-in-folder', (_event, targetPath) => {
  if (!targetPath) return false;
  try {
    shell.showItemInFolder(targetPath);
    return true;
  } catch (_e) {
    return false;
  }
});

ipcMain.handle('refresh-downloads', () => {
  return scanDownloadsFolder();
});

ipcMain.on('quit-app', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (bridgeProc) {
    try {
      bridgeProc.kill();
    } catch (_e) {}
  }
  if (notifWorkerProc) {
    try {
      notifWorkerProc.kill();
    } catch (_e) {}
  }
});
