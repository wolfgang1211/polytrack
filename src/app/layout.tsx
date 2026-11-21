import type { Metadata } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import { Inter, JetBrains_Mono, Syne, Playfair_Display } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Breadcrumb from '@/components/Breadcrumb';
import OutboundAnalytics from '@/components/OutboundAnalytics';
import ClarityScript from '@/components/ClarityScript';
import { organizationJsonLd, websiteJsonLd } from '@/lib/schema';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

const geistSans = Inter({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = JetBrains_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const displayFont = Syne({ variable: '--font-syne', subsets: ['latin'], weight: ['700', '800'] });
const serifFont = Playfair_Display({ variable: '--font-serif-display', subsets: ['latin'], weight: ['400', '700', '800', '900'], style: ['normal', 'italic'] });

const SITE_URL = 'https://www.alphaboard.xyz';

export const metadata: Metadata = {
  title: {
    default: 'AlphaBoard: Polymarket Leaderboard & Wallet Tracker',
    template: '%s | AlphaBoard',
  },
  description: 'Track top Polymarket traders, monitor wallet performance, analyze market liquidity and discover alpha in real time.',
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'AlphaBoard',
    title: 'AlphaBoard: Polymarket Leaderboard & Wallet Tracker',
    description: 'Track top Polymarket traders, monitor wallet performance, analyze market liquidity and discover alpha in real time.',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'AlphaBoard: Real-time alpha from the best Polymarket traders',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@alphaboardxyz',
    creator: '@alphaboardxyz',
    title: 'AlphaBoard: Polymarket Leaderboard & Wallet Tracker',
    description: 'Track top Polymarket traders, monitor wallet performance, analyze market liquidity and discover alpha in real time.',
    images: ['/opengraph-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} ${serifFont.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Runs before first paint: applies the saved/system theme without a flash. */}
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full w-full min-w-0 antialiased">
        <Navbar />
        <OutboundAnalytics />
          <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-7 sm:px-6 sm:py-12">
            <Breadcrumb />
            {children}
          </main>
          <Footer />
        <Script id="jsonld-org" type="application/ld+json" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <Script id="jsonld-home" type="application/ld+json" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <Analytics />
        <ClarityScript />
      </body>
    </html>
  );
}
