import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation',
  description: 'AlphaBoard public API endpoints for leaderboard, markets, wallet stats, and trade data.',
  alternates: { canonical: '/api-docs' },
};

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/leaderboard',
    desc: 'Top traders leaderboard with optional time window.',
    params: ['window=allTime|1d|1w|1m', 'limit=1..50'],
    example: '/api/leaderboard?window=allTime&limit=20',
  },
  {
    method: 'GET',
    path: '/api/markets/list',
    desc: 'List active prediction markets.',
    params: ['limit=1..50'],
    example: '/api/markets/list?limit=20',
  },
  {
    method: 'GET',
    path: '/api/wallet/[address]',
    desc: 'Wallet analytics: P&L, win rate, volume.',
    params: ['address (Ethereum)'],
    example: '/api/wallet/0x1234...',
  },
  {
    method: 'GET',
    path: '/api/trades/recent',
    desc: 'Recent large trades across Polymarket.',
    params: ['limit=1..50'],
    example: '/api/trades/recent?limit=20',
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
            <p className="text-[11px] font-mono text-white/25">
              Example: {ep.example}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
