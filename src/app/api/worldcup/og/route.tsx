import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { resolveTeam } from '@/lib/wcTeams';

export const runtime = 'edge';

const SIZE = { width: 1200, height: 630 };

function twemojiFlagUrl(iso: string): string | null {
  if (!/^[A-Z]{2}$/.test(iso)) return null;
  const cps = [...iso].map(c => (0x1f1e6 + c.charCodeAt(0) - 65).toString(16)).join('-');
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${cps}.png`;
}

function parseJsonArr(s: unknown): string[] {
  if (typeof s !== 'string') return [];
  try { return JSON.parse(s); } catch { return []; }
}

export async function GET(req: NextRequest) {
  const teamParam = req.nextUrl.searchParams.get('team') ?? '';
  const resolved = resolveTeam(teamParam);
  const teamName = resolved?.canonical ?? teamParam;

  // Live odds from the winner market
  let pct: string | null = null;
  let rank: number | null = null;
  try {
    const res = await fetch('https://gamma-api.polymarket.com/events?slug=world-cup-winner', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const json = await res.json();
      const event = Array.isArray(json) ? json[0] : json;
      const markets: Record<string, unknown>[] = Array.isArray(event?.markets) ? event.markets : [];
      const teams = markets
        .filter(m => m.closed !== true)
        .map(m => ({
          team: String(m.groupItemTitle ?? ''),
          price: parseFloat(parseJsonArr(m.outcomePrices)[0] ?? '0') || 0,
        }))
        .sort((a, b) => b.price - a.price);
      const idx = teams.findIndex(t => {
        const r = resolveTeam(t.team);
        return r && resolved ? r.canonical === resolved.canonical : t.team.toLowerCase() === teamName.toLowerCase();
      });
      if (idx >= 0) {
        rank = idx + 1;
        const p = teams[idx].price * 100;
        pct = p < 1 ? '<1%' : `${p.toFixed(1)}%`;
      }
    }
  } catch { /* fall through to generic card */ }

  const flagUrl = resolved ? twemojiFlagUrl(resolved.iso) : null;

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
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: '60%',
            height: '80%',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.18) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 28 }}>
          {flagUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={flagUrl} width={110} height={110} alt="" />
          ) : (
            <div style={{ fontSize: 90, display: 'flex' }}>🏆</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 64, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', display: 'flex' }}>
              {teamName || 'World Cup 2026'}
            </div>
            <div style={{ fontSize: 26, color: 'rgba(255,255,255,0.55)', display: 'flex' }}>
              FIFA World Cup 2026 · Polymarket odds
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 40,
            padding: '24px 48px',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 44, fontWeight: 800, color: '#a855f7' }}>{pct ?? '—'}</span>
            <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)' }}>Win the World Cup</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 44, fontWeight: 800, color: '#fbbf24' }}>{rank ? `#${rank}` : '—'}</span>
            <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)' }}>Market Rank</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 44, fontWeight: 800, color: '#22c55e' }}>LIVE</span>
            <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)' }}>Odds & Money Flow</span>
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 28,
            fontSize: 20,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.05em',
            display: 'flex',
          }}
        >
          alphaboard.xyz/worldcup
        </div>
      </div>
    ),
    { ...SIZE }
  );
}
