import { readWalletV2 } from '@/lib/dataApiV2';
import { positionPnl } from '@/lib/utils';

/** Uses exactly the wallet API's validated v2 lifecycle sample, never legacy
 * positions or a default balance. Propagates unavailable instead of a zero card. */
export async function readWalletShareStats(address: string) {
  const wallet = await readWalletV2(address);
  let totalPnl = 0;
  let wins = 0;
  let losses = 0;
  for (const position of wallet.positions) {
    const pnl = positionPnl(position);
    totalPnl += pnl;
    if (pnl > 0) wins++;
    else if (pnl < 0) losses++;
  }
  return {
    totalPnl, winRate: wins + losses ? wins / (wins + losses) * 100 : 0,
    positions: wallet.positions.length, openValue: wallet.totalValue, truncated: wallet.truncated === true,
  };
}
