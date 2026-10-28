import React from 'react';

// Authentic iOS TrueDepth Camera & IR Sensor Hardware Cutout
export function TrueDepthCameraHardware({ compact = true }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 8 : 10,
        pointerEvents: 'none',
        opacity: 0.92
      }}
    >
      <div
        style={{
          width: 9,
          height: 9,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #1d1526 0%, #09090d 70%, #050507 100%)',
          boxShadow: 'inset 0 0 2px rgba(255,255,255,0.08)'
        }}
      />
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 32% 30%, #1c315e 0%, #0c1326 48%, #04050a 100%)',
          border: '1px solid rgba(255,255,255,0.09)',
          position: 'relative',
          boxShadow: 'inset 0 1px 2px rgba(90, 150, 255, 0.25)'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2.5,
            left: 3,
            width: 3,
            height: 2,
            borderRadius: '50%',
            background: 'rgba(130, 195, 255, 0.45)'
          }}
        />
      </div>
    </div>
  );
}

// GPU-Composited Zero-CPU iOS Color-Adaptive Audio Waveform
export function AppleWaveform({
  playing = false,
  colors = ['#FF375F', '#BF5AF2', '#FF9F0A', '#FF375F', '#FF6482'],
  size = 'compact'
}) {
  const barCount = size === 'compact' ? 5 : 6;
  const maxH = size === 'compact' ? 15 : 20;
  const barW = size === 'compact' ? 2.6 : 3.1;
  const animNames = ['iosWaveBar1', 'iosWaveBar2', 'iosWaveBar3', 'iosWaveBar4', 'iosWaveBar5'];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size === 'compact' ? 2.2 : 2.8,
        height: maxH
      }}
    >
      {Array.from({ length: barCount }).map((_, idx) => {
        const col = colors[idx % colors.length] || '#30D158';
        const animName = animNames[idx % animNames.length];
        const dur = (0.72 + (idx % 3) * 0.14).toFixed(2);
        return (
          <span
            key={idx}
            className="ios-wave-bar"
            style={{
              width: barW,
              height: maxH,
              borderRadius: 99,
              background: playing ? col : 'rgba(255,255,255,0.32)',
              display: 'block',
              transform: playing ? undefined : 'scaleY(0.24)',
              animation: playing ? `${animName} ${dur}s ease-in-out infinite` : 'none'
            }}
          />
        );
      })}
    </div>
  );
}

// Exact iOS Battery Pill Icon with Charging Bolt
export function IosBatteryIcon({ level = 85, charging = true, lowPower = false, size = 'normal' }) {
  const fillColor = charging ? '#30D158' : lowPower ? '#FF9F0A' : level <= 20 ? '#FF453A' : '#FFFFFF';
  const w = size === 'large' ? 34 : 25;
  const h = size === 'large' ? 16 : 12.5;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <div
        style={{
          width: w,
          height: h,
          borderRadius: size === 'large' ? 5 : 4,
          border: `1.5px solid ${charging ? 'rgba(48, 209, 88, 0.65)' : 'rgba(255,255,255,0.45)'}`,
          padding: 1.8,
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <div
          style={{
            width: `${Math.max(8, Math.min(100, level))}%`,
            height: '100%',
            borderRadius: 2.2,
            background: fillColor,
            transition: 'width 0.35s ease'
          }}
        />
        {charging && (
          <svg
            viewBox="0 0 12 16"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: size === 'large' ? 10 : 8,
              height: size === 'large' ? 13 : 11,
              filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.7))'
            }}
          >
            <path d="M7 1L1.5 9H6L5 15L10.5 7H6L7 1Z" fill="#FFFFFF" />
          </svg>
        )}
      </div>
      <div
        style={{
          width: 2,
          height: size === 'large' ? 6 : 4.5,
          borderRadius: '0 2px 2px 0',
          background: charging ? 'rgba(48, 209, 88, 0.65)' : 'rgba(255,255,255,0.45)'
        }}
      />
    </div>
  );
}

// Apple Music Lyrics Quote Bubble Icon
export function LyricsBubbleIcon({ active = false, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3C6.48 3 2 6.69 2 11.25C2 13.73 3.34 15.95 5.45 17.45C5.72 17.64 5.83 17.99 5.71 18.3L4.83 20.6C4.66 21.04 5.11 21.46 5.53 21.25L8.55 19.74C8.83 19.6 9.15 19.56 9.46 19.62C10.28 19.77 11.13 19.85 12 19.85C17.52 19.85 22 16.16 22 11.6C22 7.04 17.52 3 12 3Z"
        fill={active ? '#FFFFFF' : 'rgba(255,255,255,0.22)'}
      />
      <path
        d="M8.5 10.5H10.5V12.5L9.3 14.5H7.8L8.8 12.5H8.5V10.5ZM13.5 10.5H15.5V12.5L14.3 14.5H12.8L13.8 12.5H13.5V10.5Z"
        fill={active ? '#000000' : '#FFFFFF'}
      />
    </svg>
  );
}

// Default System Media Artwork Disc when a Windows app doesn't provide thumbnail bytes
export function DefaultSystemMediaArt({ size = 56, playing = false }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size <= 26 ? 6 : 14,
        background: playing
          ? 'linear-gradient(135deg, #FF375F 0%, #BF5AF2 55%, #0A84FF 100%)'
          : 'linear-gradient(135deg, #2C2C2E 0%, #1C1C1E 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.14)',
        flexShrink: 0
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <path
          d="M9 18V5L21 3V16"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="6" cy="18" r="3" stroke="#FFFFFF" strokeWidth="2.2" />
        <circle cx="18" cy="16" r="3" stroke="#FFFFFF" strokeWidth="2.2" />
      </svg>
    </div>
  );
}

