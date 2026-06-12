'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { formatCurrency } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';

type Nation = {
  name: string;
  code: string;
  iso: string;
  flagCode?: string;
  primary: string;
  secondary: string;
  aliases: string[];
};

type WcMarket = {
  id: string;
  question: string;
  slug: string;
  eventSlug?: string;
  eventTitle?: string;
  outcomes?: string;
  outcomePrices?: string;
  image?: string;
  endDate?: string;
  clobTokenIds?: string;
  oneDayPriceChange?: number;
  lastTradePrice?: number;
  bestBid?: number;
  bestAsk?: number;
  groupItemTitle?: string;
  sportsMarketType?: string;
  volume24hrNum?: number;
  volumeNum?: number;
  liquidityNum?: number;
};

type WcEvent = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  image?: string;
  icon?: string;
  endDate?: string;
  volume24hr?: number;
  volume?: number;
  liquidity?: number;
  markets: WcMarket[];
};

type ApiResponse = {
  events?: WcEvent[];
  updatedAt?: string;
  error?: string;
};

type WinnerMarket = {
  market: WcMarket;
  nation: Nation;
  price: number;
};

type PricePoint = { t: number; p: number };
type PriceHistory = {
  points?: PricePoint[];
  first?: number | null;
  last?: number | null;
  changePct?: number | null;
  error?: string;
};

const NATIONS: Nation[] = [
  { name: 'Spain', code: 'ES', iso: 'ES', primary: '#ef4444', secondary: '#facc15', aliases: ['spain', 'espana', 'españa'] },
  { name: 'France', code: 'FR', iso: 'FR', primary: '#2563eb', secondary: '#ef4444', aliases: ['france'] },
  { name: 'Portugal', code: 'PT', iso: 'PT', primary: '#16a34a', secondary: '#dc2626', aliases: ['portugal'] },
  { name: 'England', code: 'GB', iso: 'GB', flagCode: 'gb-eng', primary: '#ffffff', secondary: '#ef4444', aliases: ['england'] },
  { name: 'Argentina', code: 'AR', iso: 'AR', primary: '#38bdf8', secondary: '#ffffff', aliases: ['argentina'] },
  { name: 'Brazil', code: 'BR', iso: 'BR', primary: '#22c55e', secondary: '#facc15', aliases: ['brazil', 'brasil'] },
  { name: 'Germany', code: 'DE', iso: 'DE', primary: '#facc15', secondary: '#ef4444', aliases: ['germany', 'deutschland'] },
  { name: 'Netherlands', code: 'NL', iso: 'NL', primary: '#f97316', secondary: '#2563eb', aliases: ['netherlands', 'holland', 'nederland'] },
  { name: 'Norway', code: 'NO', iso: 'NO', primary: '#dc2626', secondary: '#2563eb', aliases: ['norway'] },
  { name: 'Belgium', code: 'BE', iso: 'BE', primary: '#facc15', secondary: '#ef4444', aliases: ['belgium'] },
  { name: 'Colombia', code: 'CO', iso: 'CO', primary: '#facc15', secondary: '#2563eb', aliases: ['colombia'] },
  { name: 'Mexico', code: 'MX', iso: 'MX', primary: '#16a34a', secondary: '#ef4444', aliases: ['mexico'] },
  { name: 'South Africa', code: 'ZA', iso: 'ZA', primary: '#16a34a', secondary: '#facc15', aliases: ['south africa', 'rsa'] },
  { name: 'Czechia', code: 'CZ', iso: 'CZ', primary: '#2563eb', secondary: '#ef4444', aliases: ['czechia', 'czech republic'] },
  { name: 'South Korea', code: 'KR', iso: 'KR', primary: '#ffffff', secondary: '#2563eb', aliases: ['south korea', 'korea republic', 'republic of korea', 'korea'] },
  { name: 'United States', code: 'US', iso: 'US', primary: '#2563eb', secondary: '#ef4444', aliases: ['united states', 'usa', 'u.s.', 'us'] },
  { name: 'Paraguay', code: 'PY', iso: 'PY', primary: '#ef4444', secondary: '#2563eb', aliases: ['paraguay'] },
  { name: 'Canada', code: 'CA', iso: 'CA', primary: '#ef4444', secondary: '#ffffff', aliases: ['canada'] },
  { name: 'Bosnia-Herzegovina', code: 'BA', iso: 'BA', primary: '#2563eb', secondary: '#facc15', aliases: ['bosnia-herzegovina', 'bosnia and herzegovina', 'bosnia', 'bih'] },
  { name: 'Japan', code: 'JP', iso: 'JP', primary: '#ffffff', secondary: '#ef4444', aliases: ['japan'] },
  { name: 'Curaçao', code: 'CW', iso: 'CW', primary: '#2563eb', secondary: '#facc15', aliases: ['curacao', 'curaçao'] },
  { name: 'Morocco', code: 'MA', iso: 'MA', primary: '#dc2626', secondary: '#16a34a', aliases: ['morocco'] },
  { name: 'Haiti', code: 'HT', iso: 'HT', primary: '#2563eb', secondary: '#ef4444', aliases: ['haiti'] },
  { name: 'Scotland', code: 'GB', iso: 'GB', flagCode: 'gb-sct', primary: '#38bdf8', secondary: '#ffffff', aliases: ['scotland'] },
  { name: 'Ecuador', code: 'EC', iso: 'EC', primary: '#facc15', secondary: '#2563eb', aliases: ['ecuador'] },
  { name: 'Ivory Coast', code: 'CI', iso: 'CI', primary: '#f97316', secondary: '#22c55e', aliases: ['ivory coast', 'cote divoire', "côte d'ivoire"] },
  { name: 'Switzerland', code: 'CH', iso: 'CH', primary: '#ef4444', secondary: '#ffffff', aliases: ['switzerland'] },
  { name: 'Uruguay', code: 'UY', iso: 'UY', primary: '#38bdf8', secondary: '#ffffff', aliases: ['uruguay'] },
  { name: 'Croatia', code: 'HR', iso: 'HR', primary: '#ef4444', secondary: '#2563eb', aliases: ['croatia'] },
  { name: 'Denmark', code: 'DK', iso: 'DK', primary: '#dc2626', secondary: '#ffffff', aliases: ['denmark'] },
  { name: 'Serbia', code: 'RS', iso: 'RS', primary: '#ef4444', secondary: '#2563eb', aliases: ['serbia'] },
  { name: 'Sweden', code: 'SE', iso: 'SE', primary: '#2563eb', secondary: '#facc15', aliases: ['sweden'] },
  { name: 'Poland', code: 'PL', iso: 'PL', primary: '#ffffff', secondary: '#dc2626', aliases: ['poland'] },
  { name: 'Italy', code: 'IT', iso: 'IT', primary: '#16a34a', secondary: '#ef4444', aliases: ['italy'] },
  { name: 'Türkiye', code: 'TR', iso: 'TR', primary: '#dc2626', secondary: '#ffffff', aliases: ['turkiye', 'türkiye', 'turkey'] },
  { name: 'Qatar', code: 'QA', iso: 'QA', primary: '#7f1d1d', secondary: '#ffffff', aliases: ['qatar'] },
  { name: 'Australia', code: 'AU', iso: 'AU', primary: '#2563eb', secondary: '#facc15', aliases: ['australia'] },
  { name: 'Saudi Arabia', code: 'SA', iso: 'SA', primary: '#16a34a', secondary: '#ffffff', aliases: ['saudi arabia'] },
  { name: 'Iran', code: 'IR', iso: 'IR', primary: '#16a34a', secondary: '#ef4444', aliases: ['iran'] },
  { name: 'Ghana', code: 'GH', iso: 'GH', primary: '#facc15', secondary: '#16a34a', aliases: ['ghana'] },
  { name: 'Nigeria', code: 'NG', iso: 'NG', primary: '#16a34a', secondary: '#ffffff', aliases: ['nigeria'] },
];

