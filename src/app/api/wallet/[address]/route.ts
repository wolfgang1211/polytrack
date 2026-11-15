import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DataApiUnavailable, readWalletV2 } from '@/lib/dataApiV2';

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/wallet/[address]'>
) {
  const { address } = await ctx.params;
  const headers = { 'Cache-Control': 'no-store' };
  if (!/^0x[\da-f]{40}$/i.test(address)) {
    return NextResponse.json({ error: 'Enter a valid EVM wallet address.' }, { status: 400, headers });
  }

  try {
    return NextResponse.json(await readWalletV2(address), { headers });
  } catch (error) {
    // Never convert an unavailable/invalid upstream response to zero financial data.
    const retryAfter = error instanceof DataApiUnavailable ? error.retryAfter : undefined;
    return NextResponse.json(
      { error: 'Wallet data is temporarily unavailable. Please try again.' },
      { status: retryAfter ? 503 : 502, headers: { ...headers, ...(retryAfter ? { 'Retry-After': retryAfter } : {}) } },
    );
  }
}
