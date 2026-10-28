// Curated Apple Music Tracks with Time-Synced Lyrics & Adaptive Color Palettes

function createAlbumArtSvg(c1, c2, c3, accent, symbol) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="52%" stop-color="${c2}"/>
        <stop offset="100%" stop-color="${c3}"/>
      </linearGradient>
      <radialGradient id="glow" cx="72%" cy="28%" r="60%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.78"/>
        <stop offset="100%" stop-color="${c3}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="240" height="240" rx="48" fill="url(#bg)"/>
    <rect width="240" height="240" rx="48" fill="url(#glow)"/>
    <circle cx="120" cy="120" r="68" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
    <circle cx="120" cy="120" r="22" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
    <text x="120" y="131" text-anchor="middle" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="30" font-weight="700" opacity="0.9">${symbol}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const TRACKS = [
  {
    id: 'track-1',
    title: 'Starlight Odyssey',
    artist: 'The Weeknd & Daft Punk',
    album: 'After Hours Deluxe (Dolby Atmos)',
    duration: 56,
    accent: '#FF375F',
    secondaryAccent: '#BF5AF2',
    waveColors: ['#FF375F', '#FF6482', '#BF5AF2', '#FF375F', '#FF9F0A', '#BF5AF2'],
    cover: createAlbumArtSvg('#2B0938', '#891652', '#FF375F', '#FF9F0A', '✦'),
    lyrics: [
      { time: 0, text: '♪ Instrumental Intro (Dolby Atmos) ♪' },
      { time: 4, text: 'City lights reflecting on the midnight glass' },
      { time: 9, text: 'We are drifting through the neon afterglow' },
      { time: 14, text: 'Every heartbeat synced in stereo tonight' },
      { time: 19, text: 'Hold the horizon before the shadows fade' },
      { time: 24, text: 'Starlight calling from the other side of time' },
      { time: 30, text: 'Weightless in the frequency we left behind' },
      { time: 36, text: 'Let the rhythm pull us into overdrive' },
      { time: 42, text: 'Shining brighter than the static in the sky' },
      { time: 49, text: 'Fading slowly into golden sunrise...' }
    ]
  },
  {
    id: 'track-2',
    title: 'Midnight Horizon',
    artist: 'Fred again.. & Disclosure',
    album: 'USB Live Sessions',
    duration: 48,
    accent: '#0A84FF',
    secondaryAccent: '#64D2FF',
    waveColors: ['#0A84FF', '#64D2FF', '#5E5CE6', '#30D158', '#64D2FF', '#0A84FF'],
    cover: createAlbumArtSvg('#041C32', '#064663', '#0A84FF', '#64D2FF', '◈'),
    lyrics: [
      { time: 0, text: '♪ Sub-bass pulse & vocoder intro ♪' },
      { time: 4, text: 'Caught a wave across the London underground' },
      { time: 9, text: 'Turn the sample up until the ceiling shakes' },
      { time: 14, text: 'You said hold on to this moment right now' },
      { time: 20, text: 'Blue lasers cutting through the morning fog' },
      { time: 26, text: 'We keep dancing when the streetlights flicker out' },
      { time: 32, text: 'Everything is connected in the sound' },
      { time: 39, text: 'Breathing in the electric atmosphere' },
      { time: 44, text: '♪ Synth outro resonance ♪' }
    ]
  },
  {
    id: 'track-3',
    title: 'Solaris Echoes',
    artist: 'Tame Impala',
    album: 'Currents B-Sides',
    duration: 52,
    accent: '#FF9F0A',
    secondaryAccent: '#30D158',
    waveColors: ['#FF9F0A', '#FFD60A', '#30D158', '#FF9F0A', '#64D2FF', '#FFD60A'],
    cover: createAlbumArtSvg('#1F1105', '#7C3E06', '#FF9F0A', '#FFD60A', '☀'),
    lyrics: [
      { time: 0, text: '♪ Psychedelic phaser guitar sweep ♪' },
      { time: 5, text: 'Floating higher on a prism of the sun' },
      { time: 11, text: 'Colors melting into liquid symmetry' },
      { time: 17, text: 'Did you notice how the seasons rearrange?' },
      { time: 23, text: 'Every second spinning faster than before' },
      { time: 29, text: 'Just let it happen, let the current carry us' },
      { time: 36, text: 'Drifting past the edge of gravity' },
      { time: 43, text: 'Golden echoes in an endless summer dream' }
    ]
  }
];
