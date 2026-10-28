const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');

const wpnDbPath = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'Microsoft',
  'Windows',
  'Notifications',
  'wpndatabase.db'
);

const cacheFilePath = path.join(process.env.ORBIT_DATA_DIR || __dirname, 'notif-history-cache.json');
const avatarCache = new Map();

let persistentHistory = [];
let clearedUpToId = 0;
let lastSeenNotificationId = 0;
let lastEmittedHash = '';

try {
  if (fs.existsSync(cacheFilePath)) {
    const saved = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    if (Array.isArray(saved.history)) persistentHistory = saved.history;
    if (typeof saved.clearedUpToId === 'number') clearedUpToId = saved.clearedUpToId;
  }
} catch (_e) {}

function saveHistoryCache() {
  try {
    fs.writeFileSync(
      cacheFilePath,
      JSON.stringify({ clearedUpToId, history: persistentHistory.slice(0, 30) }),
      'utf8'
    );
  } catch (_e) {}
}

function decodeXmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function formatNotificationAppName(primaryId) {
  if (!primaryId) return 'Windows';
  const low = primaryId.toLowerCase();
  if (low.includes('whatsapp')) return 'WhatsApp';
  if (low.includes('teams')) return 'Microsoft Teams';
  if (low.includes('telegram')) return 'Telegram';
  if (low.includes('discord')) return 'Discord';
  if (low.includes('spotify')) return 'Spotify';
  if (low.includes('chrome')) return 'Google Chrome';
  if (low.includes('edge')) return 'Microsoft Edge';
  if (low.includes('outlook') || low.includes('mail')) return 'Mail';
  if (low.includes('gamingapp') || low.includes('xbox')) return 'Xbox';
  if (low.includes('windowsdefender') || low.includes('security')) return 'Windows Security';
  if (low.includes('explorer')) return 'File Explorer';
  if (low.includes('antigravity')) return 'Antigravity';
  const cleaned = primaryId.split('!')[0].split('.').pop() || 'System';
  return cleaned.replace(/_[a-z0-9]+$/i, '');
}