const SLUG_TOKEN_MAP: Record<string, string> = {
  mex: 'Mexico', rsa: 'South Africa', kr: 'South Korea', cze: 'Czechia', usa: 'United States', par: 'Paraguay',
  can: 'Canada', bih: 'Bosnia-Herzegovina', nld: 'Netherlands', jpn: 'Japan', ger: 'Germany', bra: 'Brazil',
  mar: 'Morocco', hai: 'Haiti', sco: 'Scotland', esp: 'Spain', fra: 'France', por: 'Portugal', eng: 'England',
  arg: 'Argentina', bel: 'Belgium', col: 'Colombia', ecu: 'Ecuador', sui: 'Switzerland', nor: 'Norway',
};

function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function wordIncludes(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(haystack);
}

function findNation(value: string): Nation | undefined {
  const text = normalise(value);
  if (!text) return undefined;
  return NATIONS.find((nation) => {
    const needles = [nation.name, nation.code, nation.iso, ...nation.aliases].map(normalise);
    return needles.some((needle) => wordIncludes(text, needle));
  });
}

function nationByName(name: string): Nation | undefined {
  return NATIONS.find((nation) => nation.name === name);
}

function nationsFromText(value: string): Nation[] {
  const found: Nation[] = [];
  const text = normalise(value);
  for (const nation of NATIONS) {
    const needles = [nation.name, ...nation.aliases].map(normalise);
    if (needles.some((needle) => wordIncludes(text, needle)) && !found.some((n) => n.name === nation.name)) {
      found.push(nation);
    }
  }
  return found;
}

function nationForWinnerQuestion(question: string): Nation | undefined {
  const match = question.match(/^Will\s+(.+?)\s+(?:win|advance|qualify)/i);
  return findNation(match?.[1] ?? question);
}

function nationsForEvent(event: WcEvent): Nation[] {
  const title = event.title.replace(/\s+-\s+(More Markets|Exact Score).*$/i, '');
  const parts = title.split(/\s+vs\.?\s+/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const pair = [findNation(parts[0]), findNation(parts[1])].filter((n): n is Nation => Boolean(n));
    if (pair.length === 2) return pair;
  }

  const fromTitle = nationsFromText(title);
  if (fromTitle.length >= 2) return fromTitle.slice(0, 2);

  const tokens = normalise(event.slug).split(' ');
  const fromSlug: Nation[] = [];
  for (const token of tokens) {
    const nationName = SLUG_TOKEN_MAP[token];
    const nation = nationName ? nationByName(nationName) : undefined;
    if (nation && !fromSlug.some((n) => n.name === nation.name)) fromSlug.push(nation);
  }
  return fromSlug.slice(0, 2);
}

