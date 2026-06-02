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

        {/* Logo "A" */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <defs>
              <linearGradient id="abLeft" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#a855f7" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
              <linearGradient id="abRight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#d8b4fe" />
                <stop offset="1" stopColor="#a855f7" />
              </linearGradient>
            </defs>
            <path d="M42 12 L66 70 L54 70 L34 22 Z" fill="url(#abRight)" />
            <path d="M38 12 L14 70 L26 70 L46 22 Z" fill="url(#abLeft)" />
            <rect x="26" y="46" width="28" height="10" rx="3" fill="url(#abLeft)" />
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
