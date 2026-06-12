import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { resolveTeam } from '@/lib/wcTeams';

export const runtime = 'edge';

const SIZE = { width: 1200, height: 630 };

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

type Obj = Record<string, unknown>;

function parseJsonArr(s: unknown): string[] {
  if (typeof s !== 'string') return [];
  try { return JSON.parse(s); } catch { return []; }
}

function twemojiFlagUrl(name: string): string | null {
  const r = resolveTeam(name);
  if (!r || !/^[A-Z]{2}$/.test(r.iso)) return null;
  const cps = [...r.iso].map(c => (0x1f1e6 + c.charCodeAt(0) - 65).toString(16)).join('-');
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/${cps}.png`;
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/* ── shared frame ──────────────────────────────────────── */

function Frame({ children, tagline }: { children: React.ReactNode; tagline: string }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0a0a0b 0%, #1a0a2e 55%, #0a0a0b 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'sans-serif',
        position: 'relative',
        padding: '48px 64px',
      }}
    >
      <div style={{
        position: 'absolute', top: '-25%', right: '-10%', width: '55%', height: '85%',
        borderRadius: '50%', filter: 'blur(70px)',
        background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.20) 0%, transparent 70%)',
      }} />

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#ffffff', display: 'flex' }}>
            Alpha<span style={{ color: '#a855f7' }}>Board</span>
          </div>
          <div style={{
            fontSize: 15, color: 'rgba(255,255,255,0.45)', display: 'flex',
            padding: '4px 12px', borderRadius: 999,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
          }}>
            World Cup 2026 🏆
          </div>
        </div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', display: 'flex' }}>{tagline}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        {children}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.35)', display: 'flex', letterSpacing: '0.04em' }}>
          alphaboard.xyz/worldcup
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.22)', display: 'flex' }}>
          Live Polymarket data · Not financial advice
        </div>
      </div>
    </div>
  );
}

function Bar({ label, pct, color, flag }: { label: string; pct: number; color: string; flag: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 290 }}>
        {flag ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flag} width={40} height={40} alt="" />
        ) : (
          <div style={{ fontSize: 32, display: 'flex' }}>⚽</div>
        )}
        <span style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flex: 1, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.05)' }}>
        <div style={{
          width: `${Math.max(2, pct)}%`, height: 34, borderRadius: 10, display: 'flex',
          background: `${color}66`, borderRight: `4px solid ${color}`,
        }} />
      </div>
      <span style={{ fontSize: 30, fontWeight: 800, color: '#ffffff', width: 92, textAlign: 'right' }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

/* ── data helpers ──────────────────────────────────────── */

async function matchCard(eventSlug: string) {
  const res = await fetch(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(eventSlug)}`, {
    headers: HEADERS, next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const event: Obj | undefined = Array.isArray(json) ? json[0] : json;
  if (!event) return null;

  const title = String(event.title ?? '');
  const base = title.split(' - ')[0].trim();
  const teams = base.split(/ vs\.? /i).map(s => s.trim());
  const markets: Obj[] = Array.isArray(event.markets) ? (event.markets as Obj[]) : [];

  const rows = markets
    .filter(m => m.closed !== true)
    .map(m => ({
      label: String(m.groupItemTitle ?? '').replace(/\s*\(.*\)\s*$/, '').trim(),
      price: parseFloat(parseJsonArr(m.outcomePrices)[0] ?? '') || 0,
    }))
    .filter(r => r.label);

  const find = (n: string) => rows.find(r => r.label.toLowerCase() === n.toLowerCase());
  const a = teams[0] ? find(teams[0]) : undefined;
  const b = teams[1] ? find(teams[1]) : undefined;
  const draw = rows.find(r => /^draw$/i.test(r.label));
  const ordered = ([a, draw, b].filter(Boolean) as { label: string; price: number }[]).length >= 2
    ? ([a, draw, b].filter(Boolean) as { label: string; price: number }[])
    : rows.slice(0, 3);

  const vol = event.volume24hr != null ? Number(event.volume24hr) : 0;

  return new ImageResponse(
    (
      <Frame tagline="Market-implied win probability">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: '#ffffff', display: 'flex' }}>{base}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {ordered.map((r, i) => (
              <Bar
                key={r.label}
                label={r.label}
                pct={r.price * 100}
                color={/^draw$/i.test(r.label) ? '#94a3b8' : i === 0 ? '#a855f7' : '#38bdf8'}
                flag={twemojiFlagUrl(r.label)}
              />
            ))}
          </div>
          {vol > 0 && (
            <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.4)', display: 'flex' }}>
              {fmtUsd(vol)} traded in the last 24h on Polymarket
            </div>
          )}
        </div>
      </Frame>
    ),
    { ...SIZE }
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function usdcOf(t: any): number {
  if (t.usdcSize != null) return Number(t.usdcSize);
  if (t.size != null && t.price != null) return Number(t.size) * Number(t.price);
  return 0;
}