function parseJsonList(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function yesPrice(market: WcMarket | undefined): number {
  if (!market) return 0;
  const outcomes = parseJsonList(market.outcomes);
  const prices = parseJsonList(market.outcomePrices).map(Number);
  if (!prices.length) return 0;
  const yesIndex = outcomes.findIndex((o) => /^yes$/i.test(o));
  const n = prices[yesIndex >= 0 ? yesIndex : 0];
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

function impliedLabel(price: number): string {
  const pct = price * 100;
  if (pct > 0 && pct < 1) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

function metricMoney(value: number | undefined): string {
  return formatCurrency(value ?? 0, true);
}

function tokenIds(market: WcMarket | undefined): string[] {
  return parseJsonList(market?.clobTokenIds);
}

function cleanMarketLabel(question: string): string {
  return question
    .replace(/^Will\s+/i, '')
    .replace(/\s+on\s+2026-\d{2}-\d{2}\??$/i, '')
    .replace(/\s+at\s+the\s+2026\s+FIFA\s+World\s+Cup\??$/i, '')
    .replace(/\s+in\s+the\s+2026\s+FIFA\s+World\s+Cup\??$/i, '')
    .replace(/\?$/g, '')
    .trim();
}

function isCornerMarket(market: WcMarket): boolean {
  return /corner/i.test(market.question);
}

function isPlayerProp(market: WcMarket): boolean {
  return /\b(shots?|goals?|assists?|saves?|cards?|tackles?)\b/i.test(market.question) && !/total corners/i.test(market.question);
}

function isPrimaryMatchMarket(market: WcMarket): boolean {
  return /\b(win|draw)\b/i.test(market.question) && !/world cup/i.test(market.question);
}

function flagUrl(nation: Nation): string {
  return `https://flagcdn.com/w80/${nation.flagCode ?? nation.iso.toLowerCase()}.png`;
}

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="font-mono text-[10px] font-black tracking-widest text-white/38">[{index}]</span>
      <div className="h-px w-12" style={{ background: 'var(--vi-border)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/46">{label}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg,var(--vi-border),transparent)' }} />
    </div>
  );
}

function FlagImage({ nation, className = 'h-6 w-6', square = false }: { nation: Nation; className?: string; square?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden ${square ? 'rounded-lg' : 'rounded-full'} bg-white/10 ring-1 ring-white/15 ${className}`}
      title={`${nation.name} flag`}
      style={{ boxShadow: `0 0 18px ${nation.primary}24` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={flagUrl(nation)} alt={`${nation.name} flag`} className="h-full w-full object-cover" />
    </span>
  );
}

function SoccerBallIcon({ className = 'h-7 w-7', style }: { className?: string; style?: CSSProperties }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-black/30 ring-1 ring-white/10 ${className}`} style={style}>
      <svg viewBox="0 0 32 32" className="h-[72%] w-[72%] text-white/70" fill="none">
        <circle cx="16" cy="16" r="13" stroke="currentColor" strokeOpacity="0.42" strokeWidth="1.8" />
        <path d="m16 8 5 3v6l-5 3-5-3v-6l5-3Z" fill="currentColor" fillOpacity="0.24" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1" />
        <path d="M11 11 6.6 9.7M21 11l4.4-1.3M11 17l-2 5.1M21 17l2 5.1M16 20v5" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function TrophyIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M8 4h8v3.2c0 3.4-1.7 5.7-4 6.5-2.3-.8-4-3.1-4-6.5V4Z" fill="#fbbf24" fillOpacity="0.9" />
      <path d="M8 6H5.5c0 3 1.4 4.8 3.4 5.2M16 6h2.5c0 3-1.4 4.8-3.4 5.2M12 13.7V18M9 20h6" stroke="#fde68a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-white/25" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="9" r="5" />
      <path d="m13 13 3 3" strokeLinecap="round" />
    </svg>
  );
}

function FieldGraphic() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[54%] opacity-[0.16] lg:block">
      <div className="absolute inset-y-0 left-0 w-px bg-white/35" />
      <div className="absolute left-[-58px] top-1/2 h-28 w-28 -translate-y-1/2 rounded-full border border-white/35" />
      <div className="absolute left-[-5px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white/30" />
      <div className="absolute right-7 top-8 h-[72%] w-36 border border-white/35" />
      <div className="absolute right-7 top-[31%] h-[38%] w-16 border border-white/30" />
    </div>
  );
}

function scrollToSection(id: string, behavior: ScrollBehavior = 'smooth') {
  const target = document.getElementById(id);
  if (!target) return;
  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - 96);
  if (behavior === 'auto') {
    window.scrollTo(0, top);
    return;
  }
  window.scrollTo({ top, behavior });
}

