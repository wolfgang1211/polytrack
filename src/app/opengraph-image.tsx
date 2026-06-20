import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'AlphaBoard: Real-time alpha from the best Polymarket traders';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a0b 0%, #1a0a2e 50%, #0a0a0b 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Gradient orb */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '-10%',
            width: '60%',
            height: '80%',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        {/* Brand mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '120px',
            height: '120px',
            marginBottom: '24px',
          }}
        >
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
            <defs>
              <linearGradient id="abMark" x1="16" y1="12" x2="102" y2="102" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#c084fc" />
                <stop offset="0.55" stopColor="#a855f7" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <path
              d="M8 110 L45 22 C49 14 61 14 65 22 L77 45 L64 56 L55 36 L28 110 Z"
              fill="url(#abMark)"
            />
            <path
              d="M49 84 L69 60 C74 54 82 54 87 60 L112 89 C118 95 114 106 106 106 H83 C79 106 75 104 72 101 L63 91 L88 91 L75 77 L55 97 C49 103 39 98 41 89 C42 87 45 85 49 84 Z"
              fill="url(#abMark)"
            />
            <path
              d="M37 74 L79 58 C86 56 90 65 85 70 L56 97 C52 100 46 98 43 94 C39 89 39 82 44 78 L53 71 L37 74 Z"
              fill="url(#abMark)"
            />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            marginBottom: '12px',
            display: 'flex',
          }}
        >
          Alpha
          <span style={{ color: '#a855f7' }}>Board</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: 'rgba(255,255,255,0.6)',
            fontWeight: 500,
            marginBottom: '32px',
          }}
        >
          Real-time alpha from the best Polymarket traders
        </div>

        {/* Stats bar */}
        <div
          style={{
            display: 'flex',
            gap: '48px',
            padding: '20px 40px',
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>50+</span>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Top Traders</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#a855f7' }}>100+</span>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Active Markets</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>24/7</span>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Live Tracking</span>
          </div>
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            fontSize: 16,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.05em',
          }}
        >
          alphaboard.xyz
        </div>
      </div>
    ),
    { ...size }
  );
}
