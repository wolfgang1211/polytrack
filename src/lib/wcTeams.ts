/* World Cup 2026 team metadata: flags + name aliases.
   Team names come from Polymarket market titles (English), so we map
   every known spelling/alias to one canonical entry. */

interface TeamMeta {
  iso: string;            // ISO 3166-1 alpha-2 for flag emoji
  aliases: string[];      // all spellings that may appear in market titles
}

const TEAMS: Record<string, TeamMeta> = {
  'Argentina':            { iso: 'AR', aliases: ['argentina'] },
  'Brazil':               { iso: 'BR', aliases: ['brazil'] },
  'France':               { iso: 'FR', aliases: ['france'] },
  'England':              { iso: 'GB', aliases: ['england'] },
  'Spain':                { iso: 'ES', aliases: ['spain'] },
  'Germany':              { iso: 'DE', aliases: ['germany'] },
  'Portugal':             { iso: 'PT', aliases: ['portugal'] },
  'Netherlands':          { iso: 'NL', aliases: ['netherlands', 'holland'] },
  'Belgium':              { iso: 'BE', aliases: ['belgium'] },
  'Croatia':              { iso: 'HR', aliases: ['croatia'] },
  'Italy':                { iso: 'IT', aliases: ['italy'] },
  'Morocco':              { iso: 'MA', aliases: ['morocco'] },
  'Mexico':               { iso: 'MX', aliases: ['mexico'] },
  'USA':                  { iso: 'US', aliases: ['usa', 'united states', 'us '] },
  'Canada':               { iso: 'CA', aliases: ['canada'] },
  'Japan':                { iso: 'JP', aliases: ['japan'] },
  'South Korea':          { iso: 'KR', aliases: ['south korea', 'korea republic', 'korea'] },
  'Australia':            { iso: 'AU', aliases: ['australia'] },
  'Iran':                 { iso: 'IR', aliases: ['iran'] },
  'Saudi Arabia':         { iso: 'SA', aliases: ['saudi arabia'] },
  'Qatar':                { iso: 'QA', aliases: ['qatar'] },
  'Uzbekistan':           { iso: 'UZ', aliases: ['uzbekistan'] },
  'Jordan':               { iso: 'JO', aliases: ['jordan'] },
  'Iraq':                 { iso: 'IQ', aliases: ['iraq'] },
  'Ecuador':              { iso: 'EC', aliases: ['ecuador'] },
  'Uruguay':              { iso: 'UY', aliases: ['uruguay'] },
  'Colombia':             { iso: 'CO', aliases: ['colombia'] },
  'Paraguay':             { iso: 'PY', aliases: ['paraguay'] },
  'Panama':               { iso: 'PA', aliases: ['panama'] },
  'Curacao':              { iso: 'CW', aliases: ['curacao', 'curaçao'] },
  'Haiti':                { iso: 'HT', aliases: ['haiti'] },
  'Cape Verde':           { iso: 'CV', aliases: ['cape verde'] },
  'Ivory Coast':          { iso: 'CI', aliases: ['ivory coast', "cote d'ivoire", 'côte d’ivoire'] },
  'Senegal':              { iso: 'SN', aliases: ['senegal'] },
  'Ghana':                { iso: 'GH', aliases: ['ghana'] },
  'Tunisia':              { iso: 'TN', aliases: ['tunisia'] },
  'Algeria':              { iso: 'DZ', aliases: ['algeria'] },
  'Egypt':                { iso: 'EG', aliases: ['egypt'] },
  'South Africa':         { iso: 'ZA', aliases: ['south africa'] },
  'Norway':               { iso: 'NO', aliases: ['norway'] },
  'Sweden':               { iso: 'SE', aliases: ['sweden'] },
  'Denmark':              { iso: 'DK', aliases: ['denmark'] },
  'Scotland':             { iso: 'GB', aliases: ['scotland'] },
  'Wales':                { iso: 'GB', aliases: ['wales'] },
  'Ireland':              { iso: 'IE', aliases: ['ireland', 'republic of ireland'] },
  'Austria':              { iso: 'AT', aliases: ['austria'] },
  'Switzerland':          { iso: 'CH', aliases: ['switzerland'] },
  'Czechia':              { iso: 'CZ', aliases: ['czechia', 'czech republic'] },
  'Poland':               { iso: 'PL', aliases: ['poland'] },
  'Ukraine':              { iso: 'UA', aliases: ['ukraine'] },
  'Türkiye':              { iso: 'TR', aliases: ['türkiye', 'turkiye', 'turkey'] },
  'Bosnia-Herzegovina':   { iso: 'BA', aliases: ['bosnia-herzegovina', 'bosnia and herzegovina', 'bosnia'] },
  'Serbia':               { iso: 'RS', aliases: ['serbia'] },
  'Slovenia':             { iso: 'SI', aliases: ['slovenia'] },
  'Slovakia':             { iso: 'SK', aliases: ['slovakia'] },
  'Romania':              { iso: 'RO', aliases: ['romania'] },
  'Hungary':              { iso: 'HU', aliases: ['hungary'] },
  'Greece':               { iso: 'GR', aliases: ['greece'] },
  'Albania':              { iso: 'AL', aliases: ['albania'] },
  'North Macedonia':      { iso: 'MK', aliases: ['north macedonia', 'macedonia'] },
  'Kosovo':               { iso: 'XK', aliases: ['kosovo'] },
  'New Zealand':          { iso: 'NZ', aliases: ['new zealand'] },
  'New Caledonia':        { iso: 'NC', aliases: ['new caledonia'] },
  'Honduras':             { iso: 'HN', aliases: ['honduras'] },
  'Costa Rica':           { iso: 'CR', aliases: ['costa rica'] },
  'Jamaica':              { iso: 'JM', aliases: ['jamaica'] },
  'Venezuela':            { iso: 'VE', aliases: ['venezuela'] },
  'Bolivia':              { iso: 'BO', aliases: ['bolivia'] },
  'Chile':                { iso: 'CL', aliases: ['chile'] },
  'Peru':                 { iso: 'PE', aliases: ['peru'] },
  'Nigeria':              { iso: 'NG', aliases: ['nigeria'] },
  'Cameroon':             { iso: 'CM', aliases: ['cameroon'] },
  'DR Congo':             { iso: 'CD', aliases: ['dr congo', 'congo dr', 'democratic republic of the congo'] },
  'Gabon':                { iso: 'GA', aliases: ['gabon'] },
  'Burkina Faso':         { iso: 'BF', aliases: ['burkina faso'] },
  'Mali':                 { iso: 'ML', aliases: ['mali'] },
  'UAE':                  { iso: 'AE', aliases: ['uae', 'united arab emirates'] },
  'Oman':                 { iso: 'OM', aliases: ['oman'] },
  'Indonesia':            { iso: 'ID', aliases: ['indonesia'] },
  'China':                { iso: 'CN', aliases: ['china'] },
};

