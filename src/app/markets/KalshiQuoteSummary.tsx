/* Shared, synchronous quote-quality summary (no hooks, no client directive, no interactive children) so it can sit
   inside an existing market link and render identically on the server and in client lists. */
import {
  SMALL_DISPLAYED_SIZE_CONTRACTS, WIDE_SPREAD_CENTS, analyzeKalshiQuotes, formatSpreadCents,
  type KalshiQuoteInput, type KalshiQuoteWarning,
} from '@/lib/kalshiQuoteQuality';

const DISCLAIMER =
  `Spread and sizes use the displayed top of book only, not full depth. A spread of ${WIDE_SPREAD_CENTS}¢ or more is flagged wide; `
  + `a displayed size under ${SMALL_DISPLAYED_SIZE_CONTRACTS} contracts on either side is flagged small. These thresholds are `
  + 'AlphaBoard display heuristics, not Kalshi rules. Quote freshness is unknown; this is not an execution quote.';

const WARNING_LABEL: Record<KalshiQuoteWarning, string> = {
  crossed: 'Crossed quote snapshot',
  no_quotes: 'No usable quotes',
  one_sided: 'One-sided quote',
  wide_spread: 'Wide spread',
  small_displayed_size: 'Small displayed size',
};

/** Exact source quantity with en-US grouping; never compact-rounded (43296.01 stays 43,296.01). */
function contracts(n: number | null): string {
  if (n === null) return 'Unavailable';
  const s = String(n);
  // Exponent form (<1e-6 or >=1e21) is kept verbatim: rounding could turn a tiny positive size into "0".
  if (/e/i.test(s)) return `${s} contracts`;
  const [int, frac] = s.split('.');
  return `${Number(int).toLocaleString('en-US')}${frac ? `.${frac}` : ''} contracts`;
}

/** Visible policy text for touch users (title/sr-only are not visible there). Render ONCE per surface, outside links. */
export function KalshiQuotePolicyNote({ className = '' }: { className?: string }) {
  return (
    <p data-quote-policy="" className={`text-xs text-ink/55 ${className}`}>
      Quote flags: wide spread = {WIDE_SPREAD_CENTS}¢ or more; small displayed size = under {SMALL_DISPLAYED_SIZE_CONTRACTS} contracts
      on a displayed side. These are AlphaBoard UI heuristics, not Kalshi rules. Sizes are displayed levels, not full depth;
      quote freshness is unknown.
    </p>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-ink/55">{label}</span>{' '}
      <span className={`font-semibold ${value === 'Unavailable' ? 'text-ink/55' : 'text-ink/70'}`}>{value}</span>
    </span>
  );
}

export default function KalshiQuoteSummary({ yesBid, yesAsk, yesBidSize, yesAskSize, partial = false, source = 'market', className = '' }:
  KalshiQuoteInput & { partial?: boolean; source?: 'market' | 'book'; className?: string }) {
  const q = analyzeKalshiQuotes({ yesBid, yesAsk, yesBidSize, yesAskSize });
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${className}`}
      data-quote-status={q.status} data-quote-warnings={q.warnings.join(' ')} data-quote-source={source}
      data-quote-partial={partial ? 'true' : undefined} title={DISCLAIMER}>
      <span className="sr-only">{DISCLAIMER}</span>
      <span className="uppercase tracking-wider text-ink/55">{source === 'book' ? 'Order book top' : 'Listed quote'}</span>
      <Value label="Spread" value={formatSpreadCents(q.spreadCents)} />
      <Value label="Bid size" value={contracts(q.bidSize)} />
      <Value label="Ask size" value={contracts(q.askSize)} />
      {q.warnings.map(w => (
        <span key={w} className="rounded-full px-1.5 py-0.5 font-semibold text-amber-400"
          style={{ background: 'rgba(var(--ink-rgb),0.05)', border: '1px solid rgba(var(--ink-rgb),0.1)' }}>
          {WARNING_LABEL[w]}
        </span>
      ))}
      {partial && (
        <span className="basis-full text-rose-400">
          Partial book — summary uses observed levels only; the true best quote cannot be confirmed.
        </span>
      )}
    </div>
  );
}