function TinyButton({ children, active = false, href }: { children: ReactNode; active?: boolean; href?: string }) {
  const style = active
    ? { background: 'linear-gradient(135deg,rgba(124,58,237,0.34),rgba(168,85,247,0.16))', border: '1px solid rgba(168,85,247,0.72)', boxShadow: '0 0 26px rgba(124,58,237,0.20), inset 0 1px 0 rgba(255,255,255,0.08)' }
    : { background: 'rgba(255,255,255,0.058)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' };
  const className = 'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-black text-white/86 transition hover:-translate-y-0.5 hover:border-violet-300/55 hover:text-white whitespace-nowrap';

  if (href) {
    return (
      <a
        href={href}
        className={className}
        style={style}
        onClick={href.startsWith('#') ? (event) => {
          event.preventDefault();
          scrollToSection(href.slice(1));
          window.history.replaceState(null, '', href);
        } : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={className} style={style}>
      {children}
    </button>
  );
}

function Hero({ events, winnerMarkets, selected }: { events: WcEvent[]; winnerMarkets: WinnerMarket[]; selected: string | null }) {
  const favorite = winnerMarkets[0];
  const winnerEvent = events.find((event) => event.slug === 'world-cup-winner');
  const dayVolume = events.reduce((sum, event) => sum + (event.volume24hr ?? 0), 0);

  return (
    <section>
      <SectionLabel index="01" label="World Cup 2026 - Special Coverage" />
      <div
        className="relative overflow-hidden rounded-2xl p-5 sm:p-6"
        style={{
          background: 'linear-gradient(100deg,rgba(255,255,255,0.055),rgba(124,58,237,0.11) 48%,rgba(255,255,255,0.025))',
          border: '1px solid rgba(168,85,247,0.34)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08),0 18px 70px rgba(0,0,0,0.28)',
        }}
      >
        <FieldGraphic />
        <div className="relative max-w-5xl">
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            World Cup <span className="text-grad">2026 Hub</span> <TrophyIcon className="inline h-7 w-7 align-[-4px]" />
          </h1>
          <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-white/64">
            Track every World Cup 2026 market before the crowd does — odds, smart money and nation-by-nation momentum in one dashboard.
          </p>
          <div
            className="mt-5 flex flex-wrap gap-2 rounded-2xl p-2"
            style={{ background: 'rgba(3,5,7,0.28)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <TinyButton active href="#pick-nation">🌐 Pick your nation</TinyButton>
            {selected && <TinyButton href="#team-focus">🎯 Team Focus</TinyButton>}
            <TinyButton href="#match-center">🏟 Match Center</TinyButton>
            <TinyButton href="#odds-race">📈 Odds Race</TinyButton>
            <TinyButton href="#smart-money">💸 Pro Holdings</TinyButton>
            <TinyButton href="#upset-radar">⚡ Upset Radar</TinyButton>
            <TinyButton href="#tournament-markets">🗂 Tournament Markets</TinyButton>
          </div>
        </div>
        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HeroMetric label="Winner mkt volume" value={metricMoney(winnerEvent?.volume)} />
          <HeroMetric label="24h volume" value={metricMoney(dayVolume)} />
          <HeroMetric label="Market favorite" value={favorite ? `${favorite.nation.code} ${favorite.nation.name}` : 'Loading'} nation={favorite?.nation} />
          <HeroMetric label="Implied odds" value={favorite ? impliedLabel(favorite.price) : '—'} />
        </div>
      </div>
    </section>
  );
}

function HeroMetric({ label, value, nation }: { label: string; value: string; nation?: Nation }) {
  return (
    <div className="min-h-[62px] rounded-xl px-3.5 py-3" style={{ background: 'rgba(3,5,7,0.42)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
      <p className="font-mono text-[9px] font-black uppercase tracking-widest text-white/42">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        {nation && <FlagImage nation={nation} className="h-5 w-5" />}
        <p className="truncate text-base font-black text-white/95">{value}</p>
      </div>
    </div>
  );
}

function NationPicker({
  winnerMarkets,
  selected,
  onSelect,
}: {
  winnerMarkets: WinnerMarket[];
  selected: string | null;
  onSelect: (name: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const visible = winnerMarkets
    .filter((item) => normalise(item.nation.name).includes(normalise(query)) || normalise(item.nation.code).includes(normalise(query)))
    .slice(0, 18);

  return (
    <section id="pick-nation" className="scroll-mt-28">
      <SectionLabel index="02" label="Pick your nation" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium text-white/56">Pick a nation to see <span className="font-bold text-white/82">only their markets</span> — odds, matches, futures and money flow.</p>
        <label className="flex w-full items-center gap-2 rounded-xl px-3 py-2 sm:w-64" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)' }}>
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search nation... (e.g. Türkiye)"
            className="w-full bg-transparent text-xs text-white/82 outline-none placeholder:text-white/38"
          />
        </label>
      </div>
      <div className="marquee-mask overflow-hidden">
        <div className="flex w-max gap-2 pr-10">
          <button
            onClick={() => onSelect(null)}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black transition"
            style={selected == null ? { background: 'var(--vi-bg)', border: '1px solid var(--vi-border-lg)', color: 'white' } : { background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.62)' }}
          >
            <span className="h-2 w-2 rounded-full bg-sky-300" /> All Nations
          </button>
          {visible.map(({ nation, price }) => {
            const isActive = selected === nation.name;
            return (
              <button
                key={nation.name}
                onClick={() => onSelect(isActive ? null : nation.name)}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold transition hover:text-white"
                style={isActive
                  ? { background: `linear-gradient(135deg,${nation.primary}2d,rgba(124,58,237,0.20))`, border: `1px solid ${nation.primary}82`, color: 'white' }
                  : { background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.70)' }}
              >
                <FlagImage nation={nation} className="h-4 w-4" />
                <span>{nation.name}</span>
                <span className="text-white/48">{impliedLabel(price)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SelectedNationPanel({ selected, winnerMarkets, markets }: { selected: string | null; winnerMarkets: WinnerMarket[]; markets: WcMarket[] }) {
  if (!selected) return null;
  const winner = winnerMarkets.find((item) => item.nation.name === selected);
  const nation = winner?.nation ?? nationByName(selected);
  if (!nation) return null;
  const teamMarkets = markets.slice(0, 8);

  return (
    <section id="team-focus" className="scroll-mt-28 rounded-2xl p-4" style={{ background: `linear-gradient(135deg,${nation.primary}14,rgba(255,255,255,0.025))`, border: `1px solid ${nation.primary}55` }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FlagImage nation={nation} className="h-9 w-9" />
          <div>
            <p className="text-sm font-black text-white/86">{nation.name} focus board</p>
            <p className="text-[11px] font-medium text-white/52">Team-specific odds, futures and related World Cup markets.</p>
          </div>
        </div>
        {winner && <span className="rounded-xl px-3 py-2 text-xs font-black text-violet-100" style={{ background: 'var(--vi-bg)', border: '1px solid var(--vi-border)' }}>{impliedLabel(winner.price)} title odds</span>}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <PriceChart market={winner?.market} title={`${nation.name} — Championship odds over time`} />
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="mb-3 font-mono text-[10px] font-black uppercase tracking-widest text-white/44">Markets for {nation.name}</div>
          <div className="flex flex-wrap gap-1.5">
            {teamMarkets.length ? teamMarkets.map((market) => <MarketChip key={market.id} market={market} />) : <span className="text-xs text-white/30">No extra markets found for this nation yet.</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

function marketForNation(markets: WcMarket[], nation: Nation): WcMarket | undefined {
  const needles = [nation.name, ...nation.aliases]
    .map(normalise)
    .filter(Boolean);
  return markets.find((market) => {
    if (!/win/i.test(market.question)) return false;
    const text = normalise(market.question);
    return needles.some((needle) => wordIncludes(text, needle));
  });
}

function outcomeRows(event: WcEvent, pair: Nation[]) {
  const [home, away] = pair;
  const homeMarket = marketForNation(event.markets, home);
  const awayMarket = marketForNation(event.markets, away);
  const drawMarket = event.markets.find((market) => /draw/i.test(market.question));
  return [
    { label: home.name, price: yesPrice(homeMarket), color: 'linear-gradient(90deg,rgba(124,58,237,0.75),rgba(168,85,247,0.82))' },
    { label: 'Draw', price: yesPrice(drawMarket), color: 'linear-gradient(90deg,rgba(255,255,255,0.18),rgba(255,255,255,0.28))' },
    { label: away.name, price: yesPrice(awayMarket), color: 'linear-gradient(90deg,rgba(14,165,233,0.62),rgba(34,211,238,0.72))' },
  ];
}

function PriceChart({ market, title }: { market?: WcMarket; title: string }) {
  const [interval, setInterval] = useState<'1d' | '1w' | '1m' | 'max'>('1d');
  const [history, setHistory] = useState<PriceHistory | null>(null);
  const tokenId = tokenIds(market)[0];

  useEffect(() => {
    if (!tokenId) {
      setHistory({ points: [] });
      return;
    }

    let cancelled = false;
    setHistory(null);
    fetch(`/api/liquidity/price-history?tokenId=${encodeURIComponent(tokenId)}&interval=${interval}`)
      .then((res) => res.json())
      .then((data: PriceHistory) => {
        if (!cancelled) setHistory(data);
      })
      .catch(() => {
        if (!cancelled) setHistory({ points: [] });
      });

    return () => { cancelled = true; };
  }, [tokenId, interval]);

  const points = (history?.points ?? []).slice(-180);
  const prices = points.map((pt) => pt.p).filter(Number.isFinite);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 1;
  const spread = Math.max(0.01, max - min);
  const chartMin = Math.max(0, min - spread * 0.18);
  const chartMax = Math.min(1, max + spread * 0.18);
  const range = Math.max(0.01, chartMax - chartMin);
  const coords = points.map((pt, index) => {
    const x = points.length <= 1 ? 48 : 48 + (index / (points.length - 1)) * 428;
    const y = 24 + (1 - (pt.p - chartMin) / range) * 120;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = coords.join(' ');
  const area = coords.length ? `48,154 ${line} 476,154` : '';
  const first = history?.first ?? points[0]?.p ?? null;
  const last = history?.last ?? points[points.length - 1]?.p ?? null;
  const changePp = first != null && last != null ? (last - first) * 100 : null;

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[10px] font-black uppercase tracking-widest text-white/30">
          {title}
          {changePp != null && (
            <span className={changePp >= 0 ? 'ml-2 text-emerald-300' : 'ml-2 text-rose-300'}>
              {changePp >= 0 ? '▲' : '▼'} {Math.abs(changePp).toFixed(1)}pp
            </span>
          )}
        </div>
        <div className="flex rounded-lg p-1" style={{ background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {(['1d', '1w', '1m', 'max'] as const).map((win) => (
            <button
              key={win}
              onClick={() => setInterval(win)}
              className="rounded-md px-2.5 py-1 text-[10px] font-black uppercase transition"
              style={interval === win ? { background: 'var(--vi-bg)', color: 'white' } : { color: 'rgba(255,255,255,0.38)' }}
            >
              {win}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-44 overflow-hidden rounded-xl" style={{ background: 'linear-gradient(180deg,rgba(124,58,237,0.07),rgba(255,255,255,0.015))' }}>
        {history == null ? (
          <div className="h-full animate-shimmer" />
        ) : points.length >= 2 ? (
          <svg viewBox="0 0 520 180" className="h-full w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`wc-chart-area-${market?.id ?? 'x'}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.34" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((row) => (
              <line key={row} x1="48" x2="476" y1={34 + row * 35} y2={34 + row * 35} stroke="rgba(255,255,255,0.055)" strokeWidth="1" />
            ))}
            <polygon points={area} fill={`url(#wc-chart-area-${market?.id ?? 'x'})`} />
            <polyline points={line} fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {[0, 0.5, 1].map((tick) => {
              const value = chartMax - tick * range;
              return <text key={tick} x="15" y={28 + tick * 120} fill="rgba(255,255,255,0.35)" fontSize="11">{Math.round(value * 100)}%</text>;
            })}
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-semibold text-white/30">
            Price history loading soon for this market.
          </div>
        )}
      </div>
    </div>
  );
}

function MarketChip({ market }: { market: WcMarket }) {
  const price = yesPrice(market);
  return (
    <a
      href={marketUrl(market.eventSlug, market.slug)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-white/48 transition hover:text-white/80"
      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span className="truncate">{cleanMarketLabel(market.groupItemTitle || market.question)}</span>
      {price > 0 && <span className="shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 text-white/65">{Math.round(price * 100)}¢</span>}
    </a>
  );
}

function DetailGroup({ title, markets }: { title: string; markets: WcMarket[] }) {
  if (!markets.length) return null;
  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/24">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {markets.slice(0, 8).map((market) => <MarketChip key={market.id} market={market} />)}
      </div>
    </div>
  );
}

function relatedEventsForMatch(event: WcEvent, allEvents: WcEvent[]): WcEvent[] {
  const base = event.slug.replace(/-(more-markets|exact-score)$/i, '');
  return allEvents.filter((candidate) => candidate.slug !== event.slug && candidate.slug.startsWith(base));
}

function detailMarketFor(event: WcEvent, pair: Nation[], selectedNation: Nation | undefined): WcMarket | undefined {
  if (selectedNation && pair.some((nation) => nation.name === selectedNation.name)) {
    return marketForNation(event.markets, selectedNation) ?? event.markets[0];
  }
  return marketForNation(event.markets, pair[0]) ?? event.markets[0];
}

function MatchDetails({ event, allEvents, selectedNation }: { event: WcEvent; allEvents: WcEvent[]; selectedNation?: Nation }) {
  const pair = nationsForEvent(event);
  const focusMarket = detailMarketFor(event, pair, selectedNation);
  const focusNation = selectedNation && pair.some((nation) => nation.name === selectedNation.name) ? selectedNation : pair[0];
  const related = relatedEventsForMatch(event, allEvents);
  const extraMarkets = related.flatMap((relatedEvent) => relatedEvent.markets);
  const moreMarkets = extraMarkets.filter((market) => !isCornerMarket(market) && !isPlayerProp(market) && !isPrimaryMatchMarket(market));
  const cornerMarkets = extraMarkets.filter(isCornerMarket);
  const propMarkets = extraMarkets.filter(isPlayerProp);
  const moneyMarkets = [...event.markets, ...extraMarkets]
    .filter((market) => (market.volume24hrNum ?? market.volumeNum ?? 0) > 0)
    .sort((a, b) => (b.volume24hrNum ?? b.volumeNum ?? 0) - (a.volume24hrNum ?? a.volumeNum ?? 0))
    .slice(0, 3);

  return (
    <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-4">
      <PriceChart market={focusMarket} title={`${focusNation?.name ?? 'Match'} to win — Championship odds over time`} />

      <div className="space-y-2">
        <div className="font-mono text-[10px] font-black uppercase tracking-widest text-white/24">More markets</div>
        <DetailGroup title="More Markets" markets={moreMarkets} />
        <DetailGroup title="Total Corners" markets={cornerMarkets} />
        <DetailGroup title="Player Props" markets={propMarkets} />
      </div>

      <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="mb-2 font-mono text-[10px] font-black uppercase tracking-widest text-white/24">Money on this match</div>
        <div className="space-y-2">
          {moneyMarkets.map((market) => (
            <a key={market.id} href={marketUrl(market.eventSlug, market.slug)} target="_blank" rel="noopener noreferrer" className="grid grid-cols-[42px_1fr_70px] items-center gap-2 rounded-lg px-2 py-2 text-[10px] transition hover:bg-white/[0.035]">
              <span className="rounded-md border border-rose-400/40 bg-rose-500/10 px-1.5 py-1 text-center font-black text-rose-200">{yesPrice(market) >= 0.5 ? 'BUY' : 'SELL'}</span>
              <span className="truncate text-white/48"><span className="rounded bg-violet-500/35 px-1 py-0.5 font-black text-violet-100">YES</span> {market.question}</span>
              <span className="text-right font-black text-white/78">{metricMoney(market.volume24hrNum ?? market.volumeNum)}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ event, allEvents, selected, expanded, onToggle }: { event: WcEvent; allEvents: WcEvent[]; selected: string | null; expanded: boolean; onToggle: () => void }) {
  const pair = nationsForEvent(event);
  if (pair.length < 2) return null;
  const [home, away] = pair;
  const rows = outcomeRows(event, pair);
  const selectedNation = selected ? nationByName(selected) : undefined;

  return (
    <article
      className="group rounded-2xl p-4 transition hover:-translate-y-0.5"
      style={expanded
        ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(168,85,247,0.85)', boxShadow: '0 0 0 1px rgba(168,85,247,0.10),0 16px 55px rgba(124,58,237,0.12)' }
        : { background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.10)' }}
    >
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sm font-black text-white/86">
            <FlagImage nation={home} className="h-6 w-6" />
            <span className="font-mono text-base">{home.code}</span>
            <span className="truncate">{home.name}</span>
            <span className="text-[10px] font-bold text-white/35">vs</span>
            <FlagImage nation={away} className="h-6 w-6" />
            <span className="font-mono text-base">{away.code}</span>
            <span className="truncate">{away.name}</span>
          </div>
          <span className="text-white/25 transition group-hover:text-white/55">{expanded ? '⌃' : '⌄'}</span>
        </div>
        <div className="space-y-2.5">
          {rows.map((row) => {
            const pct = row.price > 0 ? Math.max(1, Math.round(row.price * 100)) : 0;
            return (
              <div key={row.label} className="grid grid-cols-[88px_1fr_38px] items-center gap-2 text-[11px]">
                <span className="truncate font-semibold text-white/60">{row.label}</span>
                <div className="h-3 overflow-hidden rounded-full bg-white/[0.055] ring-1 ring-white/[0.035]">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: row.color }} />
                </div>
                <span className="text-right font-black text-white/76">{impliedLabel(row.price)}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between text-[10px] text-white/25">
          <span>{metricMoney(event.volume24hr)} 24h vol · {event.markets.length} markets</span>
          <span className="font-bold group-hover:text-white/50">{expanded ? 'Hide details ▲' : 'Match details ▼'}</span>
        </div>
      </button>

      {expanded && <MatchDetails event={event} allEvents={allEvents} selectedNation={selectedNation} />}
    </article>
  );
}

function MatchCenter({ events, selected }: { events: WcEvent[]; selected: string | null }) {
  const matchEvents = events
    .filter((event) => /^fifwc-/.test(event.slug) && !/more-markets|exact-score/i.test(event.slug) && nationsForEvent(event).length >= 2)
    .filter((event) => !selected || nationsForEvent(event).some((nation) => nation.name === selected))
    .slice(0, 8);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (matchEvents.length === 0) {
      setExpandedSlug(null);
      return;
    }
    setExpandedSlug((current) => current && matchEvents.some((event) => event.slug === current) ? current : matchEvents[0].slug);
  }, [selected, matchEvents.map((event) => event.slug).join('|')]);

  return (
    <section id="match-center" className="scroll-mt-28">
      <SectionLabel index="03" label="Match Center - Live & Upcoming" />
      {matchEvents.length === 0 ? (
        <div className="rounded-2xl p-5 text-sm text-white/38" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.10)' }}>
          No live match card for this nation yet. Futures and related markets are still shown below.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {matchEvents.map((event) => (
            <MatchCard
              key={event.id}
              event={event}
              allEvents={events}
              selected={selected}
              expanded={expandedSlug === event.slug}
              onToggle={() => setExpandedSlug(expandedSlug === event.slug ? null : event.slug)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function OddsRace({ winnerMarkets, selected }: { winnerMarkets: WinnerMarket[]; selected: string | null }) {
  const rows = (selected ? winnerMarkets.filter((item) => item.nation.name === selected) : winnerMarkets).slice(0, selected ? 4 : 12);
  const max = Math.max(0.02, ...rows.map((row) => row.price));

  return (
    <section id="odds-race" className="scroll-mt-28">
      <SectionLabel index="04" label="Championship Odds Race" />
      <div className="mb-3 flex flex-wrap gap-2">
        {winnerMarkets.slice(0, 2).map((item) => (
          <a
            key={item.market.id}
            href={marketUrl(item.market.eventSlug, item.market.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-black text-emerald-200"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)' }}
          >
            <FlagImage nation={item.nation} className="h-4 w-4" />
            {item.nation.code} {item.nation.name} <span className="text-emerald-300">▲ {impliedLabel(item.price)}</span>
          </a>
        ))}
      </div>
      <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.10)' }}>
        <div className="space-y-2">
          {rows.map((item, index) => {
            const width = Math.max(8, (item.price / max) * 100);
            return (
              <a
                key={item.market.id}
                href={marketUrl(item.market.eventSlug, item.market.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative grid min-h-[34px] grid-cols-[42px_1fr_96px_48px] items-center gap-2 overflow-hidden rounded-xl px-3 text-xs transition hover:bg-white/[0.04]"
              >
                <div className="absolute inset-y-0 left-0 rounded-xl bg-violet-500/16" style={{ width: `${width}%` }} />
                <div className="relative flex items-center gap-2 text-white/42">
                  <span className="w-4 text-center font-mono text-[10px] font-black">{index + 1}</span>
                  <FlagImage nation={item.nation} className="h-5 w-5" />
                </div>
                <div className="relative flex items-center gap-3 font-black text-white/82">
                  <span className="font-mono text-[11px]">{item.nation.code}</span>
                  <span>{item.nation.name}</span>
                </div>
                <div className="relative hidden text-right text-[10px] font-semibold text-white/25 sm:block">
                  {metricMoney(item.market.volume24hrNum)} 24h
                </div>
                <div className="relative text-right text-sm font-black text-violet-300">{impliedLabel(item.price)}</div>
              </a>
            );
          })}
        </div>
        <Link href="/markets" className="mt-3 flex h-8 items-center justify-center rounded-xl text-[11px] font-bold text-white/38 hover:text-white/70" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
          Show all World Cup markets
        </Link>
      </div>
    </section>
  );
}

function bestNationForMarket(market: WcMarket): Nation | undefined {
  return nationForWinnerQuestion(market.question) ?? findNation(`${market.question} ${market.eventTitle ?? ''} ${market.slug}`);
}

function FlowList({ markets }: { markets: WcMarket[] }) {
  return (
    <section id="smart-money" className="scroll-mt-28">
      <SectionLabel index="05" label="Pro Holdings - Smart Money" />
      <p className="mb-3 text-xs font-medium text-white/54">Open World Cup markets with strongest visible flow.</p>
      <div className="rounded-2xl p-2" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(168,85,247,0.55)' }}>
        {markets.slice(0, 7).map((market, index) => {
          const nation = bestNationForMarket(market);
          return (
            <a
              key={`${market.id}-${index}`}
              href={marketUrl(market.eventSlug, market.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="group grid grid-cols-[42px_1fr_88px] items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.05]"
              style={index === 0 ? { background: 'linear-gradient(90deg,rgba(251,191,36,0.10),transparent)' } : undefined}
            >
              {nation ? <FlagImage nation={nation} square className="h-9 w-9" /> : <SoccerBallIcon className="h-9 w-9" />}
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white/85">{market.question}</p>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-[10px] text-white/25">
                  <span className="rounded bg-violet-500/35 px-1.5 py-0.5 font-black text-violet-100">YES</span>
                  <span className="truncate">{market.eventTitle ?? market.slug}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="rounded-full px-2 py-1 text-[10px] font-black text-amber-200" style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.32)' }}>
                  live
                </span>
                <p className="mt-1 text-sm font-black text-white/82">{metricMoney(market.volume24hrNum)}</p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function UpsetRadar({ winnerMarkets }: { winnerMarkets: WinnerMarket[] }) {
  const longshots = winnerMarkets
    .filter((item) => item.price > 0 && item.price <= 0.08)
    .sort((a, b) => (b.market.volume24hrNum ?? 0) - (a.market.volume24hrNum ?? 0))
    .slice(0, 6);

  return (
    <section id="upset-radar" className="scroll-mt-28">
      <SectionLabel index="06" label="Upset Radar" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-widest text-white/28">
            ⚡ Longshot odds watch
          </div>
          <div className="space-y-3">
            {longshots.map((item) => (
              <a key={item.market.id} href={marketUrl(item.market.eventSlug, item.market.slug)} target="_blank" rel="noopener noreferrer" className="grid grid-cols-[46px_1fr_54px] items-center gap-3 text-xs">
                <span className="rounded-lg px-2 py-1 text-center font-mono font-black text-amber-200" style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.28)' }}>
                  {item.nation.code}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-black text-white/82">{item.nation.name} title</span>
                  <span className="block truncate text-[10px] text-white/25">World Cup Winner</span>
                </span>
                <span className="text-right font-black text-white/76">{impliedLabel(item.price)}</span>
              </a>
            ))}
          </div>
        </div>
        <div className="flex min-h-[190px] flex-col items-center justify-center rounded-2xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-widest text-white/28">
            🎯 Big money on longshots (&lt;35¢)
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-white/32">
            Whale longshot buys land here — usually right around kickoff. Keep an eye on the live money feed below.
          </p>
        </div>
      </div>
    </section>
  );
}

function TournamentMarkets({ events, selected }: { events: WcEvent[]; selected: string | null }) {
  const [tab, setTab] = useState<'matches' | 'futures'>('matches');
  const matches = events
    .filter((event) => /^fifwc-/.test(event.slug) && !/exact-score/i.test(event.slug))
    .filter((event) => !selected || nationsForEvent(event).some((nation) => nation.name === selected));
  const futures = events.filter((event) => !/^fifwc-/.test(event.slug));
  const shown = (tab === 'matches' ? matches : futures).slice(0, 9);

  return (
    <section id="tournament-markets" className="scroll-mt-28">
      <SectionLabel index="07" label="Tournament Markets" />
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setTab('matches')}
          className="rounded-xl px-3 py-2 text-[11px] font-black"
          style={tab === 'matches' ? { background: 'var(--vi-bg)', border: '1px solid var(--vi-border-lg)', color: 'white' } : { background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.45)' }}
        >
          Matches ({matches.length})
        </button>
        <button
          onClick={() => setTab('futures')}
          className="rounded-xl px-3 py-2 text-[11px] font-black"
          style={tab === 'futures' ? { background: 'var(--vi-bg)', border: '1px solid var(--vi-border-lg)', color: 'white' } : { background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.45)' }}
        >
          Futures ({futures.length})
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((event) => {
          const pair = nationsForEvent(event);
          return (
            <a key={event.id} href={marketUrl(event.slug, event.markets[0]?.slug)} target="_blank" rel="noopener noreferrer" className="group rounded-2xl p-4 transition hover:-translate-y-0.5" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <div className="mb-3 flex items-center gap-2">
                {pair[0] ? <FlagImage nation={pair[0]} square className="h-9 w-9" /> : <SoccerBallIcon className="h-9 w-9" />}
                {pair[1] && <FlagImage nation={pair[1]} square className="h-9 w-9 -ml-3 ring-2 ring-black/70" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white/82">{event.title}</p>
                  <p className="mt-0.5 text-[10px] text-white/27">{metricMoney(event.volume24hr)} 24h · {event.markets.length} markets</p>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.min(100, Math.max(12, (event.markets.length / 40) * 100))}%` }} />
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <SectionLabel index="01" label="World Cup 2026 - Special Coverage" />
      <div className="h-56 rounded-2xl animate-shimmer" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-36 rounded-2xl animate-shimmer" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />)}
      </div>
    </div>
  );
}

export default function WorldCupBoard() {
  const [events, setEvents] = useState<WcEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/world-cup')
      .then((res) => res.json())
      .then((data: ApiResponse) => setEvents(Array.isArray(data.events) ? data.events : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const winnerMarkets = useMemo<WinnerMarket[]>(() => {
    const winnerEvent = events.find((event) => event.slug === 'world-cup-winner') ?? events.find((event) => /world cup winner/i.test(event.title));
    return (winnerEvent?.markets ?? [])
      .map((market) => {
        const nation = nationForWinnerQuestion(market.question);
        const price = yesPrice(market);
        return nation && price > 0 ? { market, nation, price } : null;
      })
      .filter((item): item is WinnerMarket => Boolean(item))
      .sort((a, b) => b.price - a.price);
  }, [events]);

  const flowMarkets = useMemo(() => events
    .flatMap((event) => event.markets.map((market) => ({ ...market, eventSlug: market.eventSlug ?? event.slug, eventTitle: market.eventTitle ?? event.title })))
    .filter((market) => !selected || bestNationForMarket(market)?.name === selected || findNation(market.eventTitle ?? '')?.name === selected)
    .sort((a, b) => (b.volume24hrNum ?? 0) - (a.volume24hrNum ?? 0)), [events, selected]);

  useEffect(() => {
    if (loading || typeof window === 'undefined' || !window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const scroll = () => scrollToSection(id, 'auto');
    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(scroll));
    const timeout = window.setTimeout(scroll, 350);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [loading]);

  if (loading) return <LoadingState />;

  return (
    <div className="flex flex-col gap-9">
      <Hero events={events} winnerMarkets={winnerMarkets} selected={selected} />
      <NationPicker winnerMarkets={winnerMarkets} selected={selected} onSelect={setSelected} />
      <SelectedNationPanel selected={selected} winnerMarkets={winnerMarkets} markets={flowMarkets} />
      <MatchCenter events={events} selected={selected} />
      <OddsRace winnerMarkets={winnerMarkets} selected={selected} />
      <FlowList markets={flowMarkets} />
      <UpsetRadar winnerMarkets={winnerMarkets} />
      <TournamentMarkets events={events} selected={selected} />
    </div>
  );
}
