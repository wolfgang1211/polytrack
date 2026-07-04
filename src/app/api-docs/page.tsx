import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation',
  description: 'AlphaBoard public API endpoints for leaderboard, markets, wallet stats, and trade data.',
  alternates: { canonical: '/api-docs' },
  openGraph: {
    title: 'API Documentation | AlphaBoard',
    description: 'AlphaBoard public API endpoints for leaderboard, markets, wallet stats, and trade data.',
    url: '/api-docs',
  },
  twitter: {
    title: 'API Documentation | AlphaBoard',
    description: 'AlphaBoard public API endpoints for leaderboard, markets, wallet stats, and trade data.',
  },
};

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/leaderboard',
    desc: 'Top traders leaderboard with optional time window. Returns an array of trader entries.',
    params: ['window=allTime|1d|1w|1m', 'limit=1..50'],
    example: '/api/leaderboard?window=allTime&limit=20',
    sample: `[
  {
    "rank": "1",
    "proxyWallet": "0xabc…",
    "userName": "trader",
    "xUsername": "trader",
    "verifiedBadge": true,
    "vol": 1250000.5,
    "pnl": 84210.42,
    "profileImage": "https://…"
  }
]`,
  },
  {
    method: 'GET',
    path: '/api/markets/list',
    desc: 'List active prediction markets, slimmed to the fields shown below. Cached ~2 minutes.',
    params: ['sort=vol24h|volume|liquidity|ending|newest', 'limit=1..200'],
    example: '/api/markets/list?sort=vol24h&limit=20',
    sample: `[
  {
    "id": "0x…",
    "question": "Will …?",
    "slug": "will-…",
    "eventSlug": "event-…",
    "volume24hrNum": 51234.1,
    "volumeNum": 812345.0,
    "liquidityNum": 25000.0,
    "outcomes": "[\\"Yes\\",\\"No\\"]",
    "outcomePrices": "[\\"0.55\\",\\"0.45\\"]",
    "image": "https://…",
    "endDate": "2026-07-19T00:00:00Z",
    "category": "World Cup"
  }
]`,
  },
  {
    method: 'GET',
    path: '/api/wallet/[address]',
    desc: 'Wallet analytics: lifetime positions (including closed) and current portfolio value. Wallets with more than 3,000 positions are truncated (flagged in the response).',
    params: ['address (Ethereum, 0x…)'],
    example: '/api/wallet/0x1234…',
    sample: `{
  "positions": [ { "…": "Polymarket data-api position object" } ],
  "totalValue": 10423.55,
  "truncated": false
}`,
  },
  {
    method: 'GET',
    path: '/api/trades/recent',
    desc: 'Recent large trades (≥ $1,000) across Polymarket, sorted by size. Falls back to the top 20 trades when nothing clears the threshold.',
    params: [],
    example: '/api/trades/recent',
    sample: `{
  "trades": [ { "…": "Polymarket data-api trade object" } ],
  "belowThreshold": false
}`,
  },
];

function MethodBadge({ method }: { method: string }) {
  const color = method === 'GET' ? 'rgba(52,211,153,0.95)' : 'rgba(251,113,133,0.95)';
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-widest"
      style={{ background: 'rgba(255,255,255,0.04)', color, border: `1px solid ${color}33` }}
    >
      {method}
    </span>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-3xl py-8">
      <h1 className="text-3xl font-bold text-white mb-2">API Documentation</h1>
      <p className="text-xs text-white/35 mb-8">
        Public endpoints for traders, markets, wallets, and trades. All responses are JSON.
      </p>

      {/* General info */}
      <div className="rounded-xl p-5 mb-6 space-y-2"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs text-white/45">
          <strong className="text-white/70">Base URL:</strong>{' '}
          <code className="font-mono text-white/60">https://www.alphaboard.xyz</code>
        </p>
        <p className="text-xs text-white/45">
          <strong className="text-white/70">Authentication:</strong> none — all endpoints are public and read-only.
        </p>
        <p className="text-xs text-white/45">
          <strong className="text-white/70">Fair use:</strong> responses are edge-cached (typically 1–2 minutes); please keep polling intervals ≥ 30s.
          Heavy or abusive usage may be rate-limited.
        </p>
        <p className="text-xs text-white/45">
          <strong className="text-white/70">Errors:</strong> non-200 responses return{' '}
          <code className="font-mono text-white/60">{'{ "error": "message" }'}</code> with an appropriate HTTP status.
        </p>
        <p className="text-xs text-white/45">
          <strong className="text-white/70">Data source:</strong> aggregated from Polymarket public APIs; schemas may evolve with upstream changes.
        </p>
      </div>

      <div className="space-y-4">
        {ENDPOINTS.map((ep) => (
          <div
            key={ep.path}
            className="rounded-xl p-5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <MethodBadge method={ep.method} />
              <code className="text-xs font-mono text-white/70">{ep.path}</code>
            </div>
            <p className="text-xs text-white/45 mb-3">{ep.desc}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {ep.params.map((p) => (
                <span key={p} className="text-[10px] font-mono text-white/30" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 6 }}>
                  {p}
                </span>
              ))}
            </div>
            <p className="text-[11px] font-mono text-white/25 mb-3">
              Example: {ep.example}
            </p>
            {ep.sample && (
              <pre className="text-[10px] font-mono text-white/40 leading-relaxed overflow-x-auto rounded-lg p-3"
                style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.05)' }}>
                {ep.sample}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
