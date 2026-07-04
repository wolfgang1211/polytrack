import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const SIZE = { width: 1200, height: 630 };

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

interface QuickStats {
  totalPnl: number;
  winRate: number;
  positions: number;
  openValue: number;
}

/* Quick stats from a single positions page — good enough for a share card. */
async function quickStats(address: string): Promise<QuickStats | null> {
  try {
    const [posRes, valRes] = await Promise.all([
      fetch(`https://data-api.polymarket.com/positions?user=${address}&limit=500&offset=0&sizeThreshold=0`,
        { headers: HEADERS, next: { revalidate: 300 } }),
      fetch(`https://data-api.polymarket.com/value?user=${address}`,
        { headers: HEADERS, next: { revalidate: 300 } }),
    ]);
    if (!posRes.ok) return null;
    const posJson = await posRes.json();
    const positions: Record<string, unknown>[] = Array.isArray(posJson) ? posJson : (posJson.value ?? []);

    let realized = 0, unrealized = 0, wins = 0, losses = 0;
    for (const p of positions) {
      const rp = Number(p.realizedPnl) || 0;
      realized += rp;
      const isOpen = (Number(p.currentValue) || 0) > 0;
      const cp = isOpen ? (Number(p.cashPnl) || 0) : 0;
      unrealized += cp;
      const pnl = rp + cp;
      if (pnl > 0) wins++; else if (pnl < 0) losses++;
    }

    let openValue = 0;
    if (valRes.ok) {
      const valJson = await valRes.json();
      const val = Array.isArray(valJson) ? valJson[0] : valJson;
      openValue = Number(val?.value) || 0;
    }

    const decided = wins + losses;
    return {
      totalPnl: realized + unrealized,
      winRate: decided ? (wins / decided) * 100 : 0,
      positions: positions.length,
      openValue,
    };
  } catch {
    return null;
  }
}

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
  const addr = String(address).toLowerCase();
  const shortAddr = /^0x[a-fA-F0-9]{40}$/.test(addr)
    ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
    : addr.slice(0, 16);

  const stats = await quickStats(addr);
  const pnl = stats?.totalPnl ?? 0;
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
            Lifetime P&amp;L — {shortAddr}
          </span>
          <span style={{ color: pnlColor, fontSize: 120, fontWeight: 900, lineHeight: 1 }}>
            {up ? '+' : ''}{fmtUsd(pnl)}
          </span>
        </div>

        {/* Stat strip */}
        <div style={{ display: 'flex', gap: 18 }}>
          {[
            { label: 'Win Rate', value: stats ? `${stats.winRate.toFixed(1)}%` : '—' },
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
    SIZE
  );
}
