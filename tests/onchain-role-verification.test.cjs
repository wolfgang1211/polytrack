const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
const v = load('src/lib/onchainRoleVerification.ts');
const exchange = v.EXCHANGE_ADDRESSES.ctf;
const wallet = '0x' + '11'.repeat(20);
const other = '0x' + '22'.repeat(20);
const hash = n => '0x' + String(n).padStart(64, '0');
const word = n => BigInt(n).toString(16).padStart(64, '0');
const data = (side, token, makerAmount, takerAmount = makerAmount) => '0x' + [side, token, makerAmount, takerAmount, 0, 0, 0].map(word).join('');
const filled = (maker, taker, order, side = 0, token = 9, makerAmount = 100, takerAmount = makerAmount) => ({
  address: exchange,
  topics: [v.EVENT_TOPICS.orderFilled, hash(order), '0x' + maker.slice(2).padStart(64, '0'), '0x' + taker.slice(2).padStart(64, '0')],
  data: data(side, token, makerAmount, takerAmount), logIndex: '0x1',
});
const matched = (taker, order, side = 0, makerAmount = 100, takerAmount = makerAmount) => ({
  address: exchange,
  topics: [v.EVENT_TOPICS.ordersMatched, hash(order), '0x' + taker.slice(2).padStart(64, '0')],
  data: data(side, 9, makerAmount, takerAmount).slice(0, 2 + 4 * 64), logIndex: '0x3',
});
const receipt = logs => ({ transactionHash: hash(99), status: '0x1', blockNumber: '0x123', blockHash: hash(123), logs });
const req = (who, overrides = {}) => ({ chainId: 137, wallet: who, transactionHash: hash(99), tokenId: '9', side: 'BUY', size: '100', ...overrides });

test('GREEN: exact V2 maker event binds wallet, token, side, size, tx and block', () => {
  const result = v.verifyOnchainRole(receipt([filled(wallet, other, 1, 0, 9, 50, 100), filled(other, exchange, 2, 1, 9, 100, 50), matched(other, 2, 1, 100, 50)]), req(wallet));
  assert.equal(result.status, 'supported');
  assert.equal(result.role, 'maker');
  assert.equal(result.counterparty, other);
  assert.equal(result.exchange, exchange);
  assert.equal(result.blockHash, hash(123));
});

test('GREEN: exact V2 taker event uses OrdersMatched, not the synthetic exchange taker field', () => {
  // Events.sol emits both taker events from the SAME p.maker wallet.
  const result = v.verifyOnchainRole(receipt([filled(other, wallet, 1, 1, 9, 100, 50), filled(wallet, exchange, 2, 0, 9, 50, 100), matched(wallet, 2, 0, 50, 100)]), req(wallet));
  assert.equal(result.status, 'supported');
  assert.equal(result.role, 'taker');
  assert.equal(result.counterparty, other);
});

test('BUY size is takerAmount shares, not makerAmount collateral', () => {
  const r = receipt([filled(wallet, other, 1, 0, 9, 500, 100)]);
  assert.equal(v.verifyOnchainRole(r, req(wallet, { size: '100' })).status, 'supported');
  assert.equal(v.verifyOnchainRole(r, req(wallet, { size: '500' })).status, 'unsupported');
});

test('RED boundary retained: wrong chain, reverted, V1 exchange and multifill are unsupported', () => {
  assert.equal(v.verifyOnchainRole(receipt([]), req(wallet, { chainId: 1 })).reason, 'wrong-chain');
  assert.equal(v.verifyOnchainRole({ ...receipt([]), status: '0x0' }, req(wallet)).reason, 'receipt-pending-reverted-or-unbound');
  const v1 = { ...receipt([filled(wallet, other, 1)]), logs: [{ ...filled(wallet, other, 1), address: '0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e' }] };
  assert.equal(v.verifyOnchainRole(v1, req(wallet)).reason, 'no-supported-order-filled-event');
  assert.equal(v.verifyOnchainRole(receipt([filled(wallet, other, 1), filled(wallet, other, 2)]), req(wallet)).reason, 'ambiguous-multifill');
  assert.equal(v.verifyOnchainRole(receipt([filled(wallet, other, 1), filled(wallet, other, 1)]), req(wallet)).reason, 'duplicate-order-hash');
});

test('RED boundary retained: malformed identifiers, missing OrdersMatched and wrong size fail closed', () => {
  assert.equal(v.verifyOnchainRole(receipt([]), req('not-an-address')).reason, 'invalid-identifier-or-amount');
  assert.equal(v.verifyOnchainRole(receipt([filled(wallet, exchange, 1)]), req(wallet)).reason, 'taker-binding-missing');
  assert.equal(v.verifyOnchainRole(receipt([filled(wallet, other, 1)]), req(wallet, { size: '101' })).reason, 'token-side-size-or-wallet-not-bound');
  assert.equal(v.verifyOnchainRole(null, req(wallet)).reason, 'malformed-input');
  assert.equal(v.verifyOnchainRole({ ...receipt([]), transactionHash: null }, req(wallet)).reason, 'receipt-pending-reverted-or-unbound');
  const malformedTopic = { ...filled(wallet, other, 1), topics: [v.EVENT_TOPICS.orderFilled, hash(1), '0x' + '1'.repeat(64), '0x' + other.slice(2).padStart(64, '0')] };
  assert.equal(v.verifyOnchainRole(receipt([malformedTopic]), req(wallet)).reason, 'no-supported-order-filled-event');
});

test('contradictory paired events, noncanonical block quantities and numeric coercion are unsupported', () => {
  const valid = receipt([filled(wallet, other, 1)]);
  for (const blockNumber of ['banana', '0x', '0x01', '-1']) assert.equal(v.verifyOnchainRole({...valid,blockNumber},req(wallet)).status,'unsupported');
  assert.equal(v.verifyOnchainRole(valid,req(wallet,{size:100})).status,'unsupported');
  assert.equal(v.verifyOnchainRole(valid,req(wallet,{tokenId:9})).status,'unsupported');
  const contradictory = receipt([filled(other, wallet, 1, 1), filled(other, exchange, 2), matched(wallet, 2)]);
  assert.equal(v.verifyOnchainRole(contradictory,req(wallet)).status,'unsupported');
});