/** ISO 3166-1 alpha-2 → flag emoji (regional indicator symbols). */
export function flagFromIso(iso: string): string {
  if (iso === 'XK') return '🇽🇰';
  if (!/^[A-Z]{2}$/.test(iso)) return '⚽';
  return String.fromCodePoint(...[...iso].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Resolve a market-title team name to its canonical entry. */
export function resolveTeam(name: string): { canonical: string; iso: string; flag: string } | null {
  const n = name.trim().toLowerCase();
  for (const [canonical, meta] of Object.entries(TEAMS)) {
    if (canonical.toLowerCase() === n || meta.aliases.some(a => a === n)) {
      return { canonical, iso: meta.iso, flag: flagFromIso(meta.iso) };
    }
  }
  return null;
}

/** Flag for a raw team name; ⚽ when unknown (e.g. "Team AM" playoff placeholders). */
export function teamFlag(name: string): string {
  return resolveTeam(name)?.flag ?? '⚽';
}

/* ── nation colors (merged from Hermes's WorldCupBoard) ── */

export interface TeamColors { primary: string; secondary: string }

const TEAM_COLORS: Record<string, TeamColors> = {
  'Spain':              { primary: '#ef4444', secondary: '#facc15' },
  'France':             { primary: '#2563eb', secondary: '#ef4444' },
  'Portugal':           { primary: '#16a34a', secondary: '#dc2626' },
  'England':            { primary: '#e2e8f0', secondary: '#ef4444' },
  'Argentina':          { primary: '#38bdf8', secondary: '#e2e8f0' },
  'Brazil':             { primary: '#22c55e', secondary: '#facc15' },
  'Germany':            { primary: '#facc15', secondary: '#ef4444' },
  'Netherlands':        { primary: '#f97316', secondary: '#2563eb' },
  'Norway':             { primary: '#dc2626', secondary: '#2563eb' },
  'Belgium':            { primary: '#facc15', secondary: '#ef4444' },
  'Colombia':           { primary: '#facc15', secondary: '#2563eb' },
  'Mexico':             { primary: '#16a34a', secondary: '#ef4444' },
  'South Africa':       { primary: '#16a34a', secondary: '#facc15' },
  'Czechia':            { primary: '#2563eb', secondary: '#ef4444' },
  'South Korea':        { primary: '#e2e8f0', secondary: '#2563eb' },
  'USA':                { primary: '#2563eb', secondary: '#ef4444' },
  'Paraguay':           { primary: '#ef4444', secondary: '#2563eb' },
  'Canada':             { primary: '#ef4444', secondary: '#e2e8f0' },
  'Bosnia-Herzegovina': { primary: '#2563eb', secondary: '#facc15' },
  'Japan':              { primary: '#e2e8f0', secondary: '#ef4444' },
  'Curacao':            { primary: '#2563eb', secondary: '#facc15' },
  'Morocco':            { primary: '#dc2626', secondary: '#16a34a' },
  'Haiti':              { primary: '#2563eb', secondary: '#ef4444' },
  'Scotland':           { primary: '#38bdf8', secondary: '#e2e8f0' },
  'Ecuador':            { primary: '#facc15', secondary: '#2563eb' },
  'Ivory Coast':        { primary: '#f97316', secondary: '#22c55e' },
  'Switzerland':        { primary: '#ef4444', secondary: '#e2e8f0' },
  'Uruguay':            { primary: '#38bdf8', secondary: '#e2e8f0' },
  'Croatia':            { primary: '#ef4444', secondary: '#2563eb' },
  'Denmark':            { primary: '#dc2626', secondary: '#e2e8f0' },
  'Serbia':             { primary: '#ef4444', secondary: '#2563eb' },
  'Sweden':             { primary: '#2563eb', secondary: '#facc15' },
  'Poland':             { primary: '#e2e8f0', secondary: '#dc2626' },
  'Italy':              { primary: '#16a34a', secondary: '#ef4444' },
  'Türkiye':            { primary: '#dc2626', secondary: '#e2e8f0' },
  'Qatar':              { primary: '#9f1239', secondary: '#e2e8f0' },
  'Australia':          { primary: '#2563eb', secondary: '#facc15' },
  'Saudi Arabia':       { primary: '#16a34a', secondary: '#e2e8f0' },
  'Iran':               { primary: '#16a34a', secondary: '#ef4444' },
  'Ghana':              { primary: '#facc15', secondary: '#16a34a' },
  'Nigeria':            { primary: '#16a34a', secondary: '#e2e8f0' },
};

const DEFAULT_COLORS: TeamColors = { primary: '#a855f7', secondary: '#38bdf8' };

/** National kit colors for a team name; AlphaBoard purple/blue when unknown. */
export function teamColors(name: string): TeamColors {
  const r = resolveTeam(name);
  return (r && TEAM_COLORS[r.canonical]) ?? DEFAULT_COLORS;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Does free text (market/event/trade title) mention the given team?
    Uses word-boundary matching so e.g. "USA" doesn't match "thousand". */
export function textMentionsTeam(text: string | undefined, teamName: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase().replace(/-/g, ' ');
  const meta = resolveTeam(teamName);
  const aliases = meta
    ? [meta.canonical.toLowerCase(), ...TEAMS[meta.canonical].aliases]
    : [teamName.toLowerCase()];
  return aliases.some(a => {
    const alias = a.trim().replace(/-/g, ' ');
    return new RegExp(`(^|[^a-z])${escapeRe(alias)}([^a-z]|$)`, 'i').test(t);
  });
}