async function whaleCard() {
  const res = await fetch('https://data-api.polymarket.com/trades?limit=500', {
    headers: HEADERS, next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const raw: Obj[] = Array.isArray(json) ? json : [];
  const wc = raw.filter(t =>
    (typeof t.eventSlug === 'string' && (t.eventSlug as string).startsWith('fifwc')) ||
    (typeof t.title === 'string' && /world cup|fifa/i.test(t.title as string))
  );
  const top = [...wc].sort((x, y) => usdcOf(y) - usdcOf(x))[0];
  if (!top) return null;

  const amount = usdcOf(top);
  const isBuy = String(top.side ?? '').toUpperCase() === 'BUY';
  const price = top.price != null ? Number(top.price) : null;

  return new ImageResponse(
    (
      <Frame tagline="Whale alert · live money flow">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 64, display: 'flex' }}>🐋</div>
            <div style={{
              fontSize: 34, fontWeight: 800, display: 'flex', padding: '8px 22px', borderRadius: 14,
              background: isBuy ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)',
              color: isBuy ? '#34d399' : '#fb7185',
              border: `2px solid ${isBuy ? '#34d399' : '#fb7185'}55`,
            }}>
              {isBuy ? 'BUY' : 'SELL'} {String(top.outcome ?? '')}
            </div>
          </div>
          <div style={{ fontSize: 84, fontWeight: 800, color: '#ffffff', display: 'flex' }}>
            {fmtUsd(amount)}
          </div>
          <div style={{ fontSize: 32, color: 'rgba(255,255,255,0.7)', display: 'flex', lineHeight: 1.3, maxWidth: 1000 }}>
            {String(top.title ?? '')}
          </div>
          {price != null && (
            <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.4)', display: 'flex' }}>
              @ {(price * 100).toFixed(0)}¢ · implied {(price * 100).toFixed(0)}% chance
            </div>
          )}
        </div>
      </Frame>
    ),
    { ...SIZE }
  );
}

async function upsetCard() {
  const res = await fetch(
    'https://gamma-api.polymarket.com/events?tag_slug=fifa-world-cup&closed=false&active=true&order=volume24hr&ascending=false&limit=100',
    { headers: HEADERS, next: { revalidate: 120 } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const events: Obj[] = Array.isArray(json) ? json : [];

  let best: { label: string; eventTitle: string; change: number; last: number } | null = null;
  for (const e of events) {
    if (!/ vs\.? /i.test(String(e.title ?? ''))) continue;
    for (const m of (Array.isArray(e.markets) ? (e.markets as Obj[]) : [])) {
      if (m.closed === true) continue;
      const ch = m.oneDayPriceChange != null ? Number(m.oneDayPriceChange) : 0;
      if (!best || Math.abs(ch) > Math.abs(best.change)) {
        const last = m.lastTradePrice != null ? Number(m.lastTradePrice)
          : parseFloat(parseJsonArr(m.outcomePrices)[0] ?? '') || 0;
        best = {
          label: String(m.groupItemTitle ?? m.question ?? ''),
          eventTitle: String(e.title ?? ''),
          change: ch,
          last,
        };
      }
    }
  }
  if (!best || best.change === 0) return null;

  const up = best.change > 0;

  return new ImageResponse(
    (
      <Frame tagline="Upset radar · biggest 24h odds swing">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ fontSize: 60, display: 'flex' }}>📡</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
            <div style={{
              fontSize: 88, fontWeight: 800, display: 'flex',
              color: up ? '#34d399' : '#fb7185',
            }}>
              {up ? '▲' : '▼'} {(Math.abs(best.change) * 100).toFixed(0)}pp
            </div>
            <div style={{ fontSize: 34, color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
              in 24 hours
            </div>
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#ffffff', display: 'flex', maxWidth: 1000 }}>
            {best.label}
          </div>
          <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.45)', display: 'flex' }}>
            {best.eventTitle} · now {(best.last * 100).toFixed(0)}¢
          </div>
        </div>
      </Frame>
    ),
    { ...SIZE }
  );
}

/* ── route ─────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get('type') ?? 'match';

  try {
    let img: ImageResponse | null = null;
    if (type === 'match') {
      const event = sp.get('event');
      if (event && /^[a-z0-9-]+$/i.test(event)) img = await matchCard(event);
    } else if (type === 'whale') {
      img = await whaleCard();
    } else if (type === 'upset') {
      img = await upsetCard();
    }

    if (img) return img;
  } catch { /* fall through */ }

  // Fallback: generic branded card
  return new ImageResponse(
    (
      <Frame tagline="Prediction market intelligence">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 64, display: 'flex' }}>🏆</div>
          <div style={{ fontSize: 56, fontWeight: 800, color: '#ffffff', display: 'flex' }}>
            World Cup 2026 Hub
          </div>
          <div style={{ fontSize: 26, color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
            Live odds · Smart money · Upset radar
          </div>
        </div>
      </Frame>
    ),
    { ...SIZE }
  );
}
