import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AlphaBoard — Polymarket Analytics',
    short_name: 'AlphaBoard',
    description: 'Track top Polymarket traders, monitor wallet performance and discover alpha in real time.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0b',
    theme_color: '#a855f7',
    icons: [
      {
        src: '/favicon.ico',
        sizes: '256x256',
        type: 'image/x-icon',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