// Premium iOS 27 Animated 3D-Style Wireless Earbuds (L + R) & Charging Case (Box)
export function AnimatedEarbudsAndBox({
  size = 'normal',
  accentColor = '#0A84FF',
  connected = true
}) {
  const isCompact = size === 'compact';
  const w = isCompact ? 56 : 78;
  const h = isCompact ? 42 : 56;

  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: isCompact ? 12 : 16,
        background: `radial-gradient(circle at 50% 35%, ${accentColor}38 0%, rgba(20, 24, 34, 0.95) 75%)`,
        border: `1px solid ${accentColor}66`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
        overflow: 'hidden',
        boxShadow: `inset 0 0 12px ${accentColor}25`
      }}
    >
      <svg
        width={w}
        height={h}
        viewBox="0 0 80 58"
        fill="none"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="budBodyGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#E5E7EB" />
            <stop offset="100%" stopColor="#9CA3AF" />
          </linearGradient>
          <linearGradient id="caseBodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F9FAFB" />
            <stop offset="50%" stopColor="#D1D5DB" />
            <stop offset="100%" stopColor="#6B7280" />
          </linearGradient>
          <linearGradient id="caseInteriorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1F2937" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
        </defs>

        {/* Left Earbud (Floating Animation) */}
        <g className="bt-anim-left">
          {/* Stem */}
          <rect
            x="11"
            y="14"
            width="4.5"
            height="15"
            rx="2.2"
            fill="url(#budBodyGrad)"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="0.5"
          />
          {/* Metallic bottom charging contact */}
          <rect x="11.5" y="26.5" width="3.5" height="2.2" rx="1" fill="#64D2FF" />
          {/* Acoustic Head */}
          <ellipse
            cx="16.5"
            cy="13.5"
            rx="7"
            ry="5.6"
            fill="url(#budBodyGrad)"
          />
          {/* Silicone Tip */}
          <ellipse cx="22.8" cy="13.5" rx="2.6" ry="3.6" fill="#374151" />
          {/* Acoustic Mesh Grille */}
          <ellipse cx="17.5" cy="13.5" rx="1.8" ry="1.1" fill="#111827" />
          {/* L Badge */}
          <text
            x="13.2"
            y="23.5"
            fill="#111827"
            fontSize="4.5"
            fontWeight="800"
            textAnchor="middle"
          >
            L
          </text>
        </g>

        {/* Right Earbud (Floating Animation) */}
        <g className="bt-anim-right">
          {/* Stem */}
          <rect
            x="64.5"
            y="14"
            width="4.5"
            height="15"
            rx="2.2"
            fill="url(#budBodyGrad)"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="0.5"
          />
          {/* Metallic bottom charging contact */}
          <rect x="65" y="26.5" width="3.5" height="2.2" rx="1" fill="#64D2FF" />
          {/* Acoustic Head */}
          <ellipse
            cx="63.5"
            cy="13.5"
            rx="7"
            ry="5.6"
            fill="url(#budBodyGrad)"
          />
          {/* Silicone Tip */}
          <ellipse cx="57.2" cy="13.5" rx="2.6" ry="3.6" fill="#374151" />
          {/* Acoustic Mesh Grille */}
          <ellipse cx="62.5" cy="13.5" rx="1.8" ry="1.1" fill="#111827" />
          {/* R Badge */}
          <text
            x="66.8"
            y="23.5"
            fill="#111827"
            fontSize="4.5"
            fontWeight="800"
            textAnchor="middle"
          >
            R
          </text>
        </g>

        {/* Center Charging Case / Box (Breathing Animation) */}
        <g className="bt-anim-box">
          {/* Open Upper Lid */}
          <path
            d="M25 22C25 17.5 29 15 40 15C51 15 55 17.5 55 22H25Z"
            fill="url(#caseBodyGrad)"
            opacity="0.9"
          />
          {/* Dark Interior Crushed Recess */}
          <ellipse cx="40" cy="23.5" rx="14.5" ry="3" fill="url(#caseInteriorGrad)" />
          {/* Main Charging Box Body */}
          <rect
            x="24"
            y="23.5"
            width="32"
            height="25"
            rx="8.5"
            fill="url(#caseBodyGrad)"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="0.7"
          />
          {/* Lid Seam Line */}
          <line
            x1="25"
            y1="28.5"
            x2="55"
            y2="28.5"
            stroke="rgba(17,24,39,0.35)"
            strokeWidth="0.9"
          />
          {/* Metallic Hinge Accent */}
          <rect x="35" y="27.5" width="10" height="2" rx="1" fill="#9CA3AF" />
          {/* Glowing Status LED on Box */}
          <circle
            cx="40"
            cy="36.5"
            r="2.1"
            fill={connected ? '#30D158' : '#FF9F0A'}
          />
          <circle
            cx="40"
            cy="36.5"
            r="4.2"
            fill={connected ? 'rgba(48, 209, 88, 0.32)' : 'rgba(255, 159, 10, 0.32)'}
          />
          {/* Subtle BOX Label */}
          <text
            x="40"
            y="45"
            fill="#1F2937"
            fontSize="4.6"
            fontWeight="800"
            letterSpacing="0.5"
            textAnchor="middle"
          >
            CASE
          </text>
        </g>
      </svg>
    </div>
  );
}
