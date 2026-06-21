import { ImageResponse } from 'next/og';

const SITE_URL = 'https://www.alphaboard.xyz';

export const runtime = 'edge';
export const alt = 'AlphaBoard: Real-time alpha from the best Polymarket traders';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0b',
        }}
      >
        <img
          src={`${SITE_URL}/og-home-v2.png`}
          alt="AlphaBoard OG"
          width="1200"
          height="630"
          style={{ objectFit: 'cover' }}
        />
      </div>
    ),
    { ...size }
  );
}
