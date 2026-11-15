import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AlphaBoard: Polymarket Analytics',
    short_name: 'AlphaBoard',
    description: 'Track top Polymarket traders, monitor wallet performance and discover alpha in real time.',
    start_url: '/',
    display: 'standalone',
    background_color: '#111111',
    theme_color: '#111111',
    icons: [
      {
        src: '/alphaboard-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/alphaboard-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
