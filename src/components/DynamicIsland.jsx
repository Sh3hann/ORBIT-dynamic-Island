import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Sun,
  Clock,
  Cpu,
  Clipboard,
  Check,
  Download,
  Upload,
  X,
  FolderOpen,
  Wifi,
  MessageCircle,
  PhoneCall,
  Settings as SettingsIcon,
  Pin,
  Camera,
  Calculator,
  Search,
  Bluetooth,
  Sliders
} from 'lucide-react';
import { soundEngine } from '../soundEffects';
import {
  AppleWaveform,
  IosBatteryIcon,
  LyricsBubbleIcon,
  DefaultSystemMediaArt,
  AnimatedEarbudsAndBox
} from './IosIcons';

// Exact iOS 27 Spring Physics
const SPRING_EXPAND = {
  type: 'spring',
  stiffness: 390,
  damping: 30,
  mass: 0.82
};

const SPRING_COLLAPSE = {
  type: 'spring',
  stiffness: 440,
  damping: 36,
  mass: 0.78
};

const PAGE_TRANSITION = {
  initial: { opacity: 0, x: 12, scale: 0.98 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -12, scale: 0.98 },
  transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] }
};

const ALL_PAGES = [
  { id: 'system', label: 'PC Hardware', short: 'System' },
  { id: 'media', label: 'Music & Lyrics', short: 'Music' },
  { id: 'bluetooth', label: 'Bluetooth & Sound Mix', short: 'Bluetooth' },
  { id: 'notifications', label: 'WhatsApp & Alerts', short: 'Alerts' },
  { id: 'shelf', label: 'Copy & Paste', short: 'Clipboard' },
  { id: 'apps', label: 'Apps & Search', short: 'Apps' },
  { id: 'tools', label: 'Capture & Calc', short: 'Tools' },
  { id: 'downloads', label: 'Downloads', short: 'Files' },
  { id: 'controls', label: 'Audio & Display', short: 'HUD' },
  { id: 'clock', label: 'Clock & Timer', short: 'Time' }
];

const DEFAULT_SETTINGS = {
  autoExpandOnHover: true,
  autoMinimizeOnLeave: true,
  rememberLastTab: true,
  autoShowLyrics: true,
  idleBarMode: 'datetime', // 'datetime' | 'battery' | 'system'
  fullscreenBarType: 'ios-handle', // 'ios-handle' | 'mini-hud' | 'stealth-edge' | 'normal'
  pinnedPages: [
    'system',
    'media',
    'bluetooth',
    'notifications',
    'shelf',
    'apps',
    'tools',
    'downloads',
    'controls',
    'clock'
  ]
};

function loadSettings() {
  try {
    const raw = localStorage.getItem('ios27_island_settings_v5');
    if (raw) {
      const parsed = JSON.parse(raw);
      let pinned =
        Array.isArray(parsed.pinnedPages) && parsed.pinnedPages.length > 0
          ? [...parsed.pinnedPages]
          : [...DEFAULT_SETTINGS.pinnedPages];
      if (!pinned.includes('system')) pinned.unshift('system');
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        pinnedPages: pinned
      };
    }
  } catch (_e) {}
  return DEFAULT_SETTINGS;
}

// ============================================================================
// APP BRAND COLOR THEME RESOLVER FOR NOTIFICATIONS & ISLAND FLASHING
// ============================================================================
function getNotificationBrandTheme(notif) {
  if (!notif) {
    return { color: '#0A84FF', glow: 'rgba(10, 132, 255, 0.36)', tint: 'rgba(10, 132, 255, 0.16)' };
  }
  if (notif.brandColor) {
    return {
      color: notif.brandColor,
      glow: `${notif.brandColor}55`,
      tint: `${notif.brandColor}24`
    };
  }
  const text = `${notif.appName || ''} ${notif.title || ''} ${notif.subText || ''}`.toLowerCase();
  if (notif.isWhatsApp || text.includes('whatsapp')) {
    return { color: '#25D366', glow: 'rgba(37, 211, 102, 0.45)', tint: 'rgba(37, 211, 102, 0.18)' };
  }
  if (notif.isTimer || text.includes('timer') || text.includes('alarm') || text.includes('clock')) {
    return { color: '#FF9F0A', glow: 'rgba(255, 159, 10, 0.45)', tint: 'rgba(255, 159, 10, 0.18)' };
  }
  if (notif.isBluetooth || text.includes('bluetooth') || text.includes('soundcore') || text.includes('airpods')) {
    return { color: '#0A84FF', glow: 'rgba(10, 132, 255, 0.45)', tint: 'rgba(10, 132, 255, 0.18)' };
  }
  if (text.includes('telegram')) {
    return { color: '#24A1DE', glow: 'rgba(36, 161, 222, 0.44)', tint: 'rgba(36, 161, 222, 0.18)' };
  }
  if (text.includes('discord')) {
    return { color: '#5865F2', glow: 'rgba(88, 101, 242, 0.44)', tint: 'rgba(88, 101, 242, 0.18)' };
  }
  if (text.includes('youtube')) {
    return { color: '#FF2D55', glow: 'rgba(255, 45, 85, 0.44)', tint: 'rgba(255, 45, 85, 0.18)' };
  }
  if (text.includes('spotify')) {
    return { color: '#1DB954', glow: 'rgba(29, 185, 84, 0.44)', tint: 'rgba(29, 185, 84, 0.18)' };
  }
  if (text.includes('instagram')) {
    return { color: '#E1306C', glow: 'rgba(225, 48, 108, 0.44)', tint: 'rgba(225, 48, 108, 0.18)' };
  }
  if (text.includes('teams') || text.includes('slack')) {
    return { color: '#BF5AF2', glow: 'rgba(191, 90, 242, 0.44)', tint: 'rgba(191, 90, 242, 0.18)' };
  }
  return { color: '#0A84FF', glow: 'rgba(10, 132, 255, 0.40)', tint: 'rgba(10, 132, 255, 0.15)' };
}

// ============================================================================
// SPOTIFY-STYLE ACCURATE DOMINANT ALBUM COVER COLOR EXTRACTOR
// ============================================================================
const DEFAULT_ALBUM_PALETTE = {
  vibrant: 'rgb(29, 185, 84)',
  secondary: 'rgb(10, 132, 255)',
  lyricBgTop: 'rgba(28, 62, 48, 0.94)',
  lyricBgBottom: 'rgba(14, 24, 38, 0.96)',
  islandGlow: 'rgba(29, 185, 84, 0.30)',
  secondaryGlow: 'rgba(10, 132, 255, 0.17)',
  waveColors: ['#1DB954', '#30D158', '#64D2FF', '#1DB954', '#30D158', '#64D2FF']
};

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), s, l];
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

function extractAlbumPaletteFromImage(imgSrc) {
  return new Promise((resolve) => {
    if (!imgSrc) return resolve(DEFAULT_ALBUM_PALETTE);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 28;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        // 12 Hue Buckets (30 deg each) to find the true dominant & secondary album colors accurately
        const buckets = Array.from({ length: 12 }, () => ({
          weight: 0,
          hSum: 0,
          sSum: 0,
          lSum: 0
        }));

        let fallbackR = 0,
          fallbackG = 0,
          fallbackB = 0,
          fallbackCount = 0;

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            if (a < 180) continue;

            fallbackR += r;
            fallbackG += g;
            fallbackB += b;
            fallbackCount++;

            const [h, s, l] = rgbToHsl(r, g, b);
            // Ignore pure black/white extremes and near-gray noise
            if (l < 0.10 || l > 0.90 || s < 0.12) continue;

            // Weight by saturation, balanced lightness, and slight center bias
            const dx = (x - size / 2) / (size / 2);
            const dy = (y - size / 2) / (size / 2);
            const centerBias = Math.max(0.65, 1.15 - (dx * dx + dy * dy) * 0.35);
            const lBalance = 1 - Math.abs(l - 0.52) * 1.25;
            const w = (0.35 + s * 1.85) * Math.max(0.25, lBalance) * centerBias;

            const bIdx = Math.floor(h / 30) % 12;
            buckets[bIdx].weight += w;
            buckets[bIdx].hSum += h * w;
            buckets[bIdx].sSum += s * w;
            buckets[bIdx].lSum += l * w;
          }
        }

        const ranked = buckets
          .map((b, idx) => ({
            idx,
            weight: b.weight,
            h: b.weight > 0 ? Math.round(b.hSum / b.weight) % 360 : idx * 30,
            s: b.weight > 0 ? b.sSum / b.weight : 0.65,
            l: b.weight > 0 ? b.lSum / b.weight : 0.5
          }))
          .filter((b) => b.weight > 0)
          .sort((a, b) => b.weight - a.weight);

        let h1 = 210,
          s1 = 0.72,
          l1 = 0.52;
        let h2 = 250,
          s2 = 0.65,
          l2 = 0.48;

        if (ranked.length > 0) {
          h1 = ranked[0].h;
          s1 = Math.min(0.92, Math.max(0.48, ranked[0].s * 1.12));
          l1 = Math.min(0.62, Math.max(0.44, ranked[0].l));

          const distinctSecond = ranked.find((cand) => {
            const diff = Math.abs(cand.h - h1);
            const hueDist = Math.min(diff, 360 - diff);
            return hueDist >= 28 && cand.weight >= ranked[0].weight * 0.16;
          });

          if (distinctSecond) {
            h2 = distinctSecond.h;
            s2 = Math.min(0.88, Math.max(0.45, distinctSecond.s * 1.08));
            l2 = Math.min(0.58, Math.max(0.42, distinctSecond.l));
          } else {
            h2 = (h1 + 32) % 360;
            s2 = Math.max(0.42, s1 * 0.88);
            l2 = Math.max(0.38, l1 * 0.9);
          }
        } else if (fallbackCount > 0) {
          const [fh, fs] = rgbToHsl(
            fallbackR / fallbackCount,
            fallbackG / fallbackCount,
            fallbackB / fallbackCount
          );
          h1 = fh;
          s1 = Math.max(0.35, fs);
          h2 = (fh + 28) % 360;
          s2 = Math.max(0.3, fs);
        }

        const [r1, g1, b1] = hslToRgb(h1, s1, Math.min(0.62, Math.max(0.5, l1)));
        const [r2, g2, b2] = hslToRgb(h2, s2, Math.min(0.6, Math.max(0.48, l2)));
        const [lr1, lg1, lb1] = hslToRgb(h1, Math.min(0.88, s1), 0.34);
        const [lr2, lg2, lb2] = hslToRgb(h2, Math.min(0.82, s2), 0.20);

        const vibrant = `rgb(${r1}, ${g1}, ${b1})`;
        const secondary = `rgb(${r2}, ${g2}, ${b2})`;
        const lyricBgTop = `rgba(${lr1}, ${lg1}, ${lb1}, 0.94)`;
        const lyricBgBottom = `rgba(${lr2}, ${lg2}, ${lb2}, 0.96)`;
        // Balanced middle-ground glow opacity (between 1st view and 2nd view)
        const islandGlow = `rgba(${r1}, ${g1}, ${b1}, 0.30)`;
        const secondaryGlow = `rgba(${r2}, ${g2}, ${b2}, 0.17)`;

        resolve({
          vibrant,
          secondary,
          lyricBgTop,
          lyricBgBottom,
          islandGlow,
          secondaryGlow,
          waveColors: [vibrant, secondary, '#FFFFFF', vibrant, secondary, vibrant]
        });
      } catch (_e) {
        resolve(DEFAULT_ALBUM_PALETTE);
      }
    };
    img.onerror = () => resolve(DEFAULT_ALBUM_PALETTE);
    img.src = imgSrc;
  });
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
}

