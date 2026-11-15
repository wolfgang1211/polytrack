import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DataApiUnavailable } from '@/lib/dataApiV2';
import { isWallet, NO_STORE } from '@/lib/publicDataApi';
import { readWalletShareStats } from '@/lib/walletShareStats';

// Use the same server runtime and upstream transport as the wallet adapter.
// This also keeps controlled built-HTTP outage tests on the real fetch path.
export const runtime = 'nodejs';

const SIZE = { width: 1200, height: 630 };


function fmtUsd(v: number): string {
  const abs = Math.abs(v);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(2)}M`
    : abs >= 1_000 ? `$${(abs / 1_000).toFixed(1)}K`
    : `$${abs.toFixed(0)}`;
  return (v < 0 ? '-' : '') + s;
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/wallet/[address]/og'>
) {
  const { address } = await ctx.params;
  if (!isWallet(address)) return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400, headers: NO_STORE });
  const addr = String(address).toLowerCase();
  const shortAddr = /^0x[a-fA-F0-9]{40}$/.test(addr)
    ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
    : addr.slice(0, 16);

  let stats: Awaited<ReturnType<typeof readWalletShareStats>>;
  try { stats = await readWalletShareStats(addr); }
  catch (error) {
    const retry = error instanceof DataApiUnavailable ? error.retryAfter : undefined;
    return NextResponse.json({ error: 'Wallet share data is temporarily unavailable.' }, {
      status: retry ? 503 : 502, headers: { ...NO_STORE, ...(retry ? { 'Retry-After': retry } : {}) },
    });
  }
  const pnl = stats.totalPnl;
  const up = pnl >= 0;
  const pnlColor = up ? '#34d399' : '#fb7185';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #0b0714 0%, #120a24 55%, #1a0f33 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              color: 'white', fontSize: 22, fontWeight: 900,
            }}>α</div>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 28, fontWeight: 800 }}>AlphaBoard</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 22 }}>Polymarket Wallet Report</span>
        </div>

        {/* P&L hero */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 26, letterSpacing: 4, textTransform: 'uppercase' }}>
            {stats.truncated ? 'Sample Position P&L' : 'Position P&L'} · {shortAddr}
          </span>
          <span style={{ color: pnlColor, fontSize: 120, fontWeight: 900, lineHeight: 1 }}>
            {up ? '+' : ''}{fmtUsd(pnl)}
          </span>
        </div>

        {/* Stat strip */}
        <div style={{ display: 'flex', gap: 18 }}>
          {[
            { label: 'Positive P&L', value: `${stats.winRate.toFixed(1)}%` },
            { label: 'Positions', value: stats ? String(stats.positions) : '—' },
            { label: 'Open Value', value: stats ? fmtUsd(stats.openValue) : '—' },
            { label: 'alphaboard.xyz', value: 'Track any wallet' },
          ].map(s => (
            <div key={s.label} style={{
              display: 'flex', flexDirection: 'column', gap: 6, flex: 1,
              padding: '20px 24px', borderRadius: 18,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 18, textTransform: 'uppercase', letterSpacing: 2 }}>{s.label}</span>
              <span style={{ color: 'rgba(255,255,255,0.92)', fontSize: 30, fontWeight: 800 }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...SIZE, headers: NO_STORE }
  );
}