function fetchAvatarBase64(url) {
  if (!url) return Promise.resolve('');
  if (avatarCache.has(url)) return Promise.resolve(avatarCache.get(url));
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 3500 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchAvatarBase64(res.headers.location));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const buf = Buffer.concat(chunks);
          if (buf.length > 80) {
            const b64 = 'data:image/jpeg;base64,' + buf.toString('base64');
            avatarCache.set(url, b64);
            resolve(b64);
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

let isScanning = false;

async function scanDatabase(emitNewBanner = false) {
  if (isScanning) return;
  if (!fs.existsSync(wpnDbPath)) return;
  isScanning = true;

  let db = null;
  try {
    db = new DatabaseSync(wpnDbPath, { open: true, readOnly: true, readBigInts: true });

    // 1. Read Unread Badges (WhatsApp & System apps)
    let whatsappUnread = 0;
    const badgeRows = db
      .prepare(
        "SELECT Notification.Payload, NotificationHandler.PrimaryId FROM Notification INNER JOIN NotificationHandler ON Notification.HandlerId = NotificationHandler.RecordId WHERE Notification.Type = 'badge'"
      )
      .all();

    for (const b of badgeRows) {
      const pid = String(b.PrimaryId || '').toLowerCase();
      if (pid.includes('whatsapp') && b.Payload) {
        const xml = Buffer.from(b.Payload).toString('utf8');
        const m = /value="(\d+)"/.exec(xml);
        if (m) whatsappUnread = parseInt(m[1], 10);
      }
    }

    // 2. Read Toast Notifications
    const toastRows = db
      .prepare(
        "SELECT Notification.Id, Notification.Payload, Notification.ArrivalTime, NotificationHandler.PrimaryId FROM Notification INNER JOIN NotificationHandler ON Notification.HandlerId = NotificationHandler.RecordId WHERE Notification.Type = 'toast' ORDER BY Notification.ArrivalTime DESC LIMIT 25"
      )
      .all();

    db.close();
    db = null;

    let newestItemToEmit = null;
    let maxRowIdInDb = lastSeenNotificationId;

    // Process from oldest to newest so newer messages sit at index 0
    for (const row of [...toastRows].reverse()) {
      const id = Number(row.Id);
      if (id > maxRowIdInDb) maxRowIdInDb = id;
      if (id <= clearedUpToId) continue;

      const primaryId = String(row.PrimaryId || '');
      const xml = row.Payload ? Buffer.from(row.Payload).toString('utf8') : '';
      const texts = [];
      const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/gi;
      let match;
      while ((match = textRegex.exec(xml)) !== null) {
        const cleaned = decodeXmlEntities(match[1].replace(/<[^>]+>/g, '').trim());
        if (cleaned) texts.push(cleaned);
      }
      if (texts.length === 0) continue;

      let rawAvatarUrl = '';
      const imgMatch = /<image[^>]+src="([^"]+)"/i.exec(xml);
      if (imgMatch && imgMatch[1]) {
        const rawSrc = decodeXmlEntities(imgMatch[1]);
        if (rawSrc.startsWith('http://') || rawSrc.startsWith('https://')) {
          rawAvatarUrl = rawSrc;
        }
      }

      const avatarUrl = rawAvatarUrl ? await fetchAvatarBase64(rawAvatarUrl) : '';
      const appName = formatNotificationAppName(primaryId);
      const isWhatsApp = appName === 'WhatsApp';
      const title = texts[0] || appName;
      const body = texts[1] || '';
      const subText = texts.slice(2).join(' • ') || '';
      const combinedLower = `${title} ${body}`.toLowerCase();
      const isCall =
        combinedLower.includes('voice call') ||
        combinedLower.includes('video call') ||
        combinedLower.includes('incoming call') ||
        combinedLower.includes('calling');

      let timeLabel = 'Just now';
      let arrivalMs = Date.now();
      try {
        const fileTime = BigInt(row.ArrivalTime);
        const msSince1970 = Number(fileTime / 10000n - 11644473600000n);
        if (msSince1970 > 1500000000000) {
          arrivalMs = msSince1970;
          timeLabel = new Date(msSince1970).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch (_e) {}

      const itemObj = {
        id,
        appName,
        isWhatsApp,
        isCall,
        title,
        body,
        subText,
        avatarUrl,
        timeLabel,
        arrivalMs
      };

      const existingIdx = persistentHistory.findIndex(
        (x) => x.id === id || (x.appName === appName && x.title === title && x.body === body)
      );
      if (existingIdx !== -1) {
        persistentHistory[existingIdx] = itemObj;
      } else {
        persistentHistory.unshift(itemObj);
      }

      if (lastSeenNotificationId > 0 && id > lastSeenNotificationId) {
        newestItemToEmit = itemObj;
      }
    }

    if (maxRowIdInDb > lastSeenNotificationId) {
      lastSeenNotificationId = maxRowIdInDb;
    }

    // Sort by arrivalMs descending (newest on top, WhatsApp prioritized when equal)
    persistentHistory.sort((a, b) => (b.arrivalMs || 0) - (a.arrivalMs || 0) || b.id - a.id);
    if (persistentHistory.length > 25) {
      persistentHistory = persistentHistory.slice(0, 25);
    }

    saveHistoryCache();

    if (emitNewBanner && newestItemToEmit) {
      process.stdout.write('NEW_NOTIF:' + JSON.stringify(newestItemToEmit) + '\n');
    }

    const payloadObj = {
      whatsappUnread,
      notifications: persistentHistory
    };
    const payloadStr = JSON.stringify(payloadObj);
    if (payloadStr !== lastEmittedHash) {
      lastEmittedHash = payloadStr;
      process.stdout.write('NOTIF_UPDATE:' + payloadStr + '\n');
    }
  } catch (_e) {
    if (db) {
      try {
        db.close();
      } catch (_err) {}
    }
  } finally {
    isScanning = false;
  }
}

// Listen for commands from main.cjs (e.g., "clear" or "refresh")
let stdinBuf = '';
process.stdin.on('data', (chunk) => {
  stdinBuf += chunk.toString('utf8');
  let idx;
  while ((idx = stdinBuf.indexOf('\n')) !== -1) {
    const cmd = stdinBuf.slice(0, idx).trim();
    stdinBuf = stdinBuf.slice(idx + 1);
    if (cmd === 'clear') {
      clearedUpToId = Math.max(clearedUpToId, lastSeenNotificationId);
      persistentHistory = [];
      saveHistoryCache();
      lastEmittedHash = '';
      scanDatabase(false);
    } else if (cmd === 'refresh') {
      lastEmittedHash = '';
      scanDatabase(false);
    }
  }
});

// Initial scan
scanDatabase(false);

// Watch Notifications directory for instant (<100ms) WAL changes
try {
  const notifDir = path.dirname(wpnDbPath);
  if (fs.existsSync(notifDir)) {
    let debounce = null;
    fs.watch(notifDir, (_eventType, filename) => {
      if (!filename || filename.startsWith('wpndatabase.db')) {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => scanDatabase(true), 120);
      }
    });
  }
} catch (_e) {}

// Low-cost fallback poll (fs.watch above delivers changes instantly)
setInterval(() => {
  scanDatabase(true);
}, 3000);