function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRate(bytesPerSec) {
  const bps = Number(bytesPerSec) || 0;
  if (bps < 1024) return `${bps} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
}

function formatAppBadge(sourceApp) {
  if (!sourceApp) return 'System Media';
  const low = sourceApp.toLowerCase();
  if (low.includes('spotify')) return 'Spotify';
  if (low.includes('youtube music')) return 'YouTube Music';
  if (low.includes('youtube')) return 'YouTube';
  if (low.includes('chrome')) return 'Chrome';
  if (low.includes('msedge') || low.includes('edge')) return 'Edge';
  if (low.includes('firefox')) return 'Firefox';
  if (low.includes('brave')) return 'Brave';
  if (low.includes('vlc')) return 'VLC';
  return sourceApp.split('!')[0].replace(/\.exe$/i, '');
}

export default function DynamicIsland() {
  const [settings, setSettings] = useState(loadSettings);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  const enabledPages = useMemo(() => {
    const filtered = ALL_PAGES.filter((p) => settings.pinnedPages.includes(p.id));
    return filtered.length > 0 ? filtered : [ALL_PAGES[0]];
  }, [settings.pinnedPages]);

  // Always start application tab on System Usage ('system'), then show recent tab during session!
  const [activePageId, setActivePageId] = useState('system');

  const activePage = useMemo(() => {
    if (enabledPages.some((p) => p.id === activePageId)) return activePageId;
    return enabledPages[0].id;
  }, [enabledPages, activePageId]);

  const selectPage = (pageId) => {
    setShowSettingsPanel(false);
    setActivePageId(pageId);
    if (settings.rememberLastTab) {
      try {
        localStorage.setItem('ios27_island_last_tab', pageId);
      } catch (_e) {}
    }
  };

  const updateSettings = (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('ios27_island_settings_v5', JSON.stringify(next));
      } catch (_e) {}
      return next;
    });
  };

  const togglePinnedPage = (pageId) => {
    soundEngine.playHapticTap();
    setSettings((prev) => {
      const exists = prev.pinnedPages.includes(pageId);
      let nextPinned = exists
        ? prev.pinnedPages.filter((id) => id !== pageId)
        : [...prev.pinnedPages, pageId];
      if (nextPinned.length === 0) nextPinned = [pageId];
      const next = { ...prev, pinnedPages: nextPinned };
      try {
        localStorage.setItem('ios27_island_settings_v5', JSON.stringify(next));
      } catch (_e) {}
      return next;
    });
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const leaveMinimizeTimerRef = useRef(null);
  const isDraggingOutRef = useRef(false);
  const dragLeaveTimerRef = useRef(null);

  const [transientAlert, setTransientAlert] = useState(null);
  const [bannerNotif, setBannerNotif] = useState(null);
  const [btBannerDevice, setBtBannerDevice] = useState(null);
  const [flashBrandColor, setFlashBrandColor] = useState(null);
  const alertTimeoutRef = useRef(null);
  const flashTimeoutRef = useRef(null);

  const triggerBrandFlash = (color, durationMs = 4500) => {
    if (!color) return;
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setFlashBrandColor(color);
    flashTimeoutRef.current = setTimeout(() => {
      setFlashBrandColor(null);
    }, durationMs);
  };

  // Bluetooth & Sound Mix Studio State
  const [selectedBtId, setSelectedBtId] = useState('');
  const [btListenMode, setBtListenMode] = useState(() => {
    return localStorage.getItem('ios27_bt_listen_mode') || 'anc';
  });
  const [btSoundPreset, setBtSoundPreset] = useState(() => {
    return localStorage.getItem('ios27_bt_sound_preset') || 'Spatial 3D';
  });
  const prevConnectedBtIdsRef = useRef(new Set());
  const btInitialScanDoneRef = useRef(false);

  // Real System Telemetry & Media State
  const [telemetry, setTelemetry] = useState({
    cpuPct: 2,
    coreLoads: [2, 2, 3, 2, 2, 2, 3, 2],
    cpuModel: 'Windows Processor',
    coresCount: 8,
    memPct: 40,
    usedMemGB: '0.0',
    totalMemGB: '0.0',
    diskPct: 0,
    usedDiskGB: '0',
    totalDiskGB: '0',
    freeDiskGB: '0',
    uptimeHours: '0.0',
    hostname: 'PC',
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
    bluetooth: null
  });

  // Track Extras & Dynamic Spotify Album Color Palette
  const [trackExtras, setTrackExtras] = useState({
    cleanTitle: '',
    cleanArtist: '',
    coverUrl: '',
    durationSec: 0,
    lyrics: []
  });
  const [albumPalette, setAlbumPalette] = useState(DEFAULT_ALBUM_PALETTE);
  const [showLyrics, setShowLyrics] = useState(true);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const lastFetchedSongKeyRef = useRef('');

  const [livePosSec, setLivePosSec] = useState(0);
  const lastSmtcPosRef = useRef(0);
  // Acoustic vocal buffer delay (default 0.55s) so lyrics never appear early
  const lyricOffsetSec = 0.55;

  // Start-with-Windows toggle (state lives in the main process; tray menu stays in sync)
  const [autoStartOn, setAutoStartOn] = useState(true);
  useEffect(() => {
    let alive = true;
    window.electronAPI?.getAutoStart?.().then((v) => {
      if (alive && typeof v === 'boolean') setAutoStartOn(v);
    });
    return () => {
      alive = false;
    };
  }, [showSettingsPanel]);
  const toggleAutoStart = async () => {
    soundEngine.playHapticTap();
    const next = !autoStartOn;
    setAutoStartOn(next);
    const applied = await window.electronAPI?.setAutoStart?.(next);
    if (typeof applied === 'boolean') setAutoStartOn(applied);
  };

  // Real Windows & WhatsApp Notifications (Persisted in localStorage so received messages stay visible!)
  const [notifData, setNotifData] = useState(() => {
    try {
      const saved = localStorage.getItem('ios27_notif_history');
      if (saved) return JSON.parse(saved);
    } catch (_e) {}
    return { whatsappUnread: 0, notifications: [] };
  });

  // Real Windows Downloads
  const [downloadsData, setDownloadsData] = useState({
    downloadsPath: '',
    activeDownload: null,
    recentFiles: []
  });

  // Real Windows Clipboard Shelf
  const [shelfItems, setShelfItems] = useState(() => {
    try {
      const saved = localStorage.getItem('ios27_clipboard_history');
      return saved ? JSON.parse(saved) : [];
    } catch (_e) {}
    return [];
  });
  const [manualClipInput, setManualClipInput] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [pastedId, setPastedId] = useState(null);

  // Apps & Web Search + Tools State (No Color Select!)
  const [searchQuery, setSearchQuery] = useState('');
  const [calcExpr, setCalcExpr] = useState('');
  const [calcResult, setCalcResult] = useState('');
  const [screenshotStatus, setScreenshotStatus] = useState('');

  // Real Battery State
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isCharging, setIsCharging] = useState(true);

  // Real Clock & Timer State
  const [nowDate, setNowDate] = useState(new Date());
  const [clockSubTab, setClockSubTab] = useState('calendar');
  const [timerTotal, setTimerTotal] = useState(300);
  const [timerRemaining, setTimerRemaining] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('ios27_island_notes');
      return saved ? JSON.parse(saved) : [];
    } catch (_e) {
      return [];
    }
  });
  const [newNoteText, setNewNoteText] = useState('');

  const media = telemetry.media || {};
  const activeCoverPhoto = media.thumbnail || trackExtras.coverUrl || '';
  const displayTitle = trackExtras.cleanTitle || media.title || '';
  const displayArtist = trackExtras.cleanArtist || media.artist || '';
  const effectiveDuration = media.durationSec > 0 ? media.durationSec : trackExtras.durationSec || 0;
  const syncedLyrics = trackExtras.lyrics || [];

  // Extract Spotify-style dynamic album colors whenever the cover photo changes
  useEffect(() => {
    if (!activeCoverPhoto) {
      setAlbumPalette(DEFAULT_ALBUM_PALETTE);
      return;
    }
    let cancelled = false;
    extractAlbumPaletteFromImage(activeCoverPhoto).then((pal) => {
      if (!cancelled && pal) {
        setAlbumPalette(pal);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeCoverPhoto]);

  const saveShelfItems = (updater) => {
    setShelfItems((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('ios27_clipboard_history', JSON.stringify(next.slice(0, 20)));
      } catch (_e) {}
      return next;
    });
  };

  const activeWhatsAppCall = useMemo(() => {
    if (telemetry.whatsappCall?.active) {
      return telemetry.whatsappCall.title || 'WhatsApp Call';
    }
    const recentCallNotif = (notifData.notifications || []).find((n) => n.isCall && n.isWhatsApp);
    if (recentCallNotif && bannerNotif?.id === recentCallNotif.id) {
      return `${recentCallNotif.title} • ${recentCallNotif.body}`;
    }
    return null;
  }, [telemetry.whatsappCall, notifData.notifications, bannerNotif]);

  const triggerTransientAlert = (type, durationMs = 2800) => {
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    setTransientAlert(type);
    if (type === 'charging') soundEngine.playChargeChime();
    else if (type === 'notif' || type === 'bluetooth') soundEngine.playSuccessChime();
    else soundEngine.playHapticTap(180, 0.02);
    alertTimeoutRef.current = setTimeout(() => {
      setTransientAlert(null);
      setBannerNotif(null);
      setBtBannerDevice(null);
    }, durationMs);
  };

  // Active Bluetooth Device Resolution & Real-Time Connection Popup Trigger
  const btDevices = useMemo(() => {
    const list = telemetry.bluetooth?.devices;
    if (Array.isArray(list) && list.length > 0) return list;
    return [
      {
        id: 'bt-fallback',
        name: 'soundcore Liberty 4 NC',
        connected: false,
        batteryPct: 100,
        leftBattery: 100,
        rightBattery: 100,
        caseBattery: 95,
        type: 'earbuds'
      }
    ];
  }, [telemetry.bluetooth]);

  const activeBtDevice = useMemo(() => {
    if (selectedBtId) {
      const found = btDevices.find((d) => d.id === selectedBtId);
      if (found) return found;
    }
    return telemetry.bluetooth?.activeDevice || btDevices[0];
  }, [btDevices, selectedBtId, telemetry.bluetooth]);

  const triggerBluetoothConnectBanner = (deviceObj) => {
    const dev = deviceObj || activeBtDevice;
    if (!dev) return;
    setBtBannerDevice(dev);
    setIsExpanded(false);
    triggerBrandFlash('#0A84FF', 5000);
    triggerTransientAlert('bluetooth', 6200);
  };

  useEffect(() => {
    const list = telemetry.bluetooth?.devices;
    if (!Array.isArray(list) || list.length === 0) return;

    const currentConnIds = new Set(
      list.filter((d) => d.connected && d.type === 'earbuds').map((d) => d.id)
    );

    if (!btInitialScanDoneRef.current) {
      btInitialScanDoneRef.current = true;
      prevConnectedBtIdsRef.current = currentConnIds;
      // If a Bluetooth earbud is already actively connected on startup, show the connection popup briefly
      const connectedEarbud = list.find((d) => d.connected && d.type === 'earbuds');
      if (connectedEarbud) {
        triggerBluetoothConnectBanner(connectedEarbud);
      }
      return;
    }

    for (const dev of list) {
      if (dev.connected && dev.type === 'earbuds' && !prevConnectedBtIdsRef.current.has(dev.id)) {
        setSelectedBtId(dev.id);
        triggerBluetoothConnectBanner(dev);
        break;
      }
    }
    prevConnectedBtIdsRef.current = currentConnIds;
  }, [telemetry.bluetooth]);

  const stepPage = (delta) => {
    soundEngine.playHapticTap(190, 0.02);
    const curIdx = Math.max(0, enabledPages.findIndex((p) => p.id === activePage));
    const nextIdx = (curIdx + delta + enabledPages.length) % enabledPages.length;
    selectPage(enabledPages[nextIdx].id);
  };

  const lastWheelRef = useRef(0);
  const handleWheel = (e) => {
    const now = Date.now();
    if (now - lastWheelRef.current < 190) return;
    if (Math.abs(e.deltaY) > 8 || Math.abs(e.deltaX) > 8) {
      lastWheelRef.current = now;
      const dir = (e.deltaY || e.deltaX) > 0 ? 1 : -1;
      stepPage(dir);
    }
  };

  const isFullscreenApp = Boolean(telemetry.isFullscreen) && settings.fullscreenBarType !== 'normal';
  const prevFullscreenRef = useRef(false);

  useEffect(() => {
    const nowFs = Boolean(telemetry.isFullscreen);
    if (nowFs && !prevFullscreenRef.current && settings.fullscreenBarType !== 'normal') {
      // Automatically minimize into the small clickable bar when entering fullscreen
      setIsExpanded(false);
      setShowSettingsPanel(false);
    }
    prevFullscreenRef.current = nowFs;
  }, [telemetry.isFullscreen, settings.fullscreenBarType]);

  const handleMouseEnterIsland = () => {
    if (leaveMinimizeTimerRef.current) {
      clearTimeout(leaveMinimizeTimerRef.current);
      leaveMinimizeTimerRef.current = null;
    }
    setIsHovered(true);
    // In fullscreen mode, keep it as a small clickable bar until clicked!
    if (settings.autoExpandOnHover && !isExpanded && !isFullscreenApp) {
      soundEngine.playHapticTap(170, 0.015);
      setIsExpanded(true);
    }
  };

  const handleMouseLeaveIsland = () => {
    setIsHovered(false);
    // Do not auto-collapse while the user is actively dragging an item in or out!
    if (isDraggingOutRef.current || isDraggingOver) return;
    if (settings.autoMinimizeOnLeave && isExpanded) {
      leaveMinimizeTimerRef.current = setTimeout(() => {
        if (isDraggingOutRef.current) return;
        setIsExpanded(false);
        setShowSettingsPanel(false);
      }, 320);
    }
  };

  // Connect to Real Windows IPC Events
  useEffect(() => {
    if (navigator.getBattery) {
      navigator.getBattery().then((bat) => {
        setBatteryLevel(Math.round(bat.level * 100));
        setIsCharging(bat.charging);
        bat.addEventListener('levelchange', () => setBatteryLevel(Math.round(bat.level * 100)));
        bat.addEventListener('chargingchange', () => {
          setIsCharging(bat.charging);
          triggerTransientAlert('charging', 2500);
        });
      });
    }

    if (!window.electronAPI) return;

    window.electronAPI.readClipboard().then((clipRes) => {
      if (!clipRes) return;
      const isObj = typeof clipRes === 'object';
      const content = isObj ? clipRes.content : String(clipRes);
      if (content && content.trim().length > 0) {
        saveShelfItems((prev) => {
          if (prev.some((x) => x.content === content)) return prev;
          return [
            {
              id: 'clip-init-' + Date.now(),
              type: isObj ? clipRes.type || 'text' : 'text',
              title: isObj ? clipRes.title || 'Windows Clipboard' : 'Windows Clipboard',
              preview: isObj ? clipRes.preview || content.slice(0, 140) : content.trim().slice(0, 140),
              content: content.slice(0, 8000),
              filePath: isObj ? clipRes.filePath : undefined,
              timestamp: 'Active'
            },
            ...prev
          ];
        });
      }
    });

    const unsubTelemetry = window.electronAPI.onSystemTelemetry((data) => {
      setTelemetry(data);
      const smtcPos = Number(data?.media?.positionSec || 0);
      if (smtcPos > 0 && Math.abs(smtcPos - lastSmtcPosRef.current) >= 1.15) {
        lastSmtcPosRef.current = smtcPos;
        setLivePosSec(smtcPos);
      }
    });

    const unsubOutsideClick = window.electronAPI.onOutsideClick(() => {
      if (isDraggingOutRef.current) return;
      setIsExpanded(false);
      setShowSettingsPanel(false);
    });

    const applyIncomingNotifs = (data) => {
      if (!data) return;
      setNotifData((prev) => {
        const incomingList = Array.isArray(data.notifications) ? data.notifications : [];
        const merged = [...incomingList];
        for (const oldItem of prev.notifications || []) {
          if (
            !merged.some(
              (x) => x.id === oldItem.id || (x.title === oldItem.title && x.body === oldItem.body)
            )
          ) {
            merged.push(oldItem);
          }
        }
        const next = {
          whatsappUnread:
            typeof data.whatsappUnread === 'number' ? data.whatsappUnread : prev.whatsappUnread,
          notifications: merged.slice(0, 25)
        };
        try {
          localStorage.setItem('ios27_notif_history', JSON.stringify(next));
        } catch (_e) {}
        return next;
      });
    };

    if (window.electronAPI.getNotifications) {
      window.electronAPI.getNotifications().then(applyIncomingNotifs);
    }

    const unsubNotifs = window.electronAPI.onNotificationsUpdate(applyIncomingNotifs);

    const unsubNewNotif = window.electronAPI.onNewNotification((item) => {
      if (item) {
        const brandTheme = getNotificationBrandTheme(item);
        triggerBrandFlash(brandTheme.color, item.isCall ? 6500 : 4800);
        setBannerNotif(item);
        triggerTransientAlert('notif', item.isCall ? 6500 : 4500);
      }
    });

    const unsubDownloads = window.electronAPI.onDownloadsUpdate((data) => {
      if (data) setDownloadsData(data);
    });

    const unsubClipboard = window.electronAPI.onClipboardUpdate((item) => {
      saveShelfItems((prev) => {
        const filtered = prev.filter((x) => x.content !== item.content);
        return [item, ...filtered.slice(0, 19)];
      });
      triggerTransientAlert('clipboard', 1800);
    });

    const unsubPower = window.electronAPI.onPowerStatus(({ charging }) => {
      setIsCharging(charging);
      triggerTransientAlert('charging', 2500);
    });

    const unsubShortcut = window.electronAPI.onGlobalShortcut((action) => {
      if (action === 'toggle-expand') {
        soundEngine.playHapticTap();
        setIsExpanded((p) => !p);
      } else if (action === 'open-notifications') {
        soundEngine.playHapticTap();
        selectPage('notifications');
        setIsExpanded(true);
      } else if (action === 'open-settings') {
        soundEngine.playHapticTap();
        setShowSettingsPanel(true);
        setIsExpanded(true);
      } else if (action === 'open-shelf') {
        soundEngine.playHapticTap();
        selectPage('shelf');
        setIsExpanded(true);
      }
    });

    return () => {
      unsubTelemetry && unsubTelemetry();
      unsubOutsideClick && unsubOutsideClick();
      unsubNotifs && unsubNotifs();
      unsubNewNotif && unsubNewNotif();
      unsubDownloads && unsubDownloads();
      unsubClipboard && unsubClipboard();
      unsubPower && unsubPower();
      unsubShortcut && unsubShortcut();
    };
  }, []);

  // Fetch Real Synced Lyrics + High-Res Base64 Album Cover Photo
  useEffect(() => {
    if (!media.hasMedia || !media.title) {
      setTrackExtras({ cleanTitle: '', cleanArtist: '', coverUrl: '', durationSec: 0, lyrics: [] });
      lastFetchedSongKeyRef.current = '';
      setLivePosSec(0);
      lastSmtcPosRef.current = 0;
      return;
    }

    const songKey = `${media.title}|${media.artist}`;
    if (songKey === lastFetchedSongKeyRef.current) return;
    lastFetchedSongKeyRef.current = songKey;

    setLivePosSec(media.positionSec || 0);
    lastSmtcPosRef.current = media.positionSec || 0;

    if (window.electronAPI?.fetchTrackExtras) {
      setLyricsLoading(true);
      window.electronAPI.fetchTrackExtras(media.title, media.artist).then((res) => {
        if (res) {
          setTrackExtras(res);
          if (settings.autoShowLyrics && Array.isArray(res.lyrics) && res.lyrics.length > 0) {
            setShowLyrics(true);
          }
        }
        setLyricsLoading(false);
      });
    }
  }, [media.hasMedia, media.title, media.artist, settings.autoShowLyrics]);

  // High-precision 250ms lyric & clock timer + Timer Completed notification alert
  useEffect(() => {
    const fastTickNeeded = Boolean(media.playing || timerRunning || isExpanded);
    const intervalMs = fastTickNeeded ? 250 : 10000;
    const stepSec = intervalMs / 1000;

    const timer = setInterval(() => {
      setNowDate(new Date());

      if (media.playing) {
        setLivePosSec((prev) => {
          const maxDur = effectiveDuration > 0 ? effectiveDuration : 3600;
          return prev + stepSec <= maxDur ? Number((prev + stepSec).toFixed(2)) : 0;
        });
      }

      if (timerRunning && fastTickNeeded) {
        setTimerRemaining((rem) => {
          if (rem <= stepSec) {
            setTimerRunning(false);
            const timerNotif = {
              id: 'timer-done-' + Date.now(),
              appName: 'Clock • Timer',
              title: 'Timer Completed ⏰',
              body: `Your ${formatTime(timerTotal)} countdown has finished!`,
              subText: 'ORBIT Alarm',
              timeLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isTimer: true,
              brandColor: '#FF9F0A'
            };
            setNotifData((prev) => {
              const next = {
                ...prev,
                notifications: [timerNotif, ...(prev.notifications || []).slice(0, 24)]
              };
              try {
                localStorage.setItem('ios27_notif_history', JSON.stringify(next));
              } catch (_e) {}
              return next;
            });
            setBannerNotif(timerNotif);
            setIsExpanded(false);
            triggerBrandFlash('#FF9F0A', 6500);
            triggerTransientAlert('notif', 6500);
            return 0;
          }
          return Number((rem - stepSec).toFixed(2));
        });
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [media.playing, timerRunning, isExpanded, effectiveDuration, timerTotal]);

  const activeLyricIndex = useMemo(() => {
    if (!syncedLyrics.length) return 0;
    const calibratedPos = Math.max(0, livePosSec - lyricOffsetSec);
    let idx = 0;
    for (let i = 0; i < syncedLyrics.length; i++) {
      if (calibratedPos >= syncedLyrics[i].time) idx = i;
      else break;
    }
    return idx;
  }, [syncedLyrics, livePosSec, lyricOffsetSec]);

  // Island Dimensions (Without the top quick-access bar, heights are sleeker and more compact!)
  const islandDimensions = useMemo(() => {
    if (isDraggingOver) {
      return { width: 396, height: 108, borderRadius: 36 };
    }
    if (activeWhatsAppCall && !isExpanded) {
      return { width: 356, height: 52, borderRadius: 26 };
    }
    if (transientAlert === 'bluetooth' && !isExpanded) {
      return { width: 396, height: 76, borderRadius: 34 };
    }
    if (transientAlert && !isExpanded) {
      return { width: 372, height: 58, borderRadius: 29 };
    }
    if (isExpanded) {
      if (showSettingsPanel) {
        return { width: 416, height: 306, borderRadius: 38 };
      }
      switch (activePage) {
        case 'media':
          return showLyrics
            ? { width: 416, height: 268, borderRadius: 38 }
            : { width: 408, height: 182, borderRadius: 38 };
        case 'bluetooth':
          return { width: 416, height: 248, borderRadius: 38 };
        case 'notifications':
          return { width: 416, height: 236, borderRadius: 38 };
        case 'shelf':
          return { width: 416, height: 238, borderRadius: 38 };
        case 'apps':
          return { width: 416, height: 218, borderRadius: 38 };
        case 'tools':
          return { width: 416, height: 196, borderRadius: 38 };
        case 'downloads':
          return { width: 416, height: 224, borderRadius: 38 };
        case 'controls':
          return { width: 408, height: 196, borderRadius: 38 };
        case 'clock':
          return { width: 416, height: 222, borderRadius: 38 };
        case 'system':
          return { width: 416, height: 218, borderRadius: 38 };
        default:
          return { width: 412, height: 204, borderRadius: 38 };
      }
    }

    // Small Clickable Bar when a Fullscreen App is Active
    if (isFullscreenApp) {
      if (settings.fullscreenBarType === 'mini-hud') {
        return {
          width: isHovered ? 156 : 142,
          height: 22,
          borderRadius: 11
        };
      }
      if (settings.fullscreenBarType === 'stealth-edge') {
        return {
          width: isHovered ? 142 : 122,
          height: isHovered ? 10 : 6,
          borderRadius: 99
        };
      }
      // Default: 'ios-handle' (Sleek clickable iOS top handle bar)
      return {
        width: isHovered ? 138 : 118,
        height: isHovered ? 13 : 9,
        borderRadius: 99
      };
    }

    const hasPlayingSong = Boolean(media.hasMedia && displayTitle);
    const baseW = hasPlayingSong ? 320 : 216;
    const baseH = 36;
    return {
      width: isHovered ? baseW + 8 : baseW,
      height: baseH,
      borderRadius: 18
    };
  }, [
    isDraggingOver,
    activeWhatsAppCall,
    transientAlert,
    isExpanded,
    showSettingsPanel,
    activePage,
    showLyrics,
    isFullscreenApp,
    settings.fullscreenBarType,
    media.hasMedia,
    displayTitle,
    isHovered
  ]);

  useEffect(() => {
    if (window.electronAPI?.setIslandBounds) {
      window.electronAPI.setIslandBounds({
        width: islandDimensions.width,
        height: islandDimensions.height
      });
    }
  }, [islandDimensions.width, islandDimensions.height]);

  // Native Drag-and-Drop Handlers (Flicker-Free & Electron 33 webUtils File Path Support)
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDraggingOutRef.current) return;
    if (dragLeaveTimerRef.current) {
      clearTimeout(dragLeaveTimerRef.current);
      dragLeaveTimerRef.current = null;
    }
    if (!isDraggingOver) {
      setIsDraggingOver(true);
      soundEngine.playHapticTap(210, 0.02);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDraggingOutRef.current) return;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    if (dragLeaveTimerRef.current) {
      clearTimeout(dragLeaveTimerRef.current);
      dragLeaveTimerRef.current = null;
    }
    if (!isDraggingOver) {
      setIsDraggingOver(true);
      soundEngine.playHapticTap(210, 0.02);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) {
      return;
    }
    if (dragLeaveTimerRef.current) clearTimeout(dragLeaveTimerRef.current);
    dragLeaveTimerRef.current = setTimeout(() => {
      setIsDraggingOver(false);
    }, 110);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragLeaveTimerRef.current) {
      clearTimeout(dragLeaveTimerRef.current);
      dragLeaveTimerRef.current = null;
    }
    setIsDraggingOver(false);
    if (isDraggingOutRef.current) {
      isDraggingOutRef.current = false;
      return;
    }
    soundEngine.playSuccessChime();

    const newItems = [];
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach((file) => {
        const fullPath =
          (window.electronAPI?.getPathForFile && window.electronAPI.getPathForFile(file)) ||
          file.path ||
          file.name;
        newItems.push({
          id: 'file-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          type: 'file',
          title: `${file.name} (${formatBytes(file.size)})`,
          preview: fullPath,
          content: fullPath,
          filePath: fullPath,
          timestamp: nowStr
        });
      });
      if (newItems[0]?.content) {
        window.electronAPI?.writeClipboard({
          type: newItems[0].type,
          content: newItems[0].content,
          filePath: newItems[0].filePath
        });
      }
    }

    const droppedText =
      e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    if (droppedText && droppedText.trim().length > 0 && newItems.length === 0) {
      const cleanTxt = droppedText.trim();
      newItems.push({
        id: 'txt-' + Date.now(),
        type: 'text',
        title: 'Dropped Text',
        preview: cleanTxt.replace(/\s+/g, ' ').slice(0, 140),
        content: cleanTxt,
        timestamp: nowStr
      });
      window.electronAPI?.writeClipboard({ type: 'text', content: cleanTxt });
    }

    if (newItems.length > 0) {
      saveShelfItems((prev) => {
        const filtered = prev.filter((x) => !newItems.some((n) => n.content === x.content));
        return [...newItems, ...filtered.slice(0, 19)];
      });
    }
    selectPage('shelf');
    setIsExpanded(true);
  };

  // Copy & Paste Actions
  const handleCopyItem = async (item) => {
    soundEngine.playHapticTap(210, 0.025);
    if (window.electronAPI?.writeClipboard) {
      await window.electronAPI.writeClipboard({
        type: item.type,
        content: item.content,
        filePath: item.filePath || (item.type === 'file' ? item.content : '')
      });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(item.content);
    }
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handlePasteToActiveApp = async (item) => {
    soundEngine.playHapticTap(230, 0.03);
    setPastedId(item.id);
    setIsExpanded(false);
    setTimeout(() => {
      setPastedId(null);
    }, 600);
    if (window.electronAPI?.pasteToActiveWindow) {
      await window.electronAPI.pasteToActiveWindow({
        type: item.type,
        content: item.content,
        filePath: item.filePath || (item.type === 'file' ? item.content : '')
      });
    }
  };

  const handleGrabWindowsClipboard = async () => {
    soundEngine.playHapticTap();
    if (window.electronAPI?.readClipboard) {
      const clipRes = await window.electronAPI.readClipboard();
      if (clipRes) {
        const isObj = typeof clipRes === 'object';
        const content = isObj ? clipRes.content : String(clipRes);
        if (content && content.trim()) {
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          saveShelfItems((prev) => {
            const filtered = prev.filter((x) => x.content !== content.trim());
            return [
              {
                id: 'grab-' + Date.now(),
                type: isObj ? clipRes.type || 'text' : 'text',
                title: isObj ? clipRes.title || 'From Windows Clipboard' : 'From Windows Clipboard',
                preview: isObj
                  ? clipRes.preview || content.trim().slice(0, 140)
                  : content.trim().slice(0, 140),
                content: content.trim(),
                filePath: isObj ? clipRes.filePath : undefined,
                timestamp: nowStr
              },
              ...filtered
            ];
          });
        }
      }
    }
  };

  // ==========================================================================
  // MINIMIZED BAR (No Camera Lenses! Clean Date/Time or Live Music + Album Art)
  // ==========================================================================
  const renderMinimizedBar = () => {
    const timeStr = nowDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = nowDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const hasMedia = Boolean(media.hasMedia && displayTitle);

    // Small Clickable Bar when a Fullscreen App is Active
    if (isFullscreenApp) {
      if (settings.fullscreenBarType === 'mini-hud') {
        return (
          <div
            title="Click to expand ORBIT"
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 10px',
              gap: 6
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
              {hasMedia && media.playing ? (
                <AppleWaveform playing={true} colors={albumPalette.waveColors} size="compact" />
              ) : notifData.whatsappUnread > 0 ? (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#25D366',
                    flexShrink: 0
                  }}
                />
              ) : (
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#0A84FF',
                    flexShrink: 0
                  }}
                />
              )}
              {hasMedia ? (
                <span
                  style={{
                    color: '#FFFFFF',
                    fontSize: 10,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 64
                  }}
                >
                  {displayTitle}
                </span>
              ) : null}
            </div>
            <span
              style={{
                color: '#FFFFFF',
                fontSize: 10,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0
              }}
            >
              {timeStr}
            </span>
          </div>
        );
      }

      if (settings.fullscreenBarType === 'stealth-edge') {
        return (
          <div
            title="Click to expand ORBIT"
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isHovered ? 1 : 0.42,
              transition: 'opacity 0.2s ease'
            }}
          >
            <div
              style={{
                width: isHovered ? '72%' : '55%',
                height: 2,
                borderRadius: 99,
                background: isHovered ? '#0A84FF' : 'rgba(255,255,255,0.55)',
                transition: 'all 0.2s ease'
              }}
            />
          </div>
        );
      }

      // Default: 'ios-handle' (Sleek iOS Home-Indicator style small clickable bar)
      return (
        <div
          title="Click to expand ORBIT"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '0 8px'
          }}
        >
          <div
            style={{
              flex: 1,
              height: isHovered ? 4 : 3,
              borderRadius: 99,
              background:
                hasMedia && media.playing
                  ? albumPalette.vibrant
                  : isHovered
                    ? '#FFFFFF'
                    : 'rgba(255, 255, 255, 0.65)',
              transition: 'all 0.2s ease'
            }}
          />
          {notifData.whatsappUnread > 0 && (
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#25D366',
                flexShrink: 0
              }}
            />
          )}
        </div>
      );
    }

    return (
      <div
        className="smooth-color-surface"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 13px',
          gap: 10,
          '--album-c1': flashBrandColor
            ? `${flashBrandColor}42`
            : hasMedia && media.playing
              ? albumPalette.islandGlow
              : 'rgba(0, 0, 0, 0)',
          '--album-c2': flashBrandColor
            ? 'rgba(0, 0, 0, 0)'
            : hasMedia && media.playing
              ? albumPalette.secondaryGlow || 'rgba(0, 0, 0, 0)'
              : 'rgba(0, 0, 0, 0)',
          background:
            'linear-gradient(90deg, var(--album-c1) 0%, var(--album-c2) 36%, transparent 76%)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          {hasMedia ? (
            <>
              {activeCoverPhoto ? (
                <img
                  src={activeCoverPhoto}
                  alt="Cover"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    objectFit: 'cover',
                    flexShrink: 0,
                    border: '1px solid rgba(255, 255, 255, 0.14)'
                  }}
                />
              ) : (
                <DefaultSystemMediaArt size={22} playing={media.playing} />
              )}
              <AppleWaveform
                playing={Boolean(media.playing)}
                colors={albumPalette.waveColors}
                size="compact"
              />
              <span
                style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1
                }}
              >
                {displayTitle}
                {displayArtist ? (
                  <span style={{ color: 'rgba(235,235,245,0.6)', fontWeight: 500 }}>
                    {' '}
                    • {displayArtist}
                  </span>
                ) : null}
              </span>
            </>
          ) : downloadsData.activeDownload ? (
            <>
              <Download size={13} color="#0A84FF" style={{ flexShrink: 0 }} />
              <span
                style={{
                  color: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {downloadsData.activeDownload.name} ({formatRate(downloadsData.activeDownload.speedBps)})
              </span>
            </>
          ) : settings.idleBarMode === 'system' ? (
            <>
              <Cpu size={13} color="#BF5AF2" style={{ flexShrink: 0 }} />
              <span style={{ color: '#FFFFFF', fontSize: 11.5, fontWeight: 600 }}>
                CPU {telemetry.cpuPct}% • RAM {telemetry.memPct}%
              </span>
            </>
          ) : settings.idleBarMode === 'battery' ? (
            <>
              <IosBatteryIcon level={batteryLevel} charging={isCharging} />
              <span style={{ color: '#30D158', fontSize: 11.5, fontWeight: 700 }}>{batteryLevel}%</span>
            </>
          ) : (
            <>
              <span style={{ color: 'rgba(235,235,245,0.78)', fontSize: 11.5, fontWeight: 600 }}>
                {dateStr}
              </span>
              {notifData.whatsappUnread > 0 ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    soundEngine.playHapticTap();
                    selectPage('notifications');
                    setIsExpanded(true);
                  }}
                  title="Click to view WhatsApp & Laptop notifications"
                  style={{
                    padding: '1px 6px',
                    borderRadius: 99,
                    background: 'rgba(37, 211, 102, 0.2)',
                    color: '#25D366',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  WA {notifData.whatsappUnread}
                </span>
              ) : (notifData.notifications || []).length > 0 ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    soundEngine.playHapticTap();
                    selectPage('notifications');
                    setIsExpanded(true);
                  }}
                  title="Click to view Laptop notifications"
                  style={{
                    padding: '1px 6px',
                    borderRadius: 99,
                    background: 'rgba(10, 132, 255, 0.22)',
                    color: '#64D2FF',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {(notifData.notifications || []).length} Alerts
                </span>
              ) : null}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          {timerRunning && (
            <span
              style={{
                color: '#FF9F0A',
                fontSize: 11.5,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {formatTime(timerRemaining)}
            </span>
          )}
          <span
            style={{
              color: '#FFFFFF',
              fontSize: 11.5,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {timeStr}
          </span>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // SUBTLE BOTTOM PAGE DOTS & SETTINGS BUTTON (No Quick Access Bar on Top!)
  // ==========================================================================
  const renderBottomFooterDots = () => {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 6,
          marginTop: 4
        }}
      >
        <span
          style={{
            color: 'rgba(235,235,245,0.45)',
            fontSize: 10,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {nowDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>

        {/* Minimal iOS Page Dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {enabledPages.map((p) => {
            const active = !showSettingsPanel && p.id === activePage;
            return (
              <button
                key={p.id}
                onClick={() => {
                  soundEngine.playHapticTap(185, 0.02);
                  selectPage(p.id);
                }}
                title={p.label}
                style={{
                  width: active ? 14 : 5,
                  height: 5,
                  borderRadius: 99,
                  border: 'none',
                  padding: 0,
                  background: active ? '#FFFFFF' : 'rgba(255,255,255,0.24)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
              />
            );
          })}
        </div>

        {/* Tiny Settings Gear */}
        <button
          onClick={() => {
            soundEngine.playHapticTap();
            setShowSettingsPanel((s) => !s);
          }}
          title="Settings & Pin Pages"
          style={{
            background: 'transparent',
            border: 'none',
            color: showSettingsPanel ? '#0A84FF' : 'rgba(255,255,255,0.45)',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            padding: 2
          }}
        >
          <SettingsIcon size={12} />
        </button>
      </div>
    );
  };

  // ==========================================================================
  // SETTINGS PANEL
  // ==========================================================================
  const renderSettingsPanel = () => {
    return (
      <motion.div
        key="settings-panel"
        {...PAGE_TRANSITION}
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 5
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {[
            { key: 'autoExpandOnHover', label: 'Auto-Expand on Cursor', desc: 'Open when hovering bar' },
            { key: 'autoMinimizeOnLeave', label: 'Auto-Minimize to Bar', desc: 'Close when cursor leaves' },
            { key: 'rememberLastTab', label: 'Show Last Visited Tab', desc: 'Remember active page' },
            { key: 'autoShowLyrics', label: 'Auto-Show Lyrics', desc: 'Open lyrics with music' }
          ].map((opt) => {
            const on = Boolean(settings[opt.key]);
            return (
              <div
                key={opt.key}
                onClick={() => {
                  soundEngine.playHapticTap();
                  updateSettings({ [opt.key]: !on });
                }}
                style={{
                  padding: '6px 9px',
                  borderRadius: 10,
                  background: on ? 'rgba(10, 132, 255, 0.2)' : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${on ? 'rgba(10, 132, 255, 0.5)' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 700 }}>{opt.label}</div>
                  <div style={{ color: 'rgba(235,235,245,0.5)', fontSize: 9.5 }}>{opt.desc}</div>
                </div>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: on ? '#0A84FF' : 'rgba(255,255,255,0.16)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {on && <Check size={10} color="#FFFFFF" />}
                </div>
              </div>
            );
          })}
        </div>

        <div
          onClick={toggleAutoStart}
          style={{
            padding: '6px 9px',
            borderRadius: 10,
            background: autoStartOn ? 'rgba(48, 209, 88, 0.18)' : 'rgba(255,255,255,0.07)',
            border: `1px solid ${autoStartOn ? 'rgba(48, 209, 88, 0.5)' : 'rgba(255,255,255,0.08)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div>
            <div style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 700 }}>Start ORBIT with Windows</div>
            <div style={{ color: 'rgba(235,235,245,0.5)', fontSize: 9.5 }}>
              Launch silently in the tray when you sign in
            </div>
          </div>
          <div
            style={{
              width: 30,
              height: 18,
              borderRadius: 99,
              background: autoStartOn ? '#30D158' : 'rgba(255,255,255,0.18)',
              position: 'relative',
              transition: 'background 0.2s ease',
              flexShrink: 0
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                left: autoStartOn ? 14 : 2,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#FFFFFF',
                transition: 'left 0.2s ease'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(235,235,245,0.65)', fontSize: 10.5, fontWeight: 700 }}>
            IDLE MINIMIZED BAR:
          </span>
          <div style={{ display: 'flex', gap: 5 }}>
            {[
              { id: 'datetime', label: 'Date & Time' },
              { id: 'battery', label: 'Battery & Time' },
              { id: 'system', label: 'CPU/RAM & Time' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  soundEngine.playHapticTap();
                  updateSettings({ idleBarMode: m.id });
                }}
                style={{
                  padding: '3px 8px',
                  borderRadius: 99,
                  border: 'none',
                  background: settings.idleBarMode === m.id ? '#0A84FF' : 'rgba(255,255,255,0.1)',
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'rgba(235,235,245,0.65)', fontSize: 10.5, fontWeight: 700 }}>
            FULLSCREEN APP BAR:
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'ios-handle', label: 'iOS Handle' },
              { id: 'mini-hud', label: 'Mini Pill' },
              { id: 'stealth-edge', label: 'Stealth Line' },
              { id: 'normal', label: 'Standard' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  soundEngine.playHapticTap();
                  updateSettings({ fullscreenBarType: m.id });
                }}
                style={{
                  padding: '3px 7px',
                  borderRadius: 99,
                  border: 'none',
                  background:
                    (settings.fullscreenBarType || 'ios-handle') === m.id
                      ? '#30D158'
                      : 'rgba(255,255,255,0.1)',
                  color:
                    (settings.fullscreenBarType || 'ios-handle') === m.id
                      ? '#000000'
                      : '#FFFFFF',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div
            style={{
              color: 'rgba(235,235,245,0.6)',
              fontSize: 10,
              fontWeight: 700,
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Pin size={10} color="#0A84FF" />
            <span>PIN PAGES SHOWN ON ORBIT:</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {ALL_PAGES.map((p) => {
              const pinned = settings.pinnedPages.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePinnedPage(p.id)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 99,
                    border: `1px solid ${pinned ? '#30D158' : 'rgba(255,255,255,0.15)'}`,
                    background: pinned ? 'rgba(48, 209, 88, 0.18)' : 'rgba(255,255,255,0.06)',
                    color: pinned ? '#30D158' : 'rgba(235,235,245,0.45)',
                    fontSize: 10.5,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {pinned ? '✓ ' : '+ '}
                  {p.short}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>
    );
  };

  // ==========================================================================
  // EXPANDED PAGES
  // ==========================================================================
  const renderExpandedPage = () => {
    if (showSettingsPanel) {
      return renderSettingsPanel();
    }

    // 1. MUSIC & SPOTIFY-COLORED SYNCED LYRICS
    if (activePage === 'media') {
      const hasMedia = Boolean(media.hasMedia && displayTitle);
      const pos = Math.floor(livePosSec || 0);
      const dur = Math.floor(effectiveDuration || 0);
      const progressPct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;

      return (
        <motion.div
          key="page-media"
          {...PAGE_TRANSITION}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
              {activeCoverPhoto ? (
                <img
                  src={activeCoverPhoto}
                  alt="Album Art"
                  style={{
                    width: showLyrics ? 44 : 52,
                    height: showLyrics ? 44 : 52,
                    borderRadius: 11,
                    objectFit: 'cover',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    flexShrink: 0
                  }}
                />
              ) : (
                <DefaultSystemMediaArt size={showLyrics ? 44 : 52} playing={media.playing} />
              )}

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    color: '#FFFFFF',
                    fontSize: 14.5,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {hasMedia ? displayTitle : 'No Media Playing on PC'}
                </div>
                <div
                  style={{
                    color: 'rgba(235, 235, 245, 0.72)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: 1
                  }}
                >
                  {hasMedia
                    ? `${displayArtist || 'Unknown Artist'} • ${formatAppBadge(media.sourceApp)}`
                    : 'Play a song in Spotify, YouTube, or YouTube Music'}
                </div>
              </div>
            </div>

            <AppleWaveform
              playing={Boolean(media.playing)}
              colors={albumPalette.waveColors}
              size="large"
            />
          </div>

          {showLyrics && (
            <div
              className="smooth-color-surface"
              style={{
                height: 100,
                overflow: 'hidden',
                position: 'relative',
                margin: '4px 0',
                padding: '8px 12px',
                borderRadius: 14,
                '--lyric-c1': hasMedia ? albumPalette.lyricBgTop : 'rgba(255, 255, 255, 0.05)',
                '--lyric-c2': hasMedia ? albumPalette.lyricBgBottom : 'rgba(255, 255, 255, 0.05)',
                background: 'linear-gradient(140deg, var(--lyric-c1) 0%, var(--lyric-c2) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >

              {!hasMedia ? (
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, paddingTop: 30, textAlign: 'center' }}>
                  Play any song on Spotify or YouTube to see album-colored live lyrics
                </div>
              ) : lyricsLoading ? (
                <div style={{ color: '#FFFFFF', fontSize: 12, paddingTop: 30, textAlign: 'center', fontWeight: 600 }}>
                  Syncing lyrics & album colors for "{displayTitle}"...
                </div>
              ) : syncedLyrics.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, paddingTop: 30, textAlign: 'center' }}>
                  No lyrics found for "{displayTitle}"
                </div>
              ) : (
                <motion.div
                  animate={{ y: -(activeLyricIndex * 24) + 28 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                >
                  {syncedLyrics.map((line, i) => {
                    const isCurrent = i === activeLyricIndex;
                    const isPast = i < activeLyricIndex;
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          soundEngine.playHapticTap();
                          setLivePosSec(line.time);
                          window.electronAPI?.mediaControl('seek', line.time);
                        }}
                        style={{
                          color: isCurrent
                            ? '#FFFFFF'
                            : isPast
                              ? 'rgba(255, 255, 255, 0.42)'
                              : 'rgba(0, 0, 0, 0.55)',
                          textShadow: isCurrent ? '0 1px 8px rgba(0,0,0,0.35)' : 'none',
                          fontSize: isCurrent ? 14 : 12.5,
                          fontWeight: isCurrent ? 800 : 700,
                          lineHeight: '20px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {line.text}
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                color: 'rgba(235,235,245,0.6)',
                fontSize: 11,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                width: 32
              }}
            >
              {formatTime(pos)}
            </span>
            <div
              onClick={(e) => {
                if (dur <= 0) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const targetSec = Math.round(pct * dur);
                soundEngine.playHapticTap();
                setLivePosSec(targetSec);
                window.electronAPI?.mediaControl('seek', targetSec);
              }}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 99,
                background: 'rgba(255,255,255,0.18)',
                cursor: dur > 0 ? 'pointer' : 'default',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  borderRadius: 99,
                  background: hasMedia ? albumPalette.vibrant : '#FFFFFF',
                  transition: 'width 0.3s linear, background 0.4s ease'
                }}
              />
            </div>
            <span
              style={{
                color: 'rgba(235,235,245,0.6)',
                fontSize: 11,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                width: 36,
                textAlign: 'right'
              }}
            >
              {dur > 0 ? `-${formatTime(Math.max(0, dur - pos))}` : '0:00'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px' }}>
            <button
              onClick={() => {
                soundEngine.playHapticTap();
                setShowLyrics((v) => !v);
              }}
              title="Toggle Lyrics"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: 'none',
                background: showLyrics ? albumPalette.vibrant : 'rgba(255,255,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <LyricsBubbleIcon active={showLyrics} size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
              <button
                onClick={() => {
                  soundEngine.playHapticTap();
                  window.electronAPI?.mediaControl('prev');
                }}
                style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'flex' }}
              >
                <SkipBack size={19} fill="#FFFFFF" />
              </button>

              <button
                onClick={() => {
                  soundEngine.playHapticTap(200, 0.03);
                  window.electronAPI?.mediaControl('toggle');
                }}
                style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'flex' }}
              >
                {media.playing ? <Pause size={24} fill="#FFFFFF" /> : <Play size={24} fill="#FFFFFF" />}
              </button>

              <button
                onClick={() => {
                  soundEngine.playHapticTap();
                  window.electronAPI?.mediaControl('next');
                }}
                style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'flex' }}
              >
                <SkipForward size={19} fill="#FFFFFF" />
              </button>
            </div>

            <button
              onClick={() => selectPage(enabledPages.some((p) => p.id === 'bluetooth') ? 'bluetooth' : 'controls')}
              title={`Bluetooth & Sound Mix • Volume: ${telemetry.volume}%`}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.1)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {telemetry.muted ? <VolumeX size={14} color="#FF453A" /> : <Volume2 size={14} />}
            </button>
          </div>
        </motion.div>
      );
    }

    // 1.5 PREMIUM BLUETOOTH DEVICE, L/R/BOX BATTERY & SOUND MIX STUDIO
    if (activePage === 'bluetooth') {
      const dev = activeBtDevice || {
        id: 'bt-default',
        name: 'soundcore Liberty 4 NC',
        connected: true,
        leftBattery: 100,
        rightBattery: 100,
        caseBattery: 95
      };

      const cycleBtDevice = () => {
        soundEngine.playHapticTap();
        if (btDevices.length <= 1) return;
        const idx = btDevices.findIndex((d) => d.id === dev.id);
        const nextDev = btDevices[(idx + 1) % btDevices.length];
        setSelectedBtId(nextDev.id);
      };

      return (
        <motion.div
          key="page-bluetooth"
          {...PAGE_TRANSITION}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 6
          }}
        >
          {/* Top Row: Animated Earbuds & Charging Box Graphic + Device Name + Settings */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <AnimatedEarbudsAndBox
                size="normal"
                accentColor={dev.connected ? '#0A84FF' : '#64D2FF'}
                connected={Boolean(dev.connected)}
              />

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bluetooth size={13} color="#0A84FF" />
                  <span
                    style={{
                      color: dev.connected ? '#30D158' : '#64D2FF',
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px'
                    }}
                  >
                    {dev.connected ? 'Connected • Active Audio' : 'Paired Bluetooth Audio'}
                  </span>
                </div>

                <div
                  onClick={cycleBtDevice}
                  title="Click to switch paired Bluetooth / Audio device"
                  style={{
                    color: '#FFFFFF',
                    fontSize: 14.5,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    cursor: btDevices.length > 1 ? 'pointer' : 'default',
                    marginTop: 1
                  }}
                >
                  {dev.name}
                </div>

                <div style={{ color: 'rgba(235,235,245,0.6)', fontSize: 10.5, fontWeight: 600 }}>
                  {btListenMode === 'anc'
                    ? 'Adaptive ANC Active'
                    : btListenMode === 'transparency'
                      ? 'Transparency Mode'
                      : 'Normal Acoustic'}{' '}
                  • {btSoundPreset}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => triggerBluetoothConnectBanner(dev)}
                title="Preview Bluetooth Connection Popup Animation"
                style={{
                  padding: '4px 8px',
                  borderRadius: 99,
                  border: '1px solid rgba(10, 132, 255, 0.45)',
                  background: 'rgba(10, 132, 255, 0.2)',
                  color: '#64D2FF',
                  fontSize: 9.5,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Popup
              </button>
              <button
                onClick={() => {
                  soundEngine.playHapticTap();
                  window.electronAPI?.launchAppOrUrl('ms-settings:bluetooth');
                  setIsExpanded(false);
                }}
                title="Open Windows Bluetooth Settings"
                style={{
                  padding: '4px 8px',
                  borderRadius: 99,
                  border: 'none',
                  background: 'rgba(255,255,255,0.12)',
                  color: '#FFFFFF',
                  fontSize: 9.5,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                BT Settings
              </button>
            </div>
          </div>

          {/* Middle Row: Individual Battery of Left Earbud (L), Right Earbud (R), and Charging Box (CASE) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
            {[
              { tag: 'L', label: 'Left Bud', pct: dev.leftBattery ?? 100, color: '#30D158' },
              { tag: 'R', label: 'Right Bud', pct: dev.rightBattery ?? 100, color: '#30D158' },
              { tag: 'BOX', label: 'Charging Case', pct: dev.caseBattery ?? 95, color: '#0A84FF' }
            ].map((bItem) => (
              <div
                key={bItem.tag}
                style={{
                  padding: '6px 9px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span
                      style={{
                        padding: '1px 5px',
                        borderRadius: 5,
                        background: `${bItem.color}28`,
                        color: bItem.color,
                        fontSize: 9,
                        fontWeight: 800
                      }}
                    >
                      {bItem.tag}
                    </span>
                    <span style={{ color: 'rgba(235,235,245,0.72)', fontSize: 10, fontWeight: 600 }}>
                      {bItem.label}
                    </span>
                  </div>
                  <span style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 800 }}>
                    {bItem.pct}%
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 4.5,
                    borderRadius: 99,
                    background: 'rgba(255,255,255,0.14)',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(8, Math.min(100, bItem.pct))}%`,
                      height: '100%',
                      borderRadius: 99,
                      background: bItem.color,
                      transition: 'width 0.35s ease'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Row: Listening Mode Settings (ANC / Transparency / Normal) & Sound Mix EQ Presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 99,
                  padding: 2,
                  gap: 2
                }}
              >
                {[
                  { id: 'anc', label: 'ANC On' },
                  { id: 'transparency', label: 'Transparency' },
                  { id: 'normal', label: 'Normal' }
                ].map((m) => {
                  const active = btListenMode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        soundEngine.playHapticTap();
                        setBtListenMode(m.id);
                        localStorage.setItem('ios27_bt_listen_mode', m.id);
                      }}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 99,
                        border: 'none',
                        background: active ? '#0A84FF' : 'transparent',
                        color: '#FFFFFF',
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {/* Sound Mix Output Volume Mini Slider */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(255,255,255,0.07)',
                  padding: '3px 8px',
                  borderRadius: 99
                }}
              >
                <Sliders size={11} color="#64D2FF" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={telemetry.volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTelemetry((p) => ({ ...p, volume: v, muted: false }));
                    window.electronAPI?.setVolume(v);
                  }}
                  style={{ flex: 1, accentColor: '#0A84FF', cursor: 'pointer', height: 4 }}
                />
                <span style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 700 }}>
                  {telemetry.volume}%
                </span>
              </div>
            </div>

            {/* Sound Mix EQ Presets */}
            <div style={{ display: 'flex', gap: 5 }}>
              {[
                { name: 'Spatial 3D', volBoost: null },
                { name: 'Bass Boost', volBoost: null },
                { name: 'Signature', volBoost: null },
                { name: 'Vocal Clear', volBoost: null }
              ].map((eq) => {
                const isSelected = btSoundPreset === eq.name;
                return (
                  <button
                    key={eq.name}
                    onClick={() => {
                      soundEngine.playHapticTap(210, 0.025);
                      setBtSoundPreset(eq.name);
                      localStorage.setItem('ios27_bt_sound_preset', eq.name);
                    }}
                    style={{
                      flex: 1,
                      padding: '4px 0',
                      borderRadius: 8,
                      border: `1px solid ${isSelected ? '#30D158' : 'rgba(255,255,255,0.1)'}`,
                      background: isSelected ? 'rgba(48, 209, 88, 0.18)' : 'rgba(255,255,255,0.05)',
                      color: isSelected ? '#30D158' : 'rgba(235,235,245,0.75)',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {eq.name}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      );
    }

    // 2. REAL WHATSAPP & LAPTOP NOTIFICATIONS (With App Brand Colors + Contact Profile Photo)
    if (activePage === 'notifications') {
      const list = notifData.notifications || [];
      return (
        <motion.div
          key="page-notifications"
          {...PAGE_TRANSITION}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageCircle size={15} color="#25D366" />
              <span style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: 700 }}>
                WhatsApp & Laptop Alerts
              </span>
              {notifData.whatsappUnread > 0 && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 99,
                    background: 'rgba(37, 211, 102, 0.2)',
                    color: '#25D366',
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  {notifData.whatsappUnread} Unread
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              {list.length > 0 && (
                <button
                  onClick={() => {
                    const cleared = { ...notifData, notifications: [] };
                    setNotifData(cleared);
                    window.electronAPI?.clearNotifications?.();
                    try {
                      localStorage.setItem('ios27_notif_history', JSON.stringify(cleared));
                    } catch (_e) {}
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 99,
                    border: 'none',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 10.5,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => {
                  soundEngine.playHapticTap();
                  window.electronAPI?.openExternalUrl('whatsapp://');
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 99,
                  border: 'none',
                  background: '#25D366',
                  color: '#000000',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Open WhatsApp
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto', paddingRight: 2 }}>
            {list.length === 0 ? (
              <div style={{ color: 'rgba(235,235,245,0.45)', fontSize: 12, textAlign: 'center', paddingTop: 42 }}>
                Incoming WhatsApp messages & laptop notifications will appear here automatically
              </div>
            ) : (
              list.map((item) => {
                const theme = getNotificationBrandTheme(item);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.isWhatsApp) window.electronAPI?.openExternalUrl('whatsapp://');
                      else if (item.isTimer) selectPage('clock');
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 12,
                      background: theme.tint,
                      borderLeft: `3.5px solid ${theme.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      cursor: item.isWhatsApp || item.isTimer ? 'pointer' : 'default'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                      {item.avatarUrl ? (
                        <img
                          src={item.avatarUrl}
                          alt=""
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flexShrink: 0,
                            border: `1.5px solid ${theme.color}`
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: `${theme.color}33`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {item.isTimer ? (
                            <Clock size={15} color={theme.color} />
                          ) : (
                            <MessageCircle size={15} color={theme.color} />
                          )}
                        </div>
                      )}

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: theme.color, fontSize: 10.5, fontWeight: 800 }}>
                            {item.appName}
                          </span>
                          <span style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </span>
                        </div>
                        {item.body && (
                          <div style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.body}
                          </div>
                        )}
                        {item.subText && (
                          <div style={{ color: 'rgba(235,235,245,0.55)', fontSize: 10.5 }}>
                            {item.subText}
                          </div>
                        )}
                      </div>
                    </div>
                    <span style={{ color: 'rgba(235,235,245,0.5)', fontSize: 10, flexShrink: 0 }}>
                      {item.timeLabel}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      );
    }

    // 3. COPY-PASTE CLIPBOARD & DRAG-AND-DROP SHELF
    if (activePage === 'shelf') {
      return (
        <motion.div
          key="page-shelf"
          {...PAGE_TRANSITION}
          onClick={(e) => e.stopPropagation()}
          onPaste={(e) => {
            const pastedTxt = e.clipboardData?.getData('text/plain');
            if (pastedTxt && pastedTxt.trim() && document.activeElement?.tagName !== 'INPUT') {
              e.preventDefault();
              const clean = pastedTxt.trim();
              const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              window.electronAPI?.writeClipboard({ type: 'text', content: clean });
              saveShelfItems((prev) => [
                {
                  id: 'paste-' + Date.now(),
                  type: 'text',
                  title: 'Pasted Snippet',
                  preview: clean.replace(/\s+/g, ' ').slice(0, 140),
                  content: clean,
                  timestamp: nowStr
                },
                ...prev.filter((x) => x.content !== clean)
              ]);
            }
          }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 6
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={manualClipInput}
              onFocus={() => window.electronAPI?.focusWindow?.()}
              onClick={() => window.electronAPI?.focusWindow?.()}
              onChange={(e) => setManualClipInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualClipInput.trim()) {
                  const text = manualClipInput.trim();
                  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  window.electronAPI?.writeClipboard({ type: 'text', content: text });
                  saveShelfItems((prev) => [
                    {
                      id: 'manual-' + Date.now(),
                      type: 'text',
                      title: 'Saved Snippet',
                      preview: text.slice(0, 140),
                      content: text,
                      timestamp: nowStr
                    },
                    ...prev.filter((x) => x.content !== text)
                  ]);
                  setManualClipInput('');
                }
              }}
              placeholder="Paste (Ctrl+V) or type text & press Enter..."
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.09)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 9,
                padding: '5px 10px',
                color: '#FFFFFF',
                fontSize: 11.5,
                outline: 'none',
                userSelect: 'text',
                WebkitUserSelect: 'text'
              }}
            />
            <button
              onClick={handleGrabWindowsClipboard}
              style={{
                padding: '5px 10px',
                borderRadius: 9,
                border: 'none',
                background: '#0A84FF',
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              + Paste Clipboard
            </button>
            {shelfItems.length > 0 && (
              <button
                onClick={() => saveShelfItems([])}
                style={{
                  padding: '5px 8px',
                  borderRadius: 9,
                  border: 'none',
                  background: 'rgba(255, 69, 58, 0.2)',
                  color: '#FF453A',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                Clear
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 150, overflowY: 'auto', paddingRight: 2 }}>
            {shelfItems.length === 0 ? (
              <div
                style={{
                  height: 126,
                  borderRadius: 12,
                  border: '1px dashed rgba(100, 210, 255, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  color: 'rgba(235,235,245,0.5)',
                  fontSize: 12
                }}
              >
                <Clipboard size={18} color="#64D2FF" />
                <span>Copy any text/file/image (Ctrl+C) or drag & drop here</span>
              </div>
            ) : (
              shelfItems.map((item) => {
                const isCopied = copiedId === item.id;
                const isPasted = pastedId === item.id;
                const isFile = item.type === 'file';
                const isImage = item.type === 'image' && item.content?.startsWith('data:image/');
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => {
                      isDraggingOutRef.current = true;
                      window.electronAPI?.setDraggingOut?.(true);
                      const fPath = item.filePath || (isFile ? item.content : '');
                      if (e.dataTransfer) {
                        e.dataTransfer.effectAllowed = 'copyMove';
                        e.dataTransfer.setData('text/plain', item.content || item.preview || '');
                      }
                      window.electronAPI?.startNativeFileDrag?.({
                        type: item.type,
                        content: item.content,
                        filePath: fPath,
                        title: item.title,
                        preview: item.preview
                      });
                    }}
                    onDragEnd={() => {
                      isDraggingOutRef.current = false;
                      window.electronAPI?.setDraggingOut?.(false);
                    }}
                    onClick={() => handleCopyItem(item)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 10,
                      background: isCopied || isPasted ? 'rgba(48, 209, 88, 0.2)' : 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      cursor: 'grab'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      {isImage ? (
                        <img
                          src={item.content}
                          alt="Clip"
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            objectFit: 'cover',
                            flexShrink: 0,
                            border: '1px solid rgba(255,255,255,0.2)'
                          }}
                        />
                      ) : null}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.preview}
                        </div>
                        <div style={{ color: 'rgba(235,235,245,0.45)', fontSize: 10 }}>
                          {item.title} • {item.timestamp}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      {isFile && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.electronAPI?.openPath(item.filePath || item.content);
                          }}
                          style={{
                            padding: '4px 7px',
                            borderRadius: 6,
                            border: 'none',
                            background: 'rgba(255, 214, 10, 0.2)',
                            color: '#FFD60A',
                            fontSize: 10.5,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Open
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyItem(item);
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: 'none',
                          background: isCopied ? '#30D158' : 'rgba(255,255,255,0.14)',
                          color: isCopied ? '#000000' : '#FFFFFF',
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {isCopied ? 'Copied!' : 'Copy'}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePasteToActiveApp(item);
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: 'none',
                          background: isPasted ? '#30D158' : 'rgba(10, 132, 255, 0.25)',
                          color: isPasted ? '#000000' : '#64D2FF',
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {isPasted ? 'Pasted!' : 'Paste ↵'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      );
    }

    // 4. APPS & INSTANT WEB LAUNCHER
    if (activePage === 'apps') {
      const quickApps = [
        { name: 'Spotify', target: 'spotify:', color: '#1DB954' },
        { name: 'YouTube', target: 'https://www.youtube.com', color: '#FF0000' },
        { name: 'YT Music', target: 'https://music.youtube.com', color: '#FF375F' },
        { name: 'WhatsApp', target: 'whatsapp:', color: '#25D366' },
        { name: 'Explorer', target: 'explorer', color: '#FFD60A' },
        { name: 'Task Mgr', target: 'taskmgr', color: '#0A84FF' },
        { name: 'Settings', target: 'ms-settings:', color: '#64D2FF' },
        { name: 'Calculator', target: 'calc', color: '#FF9F0A' }
      ];

      const handleSearchSubmit = () => {
        if (!searchQuery.trim()) return;
        const q = searchQuery.trim();
        const url =
          q.startsWith('http://') || q.startsWith('https://')
            ? q
            : q.includes('.') && !q.includes(' ')
              ? `https://${q}`
              : `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        window.electronAPI?.launchAppOrUrl(url);
        setSearchQuery('');
        setIsExpanded(false);
      };

      return (
        <motion.div
          key="page-apps"
          {...PAGE_TRANSITION}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <div
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.09)',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: 10,
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 7
              }}
            >
              <Search size={14} color="#0A84FF" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => window.electronAPI?.focusWindow?.()}
                onClick={() => window.electronAPI?.focusWindow?.()}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchSubmit();
                }}
                placeholder="Search Google or type URL & press Enter..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: 12,
                  outline: 'none',
                  userSelect: 'text',
                  WebkitUserSelect: 'text'
                }}
              />
            </div>
            <button
              onClick={handleSearchSubmit}
              style={{
                padding: '6px 12px',
                borderRadius: 10,
                border: 'none',
                background: '#0A84FF',
                color: '#FFFFFF',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Go
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
            {quickApps.map((appItem) => (
              <button
                key={appItem.name}
                onClick={() => {
                  soundEngine.playHapticTap();
                  window.electronAPI?.launchAppOrUrl(appItem.target);
                  setIsExpanded(false);
                }}
                style={{
                  padding: '10px 6px',
                  borderRadius: 12,
                  border: `1px solid ${appItem.color}44`,
                  background: 'rgba(255,255,255,0.07)',
                  color: '#FFFFFF',
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: appItem.color }} />
                <span>{appItem.name}</span>
              </button>
            ))}
          </div>
        </motion.div>
      );
    }

    // 5. SCREEN CAPTURE & QUICK CALCULATOR (Color Select Removed!)
    if (activePage === 'tools') {
      const evaluateMath = (val) => {
        setCalcExpr(val);
        if (!val.trim()) {
          setCalcResult('');
          return;
        }
        try {
          if (/^[0-9+\-*/().\s%^]+$/.test(val)) {
            // eslint-disable-next-line no-new-func
            const res = Function(`"use strict"; return (${val.replace(/\^/g, '**')})`)();
            if (typeof res === 'number' && Number.isFinite(res)) {
              setCalcResult(String(Number(res.toFixed(4))));
            }
          }
        } catch (_e) {}
      };

      return (
        <motion.div
          key="page-tools"
          {...PAGE_TRANSITION}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <button
            onClick={async () => {
              soundEngine.playSuccessChime();
              setScreenshotStatus('Capturing screen...');
              const res = await window.electronAPI?.captureScreenshot();
              if (res?.ok) {
                setScreenshotStatus('Copied to Clipboard & Saved to Screenshots!');
              } else {
                setScreenshotStatus('Capture Failed');
              }
              setTimeout(() => setScreenshotStatus(''), 2400);
            }}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 13,
              border: '1px solid rgba(10, 132, 255, 0.4)',
              background: 'rgba(10, 132, 255, 0.16)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Camera size={16} color="#0A84FF" />
            <span>{screenshotStatus || 'Capture Fullscreen Screenshot'}</span>
          </button>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 13,
              background: 'rgba(255,255,255,0.07)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10
            }}
          >
            <Calculator size={16} color="#FF9F0A" />
            <input
              type="text"
              value={calcExpr}
              onFocus={() => window.electronAPI?.focusWindow?.()}
              onClick={() => window.electronAPI?.focusWindow?.()}
              onChange={(e) => evaluateMath(e.target.value)}
              placeholder="Quick Math: e.g. 1450 * 1.18"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                fontSize: 12.5,
                outline: 'none',
                userSelect: 'text',
                WebkitUserSelect: 'text'
              }}
            />
            {calcResult && (
              <button
                onClick={() => {
                  soundEngine.playHapticTap();
                  window.electronAPI?.writeClipboard(calcResult);
                }}
                style={{
                  padding: '4px 9px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#30D158',
                  color: '#000000',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                = {calcResult}
              </button>
            )}
          </div>
        </motion.div>
      );
    }

    // 6. REAL WINDOWS DOWNLOADS FOLDER
    if (activePage === 'downloads') {
      const activeDl = downloadsData.activeDownload;
      const recent = downloadsData.recentFiles || [];

      return (
        <motion.div
          key="page-downloads"
          {...PAGE_TRANSITION}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Download size={14} color="#0A84FF" />
              <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 700 }}>
                {activeDl ? 'Active Download' : 'Downloads Folder'}
              </span>
            </div>

            <button
              onClick={() => {
                soundEngine.playHapticTap();
                if (downloadsData.downloadsPath) {
                  window.electronAPI?.openPath(downloadsData.downloadsPath);
                }
              }}
              style={{
                padding: '3px 9px',
                borderRadius: 99,
                border: 'none',
                background: 'rgba(10, 132, 255, 0.2)',
                color: '#64D2FF',
                fontSize: 11,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer'
              }}
            >
              <FolderOpen size={12} />
              Open Folder
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 146, overflowY: 'auto', paddingRight: 2 }}>
            {recent.length === 0 ? (
              <div style={{ color: 'rgba(235,235,245,0.45)', fontSize: 12, textAlign: 'center', paddingTop: 32 }}>
                No files in Downloads folder
              </div>
            ) : (
              recent.map((file) => (
                <div
                  key={file.fullPath}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.07)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.name}
                    </div>
                    <div style={{ color: 'rgba(235,235,245,0.45)', fontSize: 10 }}>
                      {formatBytes(file.sizeBytes)} • {new Date(file.mtimeMs).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <button
                      onClick={() => window.electronAPI?.openPath(file.fullPath)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 7,
                        border: 'none',
                        background: 'rgba(255,255,255,0.14)',
                        color: '#FFFFFF',
                        fontSize: 10.5,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Open
                    </button>
                    <button
                      onClick={() => window.electronAPI?.showInFolder(file.fullPath)}
                      style={{
                        padding: '4px 6px',
                        borderRadius: 7,
                        border: 'none',
                        background: 'rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.75)',
                        cursor: 'pointer',
                        display: 'flex'
                      }}
                    >
                      <FolderOpen size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      );
    }

    // 7. REAL AUDIO VOLUME, BRIGHTNESS & BATTERY
    if (activePage === 'controls') {
      return (
        <motion.div
          key="page-controls"
          {...PAGE_TRANSITION}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 700 }}>
                {isCharging ? 'AC Power Connected' : 'On Battery Power'}
              </div>
              <div style={{ color: '#30D158', fontSize: 11.5, fontWeight: 600 }}>
                Battery Level: {batteryLevel}%
              </div>
            </div>
            <IosBatteryIcon level={batteryLevel} charging={isCharging} size="large" />
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: 13,
              background: 'rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >
            <button
              onClick={() => {
                const nextMute = !telemetry.muted;
                setTelemetry((p) => ({ ...p, muted: nextMute }));
                window.electronAPI?.setMute(nextMute);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: telemetry.muted ? '#FF453A' : '#FFFFFF',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              {telemetry.muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={telemetry.volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTelemetry((p) => ({ ...p, volume: v, muted: false }));
                window.electronAPI?.setVolume(v);
              }}
              style={{ flex: 1, accentColor: '#FFFFFF', cursor: 'pointer' }}
            />
            <span style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 700, minWidth: 34, textAlign: 'right' }}>
              {telemetry.muted ? 'Mute' : `${telemetry.volume}%`}
            </span>
          </div>

          <div
            style={{
              padding: '8px 12px',
              borderRadius: 13,
              background: 'rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >
            <Sun size={17} color="#FFD60A" />
            <input
              type="range"
              min="5"
              max="100"
              value={telemetry.brightness}
              onChange={(e) => {
                const b = Number(e.target.value);
                setTelemetry((p) => ({ ...p, brightness: b }));
                window.electronAPI?.setBrightness(b);
              }}
              style={{ flex: 1, accentColor: '#FFD60A', cursor: 'pointer' }}
            />
            <span style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 700, minWidth: 34, textAlign: 'right' }}>
              {telemetry.brightness}%
            </span>
          </div>
        </motion.div>
      );
    }

    // 8. REAL CLOCK, NOTES & TIMER
    if (activePage === 'clock') {
      return (
        <motion.div
          key="page-clock"
          {...PAGE_TRANSITION}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#FF453A', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' }}>
                {nowDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <div style={{ color: '#FFFFFF', fontSize: 21, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {nowDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>

            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.12)', borderRadius: 99, padding: 3 }}>
              {['calendar', 'timer'].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    soundEngine.playHapticTap();
                    setClockSubTab(t);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 99,
                    border: 'none',
                    background: clockSubTab === t ? '#FF9F0A' : 'transparent',
                    color: clockSubTab === t ? '#000000' : '#FFFFFF',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    cursor: 'pointer'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {clockSubTab === 'timer' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => {
                      soundEngine.playHapticTap();
                      setTimerRunning((r) => !r);
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(255, 159, 10, 0.25)',
                      color: '#FF9F0A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    {timerRunning ? <Pause size={17} fill="#FF9F0A" /> : <Play size={17} fill="#FF9F0A" />}
                  </button>
                  <button
                    onClick={() => {
                      soundEngine.playHapticTap();
                      setTimerRunning(false);
                      setTimerRemaining(timerTotal);
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(255,255,255,0.14)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={17} />
                  </button>
                </div>
                <div style={{ color: '#FF9F0A', fontSize: 32, fontWeight: 300, fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(timerRemaining)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { label: '1m', sec: 60 },
                  { label: '5m', sec: 300 },
                  { label: '10m', sec: 600 },
                  { label: '25m', sec: 1500 }
                ].map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      soundEngine.playHapticTap();
                      setTimerTotal(p.sec);
                      setTimerRemaining(p.sec);
                      setTimerRunning(true);
                    }}
                    style={{
                      flex: 1,
                      padding: '5px 0',
                      borderRadius: 99,
                      border: 'none',
                      background: timerTotal === p.sec ? 'rgba(255,159,10,0.28)' : 'rgba(255,255,255,0.1)',
                      color: timerTotal === p.sec ? '#FF9F0A' : '#FFFFFF',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                type="text"
                value={newNoteText}
                onFocus={() => window.electronAPI?.focusWindow?.()}
                onClick={() => window.electronAPI?.focusWindow?.()}
                onChange={(e) => setNewNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newNoteText.trim()) {
                    const updated = [
                      {
                        id: 'n-' + Date.now(),
                        text: newNoteText.trim(),
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      },
                      ...notes
                    ];
                    setNotes(updated);
                    localStorage.setItem('ios27_island_notes', JSON.stringify(updated));
                    setNewNoteText('');
                  }
                }}
                placeholder="Type a reminder & press Enter..."
                style={{
                  background: 'rgba(255,255,255,0.09)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 9,
                  padding: '6px 10px',
                  color: '#FFFFFF',
                  fontSize: 11.5,
                  outline: 'none',
                  userSelect: 'text',
                  WebkitUserSelect: 'text'
                }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 82, overflowY: 'auto' }}>
                {notes.length === 0 ? (
                  <div style={{ color: 'rgba(235,235,245,0.45)', fontSize: 11.5, textAlign: 'center', paddingTop: 18 }}>
                    No personal reminders saved
                  </div>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '5px 9px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.07)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 11.5,
                        color: '#FFFFFF'
                      }}
                    >
                      <span>{n.text}</span>
                      <button
                        onClick={() => {
                          const updated = notes.filter((x) => x.id !== n.id);
                          setNotes(updated);
                          localStorage.setItem('ios27_island_notes', JSON.stringify(updated));
                        }}
                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </motion.div>
      );
    }

    // 9. REAL PC HARDWARE TELEMETRY
    if (activePage === 'system') {
      return (
        <motion.div
          key="page-system"
          {...PAGE_TRANSITION}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>
              {telemetry.hostname} • {telemetry.cpuModel}
            </span>
            <span style={{ color: 'rgba(235,235,245,0.55)', fontSize: 11, fontWeight: 600 }}>
              Up {telemetry.uptimeHours}h
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div style={{ padding: '9px 10px', borderRadius: 13, background: 'rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(235,235,245,0.55)', fontSize: 10.5, fontWeight: 700 }}>CPU</span>
                <span style={{ color: '#BF5AF2', fontSize: 15, fontWeight: 800 }}>{telemetry.cpuPct}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24, marginTop: 6 }}>
                {(telemetry.coreLoads || []).slice(0, 8).map((load, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${Math.max(12, load)}%`,
                      borderRadius: 2,
                      background: load > 75 ? '#FF453A' : load > 45 ? '#FF9F0A' : '#BF5AF2',
                      transition: 'height 0.4s ease'
                    }}
                  />
                ))}
              </div>
              <div style={{ color: 'rgba(235,235,245,0.45)', fontSize: 10, marginTop: 4 }}>
                {telemetry.coresCount} Cores
              </div>
            </div>

            <div style={{ padding: '9px 10px', borderRadius: 13, background: 'rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(235,235,245,0.55)', fontSize: 10.5, fontWeight: 700 }}>RAM</span>
                <span style={{ color: '#30D158', fontSize: 15, fontWeight: 800 }}>{telemetry.memPct}%</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
                <div style={{ width: `${telemetry.memPct}%`, height: '100%', borderRadius: 99, background: '#30D158' }} />
              </div>
              <div style={{ color: 'rgba(235,235,245,0.55)', fontSize: 10 }}>
                {telemetry.usedMemGB} / {telemetry.totalMemGB} GB
              </div>
            </div>

            <div style={{ padding: '9px 10px', borderRadius: 13, background: 'rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(235,235,245,0.55)', fontSize: 10.5, fontWeight: 700 }}>DISK C:</span>
                <span style={{ color: '#0A84FF', fontSize: 15, fontWeight: 800 }}>{telemetry.diskPct}%</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
                <div style={{ width: `${telemetry.diskPct}%`, height: '100%', borderRadius: 99, background: '#0A84FF' }} />
              </div>
              <div style={{ color: 'rgba(235,235,245,0.55)', fontSize: 10 }}>
                {telemetry.freeDiskGB} GB Free
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              borderRadius: 11,
              background: 'rgba(255,255,255,0.06)',
              fontSize: 11.5,
              color: '#FFFFFF'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wifi size={13} color="#64D2FF" />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                ↓ {formatRate(telemetry.net?.rxBytesPerSec)} • ↑ {formatRate(telemetry.net?.txBytesPerSec)}
              </span>
            </div>
            <span style={{ color: '#30D158', fontWeight: 600 }}>
              Bat {batteryLevel}% {isCharging ? '(AC)' : ''}
            </span>
          </div>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <div
      onMouseDown={() => {
        if (isExpanded) {
          setIsExpanded(false);
          setShowSettingsPanel(false);
        }
      }}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 6,
        position: 'relative',
        background: 'transparent'
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onMouseEnter={handleMouseEnterIsland}
        onMouseLeave={handleMouseLeaveIsland}
        onWheel={handleWheel}
        onContextMenu={(e) => {
          e.preventDefault();
          soundEngine.playHapticTap();
          setShowSettingsPanel(true);
          setIsExpanded(true);
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'auto'
        }}
      >
        <motion.div
          layout
          initial={false}
          animate={{
            width: islandDimensions.width,
            height: islandDimensions.height,
            borderRadius: islandDimensions.borderRadius
          }}
          transition={isExpanded ? SPRING_EXPAND : SPRING_COLLAPSE}
          onClick={() => {
            if (transientAlert) {
              setTransientAlert(null);
              return;
            }
            if (!isExpanded) {
              soundEngine.playHapticTap(175, 0.02);
              setIsExpanded(true);
            }
          }}
          style={{
            background: '#000000',
            position: 'relative',
            overflow: 'hidden',
            cursor: isExpanded ? 'default' : 'pointer',
            border: isDraggingOver
              ? '1.5px solid rgba(10, 132, 255, 0.45)'
              : '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: 'none'
          }}
        >
          {/* Non-unmounting Drop Zone Overlay so drag-and-drop never flickers or cancels on child nodes */}
          {isDraggingOver && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 60,
                background: 'rgba(0, 0, 0, 0.94)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                pointerEvents: 'none'
              }}
            >
              <Upload size={22} color="#0A84FF" />
              <div style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 700 }}>
                Drop into ORBIT Shelf
              </div>
              <div style={{ color: '#64D2FF', fontSize: 11 }}>
                Release to pin file, image, or text
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeWhatsAppCall && !isExpanded ? (
              <motion.div
                key="whatsapp-call-banner"
                {...PAGE_TRANSITION}
                onClick={(e) => {
                  e.stopPropagation();
                  window.electronAPI?.openExternalUrl('whatsapp://');
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 16px',
                  cursor: 'pointer',
                  background: 'linear-gradient(90deg, rgba(37, 211, 102, 0.32) 0%, transparent 80%)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#25D366',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <PhoneCall size={14} color="#000000" />
                  </div>
                  <div>
                    <div style={{ color: '#25D366', fontSize: 10.5, fontWeight: 700 }}>WHATSAPP CALL</div>
                    <div style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: 700 }}>{activeWhatsAppCall}</div>
                  </div>
                </div>
                <span style={{ color: '#25D366', fontSize: 11.5, fontWeight: 700 }}>Open Call →</span>
              </motion.div>
            ) : transientAlert === 'bluetooth' && !isExpanded ? (
              <motion.div
                key="bluetooth-connect-banner"
                {...PAGE_TRANSITION}
                onClick={(e) => {
                  e.stopPropagation();
                  selectPage(enabledPages.some((p) => p.id === 'bluetooth') ? 'bluetooth' : 'controls');
                  setIsExpanded(true);
                  setTransientAlert(null);
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 14px',
                  gap: 11,
                  cursor: 'pointer',
                  background:
                    'radial-gradient(120% 120% at 15% 50%, rgba(10, 132, 255, 0.34) 0%, rgba(48, 209, 88, 0.14) 55%, transparent 95%)'
                }}
              >
                <AnimatedEarbudsAndBox
                  size="compact"
                  accentColor="#0A84FF"
                  connected={true}
                />

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        color: '#30D158',
                        fontSize: 9.5,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px'
                      }}
                    >
                      Bluetooth Connected
                    </span>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 99,
                        background: 'rgba(10, 132, 255, 0.25)',
                        color: '#64D2FF',
                        fontSize: 9,
                        fontWeight: 700
                      }}
                    >
                      {btSoundPreset}
                    </span>
                  </div>

                  <div
                    style={{
                      color: '#FFFFFF',
                      fontSize: 13.5,
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      margin: '1px 0 3px'
                    }}
                  >
                    {(btBannerDevice || activeBtDevice)?.name || 'soundcore Liberty 4 NC'}
                  </div>

                  {/* Individual Battery Pills for Left (L), Right (R), and Charging Box */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {[
                      { k: 'L', v: (btBannerDevice || activeBtDevice)?.leftBattery ?? 100, c: '#30D158' },
                      { k: 'R', v: (btBannerDevice || activeBtDevice)?.rightBattery ?? 100, c: '#30D158' },
                      { k: 'Box', v: (btBannerDevice || activeBtDevice)?.caseBattery ?? 95, c: '#64D2FF' }
                    ].map((b) => (
                      <span
                        key={b.k}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '1px 6px',
                          borderRadius: 6,
                          background: 'rgba(255,255,255,0.1)',
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#FFFFFF'
                        }}
                      >
                        <span style={{ color: b.c, fontWeight: 800 }}>{b.k}</span>
                        <span>{b.v}%</span>
                      </span>
                    ))}
                  </div>
                </div>

                <span style={{ color: '#0A84FF', fontSize: 10.5, fontWeight: 800, flexShrink: 0 }}>
                  Mix →
                </span>
              </motion.div>
            ) : transientAlert && !isExpanded ? (
              <motion.div
                key="transient-alert"
                {...PAGE_TRANSITION}
                onClick={(e) => {
                  e.stopPropagation();
                  if (transientAlert === 'notif' && bannerNotif?.isWhatsApp) {
                    window.electronAPI?.openExternalUrl('whatsapp://');
                  } else if (transientAlert === 'notif' && bannerNotif?.isTimer) {
                    selectPage('clock');
                    setIsExpanded(true);
                  } else if (transientAlert === 'notif') {
                    selectPage('notifications');
                    setIsExpanded(true);
                  }
                  setTransientAlert(null);
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 16px',
                  cursor: 'pointer',
                  background:
                    transientAlert === 'notif' && bannerNotif
                      ? `linear-gradient(90deg, ${getNotificationBrandTheme(bannerNotif).glow} 0%, transparent 85%)`
                      : 'transparent'
                }}
              >
                {transientAlert === 'notif' && bannerNotif ? (
                  (() => {
                    const bTheme = getNotificationBrandTheme(bannerNotif);
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                          {bannerNotif.avatarUrl ? (
                            <img
                              src={bannerNotif.avatarUrl}
                              alt=""
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                flexShrink: 0,
                                border: `1.5px solid ${bTheme.color}`
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                background: `${bTheme.color}33`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              {bannerNotif.isTimer ? (
                                <Clock size={16} color={bTheme.color} />
                              ) : (
                                <MessageCircle size={16} color={bTheme.color} />
                              )}
                            </div>
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                color: '#FFFFFF',
                                fontSize: 12.5,
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              <span style={{ color: bTheme.color, fontWeight: 800 }}>
                                {bannerNotif.appName}:{' '}
                              </span>
                              {bannerNotif.title}
                            </div>
                            {bannerNotif.body && (
                              <div
                                style={{
                                  color: 'rgba(235,235,245,0.85)',
                                  fontSize: 11.5,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {bannerNotif.body}
                              </div>
                            )}
                          </div>
                        </div>
                        <span style={{ color: bTheme.color, fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          Open
                        </span>
                      </>
                    );
                  })()
                ) : transientAlert === 'charging' ? (
                  <>
                    <span style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: 600 }}>
                      {isCharging ? 'Charging' : 'On Battery'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#30D158', fontSize: 13.5, fontWeight: 700 }}>{batteryLevel}%</span>
                      <IosBatteryIcon level={batteryLevel} charging={isCharging} />
                    </div>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600 }}>
                      Saved to Clipboard Shelf
                    </span>
                    <span style={{ color: '#64D2FF', fontSize: 11.5, fontWeight: 700 }}>Ready</span>
                  </>
                )}
              </motion.div>
            ) : isExpanded ? (
              <motion.div
                key="expanded-shell"
                className="smooth-color-surface"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  width: '100%',
                  height: '100%',
                  padding: '14px 16px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  '--album-c1':
                    flashBrandColor
                      ? `${flashBrandColor}40`
                      : activePage === 'media' && media.hasMedia
                        ? albumPalette.islandGlow
                        : 'rgba(0, 0, 0, 0)',
                  '--album-c2':
                    flashBrandColor
                      ? 'rgba(0, 0, 0, 0)'
                      : activePage === 'media' && media.hasMedia
                        ? albumPalette.secondaryGlow || 'rgba(0, 0, 0, 0)'
                        : 'rgba(0, 0, 0, 0)',
                  background:
                    'radial-gradient(90% 86% at 16% 12%, var(--album-c1) 0%, var(--album-c2) 38%, transparent 76%)'
                }}
              >
                <AnimatePresence mode="wait">{renderExpandedPage()}</AnimatePresence>
                {renderBottomFooterDots()}
              </motion.div>
            ) : (
              renderMinimizedBar()
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
