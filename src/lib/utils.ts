export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// True lifetime P&L for a position. Polymarket's data-api reports `cashPnl`
// as the UNREALIZED mark-to-market of currently-held shares only (so a
// redeemed winner reads as -costBasis), while `realizedPnl` holds the profit
// already taken from sells. Total = realized + unrealized. Using cashPnl alone
// makes active traders / market-makers look like they lose almost everything.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function positionPnl(p: { cashPnl?: number; realizedPnl?: number; currentValue?: number; curPrice?: number } | any): number {
  const realized = Number(p?.realizedPnl) || 0;
  const cash = Number(p?.cashPnl) || 0;
  // Only include unrealized cashPnl while the position is OPEN. For closed/
  // redeemed positions the data-api reports cashPnl as -costBasis, which would
  // double-count the loss on top of realizedPnl.
  const isOpen = (Number(p?.currentValue) || 0) > 0;
  return realized + (isOpen ? cash : 0);
}

export function formatAddress(address: string, chars = 6): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-4)}`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function pnlColor(value: number): string {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-zinc-400';
}

export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

export function rankBadge(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export const CATEGORY_PATTERNS: [string, RegExp][] = [
  ['Crypto',        /bitcoin|btc|eth(?:ereum)?|crypto|solana|sol\b|doge|token|defi|nft|web3|blockchain|binance|xrp|avax|chainlink|usdc|stablecoin/i],
  ['Politics',      /trump|biden|harris|election|president|congress|senate|democrat|republican|ballot|vote|poll|minister|prime\s+minister|parliament|white\s+house|nato|geopolit|campaign/i],
  ['Sports',        /nfl|nba|nhl|mlb|soccer|football|basketball|baseball|tennis|golf|champion(?:ship)?|super\s+bowl|world\s+cup|fifa|league|playoff|ufc|mma|boxing|formula\s*1|f1\b|olympics|spurs|thunder|lakers|celtics|warriors|heat|bulls|knicks|nuggets|mavericks|bucks|sixers|hawks|rockets|vs\.|win\s+the\s+game/i],
  ['Entertainment', /oscar|grammy|emmy|movie|film|show|tv\b|music|celebrity|award|actor|actress|box\s+office|netflix|album|billboard|spotify/i],
  ['Tech',          /\bai\b|gpt|openai|spacex|nasa|rocket|apple|google|microsoft|meta\b|amazon|tesla|nvidia|startup|ipo|antitrust/i],
  ['World',         /war|conflict|ceasefire|sanction|nato|invasion|russia|ukraine|israel|china|taiwan|climate|hurricane|earthquake/i],
];

export function detectCategory(title: string): string {
  for (const [cat, re] of CATEGORY_PATTERNS) {
    if (re.test(title)) return cat;
  }
  return 'Other';
}

const API_CAT_MAP: Record<string, string> = {
  crypto: 'Crypto', cryptocurrency: 'Crypto', defi: 'Crypto', web3: 'Crypto',
  politics: 'Politics', political: 'Politics', elections: 'Politics', government: 'Politics',
  sports: 'Sports', sport: 'Sports',
  tech: 'Tech', technology: 'Tech', science: 'Tech',
  entertainment: 'Entertainment', 'pop culture': 'Entertainment', music: 'Entertainment',
  world: 'World', global: 'World', news: 'World',
};

export function resolveCategory(apiCategory: string | undefined, title: string): string {
  if (apiCategory) {
    const norm = apiCategory.toLowerCase().trim();
    if (API_CAT_MAP[norm]) return API_CAT_MAP[norm];
    for (const [alias, cat] of Object.entries(API_CAT_MAP)) {
      if (norm.includes(alias)) return cat;
    }
  }
  return detectCategory(title);
}

/** Risk-adjusted "Smart Score" (0–100) computed relative to a dataset.
 *  Blends P&L efficiency (ROI = pnl/vol) with absolute P&L magnitude via
 *  percentile ranking, so a consistent earner outranks a lucky high-volume punt. */
export function computeSmartScores<T extends { pnl: number; vol: number }>(
  rows: T[]
): Map<T, number> {
  const result = new Map<T, number>();
  if (rows.length === 0) return result;

  const roi = (r: T) => (r.vol > 0 ? r.pnl / r.vol : 0);
  const percentile = (sortedVals: number[], v: number) => {
    if (sortedVals.length <= 1) return 1;
    let lo = 0;
    for (let i = 0; i < sortedVals.length; i++) if (sortedVals[i] < v) lo = i + 1;
    return lo / (sortedVals.length - 1);
  };

  const roiVals = rows.map(roi).sort((a, b) => a - b);
  const pnlVals = rows.map(r => r.pnl).sort((a, b) => a - b);

  for (const r of rows) {
    const roiP = percentile(roiVals, roi(r));
    const pnlP = percentile(pnlVals, r.pnl);
    const score = Math.round((0.6 * roiP + 0.4 * pnlP) * 100);
    result.set(r, Math.max(0, Math.min(100, score)));
  }
  return result;
}

export function scoreTier(score: number): { label: string; color: string; badge: string } {
  if (score >= 85) return { label: 'Elite',  color: '#fbbf24', badge: '🔥' };
  if (score >= 65) return { label: 'Sharp',  color: '#34d399', badge: '⚡' };
  if (score >= 40) return { label: 'Solid',  color: '#38bdf8', badge: '•' };
  return { label: 'Risky', color: '#fb7185', badge: '•' };
}
