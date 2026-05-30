export interface LeaderboardEntry {
  rank: string;
  proxyWallet: string;
  userName: string;
  xUsername: string;
  verifiedBadge: boolean;
  vol: number;
  pnl: number;
  profileImage: string;
}

export interface Position {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  totalBought: number;
  realizedPnl: number;
  percentRealizedPnl: number;
  curPrice: number;
  redeemable: boolean;
  mergeable: boolean;
  title: string;
  slug: string;
  icon?: string;
  eventId: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  oppositeOutcome: string;
  oppositeAsset: string;
  endDate?: string;
  negativeRisk: boolean;
}

export interface WalletData {
  positions: Position[];
  totalValue: number;
  truncated?: boolean;
}

export type TimeWindow = 'allTime' | '1d' | '1w' | '1m';
export type SortField = 'pnl' | 'vol' | 'rank';
export type SortOrder = 'asc' | 'desc';

export interface TopMarket {
  id: string;
  question: string;
  slug: string;
  eventSlug?: string;
  volume24hrNum?: number;
  volume24hr?: number | string;
  volumeNum?: number;
  liquidityNum?: number;
  outcomePrices?: string;
  outcomes?: string;
  image?: string;
  endDateIso?: string;
  endDate?: string;
}

export interface RecentTrade {
  id?: string;
  proxyWallet?: string;
  side?: string;
  outcome?: string;
  outcomeIndex?: number;
  title?: string;
  slug?: string;
  eventSlug?: string;
  asset?: string;
  icon?: string;
  size?: number;
  price?: number;
  usdcSize?: number;
  amount?: number;
  timestamp?: number;
  createdAt?: number;
}

export interface RisingTrader {
  rank: string;
  proxyWallet: string;
  userName?: string;
  xUsername?: string;
  pnl: number;
  vol: number;
}
