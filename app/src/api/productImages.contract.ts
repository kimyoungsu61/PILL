import { createProductImageLoader, type ProductImageResult } from './productImages';

const assert = { equal(actual: unknown, expected: unknown, message = 'Product image contract failed') {
  if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`);
} };

async function verify() {
  let calls = 0;
  let active = 0;
  let peak = 0;
  const release: Array<() => void> = [];
  const result: ProductImageResult = { status: 'FOUND', imageUri: 'https://cdn.shopify.com/product.jpg', sourceUrl: 'https://doctorsbest.com/products/product', checkedAt: '2026-10-20T02:00:00Z' };
  const load = createProductImageLoader(async () => {
    calls++; active++; peak = Math.max(peak, active);
    await new Promise<void>(resolve => release.push(resolve));
    active--;
    return result;
  });
  const morning = load('owner', 1, 'token');
  const evening = load('owner', 1, 'token');
  assert.equal(morning, evening, 'Repeated doses must share the same request');
  const other = load('owner', 2, 'token');
  const queued = load('owner', 3, 'token');
  await Promise.resolve();
  assert.equal(calls, 2, 'Background work must leave dose recording responsive');
  release.shift()!(); release.shift()!();
  await morning; await other;
  await Promise.resolve();
  release.shift()!(); await queued;
  assert.equal(peak, 2);
  assert.equal(await load('owner', 1, 'token'), result);
  assert.equal(calls, 3, 'Opening another screen must reuse a found photo');
  const anotherAccount = load('other-account', 1, 'other-token');
  await Promise.resolve(); release.shift()!(); await anotherAccount;
  assert.equal(calls, 4, 'Account changes must not reuse another account’s request');

  let failures = 0;
  const failing = createProductImageLoader(async () => { failures++; throw new Error('offline'); });
  await failing('owner', 4, 'token').catch(() => undefined);
  await failing('owner', 4, 'token').catch(() => undefined);
  assert.equal(failures, 1, 'Unavailable photos must not cause a request storm');
}
void verify();
