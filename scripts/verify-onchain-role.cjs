#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/* Bounded, read-only Polygon receipt probe. No keys, wallets, or writes. */
const { createLoader } = require('../tests/helpers/load-ts.cjs');
const load = createLoader();
const verifier = load('src/lib/onchainRoleVerification.ts');

const arg = name => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const rpc = arg('--rpc') || 'https://polygon-rpc.com';
const tx = arg('--tx');
const wallet = arg('--wallet');
const tokenId = arg('--token-id');
const side = arg('--side');
const size = arg('--size');
const validAddress = value => /^0x[0-9a-fA-F]{40}$/.test(value || '');
const validHash = value => /^0x[0-9a-fA-F]{64}$/.test(value || '');
const validDecimal = value => /^(0|[1-9][0-9]*)$/.test(value || '');
let rpcUrl;
try { rpcUrl = new URL(rpc); } catch { rpcUrl = null; }
const safeRpc = rpcUrl && rpcUrl.protocol === 'https:' && !rpcUrl.username && !rpcUrl.password && !rpcUrl.search && !rpcUrl.hash;
if (!tx || !wallet || !tokenId || !side || !size || !validHash(tx) || !validAddress(wallet) || !validDecimal(tokenId) || !validDecimal(size) || !['BUY', 'SELL'].includes(side) || !safeRpc) {
  console.error('usage: node scripts/verify-onchain-role.cjs --tx 0x... --wallet 0x... --token-id DECIMAL --side BUY|SELL --size DECIMAL [--rpc URL]');
  process.exitCode = 2;
} else {
  const call = async (method, params) => {
    const response = await fetch(rpc, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    if (!response.ok) throw new Error(`rpc-http-${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(`rpc-${body.error.code ?? 'error'}`);
    return body.result;
  };
  (async () => {
    const started = new Date().toISOString();
    const evidence = { started, transactionHash: tx, network: 'Polygon / chain 137', writeCount: 0 };
    try {
      const chainIdHex = await call('eth_chainId', []);
      evidence.chainId = Number(BigInt(chainIdHex));
      if (evidence.chainId !== verifier.POLYGON_CHAIN_ID) throw new Error('wrong-chain');
      const receipt = await call('eth_getTransactionReceipt', [tx]);
      if (!receipt) throw new Error('receipt-unavailable-or-pending');
      const result = verifier.verifyOnchainRole(receipt, { chainId: evidence.chainId, wallet, transactionHash: tx, tokenId, side, size });
      evidence.result = result;
      console.log(JSON.stringify(evidence, null, 2));
    } catch (error) {
      evidence.result = { status: 'unsupported', reason: String(error && error.message || error) };
      console.log(JSON.stringify(evidence, null, 2));
      process.exitCode = 0;
    }
  })();
}
